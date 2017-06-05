

var SOUND_URL = '/sound/n127.mp3';
var SOUND_URL2 = '/sound/Moonlight.mp3';

var SupportedAudioContext;
try {
    SupportedAudioContext = window.AudioContext || window.webkitAudioContext;
} catch(e) {
    throw new Error('Web Audio API is not supported.');
}
var context = new SupportedAudioContext();

var buffer;
(function  () {
    var request = new XMLHttpRequest();
    request.open('GET', SOUND_URL, true);
    request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
    request.send();
    request.onload = function () {
        // contextにArrayBufferを渡し、decodeさせる
        context.decodeAudioData(request.response, function (buf) {
            buffer = buf;
        });
    };
})();






$('#test1').on('click', function (e) {
    e.preventDefault();

    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    
    source.start(0);
});



var source;
function play(targets){
    if(!targets || targets.length === 0){
        return;
    }
    
    var url = '/sound/' + targets[0] + '.mp3';
    
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
    request.send();
    request.onload = function () {
        // contextにArrayBufferを渡し、decodeさせる
        context.decodeAudioData(request.response, function (buf) {
            buffer = buf;
        });
    };
    
    source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    
    source.start(0);
    
}


function stop(){
    source.stop();
}


function rec(category){
    
}


