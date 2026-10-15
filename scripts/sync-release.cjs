// Changelog is the source; HTML and CEP manifest version fields are generated outputs.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const semver = /^\d+\.\d+\.\d+$/;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function selectRelease(data, tag) {
  if (!semver.test(data.version) || data.entries[0]?.version !== data.version) throw Error('Changelog version must match its newest entry');
  const version = tag === undefined ? data.version : tag.replace(/^v/, '');
  if (!semver.test(version)) throw Error('A stable release tag such as v0.3.1 is required');
  const entry = data.entries.find(e => e.version === version);
  if (!entry) throw Error('Published release has no matching changelog entry: ' + version);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || new Date(entry.date + 'T00:00:00Z').toISOString().slice(0, 10) !== entry.date) throw Error('Invalid release date');
  if (!Array.isArray(entry.changes) || !entry.changes.length) throw Error('Release changes are required');
  const highlights = entry.highlights || entry.changes.map(description => ({description}));
  if (!Array.isArray(highlights) || !highlights.length || highlights.some(h => typeof h.description !== 'string' || !h.description.trim() || (h.title !== undefined && typeof h.title !== 'string'))) throw Error('Invalid release highlights');
  return {version, tag:'v' + version, date:entry.date, highlights};
}

function renderPage(html, release) {
  const fields = {version:release.version, tag:release.tag, download:'下载 ' + release.version};
  const seen = new Set();
  html = html.replace(/<(span|h3)([^>]*\bdata-release-field="(version|tag|download)"[^>]*)>[\s\S]*?<\/\1>/g, (_, element, attrs, field) => {
    seen.add(field);
    return '<' + element + attrs + '>' + escapeHtml(fields[field]) + '</' + element + '>';
  });
  if (seen.size !== 3) throw Error('Missing managed version fields in index.html');
  let dates = 0, links = 0, notes = 0;
  html = html.replace(/<time\b([^>]*\bdata-release-date\b[^>]*)>[\s\S]*?<\/time>/g, (_, attrs) => {
    dates++;
    return '<time' + attrs.replace(/datetime="[^"]*"/, 'datetime="' + release.date + '"') + '>' + release.date.replaceAll('-', '.') + '</time>';
  });
  const url = 'https://github.com/MYdesignTool/Ae-ToolKit/releases/tag/' + release.tag;
  html = html.replace(/<a\b([^>]*\bdata-release-link\b[^>]*)>/g, (_, attrs) => {
    links++;
    return '<a' + attrs.replace(/href="[^"]*"/, 'href="' + url + '"') + '>';
  });
  const cards = release.highlights.map((h, i) => '<div><span class="feature-index">' + String(i + 1).padStart(2, '0') + '</span>' + (h.title ? '<h3>' + escapeHtml(h.title) + '</h3>' : '') + '<p>' + escapeHtml(h.description) + '</p></div>').join('');
  html = html.replace(/<!-- release:notes:start -->[\s\S]*?<!-- release:notes:end -->/g, () => {
    notes++;
    return '<!-- release:notes:start --><div class="release-notes">' + cards + '</div>\n        <!-- release:notes:end -->';
  });
  if (dates !== 1 || links < 2 || notes !== 1) throw Error('Missing managed release date, links or notes in index.html');
  return html;
}

function renderManifest(xml, version) {
  let replacements = 0;
  xml = xml.replace(/(ExtensionBundleVersion=")[^"]+("|$)/, (_, a, b) => { replacements++; return a + version + b; });
  xml = xml.replace(/(<Extension Id="com\.local\.aetoolkit\.panel" Version=")[^"]+("|$)/, (_, a, b) => { replacements++; return a + version + b; });
  if (replacements !== 2) throw Error('Expected CEP bundle and panel version fields');
  return xml;
}

function main(args) {
  let tag, siteOnly = false, check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--release-tag' && args[i + 1]) tag = args[++i];
    else if (args[i] === '--site-only') siteOnly = true;
    else if (args[i] === '--check') check = true;
    else throw Error('Unknown or incomplete argument: ' + args[i]);
  }
  const data = JSON.parse(fs.readFileSync(path.join(root, 'extension/data/changelog.json'), 'utf8'));
  const release = selectRelease(data, tag);
  const files = new Map();
  function update(file, render) {
    const full = path.join(root, file), current = fs.readFileSync(full, 'utf8');
    const next = render(current).replace(/\r\n/g, '\n');
    if (current !== next) files.set(full, next);
  }
  update('index.html', html => renderPage(html, release));
  if (!siteOnly) {
    const version = data.version;
    update('extension/CSXS/manifest.xml', xml => renderManifest(xml, version));
    update('README.md', text => text.replace(/当前版本 \*\*\d+\.\d+\.\d+\*\*/, '当前版本 **' + version + '**'));
    update('extension/README.md', text => text.replace(/版本 \d+\.\d+\.\d+。/, '版本 ' + version + '。'));
  }
  if (check && files.size) throw Error('Run node scripts/sync-release.cjs to update: ' + [...files.keys()].map(f => path.relative(root, f)).join(', '));
  if (!check) for (const [file, content] of files) fs.writeFileSync(file, content);
  console.log('Release metadata ' + (check ? 'verified: ' : 'generated: ') + release.tag);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = {selectRelease, renderPage, renderManifest};
