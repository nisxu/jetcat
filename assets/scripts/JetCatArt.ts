import { _decorator, Component, Enum, Graphics, UITransform } from 'cc';
import { cityBackground, rooftop, building, flame, replayButton, scorePanel, pawMedal, verticalBleed, continueButton } from './JetCatVisuals';
const { ccclass, property, executeInEditMode, requireComponent } = _decorator;
export enum JetCatArtKind { City, Rooftop, Building, Exhaust, ReplayButton, ScorePanel, Medal, ContinueButton }

/** One drawing implementation for the scene editor, prefab editor and game. */
@ccclass('JetCatArt')
@executeInEditMode
@requireComponent(Graphics)
export class JetCatArt extends Component {
    @property({ type: Enum(JetCatArtKind) })
    kind = JetCatArtKind.City;
    private signature = '';

    onEnable() { this.redraw(); }
    onValidate() { this.signature = ''; }
    update() {
        const ui = this.getComponent(UITransform);
        const signature = `${this.kind}:${ui.width}:${ui.height}:${ui.anchorX}:${ui.anchorY}:${verticalBleed(this.node)}`;
        if (signature !== this.signature) this.redraw();
    }
    private redraw() {
        const ui = this.getComponent(UITransform);
        if (!ui) return;
        this.signature = `${this.kind}:${ui.width}:${ui.height}:${ui.anchorX}:${ui.anchorY}:${verticalBleed(this.node)}`;
        if (this.kind === JetCatArtKind.City) cityBackground(this.node);
        else if (this.kind === JetCatArtKind.Rooftop) rooftop(this.node);
        else if (this.kind === JetCatArtKind.Building) building(this.node);
        else if (this.kind === JetCatArtKind.ReplayButton) replayButton(this.node);
        else if (this.kind === JetCatArtKind.ScorePanel) scorePanel(this.node);
        else if (this.kind === JetCatArtKind.Medal) pawMedal(this.node);
        else if (this.kind === JetCatArtKind.ContinueButton) continueButton(this.node);
        else flame(this.getComponent(Graphics), 0, false);
    }
}
