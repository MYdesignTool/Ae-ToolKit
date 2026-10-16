// Only language navigations use the horizontal transition; theme changes keep their radial reveal.
(function () {
  'use strict';
  var root = document.documentElement;
  var base = new URL('../../', document.currentScript.src);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var nativeNavigation = typeof PageSwapEvent !== 'undefined' && typeof PageRevealEvent !== 'undefined';
  var key = 'language-transition', arrival = null, pending = null, nativeActive = false, entered = false, recoveryTimer = 0;
  function locale(value) {
    if (!value) return null;
    try {
      var url = new URL(value, base);
      if (url.origin !== base.origin) return null;
      if (url.pathname === base.pathname || url.pathname === base.pathname + 'index.html') return 'zh';
      if (url.pathname === base.pathname + 'en/' || url.pathname === base.pathname + 'en/index.html') return 'en';
    } catch (e) {}
    return null;
  }
  function direction(from, to) {
    var a = locale(from), b = locale(to);
    return a && b && a !== b ? b : null;
  }
  function steadyHeader() {
    var header = document.querySelector('.site-header');
    if (header) header.style.viewTransitionName = 'language-header';
  }
  function clear() {
    clearTimeout(recoveryTimer); recoveryTimer = 0; pending = null;
    root.removeAttribute('data-language-transition');
    root.removeAttribute('data-language-arrival');
    var header = document.querySelector('.site-header');
    if (header) header.style.removeProperty('view-transition-name');
  }
  try {
    var saved = JSON.parse(sessionStorage.getItem(key));
    sessionStorage.removeItem(key);
    if (saved && Date.now() - saved.time >= 0 && Date.now() - saved.time < 12000 &&
        saved.url === location.href && direction(saved.from, saved.url) === saved.direction) arrival = saved.direction;
  } catch (e) {}
  if (!arrival && window.navigation && navigation.activation && navigation.activation.navigationType !== 'replace') {
    arrival = direction(navigation.activation.from && navigation.activation.from.url, location.href);
  }
  function markArrival(toward) {
    root.setAttribute('data-language-arrival', toward);
    root.setAttribute('data-language-continued', toward);
  }
  if (arrival && !reduced.matches) markArrival(arrival);
  function visibleSections() {
    return Array.prototype.filter.call(document.querySelectorAll('section, .site-footer'), function (el) {
      var r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    });
  }
  function animateSections(toward) {
    var sign = toward === 'en' ? 1 : -1;
    return visibleSections().map(function (el) {
      var frames = [
        {opacity:0, transform:'translateX(' + sign * 22 + 'px)', filter:'blur(2px)'},
        {opacity:1, transform:'translateX(0)', filter:'blur(0)'}
      ];
      return el.animate(frames, {duration:320, easing:'cubic-bezier(.2,.75,.25,1)'}).finished.catch(function () {});
    });
  }
  function fallbackEntry() {
    if (!arrival || nativeActive || entered) return;
    entered = true;
    if (reduced.matches || !Element.prototype.animate) { clear(); return; }
    Promise.all(animateSections(arrival)).then(clear, clear);
  }
  function afterDOM(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, {once:true});
    else callback();
  }
  addEventListener('pageswap', function (event) {
    var transition = event.viewTransition;
    if (!transition) return;
    var toward = direction(location.href, event.activation && event.activation.entry && event.activation.entry.url);
    if (!toward && pending) toward = pending.direction;
    if (!nativeNavigation || !toward || reduced.matches) { transition.skipTransition(); return; }
    root.setAttribute('data-language-transition', toward);
    steadyHeader();
    transition.ready.catch(function () {});
    transition.finished.then(clear, clear);
  });
  addEventListener('pagereveal', function (event) {
    var transition = event.viewTransition;
    var activation = window.navigation && navigation.activation;
    var toward = arrival || direction(activation && activation.from && activation.from.url, location.href);
    if (!transition || !nativeNavigation || !toward || reduced.matches) {
      if (transition) transition.skipTransition();
      if (toward && !reduced.matches) {
        arrival = toward;
        markArrival(toward);
        afterDOM(fallbackEntry);
      } else clear();
      return;
    }
    nativeActive = true;
    markArrival(toward);
    root.setAttribute('data-language-transition', toward);
    transition.ready.catch(function () {});
    transition.finished.then(clear, clear);
  });
  addEventListener('pagehide', function () { clearTimeout(recoveryTimer); recoveryTimer = 0; pending = null; });
  addEventListener('pageshow', function (event) { if (event.persisted) clear(); });
  afterDOM(function () {
    if (!nativeNavigation) fallbackEntry();
    else if (arrival) requestAnimationFrame(fallbackEntry);
    var link = document.querySelector('[data-language-switch]');
    if (!link) return;
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var toward = direction(location.href, link.href);
      if (!toward || reduced.matches) return;
      if (pending) { event.preventDefault(); return; }
      var target = link.href;
      pending = {direction:toward, url:target};
      try { sessionStorage.setItem(key, JSON.stringify({from:location.href, url:target, direction:toward, time:Date.now()})); } catch (e) {}
      recoveryTimer = setTimeout(clear, 2500);
    });
  });
})();
