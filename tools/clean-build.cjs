const fs = require('node:fs');
const path = require('node:path');
const platform = process.argv[2];
if (!['bytedance-mini-game', 'web-mobile'].includes(platform)) throw Error('Unsupported platform');
const dir = path.resolve(__dirname, '..', 'build', platform);
if (fs.existsSync(dir)) for (const item of fs.readdirSync(dir)) {
  if (item !== '.ttmg') fs.rmSync(path.join(dir, item), { recursive: true, force: true });
}
