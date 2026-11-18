import { _decorator, Component, Enum, Graphics, UITransform, sys, view } from 'cc';
import { cityBackground, rooftop, building, flame, replayButton, scorePanel, pawMedal, verticalBleed, continueButton, musicIcon } from './JetCatVisuals';
const { ccclass, property, executeInEditMode, requireComponent } = _decorator;
export enum JetCatArtKind { City, Rooftop, Building, Exhaust, ReplayButton, ScorePanel, Medal, ContinueButton, Music }

/** One drawing implementation for the scene editor, prefab editor and game. */
@ccclass('JetCatArt')
@executeInEditMode
@requireComponent(Graphics)
export class JetCatArt extends Component {
    @property({ type: Enum(JetCatArtKind) })
    kind = JetCatArtKind.City;
    musicEnabled = true;
    private signature = '';

    onEnable() { this.redraw(); }
    onValidate() { this.signature = ''; }
    update() {
        if (this.kind === JetCatArtKind.Music) {
            const visible = view.getVisibleSize();
            const safe = sys.getSafeAreaRect();
            const ui = this.getComponent(UITransform);
            const x = safe.x - visible.width / 2 + ui.width / 2 + 28;
            const y = safe.y + safe.height - visible.height / 2 - ui.height / 2 - 28;
            if (Math.abs(this.node.position.x - x) > 0.5 || Math.abs(this.node.position.y - y) > 0.5) {
                this.node.setPosition(x, y, 0);
            }
        }
        const ui = this.getComponent(UITransform);
        const signature = `${this.musicEnabled}:${this.kind}:${ui.width}:${ui.height}:${ui.anchorX}:${ui.anchorY}:${verticalBleed(this.node)}`;
        if (signature !== this.signature) this.redraw();
    }
    private redraw() {
        const ui = this.getComponent(UITransform);
        if (!ui) return;
        this.signature = `${this.musicEnabled}:${this.kind}:${ui.width}:${ui.height}:${ui.anchorX}:${ui.anchorY}:${verticalBleed(this.node)}`;
        if (this.kind === JetCatArtKind.City) cityBackground(this.node);
        else if (this.kind === JetCatArtKind.Rooftop) rooftop(this.node);
        else if (this.kind === JetCatArtKind.Building) building(this.node);
        else if (this.kind === JetCatArtKind.ReplayButton) replayButton(this.node);
        else if (this.kind === JetCatArtKind.ScorePanel) scorePanel(this.node);
        else if (this.kind === JetCatArtKind.Medal) pawMedal(this.node);
        else if (this.kind === JetCatArtKind.ContinueButton) continueButton(this.node);
        else if (this.kind === JetCatArtKind.Music) musicIcon(this.node, this.musicEnabled);
        else flame(this.getComponent(Graphics), 0, false);
    }
}
