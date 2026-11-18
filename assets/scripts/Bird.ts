import { flame } from './JetCatVisuals';
import { _decorator, Animation, Graphics, AudioClip, Collider2D, Component, Contact2DType, Input, input, IPhysics2DContact, RigidBody2D, Vec2 } from 'cc';
import { Tags } from './Tags';
import { GameManager } from './GameManager';
import { AudioMgr } from './AudioMgr';
const { ccclass, property } = _decorator;

@ccclass('Bird')
export class Bird extends Component {
    @property
    rotateSpeed: number = 60;
    @property(AudioClip)
    clickAudio:AudioClip = null;
    private jet: Graphics;
    private jetTime = 0;
    private boostTime = 0;
    private normalGravityScale = 1;
    _canControl: boolean = false;
    protected onLoad(): void {
        this.getComponent(Animation).enabled = false;
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
        this.getComponent(Animation).enabled = false;
    }

    enableControl() {
        this.getComponent(RigidBody2D).wakeUp();
        this.getComponent(Animation).enabled = false;
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
        this.node.setPosition(0, 80, 0);
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
        body.linearVelocity = new Vec2(0, 6);
        this.boostTime = 0.18;
    }

    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (!this._canControl) return;
        if(otherCollider.tag === Tags.LAND || otherCollider.tag === Tags.PIPE){
            GameManager.inst().enterGameOver();
        }
    }

    onEndContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (!this._canControl) return;
        if(otherCollider.tag === Tags.PASS){
            GameManager.inst().addScore();
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
    onTouchStart() {
        if(!this._canControl) return;
        AudioMgr.inst.playOneShot(this.clickAudio)
        this.getComponent(RigidBody2D).linearVelocity = new Vec2(0, 10)
        this.boostTime = 0.18;
    }
    protected update(dt: number): void {
        this.jetTime += dt;
        this.boostTime = Math.max(0, this.boostTime - dt);
        flame(this.jet, this.jetTime, this.boostTime > 0);
        this.jet.node.active = this._canControl;
        // Keep the single upright cat frame; only a subtle bounded tilt follows flight.
        const target = this._canControl ? (this.boostTime > 0 ? 10 : -6) : 0;
        this.node.angle += (target - this.node.angle) * Math.min(1, dt * 10);
    }
}


