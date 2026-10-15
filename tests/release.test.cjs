const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {selectRelease, renderPage, renderManifest} = require('../scripts/sync-release.cjs');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'extension/data/changelog.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'extension/CSXS/manifest.xml'), 'utf8');
const future = {version:'9.8.7', date:'2030-01-02', changes:['New release changes'], highlights:[{title:'New summary', description:'Only this release content'}]};

function extended() { return {version:future.version, entries:[structuredClone(future), ...structuredClone(data.entries)]}; }

test('all page versions, dates, links and summaries move together for a new release', () => {
  const rendered = renderPage(html, selectRelease(extended()));
  assert.equal((rendered.match(/data-release-field="(?:version|tag|download)"/g) || []).length, 4);
  assert.ok(rendered.includes('data-release-field="tag">v9.8.7'));
  assert.ok(rendered.includes('data-release-field="version">9.8.7'));
  assert.ok(rendered.includes('data-release-field="download">下载 9.8.7'));
  assert.ok(rendered.includes('datetime="2030-01-02">2030.01.02'));
  assert.equal((rendered.match(/releases\/tag\/v9\.8\.7/g) || []).length, 4);
  assert.ok(rendered.includes('Only this release content'));
  assert.ok(!rendered.includes('工作环境，一起带走'));
  assert.ok(!rendered.includes('v' + data.version));
  assert.equal(renderPage(rendered, selectRelease(extended())), rendered, 'rendering is idempotent');
});

test('deployment selects published history instead of an unreleased source version', () => {
  const release = selectRelease(extended(), 'v' + data.version);
  assert.equal(release.version, data.version);
  assert.equal(release.date, data.entries[0].date);
  const rendered = renderPage(html, release);
  assert.ok(!rendered.includes('9.8.7'));
  assert.ok(!rendered.includes('Only this release content'));
  assert.throws(() => selectRelease(data, 'v9.8.7'), /no matching changelog entry/);
  assert.throws(() => selectRelease(data, 'v9.8.7-beta.1'), /stable release tag/);
});

test('entries without editorial highlights use their own changes and escape HTML', () => {
  const source = extended();delete source.entries[0].highlights;
  source.entries[0].changes = ['<script>alert("test")</script> & plain text'];
  const rendered = renderPage(html, selectRelease(source));
  assert.ok(rendered.includes('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt; &amp; plain text'));
  assert.ok(!rendered.includes('<script>alert("test")'));
});

test('CEP versions sync while host and runtime compatibility remain intact', () => {
  const rendered = renderManifest(manifest, future.version);
  assert.ok(rendered.includes('ExtensionBundleVersion="9.8.7"'));
  assert.ok(rendered.includes('Id="com.local.aetoolkit.panel" Version="9.8.7"'));
  assert.ok(rendered.includes('Host Name="AEFT" Version="[23.0,99.9]"'));
  assert.ok(rendered.includes('RequiredRuntime Name="CSXS" Version="11.0"'));
});

test('inconsistent or incomplete release metadata fails rather than mixing versions', () => {
  assert.throws(() => selectRelease({...data, version:'9.8.7'}), /newest entry/);
  const source = extended();source.entries[0].date = '2030-02-30';
  assert.throws(() => selectRelease(source), /Invalid release date/);
  assert.throws(() => renderPage('<h1>Missing fields</h1>', selectRelease(data)), /Missing managed/);
});
