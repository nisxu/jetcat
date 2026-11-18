import { BlockInputEvents, Color, Graphics, Label, Node, UITransform } from 'cc';

export type RewardResult = 'completed' | 'cancelled' | 'failed';

/** Development-only UI. No network request, real ad, or advertising revenue. */
export class MockRewardedAd {
    private panel: Node | null = null;
    private settle: ((result: RewardResult) => void) | null = null;

    show(parent: Node): Promise<RewardResult> {
        if (this.settle) return Promise.resolve('failed');
        return new Promise(resolve => {
            this.settle = resolve;
            try {
                const panel = new Node('MockRewardedAd');
                this.panel = panel;
                parent.addChild(panel);
                // Overscan blocks input on tall screens without changing gameplay geometry.
                panel.addComponent(UITransform).setContentSize(4000, 6000);
                panel.addComponent(BlockInputEvents);
                const g = panel.addComponent(Graphics);
                g.fillColor = new Color(15, 18, 40, 235);
                g.rect(-2000, -3000, 4000, 6000); g.fill();
                g.fillColor = new Color('#fff3dc');
                g.roundRect(-300, -310, 600, 620, 24); g.fill();
                this.label(panel, 'TEST AD', 235, 32, '#393451');
                this.label(panel, 'Simulation only · No real ad', 180, 22, '#80594d');
                this.button(panel, 'COMPLETE', 75, '#d7edcf', 'completed');
                this.button(panel, 'CANCEL', -35, '#e5dff2', 'cancelled');
                this.button(panel, 'FAIL', -145, '#f4d6ce', 'failed');
                this.label(panel, 'Only COMPLETE grants a revive.', -250, 22, '#80594d');
            } catch (error) {
                this.finish('failed');
            }
        });
    }

    cancel() { this.finish('cancelled'); }

    private finish(result: RewardResult) {
        const resolve = this.settle;
        if (!resolve) return;
        this.settle = null;
        const panel = this.panel;
        this.panel = null;
        if (panel?.isValid) { panel.active = false; panel.destroy(); }
        resolve(result);
    }

    private label(parent: Node, text: string, y: number, size: number, color: string) {
        const node = new Node('Text');
        parent.addChild(node);
        node.setPosition(0, y, 0);
        node.addComponent(UITransform).setContentSize(560, 65);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 8;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(color);
        return node;
    }

    private button(parent: Node, text: string, y: number, color: string, result: RewardResult) {
        const node = new Node(result);
        parent.addChild(node);
        node.setPosition(0, y, 0);
        node.addComponent(UITransform).setContentSize(510, 84);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(color);
        g.roundRect(-255, -42, 510, 84, 16); g.fill();
        this.label(node, text, 0, 28, '#393451');
        node.on(Node.EventType.TOUCH_END, (event) => {
            event.propagationStopped = true;
            this.finish(result);
        });
    }
}
