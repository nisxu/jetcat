const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const baseline = read('tests/gameplay-baseline.json');
function snapshot(a) {
  const result = {};
  for (const v of a) {
    if (v.__type__ === 'cc.Node') result[v._id] = Object.fromEntries(['_lpos','_lrot','_lscale','_euler','_active','_layer'].filter(k => k in v).map(k => [k,v[k]]));
    else if (/Collider2D|RigidBody2D|Physics/.test(v.__type__ || '')) result[v._id] = Object.fromEntries(Object.entries(v).filter(([k]) => !['node','__prefab','_name','__editorExtras__'].includes(k)));
    else if ('moveSpeed' in v || 'spawnRate' in v) result[v._id] = Object.fromEntries(['moveSpeed','spawnRate'].filter(k => k in v).map(k => [k,v[k]]));
  }
  return result;
}
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const assets = walk(path.join(root,'assets'));
const uuids = new Set();
function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (value.uuid) uuids.add(value.uuid);
  Object.values(value).forEach(collect);
}
for (const f of assets.filter(f => f.endsWith('.meta'))) collect(JSON.parse(fs.readFileSync(f,'utf8')));
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function compress(uuid) {
  const hex=uuid.replace(/-/g,''); let out=hex.slice(0,5);
  for (let i=5;i<hex.length;i+=3) { const bits=parseInt(hex.slice(i,i+3),16);out+=alphabet[bits>>6]+alphabet[bits&63]; }
  return out;
}
const scriptTypes = new Set(assets.filter(f => f.endsWith('.ts.meta')).map(f => compress(JSON.parse(fs.readFileSync(f,'utf8')).uuid)));
for (const [kind,file] of [['scene','assets/game.scene'],['obstacle','assets/prefabs/BuildingObstacle.prefab']]) {
  const objects=read(file);
  assert.deepEqual(snapshot(objects),baseline[kind], 'Physics, transforms or timing changed');
  function validate(v) {
    if (!v || typeof v !== 'object') return;
    if ('__id__' in v) assert.ok(Number.isInteger(v.__id__) && v.__id__>=0 && v.__id__<objects.length,'Dangling object reference');
    if (v.__uuid__) {
      const id=v.__uuid__;
      // Cocos internal/default texture is owned by the engine asset database.
      assert.ok(uuids.has(id) || uuids.has(id.split('@')[0]) || id.startsWith('7d8f9b89-'),'Dangling asset '+id);
    }
    if (v.__type__ && !v.__type__.startsWith('cc.')) assert.ok(scriptTypes.has(v.__type__),'Missing script type '+v.__type__);
    Object.values(v).forEach(validate);
  }
  objects.forEach(validate);
  for (const node of objects.filter(v=>v.__type__==='cc.Node')) {
    for (const ref of node._components || []) assert.equal(objects[ref.__id__].node.__id__,objects.indexOf(node),'Component owner mismatch');
  }
  assert.ok(!objects.some(v=>v.__type__==='cc.Animation' || 'medalFrames' in v));
}
for (const [file,expected] of Object.entries(baseline.media)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,'Media changed '+file);
assert.ok(!assets.some(f => /gameBirds|bird\d_fly/.test(f)));
assert.equal(read('package.json').name,'jetcat');
assert.ok(fs.readFileSync(path.join(root,'LICENSE'),'utf8').includes('Copyright (c) 2025 Admin'));
console.log('PASS: all scene/prefab references resolve; physical geometry, transforms, speeds and media match pre-refactor baseline.');
