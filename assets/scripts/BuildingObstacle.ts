import { GAMEPLAY } from './GameplayTuning';
import { _decorator, Component, Node } from 'cc';
import { RunContext } from './RunContext';
const { ccclass, property } = _decorator;

@ccclass('BuildingObstacle')
export class BuildingObstacle extends Component {
    
    private moveSpeed: number;
    start() {
        this.moveSpeed = RunContext.inst().moveSpeed;
    }

    update(deltaTime: number) {
        this.node.setPosition(this.node.getPosition().add3f(-this.moveSpeed * deltaTime, 0, 0))
        if(this.node.getPosition().x < GAMEPLAY.obstacleCullX){
            this.node.destroy();
        }
    }
}


