

// Media API
if (!navigator.getUserMedia)
    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
if (!navigator.cancelAnimationFrame)
    navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
if (!navigator.requestAnimationFrame)
    navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;


if (!window.AudioContext){
    window.AudioContext = window.webkitAudioContext;
}

/**
 * Applicationのベースクラス
 * 機能
 * - pushStateによるSPA画面遷移
 */
class App{
    constructor(){
        this.handlers = [];
        this.$page = {};
        this.$current = null;

        if (typeof window !== 'undefined') {
            this.location = window.location;
            this.history = window.history;
        }
    }
    start(){
        //popstate
        window.addEventListener("popstate", this.__checkUrl.bind(this), false); 
        this.loadUrl(this.location.pathname);
    }

    stop(){
        window.removeEventListener("popstate", this.__checkUrl.bind(this), false)
    }

    navigate(fragment, options){
        options = options||{};
        if(options.replace){
            this.history.replaceState({}, document.title, fragment);
        }else{
            this.history.pushState({}, document.title, fragment);
        }
        this.loadUrl(fragment);
    }
    loadUrl(fragment){
        this.handlers.some(handle=>{
            if(handle.route.test(fragment)){
                handle.callback.apply(this, fragment.match(handle.route));
                return true;
            }
        });
    }

    route(pattern, callback){
        this.handlers.push({route:pattern, callback:callback});
    }

    showPage(name, options){
        if(this.$current) this.$current.hide();
        this.$current = this.$page[name];
        this.$current.show();
        return this.$current;
    }

    __checkUrl(evt){
        console.log("__checkUrl: %o", evt, this.location.pathname);
        const current = this.location.pathname;
        this.loadUrl(current);
    }
}
class HubApp extends App{

    constructor(){
        super();
        this.$el = $("main");
        //AuthView
        this.auth = new AuthView();
        //LCD
        //init LCD
        this.lcd = new CanvasLCD('06');
        this.lcd.init('mixer_lcd', "SPACE", false);

        //init pages
        this.$page["home"] = this.$el.find("#page01_home").hide();
        this.$page["listrooms"] = this.$el.find("#page02_listrooms").hide();
        this.$page["playroom"] = this.$el.find("#page03_playroom").hide();

        //init mixer
        this.mixer = new Mixer(this);

        this.init();
        this.render();
    }

    init(){
        //initialize router settings
        this.route(/^\/$/, this.home);
        this.route(/^\/playrooms\/$/, this.listrooms);
        this.route(/^\/playrooms\/(\S+)$/, this.playroom);

    }

    /**
     * rendering global level components.
     * - auth
     * - lcd
     * - menu
     */
    render(){

        this.auth.render();
        return this;        
    }


    home(){
        console.log("home");
        const self = this;
        // init application message
        this.lcd.init('mixer_lcd', "LET'S PLAY.", true);

        //show home page
        this.showPage("home");

        setTimeout(function(){
            self.navigate("/playrooms/");
        }, 6000);
    }
    listrooms(){
        console.log("PAGE: PLAYROOM LIST", arguments);
        const self = this;

        //clear page
        const $roomscontainer = $(".playrooms-container").empty();
        firebase.database().ref("/playrooms").once("value", snapshot=>{
            const playrooms = snapshot.val();
            console.log("search playrooms ", playrooms);
            for(let roomId in playrooms){
                $("#tmpl-playroom-card")
                    .tmpl({id:roomId, playroom:playrooms[roomId]})
                    .appendTo($roomscontainer);
            }
            //dom event for transition
            $roomscontainer.off("click");
            $roomscontainer.on("click", "a.btnToRoom", evt=>{
                self.navigate("/playrooms/" + $(evt.currentTarget).attr("data-roomid"));
            });
        });

        //show listrooms page
        this.showPage("listrooms");
    }
    playroom(path, id){
        const self = this;
        console.log("PAGE: PLAYROOM DETAIL", arguments);
        console.log(this);
        this.mixer.load(id).done(()=>self.showPage('playroom'));
    }

}

