

//var SOUND_URL = '/sound/n127.mp3';
//var SOUND_URL2 = '/sound/Moonlight.mp3';

var SupportedAudioContext;
try {
    SupportedAudioContext = window.AudioContext || window.webkitAudioContext;
} catch (e) {
    throw new Error('Web Audio API is not supported.');
}
var context;


var source;
var ctrls;

function play(targets) {
    if (!targets || targets.length === 0) {
        return;
    }
    if (!context) {
        context = new SupportedAudioContext();
    }

    ctrls = new Array();

    var dffs = new Array();

    $.each(targets, function (i, target) {

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


    $.when.apply($, dffs).then(function () {

        $.each(ctrls, function (i, ctrl) {

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

function stop() {
    $.each(ctrls, function (i, ctrl) {
        ctrl.source.stop();
    });
}


function rec(category) {
    console.log("rec")
}




function test01() {
    t1_indi = new VolumeIndicator(ctrls[0].source, document.getEementById("t1_indi"));
    t1_indi.start();
}
function test02() {
    var m = window.m = new Mixer();
    m.loadAudioBuffer("0", "v1");
    m.loadAudioBuffer("1", "g1");
    window.r = new RecordDeck(m);
    window.metro = new Metronome(m);
}


//---------------------------------------------
// Mixer
//
class Mixer {
    constructor() {
        this.musicTitle = "MARCH OF KOALA";
        this.tracks = [];
        this.context = new window.AudioContext();
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.context.destination);
        this._startTime = 0;
        this._offsetTime = 0
        this._playing = false;
        var self = this;

        this.metronome = new Metronome(this);
        this.recorddeck = new RecordDeck(this);

        //init LCD
        this.lcd = new CanvasLCD('06');
        this.lcd.init('mixer_lcd', this.musicTitle, true);

        //dom event
        $("#main_vol").on("change", (e) => {
            var v = e.target.value;
            self.gainNode.gain.value = v / 100;
        });
        $("#main_play").on("click", (e) => {
            self.play();
        });
        $("#main_pause").on("click", (e) => {
            self.pause();
        });
        $("#main_stop").on("click", (e) => {
            self.stop();
        });
        $("#main_rec").on("click", (e) => {
            self.rec();
        });
    }
    get offset() {
        if (this.playing) {
            if (this.context.currentTime - this._startTime < 0) {
                return this._offsetTime;
            } else {
                return this.context.currentTime - this._startTime + this._offsetTime;
            }
        } else {
            return this._offsetTime;
        }
    }
    get playing() {
        return this._playing;
    }
    play(startTime) {
        if (this.playing) return;
        var _startTime = startTime;
        if (_startTime === undefined) {
            _startTime = this.context.currentTime + 1;
        }
        var offsetTime = this._offsetTime;
        this.tracks.forEach((track) => track.start(_startTime, offsetTime));
        this._startTime = _startTime;
        this._playing = true;
        this._startLCD();
    }
    pause() {
        this.tracks.forEach((track) => track.stop());
        this._offsetTime = this.offset;
        this._playing = false;
        this._stopLCD();
    }
    stop() {
        this.tracks.forEach((track) => track.stop());
        this._offsetTime = 0;
        this._playing = false;
        this._drawLCD();
        this._stopLCD();
    }
    rec() {
        var self = this;
        if (this.playing) return;
        this._offsetTime = 0;
        this.recorddeck.open();
    }

    _startLCD() {
        this._lcd_rafId = window.requestAnimationFrame(this._drawLCD.bind(this));
    }
    _drawLCD() {
        var offset = this.offset;
        if (offset >= 0) {
            var sei = Math.floor(this.offset * 100);
            var sec = Math.floor(sei / 100);
            var deci = sei % 100;
            var fff = "                                    " + sec + "." + ("00" + deci).slice(-2);
            var dispoffset = fff.slice(this.musicTitle.length - 36 + 1);
            this.lcd.write2Display("letters", this.musicTitle + " " + dispoffset);
        }
        this._lcd_rafId = window.requestAnimationFrame(this._drawLCD.bind(this));
    }
    _stopLCD() {
        if (this._lcd_rafId) {
            window.cancelAnimationFrame(this._lcd_rafId)
        }
    }
    addTrack(id, buf) {
        if (id === undefined) {
            id = this.tracks.length;
        }
        var track = new Track(id, this, buf);
        track.output.connect(this.gainNode);
        this.tracks.push(track);
        return track;
    }
    loadAudioBuffer(id, target) {
        var self = this;
        var url = '/sound/' + target + '.mp3';

        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
        request.send();


        var d = new $.Deferred;
        request.onload = function () {
            console.log(self);
            // オーディオデータが取得できた場合、contextにArrayBufferを渡し、decodeさせる
            if (this.status === 200) {
                self.context.decodeAudioData(request.response, function (buf) {
                    //                buffer = buf;
                    d.resolve(self.addTrack(id, buf));
                });
            }
        };
        return d;
    }

}

class Track {
    constructor(id, mixer, buffer) {
        var self = this;
        this.id = id;
        this.mixer = mixer;
        var context = this.context = mixer.context;
        this.buffer = buffer;
        var gainNode = this.gainNode = context.createGain();

        this.enabled = false;

        this.$el = $(".track" + id);
        this.elToggle = document.getElementById("track" + id + "_toggle");
        this.elToggle.addEventListener('change', (e) => {
            var v = e.target.value;
            self.enabled = !!v;
            if (mixer.playing) {
                if (self.enabled) {
                    self.start(0, mixer.offset)
                } else {
                    self.stop();
                }
            }
        });
        this.elVol = document.getElementById("track" + id + "_vol");
        gainNode.gain.value = this.elVol.value / 100;
        this.elVol.addEventListener('change', (e) => {
            var v = e.target.value;
            gainNode.gain.value = v / 100;
        });

        this.volumeDb = new VolumeIndicator(this.gainNode, document.getElementById("track" + id + "_vol_indi"));
        this.volumeDb.start();

        this.$heart = this.$el.find(".heart");
        this.$heart.on("click", (e) => {
            console.log("cloned!!!!!");
            var cloneTrack = self.mixer.addTrack(undefined, self.buffer);
            cloneTrack.$el.find(".name").innerText = self.$el.find(".name").innerText;
        });

    }
    start(when, offset) {
        if (!this.enabled) return;
        if (this.source) this.stop();
        var source = this.source = this.context.createBufferSource();
        source.buffer = this.buffer;
        source.connect(this.input);
        source.start(when, offset);
    }
    stop() {
        if (!this.source) return;
        this.source.stop();
        this.source = null;
    }

    get input() {
        return this.gainNode;
    }
    get output() {
        return this.gainNode;
    }

}

//---------------------------------------------
// for volume indicator
class VolumeIndicator {
    constructor(inputPoint, canvas) {
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
        if (!this.rafID) {
            this.rafID = window.requestAnimationFrame(this._draw.bind(this));
        }
    }
    stop() {
        if (this.rafID) {
            window.cancelAnimationFrame(this.rafID);
            this.rafID = null;
        }
    }
    _draw(time) {


        var freqByteData = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteFrequencyData(freqByteData);
        var sum = freqByteData.reduce((a, b) => a + b, 0);
        this.volume = sum / freqByteData.length / 255 * 100;

        this.analyserContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.analyserContext.fillStyle = '#F6D565';
        this.analyserContext.lineCap = 'round';
        this.analyserContext.fillStyle = "hsl( " + Math.round(this.volume / 100 * 360) + ", 100%, 50%)";
        this.analyserContext.fillRect(0, this.canvasHeight, this.canvasWidth, -this.volume / 100 * this.canvasHeight);

        window.requestAnimationFrame(this._draw.bind(this));
    }
}




//--------------------------------------------
// for REC

class RecordDeck {

    constructor(mixer) {
        this.mixer = mixer;
        this.audioContext = mixer.context;
        this.resizeAnalyzer();
        var canvas = document.getElementById("rec_analyser");
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.analyserContext = canvas.getContext('2d');
        this.initAudio();

        this.$modal = $("#rec_modal").modal({
            ready: this.ready.bind(this),
            complete: this.complete.bind(this)
        });

        window.onorientationchange = this.resizeAnalyzer.bind(this);
        window.onresize = this.resizeAnalyzer.bind(this);
    }
    ready() {
        console.log("ready");
        this.resizeAnalyzer();
        this.record();
    }
    complete() {
        var self = this;
        this.mixer.metronome.play();
        console.log("complete");
        this.mixer.stop();
        this.stop();
        this.audioRecorder.getBuffer((buf) => {
            console.log(buf);
            var trimIndex = Math.round(self.trimOffset * self.audioContext.sampleRate);
            var ab = self.audioContext.createBuffer(2, buf[0].length - trimIndex, self.audioContext.sampleRate);
            console.log(ab);
            for (var channel = 0; channel < 2; channel++) {
                // 実際のデータの配列を得る
                var nowBuffering = ab.getChannelData(channel);
                for (var i = 0; i < nowBuffering.length; i++) {
                    // Math.random()は[0; 1.0]である
                    // 音声は[-1.0; 1.0]である必要がある
                    nowBuffering[i] = buf[channel][trimIndex + i];
                }
            }
            self.mixer.tracks[0].buffer = ab;
        });
    }
    open() {
        this.$modal.modal("open");
    }
    close() {
        this.$modal.modal("close");
    }
    record() {
        var self = this;
        this.audioRecorder.clear();
        this.audioRecorder.record();
        this._precountTime = this.audioContext.currentTime;
        var current = this.mixer.context.currentTime;
        $(this.mixer.metronome).off("tick");
        var measures = 0
        $(this.mixer.metronome).on("tick", function (evt, data) {
            console.log(data);
            if (data.beat === 0) {
                measures += 1;
            }
            if (measures === 2 && !self.mixer.playing) {
                console.log("play start");
                self.mixer.play(data.time);
                self.trimOffset = data.time - self._precountTime;
            }
        });
        this.mixer.metronome.play();
    }
    stop() {
        this.audioRecorder.stop();
    }
    resizeAnalyzer() {
        var canvas = document.getElementById("rec_analyser");
        var wrapper = canvas.parentElement;
        $(canvas).attr('width', $(wrapper).width());
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;

    }
    cancelAnalyserUpdates() {
        window.cancelAnimationFrame(rafID);
        this.rafID = null;
    }

    updateAnalysers(time) {

        // analyzer draw code here
        {
            var SPACING = 3;
            var BAR_WIDTH = 1;
            var numBars = Math.round(this.canvasWidth / SPACING);
            var freqByteData = new Uint8Array(this.analyserNode.frequencyBinCount);

            this.analyserNode.getByteFrequencyData(freqByteData);

            this.analyserContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.analyserContext.fillStyle = '#F6D565';
            this.analyserContext.lineCap = 'round';
            var multiplier = this.analyserNode.frequencyBinCount / numBars;
            var rate = this.canvasHeight / 255;
            // Draw rectangle for each frequency bin.
            for (var i = 0; i < numBars; ++i) {
                var magnitude = 0;
                var offset = Math.floor(i * multiplier);
                // gotta sum/average the block, or we miss narrow-bandwidth spikes
                for (var j = 0; j < multiplier; j++)
                    magnitude += freqByteData[offset + j];
                magnitude = magnitude / multiplier * rate;
                var magnitude2 = freqByteData[i * multiplier];
                this.analyserContext.fillStyle = "hsl( " + Math.round((i * 360) / numBars) + ", 100%, 50%)";
                this.analyserContext.fillRect(i * SPACING, this.canvasHeight, BAR_WIDTH, -magnitude);
            }
        }

        this.rafID = window.requestAnimationFrame(this.updateAnalysers.bind(this));
    }


    gotStream(stream) {
        var inputPoint = this.audioContext.createGain();

        // Create an AudioNode from the stream.
        var realAudioInput = this.audioContext.createMediaStreamSource(stream);
        var audioInput = realAudioInput;
        audioInput.connect(inputPoint);


        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 2048;
        inputPoint.connect(this.analyserNode);

        this.audioRecorder = new Recorder(inputPoint);

        var zeroGain = this.audioContext.createGain();
        zeroGain.gain.value = 0.0;
        inputPoint.connect(zeroGain);
        zeroGain.connect(this.audioContext.destination);
        this.updateAnalysers();
    }

    initAudio() {
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
            }, this.gotStream.bind(this), (e) => {
                alert(
`Error getting UserMedia audio stream.
If no mic is plugged, plug a mic then reload page.`);
                console.log(e);
            });
    }

}



//------------------------------
// metronome

class Metronome {
    constructor(mixer) {
        this.context = mixer.context;
        this.isPlaying = false;      // Are we currently playing?
        this.startTime;              // The start time of the entire sequence.
        this.current16thNote;        // What note is currently last scheduled?
        this.tempo = 120.0;          // tempo (in beats per minute)
        this.lookahead = 25.0;       // How frequently to call scheduling function 
        //(in milliseconds)
        this.scheduleAheadTime = 0.1;    // How far ahead to schedule audio (sec)
        // This is calculated from lookahead, and overlaps 
        // with next interval (in case the timer is late)
        this.nextNoteTime = 0.0;     // when the next note is due.
        this.noteResolution = 2;     // 0 == 16th, 1 == 8th, 2 == quarter note
        this.noteLength = 0.05;      // length of "beep" (in seconds)
        this.last16thNoteDrawn = -1; // the last "box" we drew on the screen
        this.notesInQueue = [];      // the notes that have been put into the web audio,
        // and may or may not have played yet. {note, time}
        this.timerWorker = null;     // The Web Worker used to fire timer messages

        this.timerWorker = new Worker("metronomeworker.js");
        var self = this;
        this.timerWorker.onmessage = function (e) {
            if (e.data == "tick") {
                // console.log("tick!");
                self.scheduler();
            }
            else
                console.log("message: " + e.data);
        };
        this.timerWorker.postMessage({ "interval": this.lookahead });
    }
    nextNote() {
        // Advance current note and time by a 16th note...
        var secondsPerBeat = 60.0 / this.tempo;    // Notice this picks up the CURRENT 
        // tempo value to calculate beat length.
        this.nextNoteTime += 0.25 * secondsPerBeat;    // Add beat length to last beat time

        this.current16thNote++;    // Advance the beat number, wrap to zero
        if (this.current16thNote == 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // push the note on the queue, even if we're not playing.
        this.notesInQueue.push({ note: beatNumber, time: time });

        if ((this.noteResolution == 1) && (beatNumber % 2))
            return; // we're not playing non-8th 16th notes
        if ((this.noteResolution == 2) && (beatNumber % 4))
            return; // we're not playing non-quarter 8th notes

        // create an oscillator
        var osc = this.context.createOscillator();
        osc.connect(this.context.destination);
        if (beatNumber % 16 === 0)    // beat 0 == high pitch
            osc.frequency.value = 880.0;
        else if (beatNumber % 4 === 0)    // quarter notes = medium pitch
            osc.frequency.value = 440.0;
        else                        // other 16th notes = low pitch
            osc.frequency.value = 220.0;

        osc.start(time);
        osc.stop(time + this.noteLength);
        $(this).trigger("tick", { beat: beatNumber % 16, time: time });
    }

    scheduler() {
        // while there are notes that will need to play before the next interval, 
        // schedule them and advance the pointer.
        while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
    }

    play() {
        this.isPlaying = !this.isPlaying;

        if (this.isPlaying) { // start playing
            this.current16thNote = 0;
            this.nextNoteTime = this.context.currentTime;
            this.timerWorker.postMessage("start");
            return "stop";
        } else {
            this.timerWorker.postMessage("stop");
            return "play";
        }
    }

}
