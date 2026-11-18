// Run with: node tests/score-reset.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript/lib/typescript.js');
const storage = new Map();
const cc = {
  resources: { load(_path, _type, callback) { callback(null, { name: "coin01" }); } },
  sys: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } },
  Component: class {},
  _decorator: { ccclass: () => target => target, property: () => {} },
};
function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'scripts', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { ...globals, exports, require: name => name === 'cc' ? cc : dependencies[name] || (name === 'cc/env' ? { PREVIEW: true } : name.endsWith('/RunContext') ? { RunContext } : name.endsWith('/GameplayTuning') ? load('GameplayTuning.ts') : {}) });
  return exports;
}
const { RunContext } = load('RunContext.ts');
const { ScoreStore } = load('ScoreStore.ts');
const scoreAudioCalls = [];
const { RunController } = load('RunController.ts', {
  './ScoreStore': { ScoreStore }, './AudioService': { AudioService: { inst: { stopEffects() {}, prepareEffects() {}, playOneShot(clip) { scoreAudioCalls.push(clip); } } } },
});
function scene() {
  const game = new RunController();
  game.scoreLabel = { string: 'stale' };
  game.player = { disableControl() {}, enableControl() {} };
  game.skyline = game.rooftops = { disableMove() {}, enableMove() {} };
  game.obstacles = { disableSpawn() {}, enableSpawn() {} };
  game.gamingUI = { active: false };
  game.gameOverUI = { hide() {}, show() {} };
  game.enterReady();
  return game;
}
const first = scene();
first.enterPlaying();
for (let i = 0; i < 5; i++) first.addScore();
first.enterGameOver();
assert.equal(ScoreStore.getScore(), 5);
assert.equal(ScoreStore.getBestScore(), 5);
first.addScore();
assert.equal(ScoreStore.getScore(), 5, 'collision events after death must not score');
for (let replay = 0; replay < 3; replay++) {
  const next = scene(); // New scene instance, same static ScoreStore: actual replay lifecycle.
  assert.equal(ScoreStore.getScore(), 0);
  assert.equal(next.scoreLabel.string, '0');
  next.addScore();
  assert.equal(ScoreStore.getScore(), 0, 'ready state must not score');
  next.enterPlaying();
  next.addScore();
  assert.equal(ScoreStore.getScore(), 1, 'first obstacle must award 1, not previous score + 1');
  assert.equal(next.scoreLabel.string, '1');
  next.enterGameOver();
  assert.equal(ScoreStore.getBestScore(), 5, 'replay must preserve personal best');
}
console.log('PASS: scene reload resets score, first obstacle scores 1, best score survives, inactive states cannot score.');

// Continue preserves this run, blocks scoring during recovery, and schedules once.
const resumed = scene();
const jobs = [];
let clears = 0, prepares = 0, finishes = 0;
resumed.scheduleOnce = (fn, delay) => jobs.push({ fn, delay });
resumed.reviveCountdown = { node: { active: false }, string: '' };
resumed.obstacles.clearForRevive = () => clears++;
resumed.player.prepareRevive = () => prepares++;
resumed.player.finishRevive = () => finishes++;
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
assert.equal(ScoreStore.getScore(), 3, 'recovery cannot score or die from stale contacts');
resumed.update(1);
assert.equal(resumed.reviveCountdown.string, 'READY  2');
resumed.update(1);
assert.equal(resumed.reviveCountdown.string, 'READY  1');
resumed.update(1.1);
resumed.update(1);
assert.equal(finishes, 1);
assert.equal(resumed.reviveCountdown.node.active, false);
resumed.addScore();
assert.equal(ScoreStore.getScore(), 4, 'first obstacle after continue increments retained score');
resumed.enterGameOver();
assert.equal(ScoreStore.getBestScore(), 5);
scene();
assert.equal(ScoreStore.getScore(), 0, 'restart still resets score after a continued game');
console.log('PASS: revive preserves score, clears obstacles once, guards countdown, resumes scoring; restart resets.');

