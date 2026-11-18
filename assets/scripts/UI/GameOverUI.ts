import { PREVIEW } from 'cc/env';
import { ScoreStore } from '../ScoreStore';
import { RunContext } from '../RunContext';
import { AudioService } from '../AudioService';
import { MockRewardedAd, RewardResult } from './MockRewardedAd';
import { pawMedal } from '../JetCatVisuals';
import { _decorator, Component, director, Label, Node, Button, Graphics, BlockInputEvents, Color, UITransform, sys, view, Vec3 } from 'cc';
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
    private get testAdsAvailable(): boolean {
        return this.enableMockAds && (PREVIEW || (globalThis as any).__JETCAT_DEV_ADS__ === true);
    }

    show(curScore: number, bestScore: number, canRevive: boolean) {
        this.node.active = true;
        if (this.rewardStatus) this.rewardStatus.string = "";
        const continueButton = this.node.getChildByName('ContinueButton');
        const replayButton = this.node.getChildByName('ReplayButton');
        const offerRevive = canRevive && this.testAdsAvailable;
        if (continueButton) continueButton.active = offerRevive;
        if (replayButton) {
            const position = replayButton.position;
            replayButton.setPosition(offerRevive ? -155 : 0, position.y, position.z);
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

    private resetDialog: Node = null;

    protected onLoad() {
        let reset = this.node.getChildByName('ResetBestButton');
        if (!reset) {
            reset = new Node('ResetBestButton');
            reset.layer = this.node.layer;
            this.node.addChild(reset);
            reset.addComponent(UITransform).setContentSize(220, 64);
            const label = reset.addComponent(Label);
            label.string = 'RESET BEST';
            label.fontSize = 20;
            label.lineHeight = 26;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.color = new Color('#c2b8d2');
        }
        reset.active = true;
        reset.on(Node.EventType.TOUCH_END, (event) => {
            event.propagationStopped = true;
            this.onResetBestClick();
        });
    }

    protected lateUpdate() {
        const reset = this.node.getChildByName('ResetBestButton');
        const canvas = this.node.parent?.getComponent(UITransform);
        const parent = this.node.getComponent(UITransform);
        if (!reset || !canvas || !parent) return;
        const visible = view.getVisibleSize();
        const safe = sys.getSafeAreaRect();
        // Safe-area coordinates are in design units; convert through Canvas so
        // this also works when the game-over panel is moved or scaled.
        const bottom = Math.max(0, safe.y);
        const point = canvas.convertToWorldSpaceAR(new Vec3(
            safe.x + safe.width / 2 - visible.width / 2,
            bottom - visible.height / 2 + 52, 0));
        const local = parent.convertToNodeSpaceAR(point);
        if (Math.abs(reset.position.x - local.x) > 0.5 || Math.abs(reset.position.y - local.y) > 0.5) {
            reset.setPosition(local);
        }
    }

    onResetBestClick() {
        if (this.rewardPending || this.resetDialog) return;
        const dialog = new Node('ResetBestConfirmation');
        dialog.layer = this.node.layer;
        this.resetDialog = dialog;
        this.node.addChild(dialog);
        dialog.addComponent(UITransform).setContentSize(4000, 6000);
        dialog.addComponent(BlockInputEvents);
        const g = dialog.addComponent(Graphics);
        g.fillColor = new Color(15, 18, 40, 220);
        g.rect(-2000, -3000, 4000, 6000); g.fill();
        g.fillColor = new Color('#fff3dc');
        g.roundRect(-300, -180, 600, 360, 24); g.fill();
        const text = (parent: Node, value: string, x: number, y: number, width: number, size: number) => {
            const node = new Node(value);
            node.layer = parent.layer;
            parent.addChild(node); node.setPosition(x, y, 0);
            node.addComponent(UITransform).setContentSize(width, 80);
            const label = node.addComponent(Label);
            label.string = value; label.fontSize = size; label.lineHeight = size + 8;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.color = new Color('#534466');
            return node;
        };
        text(dialog, 'RESET BEST SCORE?', 0, 110, 560, 30);
        text(dialog, 'Your best score will be reset to 0.\nThis cannot be undone.', 0, 20, 560, 24);
        for (const [title, x, color] of [['CANCEL', -140, '#e5dff2'], ['RESET', 140, '#ffd58c']] as const) {
            const button = new Node(title);
            button.layer = dialog.layer;
            dialog.addChild(button);
            button.setPosition(x, -100, 0);
            button.addComponent(UITransform).setContentSize(240, 80);
            const skyline = button.addComponent(Graphics);
            skyline.fillColor = new Color(color); skyline.roundRect(-120, -38, 240, 76, 14); skyline.fill();
            // Keep the text above the button background.
            text(button, title, 0, 0, 240, 26);
            button.addComponent(Button);
            button.on(Button.EventType.CLICK, () => {
                if (!this.resetDialog) return;
                if (title === 'RESET') {
                    ScoreStore.resetBestScore();
                    this.bestScoreLabel.string = '0';
                    this.newSprite.active = false;
                }
                this.closeResetDialog();
            });
        }
    }

    private closeResetDialog() {
        if (!this.resetDialog) return;
        this.resetDialog.active = false;
        this.resetDialog.destroy();
        this.resetDialog = null;
    }

    private rewardPending = false;
    private mockAd = new MockRewardedAd();
    private rewardStatus: Label = null;

    private setRewardStatus(text: string) {
        if (!this.rewardStatus) {
            const node = new Node('RewardStatus');
            node.layer = this.node.layer;
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

    protected onDisable() { this.mockAd.cancel(); this.closeResetDialog(); }
    protected onDestroy() { this.mockAd.cancel(); this.closeResetDialog(); }

    async onContinueClick() {
        const game = RunContext.inst();
        if (this.resetDialog || this.rewardPending || !game.canRevive() || !this.testAdsAvailable) return;
        this.rewardPending = true;
        this.lockButtons(true);
        this.setRewardStatus(this.testAdsAvailable ? 'TEST AD IN PROGRESS' : 'Loading ad…');
        const audio = AudioService.inst;
        const wasPlaying = audio.audioSource.playing;
        if (wasPlaying) audio.pause();
        try {
            const result = await this.requestReviveReward();
            if (!this.isValid || !this.node.active || RunContext.inst() !== game) return;
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
            if (wasPlaying && audio.audioSource.isValid && RunContext.inst() === game) audio.resume();
            this.rewardPending = false;
            if (this.isValid) this.lockButtons(false);
        }
    }

    private requestReviveReward(): Promise<RewardResult> {
        if (this.testAdsAvailable) return this.mockAd.show(this.node);
        // Real TikTok provider will be wired here once a Placement ID is available.
        // Never grant a reward just because configuration or an API is missing.
        return Promise.resolve('failed');
    }

    onReplayClick() {
        if (this.resetDialog || this.rewardPending) return;
        director.loadScene(director.getScene().name);
    }
}