class AuthView {
    constructor() {
        this.$el = $(".main_auth");
        this.auth = firebase.auth();
        console.log(this.auth);
        this.init();
    }

    init(){
        const self = this;

        this.$el.on("click", "#main_signin", function(){
            console.log("start login process");
            self.login();
        });
        this.$el.on("click", "#username", function(){
            console.log("start logout process");
            self.logout();
        });

        this.auth.onAuthStateChanged(function (user) {
            self.user = user;
            self.update();
            if (user) {
                console.log("User is signed in.");
            } else {
                console.log("No user is signed in.");
            }
            self.updateData();
        });
        return this;
    }
    
    render(){
        this.update();
        return this;
    }
    update(){
        if(this.auth.currentUser){
            this.$el.find("#main_signin").hide();
            this.$el.find("#username").attr("src", this.auth.currentUser.photoURL).show();
        }else{
            this.$el.find("#main_signin").show();
            this.$el.find("#username").attr("src", "").hide();
        }
        return this
    }

    updateData(){
        let user = this.user;
        let ref = firebase.database().ref("/users/" + user.uid).transaction(current=>{
            if(!current){
                current = {
                    level: 1
                };
            }
            current.photoURL = user.photoURL;
            current.displayName = user.displayName;
            current.email = user.email;

            if(user.email && !user.displayName){
                current.displayName = user.email.replace(/@.+$/ ,"")
            }
            return current;
        }).then(resolved=>{
            console.log("/users/" + user.uid + " is saved", resolved.snapshot.val());
        });
    }
    login() {
        const self = this;
        const provider = new firebase.auth.GithubAuthProvider();
        firebase.auth().signInWithPopup(provider).then(function (result) {
            // This gives you a GitHub Access Token. You can use it to access the GitHub API.
            const token = result.credential.accessToken;
            // The signed-in user info.
            const user = result.user;
            self.user = user;
        }).catch(function (error) {
            // Handle Errors here.
            const errorCode = error.code;
            const errorMessage = error.message;
            // The email of the user's account used.
            const email = error.email;
            // The firebase.auth.AuthCredential type that was used.
            const credential = error.credential;
            alert("Login Failed.");
        });
    }
    logout(){
        this.auth.signOut().then(function () {
            console.log('Sign-out successful.');
            
        }, function (error) {
            console.log('Sign-out with An error happened');
        });
    }

}


//---------------------------------------------
// Mixer
//
/**
 * Mixer
 */
class Mixer {
    constructor(app) {
        this.$el = $("#page03_playroom");
        this.app = app || window.app;
        this.musicTitle = "MARCH OF KOALA";
        this.tracks = {};
        this.context = new window.AudioContext();
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.context.destination);
        this._startTime = 0;
        this._offsetTime = 0
        this._playing = false;
        const self = this;

        this.metronome = new Metronome(this);
        this.recorddeck = new RecordDeck(this);

        //init LCD
        this.lcd = this.app.lcd;

        //dom event for global nav
        $("#main_vol").on("change", (e) => {
            const v = e.target.value;
            self.gainNode.gain.value = v / 100;
        });
        this.$btnPlay = $("#main_play").on("click", (e) => {
            self.play();
        });
        this.$btnPause = $("#main_pause").on("click", (e) => {
            self.pause();
        }).hide();
        this.$btnStop = $("#main_stop").on("click", (e) => {
            self.stop();
        }).addClass("disabled");

        //dom event for instrument
        this.$el.on("click", ".track_add", function(evt){
            console.log("track_add", evt.currentTarget);
            self.createNewTrack($(evt.currentTarget).attr("data-instrument"));
        });
        //firebase event
        firebase.auth().onAuthStateChanged(this.update.bind(this));
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

