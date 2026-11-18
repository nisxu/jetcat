import type { RunController } from './RunController';

/** Runtime access without importing component classes back into their own dependencies. */
export class RunContext {
    static current: RunController = null;
    static inst(): RunController { return this.current; }
}
