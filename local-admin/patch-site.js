/* Idempotent patch of the existing website so it can read catalog.json.
 * Runs every time the dashboard starts; changes nothing if already patched. Backups go to local-admin/backups/. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const LOADER_TAG = '<script src="public-catalog.js?v=1" defer></script>';

function backup(root, file, text) {
  const dir = path.join(root, 'local-admin', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(dir, path.basename(file) + '.' + stamp + '.bak'), text, 'utf8');
}

function patchHtml(root, name, notes) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('public-catalog.js')) return;
  const re = /<script src="script\.js(?:\?[^"]*)?"([^>]*)>\s*<\/script>/;
  if (!re.test(html)) throw new Error(name + ': could not find <script src="script.js" defer>.');
  backup(root, file, html);
  html = html.replace(re, (m, attrs) => LOADER_TAG + '\n    <script src="script.js?v=admin1"' + attrs + '></script>');
  fs.writeFileSync(file, html, 'utf8');
  notes.push('Patched ' + name + ' (added public-catalog.js).');
}

function patchScript(root, notes) {
  const file = path.join(root, 'script.js');
  let js = fs.readFileSync(file, 'utf8');
  if (js.includes('S90-ADMIN: prefer data-category')) return;
  const re = /(function getCategoryFromCard\(card\) \{)(\r?\n)(\s*)(const img = card\.querySelector\('img'\);)/;
  if (!re.test(js)) throw new Error('script.js: could not find getCategoryFromCard() — send me the file so I can adjust the patch.');
  backup(root, file, js);
  js = js.replace(re, (m, a, nl, ind, d) =>
    a + nl + ind + '// S90-ADMIN: prefer data-category (used by dashboard-managed products)' + nl +
    ind + "if (card.dataset && card.dataset.category) return card.dataset.category.trim();" + nl + ind + d);
  fs.writeFileSync(file, js, 'utf8');
  notes.push('Patched script.js (category lookup honours data-category).');
}

function patchSite(root) {
  const notes = [];
  patchScript(root, notes);
  patchHtml(root, 'index.html', notes);
  patchHtml(root, 'home.html', notes);
  if (!notes.length) notes.push('Website already patched.');
  return notes;
}
module.exports = { patchSite };
