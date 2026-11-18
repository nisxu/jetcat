const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const platform = process.argv[2];
const preview = process.argv[3] === '--preview';
if (!['bytedance-mini-game', 'web-mobile'].includes(platform)) throw Error('Unsupported build platform');
const dir = path.join(root, 'build', platform);
const notices = ['LICENSE', 'THIRD_PARTY_NOTICES.txt'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n\n');
// Retain notices as runtime data too, so downstream minifiers cannot discard them as comments.
const runtime = `globalThis.__JETCAT_LICENSES__ = ${JSON.stringify(notices)};\nglobalThis.__JETCAT_DEV_ADS__ = ${preview};\n`;
fs.writeFileSync(path.join(dir, 'jetcat-config.js'), runtime);
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.txt']) fs.copyFileSync(path.join(root, name), path.join(dir, name));
if (platform === 'bytedance-mini-game') {
  const entry = path.join(dir, 'game.js');
  const requireConfig = "require('./jetcat-config.js');\n";
  fs.writeFileSync(entry, requireConfig + fs.readFileSync(entry, 'utf8').replace(requireConfig, ''));
} else {
  const entry = path.join(dir, 'index.html');
  const configTag = '<script src="jetcat-config.js"></script>';
  let html = fs.readFileSync(entry, 'utf8').replace(/<title>[^<]*<\/title>/, '<title>JetCat</title>');
  html = html.replace(configTag, '').replace('</head>', configTag + '\n</head>');
  fs.writeFileSync(entry, html);
}
console.log(`Finalized ${platform}: licenses included, test ads ${preview ? 'enabled for preview' : 'disabled'}.`);
