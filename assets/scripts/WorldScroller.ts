import { GAMEPLAY } from './GameplayTuning';
import { _decorator, Component, Node } from 'cc';
import { RunContext } from './RunContext';
const { ccclass, property } = _decorator;

@ccclass('WorldScroller')
export class WorldScroller extends Component {
    @property(Node)
    target1: Node = null;
    @property(Node)
    target2: Node = null;
    _canMove: boolean = false;
    private scrollSpeed: number;
    start() {
        this.scrollSpeed = RunContext.inst().moveSpeed;
    }
    enableMove() {
        this._canMove = true;
    }
    disableMove() {
        this._canMove = false;
    }
    update(deltaTime: number) {
        if(!this._canMove) return;
        const moveDistance = -this.scrollSpeed * deltaTime;
        this.target1.setPosition(this.target1.getPosition().add3f(moveDistance, 0, 0));
        this.target2.setPosition(this.target2.getPosition().add3f(moveDistance, 0, 0));
        if(this.target1.getPosition().x < GAMEPLAY.scrollWrapX){
            this.target1.setPosition(this.target2.getPosition().add3f(GAMEPLAY.scrollTileWidth, 0, 0));
        }
        if(this.target2.getPosition().x < GAMEPLAY.scrollWrapX){
            this.target2.setPosition(this.target1.getPosition().add3f(GAMEPLAY.scrollTileWidth, 0, 0));
        }
    }
}


