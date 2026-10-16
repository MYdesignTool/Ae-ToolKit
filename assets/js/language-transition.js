// Swap localized content in place: the live glass and WebGL surfaces never become snapshots.
(function () {
  'use strict';
  var root = document.documentElement;
  var base = new URL('../../', document.currentScript.src);
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  var pending = false, prepared, queuedURL, animations = [];
  var attributes = ['alt', 'title', 'aria-label', 'hreflang', 'lang'];
  function locale() { return root.lang === 'en' ? 'en' : 'zh'; }
  function directText(el) { return Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3; }); }
  function selector(el) {
    var parts = [];
    while (el && el !== el.ownerDocument.body) {
      var tag = el.localName, index = 1, sibling = el.previousElementSibling;
      while (sibling) { if (sibling.localName === tag) index++; sibling = sibling.previousElementSibling; }
      parts.unshift(tag + ':nth-of-type(' + index + ')'); el = el.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  }
  async function prepare() {
    var docs = await Promise.all(['zh', 'en'].map(async function (lang) {
      var url = new URL(lang === 'en' ? 'en/' : './', base);
      // Keep the cache revision on preview URLs; never carry a locale redirect into a template request.
      new URL(location.href).searchParams.forEach(function (value, key) { if (key !== 'lang') url.searchParams.set(key, value); });
      var response = await fetch(url.href, {signal:AbortSignal.timeout(6000)});
      if (!response.ok) throw Error('Language template unavailable');
      return new DOMParser().parseFromString(await response.text(), 'text/html');
    }));
    // A deployment may occur while this tab is open. A different script revision needs a normal reload.
    var runtime = document.querySelector('script[src*="language-transition.js"]').getAttribute('src').split('/').pop();
    docs.forEach(function (doc) {
      var script = doc.querySelector('script[src*="language-transition.js"]');
      if (!script || script.getAttribute('src').split('/').pop() !== runtime) throw Error('Language template revision changed');
    });
    var records = [];
    docs[0].querySelectorAll('body *').forEach(function (source) {
      if (source.matches('script, style')) return;
      var path = selector(source), target = docs[1].querySelector(path);
      if (!target || target.localName !== source.localName) throw Error('Language template structure changed');
      var zh = directText(source), en = directText(target), texts = [], attrs = [];
      if (zh.length !== en.length) throw Error('Language template text structure changed');
      zh.forEach(function (node, index) { if (node.nodeValue !== en[index].nodeValue) texts.push({index:index, zh:node.nodeValue, en:en[index].nodeValue}); });
      attributes.forEach(function (name) {
        if (source.getAttribute(name) !== target.getAttribute(name)) attrs.push({name:name, zh:source.getAttribute(name), en:target.getAttribute(name)});
      });
      if (!texts.length && !attrs.length) return;
      var live = document.querySelector(path);
      if (!live || directText(live).length !== zh.length) throw Error('Live language content changed');
      var nodes = directText(live);
      texts.forEach(function (text) { text.node = nodes[text.index]; });
      records.push({el:live, texts:texts, attrs:attrs});
    });
    return {records:records, zh:docs[0], en:docs[1]};
  }
  function warm() {
    if (!prepared) prepared = prepare().catch(function (error) { prepared = null; throw error; });
    return prepared;
  }
  function visible(el) { var rect = el.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight; }
  function play(entering, toward) {
    if (motion.matches || !Element.prototype.animate) return Promise.resolve();
    var sign = toward === 'en' ? 1 : -1;
    var surfaces = Array.prototype.filter.call(document.querySelectorAll('section, .site-footer'), visible);
    var labels = Array.prototype.filter.call(document.querySelectorAll('.nav-links a, .language-toggle'), visible);
    animations = surfaces.concat(labels).map(function (el) {
      var frames = entering ? [{opacity:0}, {opacity:1}] : [{opacity:1}, {opacity:0}];
      if (surfaces.indexOf(el) !== -1) {
        frames[0].transform = 'translate3d(' + (entering ? sign * 12 : 0) + 'px,0,0)';
        frames[1].transform = 'translate3d(' + (entering ? 0 : -sign * 8) + 'px,0,0)';
      }
      return el.animate(frames, {duration:entering ? 300 : 130, easing:entering ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.4,0,1,1)', fill:'both'});
    });
    return Promise.all(animations.map(function (a) { return a.finished.catch(function () {}); }));
  }
  function cancel() { animations.forEach(function (a) { a.cancel(); }); animations = []; }
  var assetsResolved = false;
  function resolveAssets() {
    if (assetsResolved) return;
    // Freeze asset URLs before history changes the base directory from / to /en/.
    document.querySelectorAll('[src], head link[href]').forEach(function (el) {
      var attr = el.hasAttribute('src') ? 'src' : 'href';
      el.setAttribute(attr, new URL(el.getAttribute(attr), location.href).href);
    });
    assetsResolved = true;
  }
  async function switchTo(url, push) {
    var toward = url.pathname === base.pathname + 'en/' || url.pathname === base.pathname + 'en/index.html' ? 'en' : 'zh';
    if (toward === locale() || pending) return;
    pending = true;
    var link = document.querySelector('[data-language-switch]');
    link.setAttribute('aria-busy', 'true');
    try {
      var data = await warm();
      root.setAttribute('data-language-transition', toward);
      await play(false, toward);
      var anchor = document.getElementById(url.hash.slice(1));
      var offset = anchor ? anchor.getBoundingClientRect().top : null;
      var doc = data[toward];
      data.records.forEach(function (record) {
        record.texts.forEach(function (text) { text.node.nodeValue = text[toward]; });
        record.attrs.forEach(function (attr) {
          if (attr[toward] === null) record.el.removeAttribute(attr.name);
          else record.el.setAttribute(attr.name, attr[toward]);
        });
      });
      root.lang = doc.documentElement.lang;
      document.title = doc.title;
      ['meta[name="description"]', 'link[rel="canonical"]'].forEach(function (query) {
        var name = query.startsWith('meta') ? 'content' : 'href';
        document.querySelector(query).setAttribute(name, doc.querySelector(query).getAttribute(name));
      });
      resolveAssets();
      if (push) history.pushState(null, '', url.href);
      try { localStorage.setItem('site-language', toward); } catch (e) {}
      document.dispatchEvent(new CustomEvent('site-language-change', {detail:{language:toward}}));
      cancel();
      if (anchor && offset !== null) scrollTo({top:scrollY + anchor.getBoundingClientRect().top - offset, behavior:'instant'});
      await play(true, toward);
    } catch (e) {
      // Static bilingual pages remain the fallback for offline requests or a newer deployment.
      location.assign(url.href);
    } finally {
      cancel(); pending = false; link.removeAttribute('aria-busy'); root.removeAttribute('data-language-transition');
      if (queuedURL) { var next = queuedURL; queuedURL = null; switchTo(next, false); }
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var link = document.querySelector('[data-language-switch]');
    if (!link) return;
    function preload() { warm().catch(function () {}); }
    link.addEventListener('pointerenter', preload);
    link.addEventListener('focus', preload);
    link.addEventListener('touchstart', preload, {passive:true});
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (!pending) switchTo(new URL(link.href), true);
    });
    addEventListener('popstate', function () {
      var url = new URL(location.href);
      if (pending) queuedURL = url;
      else switchTo(url, false);
    });
    motion.addEventListener('change', function () { if (motion.matches) animations.forEach(function (a) { a.finish(); }); });
  });
})();
