const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const platform = process.argv[2];
assert.ok(['bytedance-mini-game', 'web-mobile'].includes(platform));
const dir = path.join(root, 'build', platform);
function walk(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.name === '.ttmg' ? [] : e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sourceMedia = new Set(walk(path.join(root,'assets')).filter(f => /\.(png|wav|m4a)$/.test(f)).map(hash));
for (const file of walk(dir)) {
  assert.ok(!/\.mp3$/.test(file), 'Old MP3 remains: '+file);
  if (/\.(png|wav|m4a)$/.test(file)) {
    // Cocos also emits an internal 2×2 default texture.
    assert.ok(sourceMedia.has(hash(file)) || (/\.png$/.test(file) && fs.statSync(file).size < 100), 'Untracked media: '+file);
  }
}
for (const name of ['LICENSE','THIRD_PARTY_NOTICES.txt']) assert.equal(fs.readFileSync(path.join(dir,name),'utf8'),fs.readFileSync(path.join(root,name),'utf8'));
const config = fs.readFileSync(path.join(dir,'jetcat-config.js'),'utf8');
for (const text of ['2025 Admin','Chukong','Erin Catto','Guy Bedford','Denis Pushkarev','Facebook']) assert.ok(config.includes(text), 'Missing notice '+text);
const entry = fs.readFileSync(path.join(dir,platform === 'web-mobile' ? 'index.html' : 'game.js'),'utf8');
assert.ok(entry.includes('jetcat-config.js'));
assert.ok(!entry.includes('FlappyBird'));
console.log('PASS: clean media inventory, startup config and distributed license notices.');