// Exercise actual JetCatController recovery methods with a body that rejects lifecycle toggles.
cc.RigidBody2D = class {};
cc.Collider2D = class {};
cc.Vec2 = class { constructor(x,y) { this.x=x; this.y=y; } };
const { JetCatController } = load('JetCatController.ts', { './AudioService': { AudioService: { inst: { prepareEffects() {} } } } });
const player = new JetCatController();
let wakes = 0;
const body = { gravityScale: 1.8, linearVelocity: null, angularVelocity: 7, wakeUp() { wakes++; } };
Object.defineProperty(body, 'enabled', { set() { throw Error('Must not toggle body lifecycle'); } });
player.getComponent = type => { assert.equal(type, cc.RigidBody2D); return body; };
player.node = { angle: 30, setPosition(x,y,z) { this.position = [x,y,z]; } };
player.jet = { node: { active: true } };
player.normalGravityScale = 1.8;
for (let i=0; i<3; i++) {
  player.prepareRevive();
  assert.equal(body.gravityScale, 0);
  assert.equal(body.linearVelocity.y, 0);
  assert.deepEqual(player.node.position, [0,80,0]);
  player.finishRevive();
  assert.equal(body.gravityScale, 1.8);
  assert.equal(body.linearVelocity.y, 6);
  assert.equal(body.angularVelocity, 0);
}
assert.equal(wakes, 6);
console.log('PASS: repeated physical recovery restores gravity, velocity and wake state without disabling bodies/fixtures.');

