

//var SOUND_URL = '/sound/n127.mp3';
//var SOUND_URL2 = '/sound/Moonlight.mp3';

var SupportedAudioContext;
try {
    SupportedAudioContext = window.AudioContext || window.webkitAudioContext;
} catch(e) {
    throw new Error('Web Audio API is not supported.');
}
var context;


var source;
var ctrls;

function play(targets){
    if(!targets || targets.length === 0){
        return;
    }
    if(!context){
        context = new SupportedAudioContext();
    }
    
    ctrls = new Array();
    
    var dffs = new Array();
    
    $.each(targets, function(i, target){
       
        var url = '/sound/' + target + '.mp3';

        
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
        request.send();
        
        
        var d = new $.Deferred;
        request.onload = function () {
            // contextにArrayBufferを渡し、decodeさせる
            context.decodeAudioData(request.response, function (buf) {
//                buffer = buf;
                ctrls.push(createSource(buf));
                d.resolve();
            });
        };
        
        dffs.push(d);
    });
        
    
    $.when.apply($, dffs).then(function(){
        
        $.each(ctrls, function(i, ctrl){
            
            ctrl.source.connect(context.destination);
            ctrl.source.start(0);
        });
    });
    
    

};


function createSource(buffer) {
    var source = context.createBufferSource();
    var gainNode = context.createGain ? context.createGain() : context.createGainNode();
    source.buffer = buffer;
    // Turn on looping
    source.loop = true;
    // Connect source to gain.
    source.connect(gainNode);
    // Connect gain to destination.
    gainNode.connect(context.destination);

    return {
      source: source,
      gainNode: gainNode
    };
  }

function stop(){
    $.each(ctrls, function(i, ctrl){
        ctrl.source.stop();
    });
}


function rec(category){
   console.log("rec") 
}




function test01(){
    t1_indi = new VolumeIndicator(ctrls[0].source, document.getElementById("t1_indi"));
    t1_indi.start();
}
function test02(){
    window.m = new Mixer();
    window.m.loadAudioBuffer("0", "v1");
    window.m.loadAudioBuffer("1", "g1");
}


//---------------------------------------------
// Mixer
//
class Mixer{
    constructor(){
        this.tracks = [];
        this.context = new window.AudioContext();
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.context.destination);
        this._startTime = 0;
        this._offsetTime = 0
        this._playing = false;
    }
    get offset(){
        if(this.playing){
            return this.context.currentTime - this._startTime + this._offsetTime; 
        }else{
            return this._offsetTime;
        }
    }
    get playing(){
        return this._playing;
    }
    play(){
        var _startTime = this.context.currentTime + 1;
        var offsetTime = this._offsetTime;
        this.tracks.forEach((track)=>track.start(_startTime, offsetTime));
        this._startTime = _startTime;
        this._playing = true;
    }
    pause(){
        this.tracks.forEach((track)=>track.stop());
        this._offsetTime = this.context.currentTime - this._startTime;
        this._playing = false;
    }
    stop(){
        this.tracks.forEach((track)=>track.stop());
        this._offsetTime = 0;
        this._playing = false;
    }

    addTrack(id, buf) {

        var track = new Track(id, this, buf);
        track.output.connect(this.gainNode);
        this.tracks.push(track);
        return track;
    }
    loadAudioBuffer(id, target){
        var self = this;
        var url = '/sound/' + target + '.mp3';
        
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
        request.send();
        
        
        var d = new $.Deferred;
        request.onload = function () {
            console.log(self);
            // contextにArrayBufferを渡し、decodeさせる
            self.context.decodeAudioData(request.response, function (buf) {
//                buffer = buf;
                d.resolve(self.addTrack(id, buf));
            });
        };
        return d;
    }
    
}

