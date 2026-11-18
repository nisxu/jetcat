import { RunContext } from './RunContext';
import { GAMEPLAY } from './GameplayTuning';
import { _decorator, AudioClip, Component, Label, Node, UITransform, EventTouch, resources } from 'cc';
import { WorldScroller } from './WorldScroller';
import { ObstacleSpawner } from './ObstacleSpawner';
import { ScoreStore } from './ScoreStore';
import { GameOverUI } from './UI/GameOverUI';
import { JetCatController } from './JetCatController';
import { JetCatArt } from './JetCatArt';
import { musicIcon } from './JetCatVisuals';
import { AudioService } from './AudioService';

const { ccclass, property } = _decorator;
enum GameState {
    Ready,
    Playing,
    GameOver,
    Reviving
}
@ccclass('RunController')
export class RunController extends Component {
    @property
    moveSpeed:number = 100;

    @property(WorldScroller)
    rooftops:WorldScroller = null;
    @property(JetCatController)
    player:JetCatController = null;
    @property(WorldScroller)
    skyline:WorldScroller = null;
    @property(ObstacleSpawner)
    obstacles:ObstacleSpawner = null;

    @property(Node)
    gamingUI:Node = null;
    @property(Label)
    scoreLabel:Label = null;
    @property(GameOverUI)
    gameOverUI:GameOverUI = null;
    @property(AudioClip)
    bgAudio:AudioClip = null;
    @property(AudioClip)
    gameOverAudio:AudioClip = null;
    @property(AudioClip)
    scoreAudio: AudioClip = null;

    @property(Label)
    reviveCountdown: Label = null;

    curState: GameState = GameState.Ready;
    private reviveSecondsLeft = 0;
    private reviveUsed = false;

    protected onLoad(): void {
        RunContext.current = this;
        AudioService.inst.prepareEffects([this.scoreAudio, this.gameOverAudio]);
        if (!this.gameOverAudio) {
            resources.load('gameOver', AudioClip, (error, clip) => {
                if (error) { console.warn('[JetCat] Game-over audio load failed', error); return; }
                if (this.isValid) { this.gameOverAudio = clip; AudioService.inst.prepareEffects([clip]); }
            });
        }
        // Hot editor scenes can retain null for newly introduced serialized fields.
        if (!this.scoreAudio) {
            resources.load('coin01', AudioClip, (error, clip) => {
                if (error) { console.warn('[JetCat] Score audio load failed', error); return; }
                if (this.isValid) { this.scoreAudio = clip; AudioService.inst.prepareEffects([clip]); }
            });
        }
        // Editor hot reload can retain an older serialized component binding.
        if (!this.reviveCountdown) {
            this.reviveCountdown = this.node.parent?.getChildByName('ReviveCountdown')?.getComponent(Label) ?? null;
        }
    }

    start() {
        this.enterReady();
        AudioService.inst.play(this.bgAudio);
        const toggle = this.node.parent.getChildByName('MusicToggle');
        const refresh = () => { toggle.getComponent(JetCatArt).musicEnabled = AudioService.inst.isMusicEnabled; musicIcon(toggle, AudioService.inst.isMusicEnabled); };
        if (toggle) {
            refresh();
            toggle.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                AudioService.inst.toggleMusic(); refresh();
            });
        }
    }

    isMusicTouch(event: EventTouch): boolean {
        const toggle = this.node.parent?.getChildByName('MusicToggle');
        return !!event && !!toggle?.activeInHierarchy && toggle.getComponent(UITransform).hitTest(event.getLocation());
    }

    private setMusicToggleVisible(visible: boolean) {
        const toggle = this.node?.parent?.getChildByName('MusicToggle');
        if (toggle) toggle.active = visible;
    }

    private stopWorld() {
        this.player.disableControl();
        this.skyline.disableMove();
        this.rooftops.disableMove();
        this.obstacles.disableSpawn();
    }

    enterReady() {
        this.setMusicToggleVisible(true);
        this.curState = GameState.Ready;
        this.reviveUsed = false;
        // Scene reloads preserve static data, so explicitly start a fresh run.
        ScoreStore.resetScore();
        this.scoreLabel.string = '0';
        this.stopWorld();
        this.gamingUI.active = false;
        this.gameOverUI.hide();
    }

    enterPlaying() {
        this.setMusicToggleVisible(false);
        this.curState = GameState.Playing;
        this.player.enableControl();
        this.skyline.enableMove();
        this.rooftops.enableMove();
        this.obstacles.enableSpawn();
        this.gameOverUI.hide();
        this.gamingUI.active = true;
    }

    enterGameOver() {
        if(this.curState !== GameState.Playing) return;
        AudioService.inst.stopEffects(this.gameOverAudio);
        AudioService.inst.playOneShot(this.gameOverAudio);
        this.curState = GameState.GameOver;
        this.setMusicToggleVisible(true);
        this.gamingUI.active = false;
        this.stopWorld();
        this.gameOverUI.show(ScoreStore.getScore(), ScoreStore.getBestScore(), this.canRevive());
        ScoreStore.saveScore();
    }

    canRevive(): boolean {
        return this.curState === GameState.GameOver && !this.reviveUsed;
    }

    /** Reward boundary: call only after the future rewarded-ad completion callback. */
    revive() {
        if (!this.canRevive()) return;
        this.reviveUsed = true;
        this.curState = GameState.Reviving;
        this.setMusicToggleVisible(false);
        this.gameOverUI.hide();
        // Discard obstacles around the death point; no points are awarded for them.
        this.obstacles.clearForRevive();
        this.player.prepareRevive();
        this.scoreLabel.string = ScoreStore.getScore().toString();
        this.gamingUI.active = true;
        this.reviveSecondsLeft = GAMEPLAY.reviveSeconds;
        if (this.reviveCountdown) {
            this.reviveCountdown.node.active = true;
            this.reviveCountdown.string = `READY  ${GAMEPLAY.reviveSeconds}`;
        }
    }

    update(dt: number) {
        if (this.curState !== GameState.Reviving) return;
        this.reviveSecondsLeft = Math.max(0, this.reviveSecondsLeft - dt);
        if (this.reviveSecondsLeft > 0) {
            if (this.reviveCountdown) this.reviveCountdown.string = `READY  ${Math.ceil(this.reviveSecondsLeft)}`;
            return;
        }
        this.player.finishRevive();
        this.enterPlaying();
        if (this.reviveCountdown) this.reviveCountdown.node.active = false;
    }

    addScore(count: number = 1) {
        if(this.curState !== GameState.Playing) return;
        ScoreStore.addScore(count);
        if (count > 0 && this.scoreAudio) AudioService.inst.playOneShot(this.scoreAudio, 0.25);
        this.scoreLabel.string = ScoreStore.getScore().toString();
    }
}


