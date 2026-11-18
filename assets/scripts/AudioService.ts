import { Node, AudioSource, AudioClip, resources, director, sys } from 'cc';
export class AudioService {
    private static _inst: AudioService;
    public static get inst(): AudioService {
        if (this._inst == null) {
            this._inst = new AudioService();
        }
        return this._inst;
    }

    private _audioSource: AudioSource;
    private effectsRoot: Node;
    private effects = new Map<AudioClip, AudioSource>();
    prepareEffects(clips: AudioClip[]) {
        for (const clip of clips) {
            if (!clip || this.effects.has(clip)) continue;
            const node = new Node('CachedEffect');
            this.effectsRoot.addChild(node);
            const source = node.addComponent(AudioSource);
            source.playOnAwake = false;
            source.loop = false;
            source.clip = clip; // Load once, before interaction, rather than per tap.
            this.effects.set(clip, source);
        }
    }

    stopEffects(except?: AudioClip) {
        for (const [clip, source] of this.effects) {
            // Do not queue STOP for idle/ended players: some mini-game backends
            // never acknowledge that redundant operation, blocking later PLAY.
            if (clip !== except && source.playing) source.stop();
        }
    }

    private musicVolume = 0.75;
    private musicPaused = false;
    private musicEnabled = sys.localStorage.getItem('MusicEnabled') !== 'false';
    get isMusicEnabled() { return this.musicEnabled; }
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        sys.localStorage.setItem('MusicEnabled', String(this.musicEnabled));
        if (!this.musicEnabled) this._audioSource.pause();
        else if (!this.musicPaused && this._audioSource.clip) this._audioSource.play();
    }
    constructor() {
        let audioRoot = new Node();
        audioRoot.name = 'JetCatAudio';
        director.getScene().addChild(audioRoot);
        director.addPersistRootNode(audioRoot);
        this._audioSource = audioRoot.addComponent(AudioSource);
        this.effectsRoot = new Node('SoundEffects');
        audioRoot.addChild(this.effectsRoot);
    }

    public get audioSource() {
        return this._audioSource;
    }

    playOneShot(sound: AudioClip | string, volume: number = 1.0) {
        if (!sound) return;
        if (sound instanceof AudioClip) {
            this.prepareEffects([sound]);
            const source = this.effects.get(sound);
            source.volume = volume;
            // AudioSource.play already restarts an actively playing clip.
            // An extra stop can stall the native operation queue after ENDED.
            source.play();
        } else {
            resources.load(sound, AudioClip, (error, clip) => {
                if (error) { console.warn('[JetCat] Effect load failed', error); return; }
                this.playOneShot(clip, volume);
            });
        }
    }

    play(sound: AudioClip | string, volume: number = 0.75) {
        this.musicVolume = volume;
        this.musicPaused = false;
        if (sound instanceof AudioClip) {
            this._audioSource.stop();
            this._audioSource.clip = sound;
            this._audioSource.loop = true;
            this.audioSource.volume = this.musicVolume;
            if (this.musicEnabled && !this.musicPaused) this._audioSource.play();
        }
        else {
            resources.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    console.warn('[JetCat] Music load failed', err);
                }
                else {
                    this._audioSource.stop();
                    this._audioSource.clip = clip;
                    this._audioSource.loop = true;
                    this.audioSource.volume = this.musicVolume;
                    if (this.musicEnabled && !this.musicPaused) this._audioSource.play();
                }
            });
        }
    }

    stop() {
        this._audioSource.stop();
    }

    pause() {
        this.musicPaused = true;
        this._audioSource.pause();
    }

    resume(){
        this.musicPaused = false;
        if (this.musicEnabled) this._audioSource.play();
    }
}