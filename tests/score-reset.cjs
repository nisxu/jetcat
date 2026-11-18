// Run with: node tests/score-reset.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript/lib/typescript.js');
const storage = new Map();
const cc = {
  sys: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } },
  Component: class {},
  _decorator: { ccclass: () => target => target, property: () => {} },
};
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'scripts', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => name === 'cc' ? cc : dependencies[name] || {} });
  return exports;
}
const { GameData } = load('GameData.ts');
const { GameManager } = load('GameManager.ts', {
  './GameData': { GameData }, './AudioMgr': { AudioMgr: { inst: { playOneShot() {} } } },
});
function scene() {
  const game = new GameManager();
  game.scoreLabel = { string: 'stale' };
  game.bird = { disableControl() {}, enableControl() {} };
  game.bg = game.land = { disableMove() {}, enableMove() {} };
  game.pipeManager = { disableSpawn() {}, enableSpawn() {} };
  game.gamingUI = { active: false };
  game.gameOverUI = { hide() {}, show() {} };
  game.enterReady();
  return game;
}
const first = scene();
first.enterPlaying();
for (let i = 0; i < 5; i++) first.addScore();
first.enterGameOver();
assert.equal(GameData.getScore(), 5);
assert.equal(GameData.getBestScore(), 5);
first.addScore();
assert.equal(GameData.getScore(), 5, 'collision events after death must not score');
for (let replay = 0; replay < 3; replay++) {
  const next = scene(); // New scene instance, same static GameData: actual replay lifecycle.
  assert.equal(GameData.getScore(), 0);
  assert.equal(next.scoreLabel.string, '0');
  next.addScore();
  assert.equal(GameData.getScore(), 0, 'ready state must not score');
  next.enterPlaying();
  next.addScore();
  assert.equal(GameData.getScore(), 1, 'first obstacle must award 1, not previous score + 1');
  assert.equal(next.scoreLabel.string, '1');
  next.enterGameOver();
  assert.equal(GameData.getBestScore(), 5, 'replay must preserve personal best');
}
console.log('PASS: scene reload resets score, first obstacle scores 1, best score survives, inactive states cannot score.');

// Continue preserves this run, blocks scoring during recovery, and schedules once.
const resumed = scene();
const jobs = [];
let clears = 0, prepares = 0, finishes = 0;
resumed.scheduleOnce = (fn, delay) => jobs.push({ fn, delay });
resumed.reviveCountdown = { node: { active: false }, string: '' };
resumed.pipeManager.clearForRevive = () => clears++;
resumed.bird.prepareRevive = () => prepares++;
resumed.bird.finishRevive = () => finishes++;
resumed.enterPlaying();
resumed.addScore(3);
resumed.enterGameOver();
resumed.revive();
resumed.revive();
assert.equal(clears, 1);
assert.equal(prepares, 1);
assert.equal(resumed.reviveSecondsLeft, 3);
assert.equal(resumed.scoreLabel.string, '3');
resumed.addScore();
resumed.enterGameOver();
assert.equal(GameData.getScore(), 3, 'recovery cannot score or die from stale contacts');
resumed.update(1);
assert.equal(resumed.reviveCountdown.string, 'READY  2');
resumed.update(1);
assert.equal(resumed.reviveCountdown.string, 'READY  1');
resumed.update(1.1);
resumed.update(1);
assert.equal(finishes, 1);
assert.equal(resumed.reviveCountdown.node.active, false);
resumed.addScore();
assert.equal(GameData.getScore(), 4, 'first obstacle after continue increments retained score');
resumed.enterGameOver();
assert.equal(GameData.getBestScore(), 5);
scene();
assert.equal(GameData.getScore(), 0, 'restart still resets score after a continued game');
console.log('PASS: revive preserves score, clears obstacles once, guards countdown, resumes scoring; restart resets.');