    /*r
     * 既存のロード済みトラックを破棄して新しくPlayroomを構築します。
     */
    load(playroomId){
        console.log("Mixer.load");
        const id = playroomId;
        const d = $.Deferred();
        let self = this;

        
        this.lcd.write2Display("lettersRL01", "LOADING.....");
        firebase.database().ref("/playrooms/"+id).once("value", snap=>{
            let playroom = snap.val();
            //show playroom page
            if(this.playing) this.stop();
            // clear tracks
            for (let tkey in this.tracks){
                delete this.tracks["tkey"];
            }
            console.log("tracks clean???",this.tracks);
            this.playroomId = id;
            this.playroom = playroom;
            this.musicTitle = playroom.title;
            this.metronome.tempo = playroom.tempo;

            //clear playroom page content
            this.$el.empty();
            //render music info and instruments
            $("#tmpl-playroom").tmpl(this.playroom).appendTo(this.$el);
            //TODO: activate
            firebase.database().ref("/tracks/" + id).once("value", snap_tracks=>{
                console.log("value: /tracks/" + id);
                let tracks = self._tracks = snap_tracks.val();
                console.log(tracks);
                let resolves = [];
                for(let key in tracks){
                    resolves.push(self.loadAudioBuffer(key, tracks[key]));
                }


                $.when.apply($, resolves).done(res=>{
                    self.lcd.clearDisplay();
                    self.lcd.write2Display("letters", playroom.title);
                    d.resolve();
                }).fail(res=>{
                    d.resolve();
                });
                
            });
        });
        return d;
    }

    update(){
        console.log("Mixer.update()");
        if(firebase.auth().currentUser){
            this.$el.find(".track_add").show();
        }else{
            this.$el.find(".track_add").hide();
        }
    }

    play(startTime) {
        if (this.playing) return;
        let _startTime = startTime;
        if (_startTime === undefined) {
            _startTime = this.context.currentTime + 0.1;
        }
        const offsetTime = this._offsetTime;
        $.each(this.tracks, (key, track) => track.start(_startTime, offsetTime));
        this._startTime = _startTime;
        this._playing = true;
        this._startLCD();

        this.$btnPlay.hide();
        this.$btnPause.show();
        this.$btnStop.removeClass("disabled");
    }
    pause() {
        $.each(this.tracks, (key, track) => track.stop());
        this._offsetTime = this.offset;
        this._playing = false;
        this._stopLCD();
        
        this.$btnPlay.show();
        this.$btnPause.hide();
        this.$btnStop.addClass("disabled");
    }
    stop() {
        $.each(this.tracks, (key, track) => track.stop());
        this._offsetTime = 0;
        this._playing = false;
        // this._drawLCD();
        // this._stopLCD();

        if(this.recording_track){
            this.recorddeck.stop();
        }
        
        this.$btnPlay.show();
        this.$btnPause.hide();
        this.$btnStop.addClass("disabled");
    }
    rec(track_id) {
        const self = this;
        if (this.playing) return;
        this._offsetTime = 0;
        this.recording_track = track_id;
        this.recorddeck.open();
        
        this.$btnPlay.hide();
        this.$btnPause.show();
        this.$btnStop.removeClass("disabled");
    }
    /**
     * レコーディング完了時にコールバックされる 
     * @param {AudioBuffer} buffer 
     * @param {Blob} WAV形式のBLOB 
     */
    completeRecording(buffer, wavBlob){
        if(this.recording_track){
            let track = this.tracks[this.recording_track];
            track.saveSound(buffer, wavBlob);
            delete this.recording_track;
        }
    }
    cancelRecording(){
        delete this.recording_track;
    }

