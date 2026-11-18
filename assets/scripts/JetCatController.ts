import { GAMEPLAY } from './GameplayTuning';
import { flame } from './JetCatVisuals';
import { _decorator, Graphics, AudioClip, Collider2D, Component, Contact2DType, Input, input, IPhysics2DContact, RigidBody2D, Vec2, resources } from 'cc';
import { CollisionTags } from './CollisionTags';
import { RunContext } from './RunContext';
import { AudioService } from './AudioService';
const { ccclass, property } = _decorator;

@ccclass('JetCatController')
export class JetCatController extends Component {
    @property(AudioClip)
    boostAudio: AudioClip = null;
    private boostLoading = false;
    private loadBoostAudio() {
        if (this.boostAudio) {
            AudioService.inst.prepareEffects([this.boostAudio]);
            return;
        }
        if (this.boostLoading) return;
        this.boostLoading = true;
        resources.load('boost1', AudioClip, (error, clip) => {
            this.boostLoading = false;
            if (error) { console.warn('[JetCat] boost1 load failed', error); return; }
            if (!this.isValid) return;
            this.boostAudio = clip;
            AudioService.inst.prepareEffects([clip]);
        });
    }
    private jet: Graphics;
    private jetTime = 0;
    private boostTime = 0;
    private normalGravityScale = 1;
    _canControl: boolean = false;
    protected onLoad(): void {
        this.loadBoostAudio();
        this.getComponent(RigidBody2D).fixedRotation = true;
        this.normalGravityScale = this.getComponent(RigidBody2D).gravityScale;
        this.jet = this.node.getChildByName('JetExhaust').getComponent(Graphics);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    disableControl() {
        this._canControl = false;
        this.getComponent(RigidBody2D).sleep();
    }

    enableControl() {
        this.getComponent(RigidBody2D).wakeUp();
        this._canControl = true;
    }

    prepareRevive() {
        this._canControl = false;
        const body = this.getComponent(RigidBody2D);
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
        // Keep the body and fixture registered throughout recovery on Native too.
        // Disabling/re-enabling them introduces a second physics lifecycle.
        body.gravityScale = 0;
        this.node.setPosition(0, GAMEPLAY.reviveY, 0);
        this.node.angle = 0;
        body.wakeUp();
        this.boostTime = 0;
        this.jet.node.active = false;
    }

    finishRevive() {
        const body = this.getComponent(RigidBody2D);
        body.gravityScale = this.normalGravityScale;
        body.wakeUp();
        body.angularVelocity = 0;
        body.linearVelocity = new Vec2(0, GAMEPLAY.reviveVelocity);
        this.boostTime = GAMEPLAY.boostSeconds;
    }

    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (!this._canControl) return;
        if(otherCollider.tag === CollisionTags.ROOFTOP || otherCollider.tag === CollisionTags.BUILDING){
            RunContext.inst().enterGameOver();
        }
    }

    onEndContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (!this._canControl) return;
        if(otherCollider.tag === CollisionTags.SCORE_GATE){
            RunContext.inst().addScore();
        }
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }
    onTouchStart(event) {
        if (RunContext.inst().isMusicTouch(event)) return;
        if(!this._canControl) return;
        this.getComponent(RigidBody2D).linearVelocity = new Vec2(0, GAMEPLAY.boostVelocity);
        this.boostTime = GAMEPLAY.boostSeconds;
        if (this.boostAudio) AudioService.inst.playOneShot(this.boostAudio, 1.0);
    }
    protected update(dt: number): void {
        this.jetTime += dt;
        this.boostTime = Math.max(0, this.boostTime - dt);
        flame(this.jet, this.jetTime, this.boostTime > 0);
        this.jet.node.active = this._canControl;
        // Keep the single upright cat frame; only a subtle bounded tilt follows flight.
        const target = this._canControl ? (this.boostTime > 0 ? GAMEPLAY.boostTilt : GAMEPLAY.glideTilt) : 0;
        this.node.angle += (target - this.node.angle) * Math.min(1, dt * GAMEPLAY.tiltResponse);
    }
}