// Exercise actual Bird recovery methods with a body that rejects lifecycle toggles.
cc.RigidBody2D = class {};
cc.Collider2D = class {};
cc.Vec2 = class { constructor(x,y) { this.x=x; this.y=y; } };
const { Bird } = load('Bird.ts');
const bird = new Bird();
let wakes = 0;
const body = { gravityScale: 1.8, linearVelocity: null, angularVelocity: 7, wakeUp() { wakes++; } };
Object.defineProperty(body, 'enabled', { set() { throw Error('Must not toggle body lifecycle'); } });
bird.getComponent = type => { assert.equal(type, cc.RigidBody2D); return body; };
bird.node = { angle: 30, setPosition(x,y,z) { this.position = [x,y,z]; } };
bird.jet = { node: { active: true } };
bird.normalGravityScale = 1.8;
for (let i=0; i<3; i++) {
  bird.prepareRevive();
  assert.equal(body.gravityScale, 0);
  assert.equal(body.linearVelocity.y, 0);
  assert.deepEqual(bird.node.position, [0,80,0]);
  bird.finishRevive();
  assert.equal(body.gravityScale, 1.8);
  assert.equal(body.linearVelocity.y, 6);
  assert.equal(body.angularVelocity, 0);
}
assert.equal(wakes, 6);
console.log('PASS: repeated physical recovery restores gravity, velocity and wake state without disabling bodies/fixtures.');

// Regression for the recorded freeze: a missing serialized label must not block recovery.
const noLabel = scene();
noLabel.pipeManager.clearForRevive = () => {};
noLabel.bird.prepareRevive = () => {};
noLabel.bird.finishRevive = () => {};
noLabel.enterPlaying();
noLabel.addScore(2);
noLabel.enterGameOver();
noLabel.reviveCountdown = null;
noLabel.revive();
noLabel.update(1);
noLabel.update(2.1);
noLabel.addScore();
assert.equal(GameData.getScore(), 3);
const fallback = scene();
const expectedLabel = { string: '', node: { active: false } };
fallback.node = { parent: { getChildByName: name => name === 'ReviveCountdown' ? { getComponent: () => expectedLabel } : null } };
fallback.onLoad();
assert.equal(fallback.reviveCountdown, expectedLabel);
console.log('PASS: missing countdown binding recovers by node name; even absent UI cannot freeze gameplay.');

// One revive per run, enforced by the manager even if a hidden button is invoked.
const limited = scene();
let limitedPrepares = 0;
const availability = [];
limited.gameOverUI.show = (_score, _best, available) => availability.push(available);
limited.pipeManager.clearForRevive = () => {};
limited.bird.prepareRevive = () => limitedPrepares++;
limited.bird.finishRevive = () => {};
limited.enterPlaying();
limited.enterGameOver();
assert.equal(limited.canRevive(), true);
limited.revive();
limited.update(3.1);
limited.enterGameOver();
assert.equal(limited.canRevive(), false);
limited.revive();
assert.equal(limitedPrepares, 1);
assert.deepEqual(availability, [true, false]);
limited.enterReady();
limited.enterPlaying();
limited.enterGameOver();
assert.equal(limited.canRevive(), true, 'new run restores one revive');
limited.revive();
assert.equal(limitedPrepares, 2);