    _startLCD() {
        this._lcd_rafId = window.requestAnimationFrame(this._drawLCD.bind(this));
    }
    _drawLCD() {
        const offset = this.offset;
        if (offset >= 0) {
            const sei = Math.floor(this.offset * 100);
            const sec = Math.floor(sei / 100);
            const deci = sei % 100;
            const fff = "                                    " + sec + "." + ("00" + deci).slice(-2);
            const dispoffset = fff.slice(this.musicTitle.length - 36 + 1);
            this.lcd.write2Display("letters", this.musicTitle + " " + dispoffset);
        }
        if(this.playroom){
            if(offset>this.playroom.duration){
                this.stop();
            }
        }
        if(this.playing){
            this._lcd_rafId = window.requestAnimationFrame(this._drawLCD.bind(this));
        }
    }
    _stopLCD() {
        if (this._lcd_rafId) {
            window.cancelAnimationFrame(this._lcd_rafId)
            this._lcd_rafId = undefined;
        }
    }


    createNewTrack(instrument){
        let user = firebase.auth().currentUser;
        let trackInfo = {
            "instrument": instrument,
            "player": user.uid,
        }
        const ref = firebase.database().ref("/tracks/" + this.playroomId);
        const tkey = ref.push().key;
        console.log("tkey", tkey, trackInfo);
        ref.child(tkey).set(trackInfo);
        this.loadAudioBuffer(tkey, trackInfo);
    }
    
    addTrack(id, trackInfo, buf) {
        const container = this.$el.find(".instrument[data-instrument="+trackInfo.instrument+"] .with-header");
        if(container.length){
            const track = new Track(id, this, buf, trackInfo, container);
            track.output.connect(this.gainNode);
            this.tracks[id] = track;
            return track;
        }else{
            return undefined;
        }
    }
    removeTrack(id){
        const track = this.tracks[id];
        track.remove();
        delete this.tracks[id];
    }
    loadAudioBuffer(id, trackInfo) {
        const target = trackInfo.sound;
        const self = this;
        const url = target;
        console.log(url);
        if(!url){
            //まだからのSound
            let buf = this.context.createBuffer(2, 1, this.context.sampleRate);
            this.addTrack(id, trackInfo, buf);
            return; 
        }
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer'; // ArrayBufferとしてロード
        request.send();


        const d = new $.Deferred;
        request.onload = function () {
            console.log(self);
            // オーディオデータが取得できた場合、contextにArrayBufferを渡し、decodeさせる
            if (this.status === 200) {
                self.context.decodeAudioData(request.response, function (buf) {
                    //                buffer = buf;
                    d.resolve(self.addTrack(id, trackInfo, buf));
                });
            }
        };
        return d;
    }

}

