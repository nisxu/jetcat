import { _decorator, AudioClip, Component, Label, Node, Script } from 'cc';
import { Scroll } from './Scroll';
import { PipeManager } from './PipeManager';
import { GameData } from './GameData';
import { GameOverUI } from './UI/GameOverUI';
import { Bird } from './Bird';
import { AudioMgr } from './AudioMgr';

const { ccclass, property } = _decorator;
enum GameState {
    Ready,
    Playing,
    GameOver,
    Reviving
}
@ccclass('GameManager')
export class GameManager extends Component {
    private static _inst:GameManager = null;
    public static inst() {
        return this._inst
    }
    @property
    moveSpeed:number = 100;

    @property(Scroll)
    land:Scroll = null;
    @property(Bird)
    bird:Bird = null;
    @property(Scroll)
    bg:Scroll = null;
    @property(PipeManager)
    pipeManager:PipeManager = null;

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

    @property(Label)
    reviveCountdown: Label = null;

    curState: GameState = GameState.Ready;
    private reviveSecondsLeft = 0;
    private reviveUsed = false;

    protected onLoad(): void {
        GameManager._inst = this;
        // Editor hot reload can retain an older serialized component binding.
        if (!this.reviveCountdown) {
            this.reviveCountdown = this.node.parent?.getChildByName('ReviveCountdown')?.getComponent(Label) ?? null;
        }
    }

    start() {
        this.enterReady();
        AudioMgr.inst.play(this.bgAudio);
    }

    enterReady() {
        this.curState = GameState.Ready;
        this.reviveUsed = false;
        // Scene reloads preserve static data, so explicitly start a fresh run.
        GameData.resetScore();
        this.scoreLabel.string = '0';
        this.bird.disableControl();
        this.bg.disableMove();
        this.land.disableMove();
        this.pipeManager.disableSpawn();
        this.gamingUI.active = false;
        this.gameOverUI.hide();
    }

    enterPlaying() {
        this.curState = GameState.Playing;
        this.bird.enableControl();
        this.bg.enableMove();
        this.land.enableMove();
        this.pipeManager.enableSpawn();
        this.gameOverUI.hide();
        this.gamingUI.active = true;
    }

    enterGameOver() {
        if(this.curState !== GameState.Playing) return;
        AudioMgr.inst.playOneShot(this.gameOverAudio);
        this.curState = GameState.GameOver
        this.gamingUI.active = false;
        this.bird.disableControl();
        this.bg.disableMove();
        this.land.disableMove();
        this.pipeManager.disableSpawn();
        this.gameOverUI.show(GameData.getScore(), GameData.getBestScore(), this.canRevive());
        GameData.saveScore();
    }

    canRevive(): boolean {
        return this.curState === GameState.GameOver && !this.reviveUsed;
    }

    /** Reward boundary: call only after the future rewarded-ad completion callback. */
    revive() {
        if (!this.canRevive()) return;
        this.reviveUsed = true;
        this.curState = GameState.Reviving;
        this.gameOverUI.hide();
        // Discard obstacles around the death point; no points are awarded for them.
        this.pipeManager.clearForRevive();
        this.bird.prepareRevive();
        this.scoreLabel.string = GameData.getScore().toString();
        this.gamingUI.active = true;
        this.reviveSecondsLeft = 3;
        if (this.reviveCountdown) {
            this.reviveCountdown.node.active = true;
            this.reviveCountdown.string = 'READY  3';
        }
    }

    update(dt: number) {
        if (this.curState !== GameState.Reviving) return;
        this.reviveSecondsLeft = Math.max(0, this.reviveSecondsLeft - dt);
        if (this.reviveSecondsLeft > 0) {
            if (this.reviveCountdown) this.reviveCountdown.string = `READY  ${Math.ceil(this.reviveSecondsLeft)}`;
            return;
        }
        this.bird.finishRevive();
        this.enterPlaying();
        if (this.reviveCountdown) this.reviveCountdown.node.active = false;
    }

    addScore(count: number = 1) {
        if(this.curState !== GameState.Playing) return;
        GameData.addScore(count);
        this.scoreLabel.string = GameData.getScore().toString();
    }
}