// Regression for the recorded freeze: a missing serialized label must not block recovery.
const noLabel = scene();
noLabel.obstacles.clearForRevive = () => {};
noLabel.player.prepareRevive = () => {};
noLabel.player.finishRevive = () => {};
noLabel.enterPlaying();
noLabel.addScore(2);
noLabel.enterGameOver();
noLabel.reviveCountdown = null;
noLabel.revive();
noLabel.update(1);
noLabel.update(2.1);
noLabel.addScore();
assert.equal(ScoreStore.getScore(), 3);
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
limited.obstacles.clearForRevive = () => {};
limited.player.prepareRevive = () => limitedPrepares++;
limited.player.finishRevive = () => {};
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
  addComponent(Type) {
    if (Type === cc.Label || Type === cc.Graphics) {
      assert.ok(!this.components.has(cc.Label) && !this.components.has(cc.Graphics), 'one UI renderer per node');
    }
    const value = new Type(); this.components.set(Type, value); return value; }
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
cc.Button = class { static EventType = { CLICK: 'click' }; };
const { MockRewardedAd } = load('UI/MockRewardedAd.ts');
let pauses = 0, resumes = 0, reloads = 0;
const audio = { audioSource: { playing: true, isValid: true }, pause() { pauses++; }, resume() { resumes++; } };
cc.director = { getScene: () => ({name: 'game'}), loadScene() { reloads++; } };
const { GameOverUI } = load('UI/GameOverUI.ts', {
  '../JetCatVisuals': { pawMedal() {} }, './MockRewardedAd': { MockRewardedAd },
  '../ScoreStore': { ScoreStore }, '../RunContext': { RunContext }, '../AudioService': { AudioService: { inst: audio } },
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
  RunContext.current = game;
  game.obstacles.clearForRevive = () => {};
  game.player.prepareRevive = () => {};
  game.player.finishRevive = () => {};
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
    assert.equal(ScoreStore.getScore(), 7);
    assert.equal(game.canRevive(), result !== 'completed');
  }
  game.update(3.1); game.addScore();
  assert.equal(ScoreStore.getScore(), 8);
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
  RunContext.current = scene();
  ui.mockAd.panel.getChildByName('completed').click({}); await stale;
  assert.equal(game.canRevive(), true, 'late result cannot revive another round');
  console.log('PASS: mock complete/cancel/failure, duplicate clicks, replay lock, audio restore, stale callbacks and production fail-closed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Confirmation must not clear storage until the explicit RESET action.
const resetUI = new GameOverUI();
resetUI.node = new cc.Node('GameOverUI');
resetUI.bestScoreLabel = { string: '25' }; resetUI.newSprite = { active: true };
storage.set('BestScore', '25');
const scoreBeforeReset = ScoreStore.getScore();
resetUI.onResetBestClick();
assert.equal(ScoreStore.getBestScore(), 25);
resetUI.resetDialog.getChildByName('CANCEL').click({});
assert.equal(ScoreStore.getBestScore(), 25);
resetUI.onResetBestClick();
resetUI.resetDialog.getChildByName('RESET').click({});
assert.equal(ScoreStore.getBestScore(), 0);
assert.equal(resetUI.bestScoreLabel.string, '0');
assert.equal(ScoreStore.getScore(), scoreBeforeReset);
assert.equal(resetUI.resetDialog, null);
console.log('PASS: best-score confirmation preserves on cancel, resets storage/UI on confirm, leaves current score unchanged.');

const savedScene = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets/game.scene'), 'utf8'));
const musicNode = savedScene.find(n => n._name === 'MusicToggle');
const musicTypes = musicNode._components.map(ref => savedScene[ref.__id__].__type__);
assert.equal(musicTypes.includes('cc.Label'), false, 'music graphics must not compete with a Label renderer');
assert.equal(musicTypes.filter(t => t === 'cc.Graphics').length, 1);
console.log('PASS: music icon has exactly one Graphics renderer and no stale Label.');

const savedScoreForVisibility = ScoreStore.getScore();
const visibilityGame = scene();
const musicControl = { active: false };
visibilityGame.node = { parent: { getChildByName: name => name === 'MusicToggle' ? musicControl : null } };
visibilityGame.enterReady(); assert.equal(musicControl.active, true);
visibilityGame.enterPlaying(); assert.equal(musicControl.active, false);
visibilityGame.enterGameOver(); assert.equal(musicControl.active, true);
visibilityGame.obstacles.clearForRevive = () => {};
visibilityGame.player.prepareRevive = () => {};
visibilityGame.player.finishRevive = () => {};
visibilityGame.revive(); assert.equal(musicControl.active, false);
visibilityGame.update(3.1); assert.equal(musicControl.active, false);
visibilityGame.enterGameOver(); assert.equal(musicControl.active, true);
console.log('PASS: music control visible only on ready/game-over, hidden during play and revive countdown.');

ScoreStore.resetScore(); ScoreStore.addScore(savedScoreForVisibility);

const scoreSoundGame = scene();
scoreSoundGame.scoreAudio = { name: 'coin01' };
const countCoin = () => scoreAudioCalls.filter(clip => clip === scoreSoundGame.scoreAudio).length;
scoreSoundGame.addScore(); assert.equal(countCoin(), 0);
scoreSoundGame.enterPlaying();
scoreSoundGame.addScore(); scoreSoundGame.addScore(); assert.equal(countCoin(), 2);
scoreSoundGame.enterGameOver(); scoreSoundGame.addScore(); assert.equal(countCoin(), 2);
scoreSoundGame.obstacles.clearForRevive = () => {};
scoreSoundGame.player.prepareRevive = () => {};
scoreSoundGame.player.finishRevive = () => {};
scoreSoundGame.revive(); scoreSoundGame.addScore(); assert.equal(countCoin(), 2);
scoreSoundGame.update(3.1); scoreSoundGame.addScore(); assert.equal(countCoin(), 3);
ScoreStore.resetScore(); ScoreStore.addScore(savedScoreForVisibility);
console.log('PASS: score sound plays once per score, including after revive, never during ready/death/countdown.');

const unboundBoostBird = new JetCatController();
unboundBoostBird.isValid = true;
unboundBoostBird.loadBoostAudio();
assert.ok(unboundBoostBird.boostAudio, 'missing binding loads the single boost resource');
assert.equal(unboundBoostBird.boostLoading, false);
console.log('PASS: single boost binding recovers through resource loading.');

// Real AudioService with lightweight source doubles: no player allocation on repeated taps.
cc.AudioClip = class {};
let allocatedSources = 0;
cc.AudioSource = class {
  constructor() { allocatedSources++; this.playing = false; }
  play() { this.playing = true; }
  stop() { this.playing = false; }
  pause() { this.playing = false; }
};
cc.director = { getScene: () => new cc.Node('scene'), addPersistRootNode() {} };
const { AudioService: CachedAudioMgr } = load('AudioService.ts');
const cachedAudio = new CachedAudioMgr();
const bursts = Array.from({length: 1}, () => new cc.AudioClip());
const coinClip = new cc.AudioClip();
cachedAudio.prepareEffects([...bursts, coinClip]);
const warmCount = allocatedSources;
cachedAudio.playOneShot(coinClip, 0.2);
for (let i = 0; i < 50; i++) cachedAudio.playOneShot(bursts[0], 1.0);
assert.equal(allocatedSources, warmCount, 'clicks must reuse warmed sources');
assert.equal(cachedAudio.effects.get(coinClip).playing, true, 'boost must not cut score playback');
assert.equal(cachedAudio.effects.size, 2, 'one boost source plus one score source');
assert.equal(cachedAudio.effects.get(bursts[0]).volume, 1.0);
console.log('PASS: boost and score share cached playback; 50 taps allocate no new sources and do not interrupt score.');

const hitClip = new cc.AudioClip();
cachedAudio.prepareEffects([hitClip]);
cachedAudio.stopEffects();
cachedAudio.playOneShot(hitClip);
assert.equal(cachedAudio.effects.get(bursts[0]).playing, false);
assert.equal(cachedAudio.effects.get(coinClip).playing, false);
assert.equal(cachedAudio.effects.get(hitClip).playing, true);
console.log('PASS: death stops competing effects and plays the cached hit source.');

let redundantStops = 0;
const hitSource = cachedAudio.effects.get(hitClip);
hitSource.stop = () => { redundantStops++; hitSource.playing = false; };
hitSource.playing = false; // Simulate natural ENDED, followed by another run.
cachedAudio.stopEffects(hitClip);
cachedAudio.playOneShot(hitClip);
assert.equal(redundantStops, 0, 'ended hit source must not receive a redundant STOP before PLAY');
assert.equal(hitSource.playing, true);
cachedAudio.stopEffects(hitClip);
assert.equal(hitSource.playing, true, 'death cleanup must exclude the hit source');
console.log('PASS: repeated game-over playback avoids redundant native STOP operations.');

cc.Vec3 = class { constructor(x,y,z) { Object.assign(this,{x,y,z}); } };
const layoutUI = new GameOverUI();
const resetNode = { position: {x:0,y:-590}, setPosition(p) { this.position=p; } };
layoutUI.node = {
 getChildByName: () => resetNode,
 parent: { getComponent: () => ({convertToWorldSpaceAR: p => p}) },
 getComponent: () => ({convertToNodeSpaceAR: p => p}),
};
for (const height of [1000,1280,1800]) {
 cc.view = {getVisibleSize: () => ({width:720,height})};
 cc.sys.getSafeAreaRect = () => ({x:0,y:32,width:720,height:height-64});
 layoutUI.lateUpdate();
 assert.equal(resetNode.position.x,0);
 assert.equal(resetNode.position.y,32-height/2+52);
 assert.ok(resetNode.position.y-32 >= 32-height/2, 'entire button stays above safe bottom');
}
console.log('PASS: reset button stays centered and inside the safe area on short and tall screens.');

// Flight/input contract: preserve response and collision behavior, not just source constants.
const { CollisionTags } = load('CollisionTags.ts');
const flightSoundCalls = [];
const { JetCatController: TestedPlayer } = load('JetCatController.ts', {
  './RunContext': { RunContext: {inst: () => ({ isMusicTouch: e => !!e.music, enterGameOver: () => deaths++, addScore: () => points++ })} },
  './AudioService': { AudioService: {inst: {playOneShot: (...args) => flightSoundCalls.push(args)}} },
  './CollisionTags': { CollisionTags },
  './JetCatVisuals': {flame() {}},
});
let deaths=0,points=0;
const flyer = new TestedPlayer();
const flightBody = {linearVelocity: new cc.Vec2(0,0)};
flyer.getComponent = () => flightBody;
flyer.node = {angle:0}; flyer.jet = {node:{active:false}};
flyer.boostAudio = {name:'boost1'};
flyer.onTouchStart({}); assert.equal(flightBody.linearVelocity.y,0);
flyer._canControl = true;
flyer.onTouchStart({music:true}); assert.equal(flightBody.linearVelocity.y,0);
flyer.onTouchStart({}); assert.equal(flightBody.linearVelocity.y,10);
assert.equal(flyer.boostTime,0.18); assert.equal(flightSoundCalls[0][1],1.0);
flyer.update(1/60); assert.ok(Math.abs(flyer.node.angle-10/6)<1e-10);
flyer.onBeginContact(null,{tag:CollisionTags.ROOFTOP},null);
flyer.onBeginContact(null,{tag:CollisionTags.BUILDING},null);
flyer.onBeginContact(null,{tag:CollisionTags.SCORE_GATE},null);
flyer.onEndContact(null,{tag:CollisionTags.SCORE_GATE},null);
assert.equal(deaths,2);assert.equal(points,1);
flyer._canControl=false;
flyer.onBeginContact(null,{tag:CollisionTags.BUILDING},null);
flyer.onEndContact(null,{tag:CollisionTags.SCORE_GATE},null);
assert.equal(deaths,2);assert.equal(points,1);
console.log('PASS: tap speed, tilt response, boost timing/volume, music-touch exclusion and collision gates unchanged.');

// Production hides unavailable revive entry; preview retains the existing simulation.
const { GameOverUI: ReleaseResults } = load('UI/GameOverUI.ts', {
  'cc/env': {PREVIEW:false},
  '../JetCatVisuals': {pawMedal() {}}, './MockRewardedAd': {MockRewardedAd},
});
const releaseUI = new ReleaseResults();
const releaseContinue = {active:true};
const releaseReplay = {position:{x:-155,y:0,z:0},setPosition(x,y,z){this.position={x,y,z};}};
releaseUI.node={active:false,getChildByName:n=>n==='ContinueButton'?releaseContinue:releaseReplay};
releaseUI.curScoreLabel={};releaseUI.bestScoreLabel={};releaseUI.newSprite={};
releaseUI.show(2,5,true);
assert.equal(releaseContinue.active,false);assert.equal(releaseReplay.position.x,0);
const { GameOverUI: PhoneResults } = load('UI/GameOverUI.ts', {
  'cc/env':{PREVIEW:false}, './MockRewardedAd':{MockRewardedAd},
}, {__JETCAT_DEV_ADS__:true});
assert.equal(new PhoneResults().testAdsAvailable,true);
console.log('PASS: release cannot enable test ads via scene toggle; phone preview retains simulated revive.');

const savedRun = RunContext.current;
RunContext.current = {moveSpeed:100};
function positionNode(x=0,y=0) {
  return {position:{x,y,z:0},active:true,destroyed:false,
    getPosition(){return { ...this.position,add3f(dx,dy,dz){return {x:this.x+dx,y:this.y+dy,z:this.z+dz};}};},
    setPosition(p){this.position=p;},destroy(){this.destroyed=true;}};
}
const { WorldScroller }=load('WorldScroller.ts');
const scrolling=new WorldScroller();scrolling.target1=positionNode(0);scrolling.target2=positionNode(728);scrolling.start();
scrolling.update(1);assert.equal(scrolling.target1.position.x,0);
scrolling.enableMove();scrolling.update(0.5);assert.equal(scrolling.target1.position.x,-50);assert.equal(scrolling.target2.position.x,678);
scrolling.target1.position.x=-731;scrolling.target2.position.x=-3;scrolling.update(0);
assert.equal(scrolling.target1.position.x,725);
scrolling.disableMove();scrolling.update(1);assert.equal(scrolling.target1.position.x,725);
const { BuildingObstacle }=load('BuildingObstacle.ts');
const moving=new BuildingObstacle();moving.node=positionNode(-899);moving.start();moving.update(0.01);
assert.equal(moving.node.destroyed,false);moving.update(0.01);assert.equal(moving.node.destroyed,true);
console.log('PASS: world speed, scroll seam, stop/resume and obstacle removal boundary unchanged.');
let spawnCount=0,randomArgs;
cc.math={randomRangeInt(a,b){randomArgs=[a,b];return 37;}};
cc.instantiate=()=>{spawnCount++;const n=positionNode();n.setWorldPosition=p=>n.position=p;return n;};
const { ObstacleSpawner }=load('ObstacleSpawner.ts');
const spawner=new ObstacleSpawner();spawner.node={children:[],addChild(n){this.children.push(n);},getWorldPosition(){return {add3f:(x,y,z)=>({x:500+x,y:20+y,z})};}};
spawner.update(1);assert.equal(spawnCount,0);
spawner.enableSpawn();spawner.update(0);assert.equal(spawnCount,1);assert.deepEqual(randomArgs,[-100,100]);
assert.equal(spawner.node.children[0].position.y,57);
spawner.update(1.99);assert.equal(spawnCount,1);spawner.update(0.01);assert.equal(spawnCount,2);
spawner.clearForRevive();assert.ok(spawner.node.children.every(n=>!n.active&&n.destroyed));
spawner.update(1);assert.equal(spawnCount,2);
spawner.enableSpawn();spawner.update(0);assert.equal(spawnCount,3);
RunContext.current=savedRun;
console.log('PASS: first obstacle timing, 2-second cadence, vertical range and revive cleanup unchanged.');
