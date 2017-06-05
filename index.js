

//var SOUND_URL = '/sound/n127.mp3';
//var SOUND_URL2 = '/sound/Moonlight.mp3';

var SupportedAudioContext;
try {
    SupportedAudioContext = window.AudioContext || window.webkitAudioContext;
} catch(e) {
    throw new Error('Web Audio API is not supported.');
}
var context = new SupportedAudioContext();


var source;
var ctrls;

function play(targets){
    if(!targets || targets.length === 0){
        return;
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
    
}


