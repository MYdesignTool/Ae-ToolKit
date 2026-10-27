// Generate English HTML from the shared Chinese page. Versions and links stay in sync-release.cjs.
const fs = require('node:fs');
const path = require('node:path');
const han = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderEnglish(html, catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/i18n/en.json'), 'utf8'))) {
  html = html.replace(/\r\n?/g, '\n');
  const missing = new Set();
  function translate(text) {
    const trimmed = text.trim();
    if (!han.test(trimmed)) return text;
    let value;
    if (/^下载 \d+\.\d+\.\d+$/.test(trimmed)) value = trimmed.replace('下载 ', 'Download ');
    else if (Object.hasOwn(catalog.strings, trimmed)) value = catalog.strings[trimmed];
    else { missing.add(trimmed); return text; }
    if (typeof value !== 'string' || !value) throw Error('Empty English translation: ' + trimmed);
    var prefix = text.slice(0, text.indexOf(trimmed));
    if (/^[,.;:!?]/.test(value) && !prefix.includes('\n')) prefix = '';
    return prefix + escapeHtml(value) + text.slice(text.indexOf(trimmed) + trimmed.length);
  }
  const tokens = html.match(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi) || [];
  let result = tokens.map(token => {
    if (token.startsWith('<!--') || /^<(script|style)\b/i.test(token)) return token;
    if (token.startsWith('<')) return token.replace(/\b(alt|title|aria-label|content)="([^"]*)"/g, (_, name, value) => name + '="' + translate(value) + '"');
    return translate(token);
  }).join('');
  if (missing.size) throw Error('Missing English translations in assets/i18n/en.json:\n' + [...missing].join('\n'));
  result = result.replace('<html lang="zh-CN"', '<html lang="en"')
    .replace(/\b(src|href)="assets\//g, '$1="../assets/')
    .replace(/\bhref="docs\//g, 'href="../docs/')
    .replace('<link rel="canonical" href="https://mydesigntool.github.io/Ae-ToolKit/">', '<link rel="canonical" href="https://mydesigntool.github.io/Ae-ToolKit/en/">')
    .replace(/<a class="language-toggle"[^>]*>[\s\S]*?<\/a>/, '<a class="language-toggle" data-language-switch href="../?lang=zh" hreflang="zh-CN" lang="zh-CN" aria-label="切换中文" title="中文">中文</a>');
  return '<!-- Generated from index.html and assets/i18n/en.json by scripts/sync-release.cjs. -->\n' + result;
}
module.exports = {renderEnglish};
