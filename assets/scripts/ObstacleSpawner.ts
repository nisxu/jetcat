import { GAMEPLAY } from './GameplayTuning';
import { _decorator, Component, instantiate, math, Node, Prefab } from 'cc';
import { BuildingObstacle } from './BuildingObstacle';
const { ccclass, property } = _decorator;

@ccclass('ObstacleSpawner')
export class ObstacleSpawner extends Component {
    @property(Prefab)
    obstaclePrefab: Prefab = null;

    @property
    spawnRate: number = 2;

    private timer: number = 2;
    private _canSpawn: boolean = false;

    update(deltaTime: number) {
        if(!this._canSpawn) return;
        this.timer += deltaTime;
        if(this.timer >= this.spawnRate){
            this.timer = 0;
            const obstacle = instantiate(this.obstaclePrefab);
            this.node.addChild(obstacle);
            const randomH = math.randomRangeInt(GAMEPLAY.obstacleMinY, GAMEPLAY.obstacleMaxY);
            obstacle.setWorldPosition(this.node.getWorldPosition().add3f(0, randomH, 0));
        }        
    }

    clearForRevive() {
        this._canSpawn = false;
        // Spawn the first obstacle as soon as the revive countdown ends.
        // It still approaches from offscreen; later obstacles keep their normal spacing.
        this.timer = this.spawnRate;
        for (const obstacle of [...this.node.children]) {
            obstacle.active = false;
            obstacle.destroy();
        }
    }

    enableSpawn() {
        this._canSpawn = true;
    }

    disableSpawn() {
        this._canSpawn = false;
        this.node.children.forEach(obstacle => {
            obstacle.getComponent(BuildingObstacle).enabled = false;
        })
    }
}