class Track{
    constructor(id, mixer, buffer){
        var self = this;
        this.id = id;
        this.mixer = mixer;
        var context = this.context = mixer.context;
        this.buffer = buffer;
        var gainNode = this.gainNode = context.createGain();

        this.enabled = false;
        this.elToggle = document.getElementById("track"+id+"_toggle");
        this.elToggle.addEventListener('change', (e)=>{
            var v= e.target.value;
            self.enabled = !!v;
            if (mixer.playing) {
                if (self.enabled) {
                    self.start(0, mixer.offset)
                }else{
                    self.stop();
                }
            }
        });
        this.elVol = document.getElementById("track"+id+"_vol");
        gainNode.gain.value = this.elVol.value/100;
        this.elVol.addEventListener('change', (e)=>{
            var v= e.target.value;
            gainNode.gain.value = v/100;
        });

        this.volumeDb = new VolumeIndicator(this.gainNode, document.getElementById("track" + id + "_vol_indi"));
        this.volumeDb.start();
        
    }
    start(when, offset){
        if(!this.enabled) return;
        if(this.source) this.stop();
        var source = this.source = this.context.createBufferSource();
        source.buffer = this.buffer;
        source.connect(this.input);
        source.start(when, offset);
    }
    stop(){
        if(!this.source) return;
        this.source.stop();
        this.source = null;
    }

    get input(){
        return this.gainNode;
    }
    get output(){
        return this.gainNode;
    }

}

//---------------------------------------------
// for volume indicator
class VolumeIndicator{
    constructor(inputPoint, canvas){
        this.analyzer
        this.canvas = canvas;
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.analyserContext = canvas.getContext('2d');
        this.rafID = null;
        this.analyserNode = inputPoint.context.createAnalyser();
        this.analyserNode.fftSize = 32;
        inputPoint.connect(this.analyserNode);

        this.volume = 0;
    }
    start() {
        if (!this.rafID){
            this.rafID = window.requestAnimationFrame(this._draw.bind(this));
        }
    }
    stop() {
        if (this.rafID) {
            window.cancelAnimationFrame(rafID);
            rafID = null;
        }
    }
    _draw(time){


        var freqByteData = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteFrequencyData(freqByteData); 
        var sum = freqByteData.reduce((a, b) => a + b, 0);
        this.volume = sum / freqByteData.length/255*100;

        this.analyserContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.analyserContext.fillStyle = '#F6D565';
        this.analyserContext.lineCap = 'round';
        this.analyserContext.fillStyle = "hsl( " + Math.round(this.volume/100*360) + ", 100%, 50%)";
        this.analyserContext.fillRect(0, this.canvasHeight, this.canvasWidth, -this.volume/100*this.canvasHeight);

        window.requestAnimationFrame(this._draw.bind(this));
    }
}




//--------------------------------------------
// for REC
function cancelAnalyserUpdates() {
    window.cancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    if (!analyserContext) {
        var canvas = document.getElementById("analyser");
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        analyserContext = canvas.getContext('2d');
    }

    // analyzer draw code here
    {
        var SPACING = 3;
        var BAR_WIDTH = 1;
        var numBars = Math.round(canvasWidth / SPACING);
        var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

        analyserNode.getByteFrequencyData(freqByteData); 

        analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
        analyserContext.fillStyle = '#F6D565';
        analyserContext.lineCap = 'round';
        var multiplier = analyserNode.frequencyBinCount / numBars;

        // Draw rectangle for each frequency bin.
        for (var i = 0; i < numBars; ++i) {
            var magnitude = 0;
            var offset = Math.floor( i * multiplier );
            // gotta sum/average the block, or we miss narrow-bandwidth spikes
            for (var j = 0; j< multiplier; j++)
                magnitude += freqByteData[offset + j];
            magnitude = magnitude / multiplier;
            var magnitude2 = freqByteData[i * multiplier];
            analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
            analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
        }
    }
    
    rafID = window.requestAnimationFrame( updateAnalysers );
}

function toggleMono() {
    if (audioInput != realAudioInput) {
        audioInput.disconnect();
        realAudioInput.disconnect();
        audioInput = realAudioInput;
    } else {
        realAudioInput.disconnect();
        audioInput = convertToMono( realAudioInput );
    }

    audioInput.connect(inputPoint);
}

function gotStream(stream) {
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

//    audioInput = convertToMono( input );

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect( analyserNode );

    audioRecorder = new Recorder( inputPoint );

    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect( zeroGain );
    zeroGain.connect( audioContext.destination );
    updateAnalysers();
}

function initAudio() {
        if (!navigator.getUserMedia)
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!navigator.cancelAnimationFrame)
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
        if (!navigator.requestAnimationFrame)
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}