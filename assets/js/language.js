// Explicit language > saved choice > browser language (Chinese or English).
(function () {
  'use strict';
  var current = document.documentElement.lang === 'en' ? 'en' : 'zh';
  var root = new URL('../../', document.currentScript.src);
  var url = new URL(location.href), requested = url.searchParams.get('lang'), saved;
  if (requested !== 'zh' && requested !== 'en') requested = null;
  try { saved = localStorage.getItem('site-language'); } catch (e) {}
  if (saved !== 'zh' && saved !== 'en') saved = null;
  var browserLanguage = navigator.language || (navigator.languages && navigator.languages[0]) || '';
  // An /en/ link is an explicit language choice. The shared root negotiates first visits.
  var desired = requested || (current === 'en' ? 'en' : saved || (/^zh(?:-|$)/i.test(browserLanguage) ? 'zh' : 'en'));
  if (requested) { try { localStorage.setItem('site-language', requested); } catch (e) {} }
  if (desired !== current) {
    var destination = new URL(desired === 'en' ? 'en/' : './', root);
    destination.search = url.search; destination.hash = url.hash;
    location.replace(destination.href);
    return;
  }
  document.addEventListener('DOMContentLoaded', function () {
    var link = document.querySelector('[data-language-switch]');
    if (!link) return;
    var next, destination;
    function updateLink() {
      current = document.documentElement.lang === 'en' ? 'en' : 'zh';
      next = current === 'en' ? 'zh' : 'en';
      destination = new URL(next === 'en' ? 'en/' : './', root);
      destination.search = location.search;
      destination.searchParams.set('lang', next);
      destination.hash = location.hash;
      link.href = destination.href;
    }
    updateLink();
    document.addEventListener('site-language-change', updateLink);
    link.addEventListener('click', function () {
      var section;
      document.querySelectorAll('section[id]').forEach(function (item) {
        if (item.getBoundingClientRect().top <= 140) section = item;
      });
      destination.hash = section ? (section.id === 'hero' ? '' : section.id) : location.hash;
      link.href = destination.href;
      try { localStorage.setItem('site-language', next); } catch (e) {}
    });
  });
})();
