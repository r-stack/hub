

var SOUND_URL = '/sound/n127.mp3';
var SOUND_URL2 = '/sound/Moonlight.mp3';

var SupportedAudioContext;
try {
    SupportedAudioContext = window.AudioContext || window.webkitAudioContext;
} catch(e) {
    throw new Error('Web Audio API is not supported.');
}
var context = new SupportedAudioContext();


var source;
function play(targets){
    if(!targets || targets.length === 0){
        return;
    }
    
    var url = '/sound/' + targets[0] + '.mp3';
    
    var buffer;
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
    request.send();
    
    var d = new $.Deferred;
    request.onload = function () {
        // contextにArrayBufferを渡し、decodeさせる
        context.decodeAudioData(request.response, function (buf) {
            buffer = buf;
            d.resolve();
        });
    };
    
    d.promise().done(function(){
        source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        
        source.start(0);
        
    });
    
}


function stop(){
    source.stop();
}


function rec(category){
    
}