cc.Node = class {
  static EventType = { TOUCH_END: 'touchend' };
  constructor(name) { this.name = name; this.children = []; this.active = true; this.isValid = true; this.components = new Map(); }
  addChild(node) { this.children.push(node); }
  setPosition() {}
  addComponent(Type) { const value = new Type(); this.components.set(Type, value); return value; }
  getComponent(Type) { return this.components.get(Type); }
  getChildByName(name) { return this.children.find(n => n.name === name); }
  on(_event, callback) { this.click = callback; }
  destroy() { this.isValid = false; }
};
cc.UITransform = class { setContentSize() {} };
cc.BlockInputEvents = class {};
cc.Color = class {};
cc.Graphics = class { rect() {} roundRect() {} fill() {} };
cc.Label = class { static HorizontalAlign = { CENTER: 1 }; static VerticalAlign = { CENTER: 1 }; };
cc.Button = class {};
const { MockRewardedAd } = load('UI/MockRewardedAd.ts');
let pauses = 0, resumes = 0, reloads = 0;
const audio = { audioSource: { playing: true, isValid: true }, pause() { pauses++; }, resume() { resumes++; } };
cc.director = { getScene: () => ({name: 'game'}), loadScene() { reloads++; } };
const { GameOverUI } = load('UI/GameOverUI.ts', {
  '../JetCatVisuals': { pawMedal() {} }, './MockRewardedAd': { MockRewardedAd },
  '../GameManager': { GameManager }, '../AudioMgr': { AudioMgr: { inst: audio } },
});
const over = new GameOverUI();
const continueButton = { active: true };
const replayButton = { position: {x:-155, y:-293.913, z:0}, setPosition(x,y,z) { this.position={x,y,z}; } };
over.node = { active: false, getChildByName: name => name === 'ContinueButton' ? continueButton : replayButton };
over.curScoreLabel = { string: '' }; over.bestScoreLabel = { string: '' }; over.newSprite = { active: false };
for (const available of [true, false, true]) {
  over.show(3,5,available);
  assert.equal(continueButton.active, available);
  assert.equal(replayButton.position.x, available ? -155 : 0);
  assert.equal(replayButton.position.y, -293.913);
}
console.log('PASS: one revive per run; second death hides continue and centers replay; new run restores both.');

(async () => {
  const game = scene();
  GameManager._inst = game;
  game.pipeManager.clearForRevive = () => {};
  game.bird.prepareRevive = () => {};
  game.bird.finishRevive = () => {};
  game.enterPlaying(); game.addScore(7); game.enterGameOver();
  const ui = new GameOverUI();
  ui.isValid = true; ui.node = new cc.Node('GameOverUI');
  for (const name of ['ContinueButton', 'ReplayButton']) {
    const node = new cc.Node(name); node.addComponent(cc.Button); ui.node.addChild(node);
  }
  game.gameOverUI = ui;
  for (const result of ['cancelled', 'failed', 'completed']) {
    const pending = ui.onContinueClick();
    assert.equal(ui.rewardPending, true);
    assert.equal(ui.node.getChildByName('ReplayButton').getComponent(cc.Button).interactable, false);
    await ui.onContinueClick(); // second click must not open a second panel
    ui.onReplayClick(); assert.equal(reloads, 0);
    const panel = ui.mockAd.panel;
    panel.getChildByName(result).click({});
    panel.getChildByName(result).click({}); // duplicate callback cannot reward twice
    await pending;
    assert.equal(ui.rewardPending, false);
    assert.equal(GameData.getScore(), 7);
    assert.equal(game.canRevive(), result !== 'completed');
  }
  game.update(3.1); game.addScore();
  assert.equal(GameData.getScore(), 8);
  assert.equal(pauses, 3); assert.equal(resumes, 3);
  game.curState = 2; // subsequent death
  assert.equal(game.canRevive(), false);
  game.enterReady(); game.curState = 2; ui.node.active = true;
  assert.equal(game.canRevive(), true);
  ui.enableMockAds = false;
  await ui.onContinueClick();
  assert.equal(game.canRevive(), true, 'missing real provider must not grant reward');
  ui.enableMockAds = true;
  const abandoned = ui.onContinueClick();
  ui.node.active = false; ui.onDisable(); await abandoned;
  assert.equal(game.canRevive(), true, 'closing scene cancels pending request');
  ui.node.active = true;
  const stale = ui.onContinueClick();
  GameManager._inst = scene();
  ui.mockAd.panel.getChildByName('completed').click({}); await stale;
  assert.equal(game.canRevive(), true, 'late result cannot revive another round');
  console.log('PASS: mock complete/cancel/failure, duplicate clicks, replay lock, audio restore, stale callbacks and production fail-closed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