class Track {
    constructor(id, mixer, buffer, trackInfo, container) {
        const self = this;
        this.id = id;
        this.trackInfo = trackInfo;
        this.trackRef = firebase.database().ref("/tracks/" + mixer.playroomId + "/" + id);
        this.likesRef = firebase.database().ref("/likes/" + id);
        this.playerRef = firebase.database().ref("/users/" + trackInfo.player);
        this.mixer = mixer;
        const context = this.context = mixer.context;
        this.buffer = buffer;
        const gainNode = this.gainNode = context.createGain();

        this.enabled = false;
        console.log(container);
        container.append($("#tmpl-playroom-track")
            .tmpl({
                "id": id,
                "track":trackInfo,
                "player":{}
            }));

        this.$el = $(".track" + id);
        this.elToggle = document.getElementById("track" + id + "_toggle");
        this.elToggle.addEventListener('change', (e) => {
            const v = e.target.value;
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
            const v = e.target.value;
            gainNode.gain.value = v / 100;
        });

        this.volumeDb = new VolumeIndicator(this.gainNode, document.getElementById("track" + id + "_vol_indi"));
        this.volumeDb.start();

        this.$heart = this.$el.find(".heart");
        this.$heart.on("click", this.increment.bind(this));

        this.$rec = this.$el.find(".track_rec");
        this.$rec.on("click", this.recHandler.bind(this));

        this.$remove = this.$el.find(".track_remove");
        this.$remove.on("click", this.removeHandler.bind(this));


        //firebase event
        this.likesRef.on("value", snapshot=>{
            self.updateLikes(snapshot.val());
        });
        this.playerRef.on("value", snapshot=>{
            self.updatePlayer(snapshot.val());
        });
    }
    start(when, offset) {
        if (!this.enabled) return;
        if (this.source) this.stop();
        const source = this.source = this.context.createBufferSource();
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



    updateLikes(likes){
        if (!likes) likes = 0;
        this.$heart.find("div.favo>div").text(likes);
    }

    updatePlayer(player){
        this.$el.find("div.displayName").text(player.displayName);
        this.$el.find("div.photoURL>img").attr("src", player.photoURL);
        this.$el.find("div.level").text("👑" + (player.level || "0"));
    }

    /**
     * このトラックのレコーディングを開始する。
     */
    recHandler(){
        this.mixer.rec(this.id);
    }

    /**
     * 
     * @param {AudioBuffer} buffer 
     * @param {Blob} wavblob 
     */
    saveSound(buffer, wavblob){
        const self = this;
        this.buffer = buffer;

        const wavref = firebase.storage().ref("/tracks/" + this.id + ".wav");
        wavref.put(wavblob).then(()=>{
            console.log("sound save into storage");
            wavref.getDownloadURL().then((url)=>{
                if(self.trackInfo.sound != url){
                    console.log("try update database for sound url");
                    self.trackRef.child("sound").set(url).then(resolved=>{
                        console.log("sound url saved. sound=%s", url);
                    });
                }
            });
        });

    }

    /**
     * Trackの削除イベントリスナ
     */
    removeHandler(){
        this.mixer.removeTrack(this.id);
    }
    /**
     * Trackの削除
     */
    remove(){
        this.$el.remove();
        this.stop();
        this.output.disconnect();
        return this.trackRef.remove();
    }

    /**
     * いいねのカウントアップ
     */ 
    increment() {
        const self = this;
        console.log("increment likes");
        this.likesRef.transaction(likes=>{
            console.log("increment likes %o", likes);
            if(likes != null){
                likes++;
            }else{
                likes = 1;
            }

            console.log(likes);
            return likes;
        }).then((resolved)=>{
            console.log(resolved);
            const likes = resolved.snapshot.val();
            console.log("increment tx success likes = %o", likes); 
        });
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


        const freqByteData = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteFrequencyData(freqByteData);
        const sum = freqByteData.reduce((a, b) => a + b, 0);
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
        const canvas = document.getElementById("rec_analyser");
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.analyserContext = canvas.getContext('2d');
        this.lazy = true;
        this._audio_inited = false;
        if(!this.lazy){
            this.initAudio();
        }

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
        const self = this;
        console.log("complete");
        this.mixer.stop();
        this.stop();
        this.audioRecorder.getBuffer((buf) => {
            console.log(buf);
            const trimIndex = Math.round(self.trimOffset * self.audioContext.sampleRate);
            if (buf[0].length - trimIndex > 0) {
                const ab = self.audioContext.createBuffer(2, buf[0].length - trimIndex, self.audioContext.sampleRate);
                console.log(ab);
                for (let channel = 0; channel < 2; channel++) {
                    // 実際のデータの配列を得る
                    const nowBuffering = ab.getChannelData(channel);
                    for (let i = 0; i < nowBuffering.length; i++) {
                        // Math.random()は[0; 1.0]である
                        // 音声は[-1.0; 1.0]である必要がある
                        nowBuffering[i] = buf[channel][trimIndex + i];
                    }
                }
                self.mixer.completeRecording(ab, self.encodeWAV(2, ab));
                console.log(ab.length);
            }else{
                console.log("no rec data.");
            }
            self.clearStream();
        });
    }


    encodeWAV(numChannels, audiobuf) {

        function interleave(inputL, inputR) {
            const length = inputL.length + inputR.length;
            const result = new Float32Array(length);

            let index = 0;
            let inputIndex = 0;

            while(index < length) {
                result[index++] = inputL[inputIndex];
                result[index++] = inputR[inputIndex];
                inputIndex++;
            }
            return result;
        }
        function floatTo16BitPCM(output, offset, input) {
            let s;
            for(let i = 0; i < input.length; i++ , offset += 2) {
                s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        }

        function writeString(view, offset, string) {
            for(let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        const sampleRate = this.audioContext.sampleRate;
        let samples;
        if(numChannels == 2){
            samples = interleave(audiobuf.getChannelData(0), audiobuf.getChannelData(1));    
        }else{
            samples = audiobuf.getChannelData(0);
        }
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + samples.length * 2, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * 4, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, numChannels * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        floatTo16BitPCM(view, 44, samples);

        return new Blob([view], {type: "audio/wav"});
    }

    clearStream(){
        if(this.stream){
            this.stream.getTracks().forEach(tr=>tr.stop());
            this._audio_inited = false;
        }
    }
    open() {
        if (this._audio_inited) {
            this.$modal.modal("open");
        } else {
            this.initAudio();
        }
    }
    close() {
        this.$modal.modal("close");
    }
    record() {
        const self = this;
        this.audioRecorder.clear();
        this.audioRecorder.record();
        this._precountTime = this.audioContext.currentTime;
        const current = this.mixer.context.currentTime;
        $(this.mixer.metronome).off("tick");
        let measures = 3; // default precount
        $(this.mixer.metronome).on("tick", function (evt, data) {
            console.log(measures, data);
            if (!self.mixer.playing) {
                if (data.beat === 0) {
                    measures -= 1;
                    this.counter.text(measures);
                }
                if (measures > 0){
                    console.log("precount");
                    self.mixer.lcd.write2Display("letters", measures + " MEASURES TO REC   " + "    ".slice(4-(data.beat/4)) + "+");
                    this.counter.text(measures + ".".repeat(data.beat/4));
                }else if (measures === 0) {
                    console.log("play start");
                    self.mixer.play(data.time);
                    self.trimOffset = data.time - self._precountTime;
                    this.counter.text("");
                }
            }
        });
        this.mixer.metronome.play();
    }
    stop() {
        this.audioRecorder.stop();
        this.mixer.metronome.stop();
    }
    resizeAnalyzer() {
        const canvas = document.getElementById("rec_analyser");
        const wrapper = canvas.parentElement;
        $(canvas).attr('width', $(wrapper).width());
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;

    }
    cancelAnalyserUpdates() {
        if(this.rafID){
            window.cancelAnimationFrame(this.rafID);
            this.rafID = null;
        }
    }

    updateAnalysers(time) {

        // analyzer draw code here
        {
            const SPACING = 3;
            const BAR_WIDTH = 1;
            const numBars = Math.round(this.canvasWidth / SPACING);
            const freqByteData = new Uint8Array(this.analyserNode.frequencyBinCount);

            this.analyserNode.getByteFrequencyData(freqByteData);

            this.analyserContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.analyserContext.fillStyle = '#F6D565';
            this.analyserContext.lineCap = 'round';
            const multiplier = this.analyserNode.frequencyBinCount / numBars;
            const rate = this.canvasHeight / 255;
            // Draw rectangle for each frequency bin.
            let i, j, magnitude, offset, magnitude2;
            for (i = 0; i < numBars; ++i) {
                magnitude = 0;
                offset = Math.floor(i * multiplier);
                // gotta sum/average the block, or we miss narrow-bandwidth spikes
                for (j = 0; j < multiplier; j++)
                    magnitude += freqByteData[offset + j];
                magnitude = magnitude / multiplier * rate;
                magnitude2 = freqByteData[i * multiplier];
                this.analyserContext.fillStyle = "hsl( " + Math.round((i * 360) / numBars) + ", 100%, 50%)";
                this.analyserContext.fillRect(i * SPACING, this.canvasHeight, BAR_WIDTH, -magnitude);
            }
        }

        this.rafID = window.requestAnimationFrame(this.updateAnalysers.bind(this));
    }


    gotStream(stream) {
        this.stream = stream;
        const inputPoint = this.audioContext.createGain();

        // Create an AudioNode from the stream.
        const realAudioInput = this.audioContext.createMediaStreamSource(stream);
        const audioInput = realAudioInput;
        audioInput.connect(inputPoint);


        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 2048;
        inputPoint.connect(this.analyserNode);

        this.audioRecorder = new Recorder(inputPoint);

        const zeroGain = this.audioContext.createGain();
        zeroGain.gain.value = 0.0;
        inputPoint.connect(zeroGain);
        zeroGain.connect(this.audioContext.destination);
        this.updateAnalysers();

        this._audio_inited = true;
        if(this.lazy){
            this.open();
        }
    }

    initAudio() {
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
        this.throughoutNote;         // The throughout sum 16-beats are hit.
        this.current16thNote;        // What note is currently last scheduled?
        this.tempo = 120;          // tempo (in beats per minute)
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

        this.timerWorker = new Worker("/metronomeworker.js");
        const self = this;
        this.timerWorker.onmessage = function (e) {
            if (e.data == "tick") {
                // console.log("tick!");
                self.scheduler();
            }
            else
                console.log("message: " + e.data);
        };
        this.timerWorker.postMessage({ "interval": this.lookahead });

        // Get DOM of metronome needle and setup.
        this.needle = $("#metronome_needle");
        this.needleToLeft = true;
        this.needle.css({ "transition": "transform " + 60.0 / this.tempo + "s linear" });
        
        this.counter = $("#metronome_counter");
    }
    nextNote() {
        // Advance current note and time by a 16th note...
        const secondsPerBeat = 60.0 / this.tempo;    // Notice this picks up the CURRENT 
        // tempo value to calculate beat length.
        this.nextNoteTime += 0.25 * secondsPerBeat;    // Add beat length to last beat time

        this.current16thNote++;    // Advance the beat number, wrap to zero
        if (this.current16thNote == 16) {
            this.current16thNote = 0;
        }

        this.throughoutNote++;
    }

    scheduleNote(beatNumber, time, throughoutCount) {
        // push the note on the queue, even if we're not playing.
        this.notesInQueue.push({ note: beatNumber, time: time });

        if ((this.noteResolution == 1) && (beatNumber % 2))
            return; // we're not playing non-8th 16th notes
        if ((this.noteResolution == 2) && (beatNumber % 4))
            return; // we're not playing non-quarter 8th notes
        
        // Swing the metronome needle.
        this.needle.toggleClass("left-60deg");
        this.needle.toggleClass("right-60deg");

        // if ((-1 < throughoutCount && throughoutCount < 4)
        //     || (4 < throughoutCount && throughoutCount < 12)
        //     || (12 < throughoutCount && throughoutCount < 20)) {
        //     return; // start with .x.x.xxxX
        // }

        // create an oscillator
        const osc = this.context.createOscillator();
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
            this.scheduleNote(this.current16thNote, this.nextNoteTime, this.throughoutNote);
            this.nextNote();
        }
    }

    play() {
        if (!this.isPlaying) { // start playing
            this.current16thNote = 0;
            this.throughoutNote = 0;
            this.nextNoteTime = this.context.currentTime;
            this.timerWorker.postMessage("start");
            this.isPlaying = true;
        }
    }

    stop(){
        if (this.isPlaying) { // start playing
            this.current16thNote = 0;
            this.throughoutNote = 0;
            this.nextNoteTime = this.context.currentTime;
            this.timerWorker.postMessage("stop");
            this.isPlaying = false;
        }
    }

}
