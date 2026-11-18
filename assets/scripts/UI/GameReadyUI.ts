import { _decorator, Component, input, Input, Node } from 'cc';
import { RunContext } from '../RunContext';
const { ccclass, property } = _decorator;

@ccclass('GameReadyUI')
export class GameReadyUI extends Component {
    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event) {
        if (RunContext.inst().isMusicTouch(event)) return;
        RunContext.inst().enterPlaying();
        this.node.active = false;
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }
}


