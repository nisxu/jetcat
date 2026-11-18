import { Canvas, Color, Graphics, Node, UITransform } from 'cc';

function rect(g: Graphics, x: number, y: number, w: number, h: number, hex: string) {
    g.fillColor = new Color(hex); g.rect(x, y, w, h); g.fill();
}
function surface(node: Node): Graphics {
    const g = node.getComponent(Graphics);
    g.clear(); return g;
}

/** Extend decoration only; never resize physics nodes or shift the playable area. */
export function verticalBleed(node: Node): number {
    let parent: Node | null = node;
    while (parent && !parent.getComponent(Canvas)) parent = parent.parent;
    const height = parent?.getComponent(UITransform)?.height ?? 1280;
    return Math.max(0, (height - 1280) / 2) + 2;
}

// Exact geometry avoids packed-atlas rotation, border sampling and nine-slice artifacts.
export function cityBackground(node: Node) {
    const g = surface(node);
    const { width: w, height: h } = node.getComponent(UITransform).contentSize;
    const bleed = verticalBleed(node);
    rect(g, -w / 2, h / 2 - 1, w, bleed + 1, '#3765bf');
    rect(g, -w / 2, -h / 2 - bleed, w, bleed + 1, '#7779b8');
    // Identical edge colors and a continuous bottom band make repeating tiles seamless.
    for (let y = 0; y < h; y += 8) {
        const t = y / h;
        g.fillColor = new Color(103 - t * 48, 152 - t * 51, 220 - t * 29);
        g.rect(-w / 2, y - h / 2, w, Math.min(8, h - y)); g.fill();
    }
    rect(g, -w / 2, -h / 2, w, 210, '#7779b8');
    for (let i = 0; i < 12; i++) {
        const x = -w / 2 + 14 + i * 60;
        const bh = [110, 155, 85, 190, 125, 165][i % 6];
        rect(g, x, -h / 2 + 100, 43, bh, '#686bb1');
        rect(g, x + 6, -h / 2 + 100 + bh, 31, 6, '#8489ce');
        for (let yy = 115; yy < 95 + bh; yy += 24)
            for (let xx = 8; xx < 35; xx += 13)
                rect(g, x + xx, -h / 2 + yy, 6, 10, '#a1c9ee');
    }
}

export function rooftop(node: Node) {
    const g = surface(node);
    const { width: w, height: h } = node.getComponent(UITransform).contentSize;
    const bleed = verticalBleed(node);
    rect(g, -w / 2, -h / 2 - bleed, w, h + bleed, '#565080');
    rect(g, -w / 2, h / 2 - 12, w, 12, '#b1a4df');
    rect(g, -w / 2, h / 2 - 18, w, 6, '#393451');
    for (let x = -w / 2 + 20; x < w / 2; x += 60)
        rect(g, x, -h / 2 - bleed + 10, 2, h + bleed - 38, '#716694');
}

export function building(node: Node) {
    const g = surface(node);
    const { width: w, height: h } = node.getComponent(UITransform).contentSize;
    rect(g, -w / 2, -h / 2, w, h, '#39355f');
    rect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, '#7463ad');
    rect(g, -w / 2 + 5, -h / 2 + 4, 5, h - 8, '#9c8bcc');
    // Both upper and lower obstacles use complete facades, never stretched pipe slices.
    for (let y = -h / 2 + 20; y < h / 2 - 24; y += 38) {
        const windowWidth = 8;
        const spacing = 14;
        for (let column = 0; column < 3; column++) {
            const x = (column - 1) * spacing - windowWidth / 2;
            rect(g, x, y, windowWidth, 21, '#464276');
            rect(g, x + 1, y + 3, windowWidth - 2, 16, '#8ee5ec');
        }
        rect(g, -w / 2 + 8, y - 5, w - 16, 2, '#a294ce');
    }
    rect(g, -w / 2 + 3, -h / 2 + 3, w - 6, 8, '#b0a0d6');
    rect(g, -w / 2 + 3, h / 2 - 11, w - 6, 8, '#b0a0d6');
}

export function flame(g: Graphics, time: number, boost: boolean) {
    g.clear();
    const length = (boost ? 25 : 17) + Math.sin(time * 32) * 3;
    g.fillColor = new Color('#ff8a31');
    g.moveTo(-10, 2); g.lineTo(-14 - length, -4); g.lineTo(-10, -9); g.close(); g.fill();
    g.fillColor = new Color('#ffe79d');
    g.moveTo(-11, 0); g.lineTo(-15 - length * 0.65, -4); g.lineTo(-11, -7); g.close(); g.fill();
}

export function replayButton(node: Node) {
    const g = surface(node);
    const { width: w, height: h } = node.getComponent(UITransform).contentSize;
    g.fillColor = new Color('#352c58');
    g.roundRect(-w / 2, -h / 2 - 5, w, h, 24); g.fill();
    g.fillColor = new Color('#fff3dc');
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 22); g.fill();
    // Open circular arrow, unlike the old play triangle.
    g.strokeColor = new Color('#e87930'); g.lineWidth = 9;
    const r = 25;
    for (let i = 0; i <= 40; i++) {
        const a = (-45 - i * 280 / 40) * Math.PI / 180;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillColor = new Color('#e87930');
    g.moveTo(14, 8); g.lineTo(35, 15); g.lineTo(17, 31); g.close(); g.fill();
}

export function scorePanel(node: Node) {
    const g = surface(node);
    const { width: w, height: h } = node.getComponent(UITransform).contentSize;
    g.fillColor = new Color('#392f5c');
    g.roundRect(-w / 2, -h / 2 - 5, w, h, 24); g.fill();
    g.fillColor = new Color('#fff0d1');
    g.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 21); g.fill();
}

export function pawMedal(node: Node, tier = 0) {
    const g = surface(node);
    const { width, height } = node.getComponent(UITransform).contentSize;
    const r = Math.min(width, height) / 2 - 3;
    const colors = ['#d2bdab', '#cbd6e5', '#f2c05c', '#c6b4ed'];
    g.fillColor = new Color('#443658'); g.circle(0, 0, r); g.fill();
    g.fillColor = new Color(colors[tier]); g.circle(0, 0, r - 4); g.fill();
    g.fillColor = new Color('#fff1d5'); g.circle(0, 0, r - 9); g.fill();
    g.fillColor = new Color('#805447');
    g.ellipse(0, -r * 0.22, r * 0.40, r * 0.30); g.fill();
    for (const [x, y] of [[-0.46, 0.18], [-0.18, 0.48], [0.18, 0.48], [0.46, 0.18]]) {
        g.ellipse(x * r, y * r, r * 0.14, r * 0.18); g.fill();
    }
}

export function continueButton(node: Node) {
    const g = surface(node);
    const { width: w, height: h } = node.getComponent(UITransform).contentSize;
    g.fillColor = new Color('#49345a');
    g.roundRect(-w / 2, -h / 2 - 5, w, h, 24); g.fill();
    g.fillColor = new Color('#ffd28a');
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 22); g.fill();
    // Video screen + play glyph; text is a native Label in the scene.
    g.strokeColor = new Color('#80512f'); g.lineWidth = 4;
    g.roundRect(-28, 5, 56, 36, 7); g.stroke();
    g.fillColor = new Color('#80512f');
    g.moveTo(-6, 12); g.lineTo(10, 23); g.lineTo(-6, 34); g.close(); g.fill();
}
