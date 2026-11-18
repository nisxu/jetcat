import { GameManager } from '../GameManager';
import { AudioMgr } from '../AudioMgr';
import { MockRewardedAd, RewardResult } from './MockRewardedAd';
import { pawMedal } from '../JetCatVisuals';
import { _decorator, Component, director, Label, Node, Button, Color, UITransform, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameOverUI')
export class GameOverUI extends Component {
    @property(Label)
    curScoreLabel:Label = null;
    @property(Label)
    bestScoreLabel:Label = null;
    @property(Node)
    newSprite:Node = null;
    @property(Node)
    medal:Node = null;
    @property([SpriteFrame])
    medalFrames:SpriteFrame[] = []
    show(curScore: number, bestScore: number, canRevive: boolean) {
        this.node.active = true;
        if (this.rewardStatus) this.rewardStatus.string = "";
        const continueButton = this.node.getChildByName('ContinueButton');
        const replayButton = this.node.getChildByName('ReplayButton');
        if (continueButton) continueButton.active = canRevive;
        if (replayButton) {
            const position = replayButton.position;
            replayButton.setPosition(canRevive ? -155 : 0, position.y, position.z);
        }
        this.curScoreLabel.string = curScore.toString();
        this.bestScoreLabel.string = bestScore.toString();
        if(curScore >= bestScore){
            this.newSprite.active = true;
        }else{
            this.newSprite.active = false;
        }
        pawMedal(this.medal, curScore >= 30 ? 3 : curScore >= 20 ? 2 : curScore >= 10 ? 1 : 0);
    }
    hide() {
        this.node.active = false;
    }

    // Explicit development switch: disable before publishing. Missing real provider fails closed.
    @property({ tooltip: '开发专用模拟广告；发布前必须关闭，真实广告尚未接入。' })
    enableMockAds = true;

    private rewardPending = false;
    private mockAd = new MockRewardedAd();
    private rewardStatus: Label = null;

    private setRewardStatus(text: string) {
        if (!this.rewardStatus) {
            const node = new Node('RewardStatus');
            this.node.addChild(node);
            node.setPosition(0, -480, 0);
            node.addComponent(UITransform).setContentSize(650, 75);
            this.rewardStatus = node.addComponent(Label);
            this.rewardStatus.fontSize = 24;
            this.rewardStatus.lineHeight = 30;
            this.rewardStatus.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.rewardStatus.color = new Color('#fff3dc');
        }
        this.rewardStatus.string = text;
    }

    private lockButtons(locked: boolean) {
        for (const name of ['ContinueButton', 'ReplayButton']) {
            const button = this.node.getChildByName(name)?.getComponent(Button);
            if (button) button.interactable = !locked;
        }
    }

    protected onDisable() { this.mockAd.cancel(); }
    protected onDestroy() { this.mockAd.cancel(); }

    async onContinueClick() {
        const game = GameManager.inst();
        if (this.rewardPending || !game.canRevive()) return;
        this.rewardPending = true;
        this.lockButtons(true);
        this.setRewardStatus(this.enableMockAds ? 'TEST AD IN PROGRESS' : 'Loading ad…');
        const audio = AudioMgr.inst;
        const wasPlaying = audio.audioSource.playing;
        if (wasPlaying) audio.pause();
        try {
            const result = await this.requestReviveReward();
            if (!this.isValid || !this.node.active || GameManager.inst() !== game) return;
            if (result === 'completed' && game.canRevive()) {
                this.setRewardStatus('');
                game.revive();
            } else {
                this.setRewardStatus(result === 'cancelled'
                    ? 'Ad cancelled. Revive still available.'
                    : 'Ad unavailable. Revive still available. Try again.');
            }
        } catch (error) {
            if (this.isValid && this.node.active) this.setRewardStatus('Ad failed. Revive still available. Try again.');
        } finally {
            if (wasPlaying && audio.audioSource.isValid && GameManager.inst() === game) audio.resume();
            this.rewardPending = false;
            if (this.isValid) this.lockButtons(false);
        }
    }

    private requestReviveReward(): Promise<RewardResult> {
        if (this.enableMockAds) return this.mockAd.show(this.node);
        // Real TikTok provider will be wired here once a Placement ID is available.
        // Never grant a reward just because configuration or an API is missing.
        return Promise.resolve('failed');
    }

    onReplayClick() {
        if (this.rewardPending) return;
        director.loadScene(director.getScene().name);
    }
}


