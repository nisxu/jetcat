import { GameManager } from '../GameManager';
import { pawMedal } from '../JetCatVisuals';
import { _decorator, Component, director, Label, Node, Sprite, SpriteFrame } from 'cc';
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

    private rewardPending = false;

    async onContinueClick() {
        if (this.rewardPending || !GameManager.inst().canRevive()) return;
        this.rewardPending = true;
        try {
            const completed = await this.requestReviveReward();
            if (completed && this.isValid && this.node.active) GameManager.inst().revive();
        } finally {
            this.rewardPending = false;
        }
    }

    private async requestReviveReward(): Promise<boolean> {
        // Prototype: no ad is shown. Replace with rewarded-ad completion result later.
        // Cancellation, incomplete viewing and ad errors must resolve false.
        return true;
    }

    onReplayClick() {
        director.loadScene(director.getScene().name);
    }
}


