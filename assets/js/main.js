// Ae-ToolKit 发布页交互脚本

(function () {
  "use strict";

  // 标记 JS 可用，启用滚动揭示动画（无 JS 时内容正常显示）
  document.documentElement.classList.add("js");

  // Keep the saved light/dark preference; the head script applies it before first paint.
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById("theme-toggle");
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
    if (btn) btn.setAttribute('aria-pressed', String(saved === 'dark'));
    var desiredTheme = root.getAttribute('data-theme'), themeTransition;
    if (btn) {
      btn.addEventListener("click", function () {
        var next = desiredTheme === "light" ? "dark" : "light";
        desiredTheme = next;
        if (themeTransition) themeTransition.skipTransition();
        function applyTheme() { root.setAttribute('data-theme', desiredTheme); }
        if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          var rect = btn.getBoundingClientRect();
          root.style.setProperty('--theme-x', rect.left + rect.width/2 + 'px');
          root.style.setProperty('--theme-y', rect.top + rect.height/2 + 'px');
          themeTransition = document.startViewTransition(applyTheme);
          themeTransition.ready.catch(function () { /* Rapid toggles can skip the previous snapshot. */ });
          themeTransition.finished.catch(function () {});
        } else applyTheme();
        btn.setAttribute('aria-pressed', String(next === 'dark'));
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    }
  })();

  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var menuButton = document.getElementById('mobile-toggle');
  var navLinks = document.querySelector('.nav-links');
  function closeMenu() { navLinks.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }
  menuButton.addEventListener('click', function () { var open=navLinks.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('keydown', function (event) { if (event.key==='Escape') closeMenu(); });

  // 年份
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 平滑锚点滚动
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var targetId = this.getAttribute("href");
      if (!targetId || targetId === "#") return;
      var el = document.querySelector(targetId);
      if (!el) return;
      e.preventDefault();
      // 关闭移动端菜单
      closeMenu();
      el.scrollIntoView({ behavior: motion.matches ? "auto" : "smooth", block: "start" });
      if (this.classList.contains("back-to-top")) document.getElementById("hero-title").focus({ preventScroll:true });
    });
  });

  // Update only on threshold changes; hidden controls cannot receive keyboard focus.
  var rocket = document.getElementById('back-to-top'), rocketFrame = 0, rocketVisible;
  function syncRocket() {
    rocketFrame = 0;
    var show = scrollY > Math.max(420, innerHeight * .6);
    if (show === rocketVisible) return;
    rocketVisible = show;
    rocket.classList.toggle('is-visible', show);
    rocket.setAttribute('aria-hidden', String(!show));
    rocket.tabIndex = show ? 0 : -1;
    rocket.inert = !show;
  }
  function queueRocket() { if (!rocketFrame) rocketFrame = requestAnimationFrame(syncRocket); }
  addEventListener('scroll', queueRocket, { passive:true });
  addEventListener('resize', queueRocket);
  syncRocket();

  // 滚动揭示：进入视口时淡入上浮（错落出现）
  var revealEls = document.querySelectorAll(
    ".section-title, .section-subtitle, .feature-card, .release-card, .code-panel, .step, .footer-top, .footer-bottom"
  );
  revealEls.forEach(function (el) {
    el.classList.add("reveal");
  });

  // 同组元素按出现顺序错落延迟
  revealEls.forEach(function (el) {
    var parent = el.parentElement;
    var sibs = Array.prototype.filter.call(parent.children, function (c) {
      return c.classList && c.classList.contains("reveal");
    });
    var idx = sibs.indexOf(el);
    if (idx > 0 && !motion.matches) {
      el.style.transitionDelay = Math.min(idx * 45, 90) + "ms";
      el.addEventListener('transitionend', function clearEntranceDelay(event) {
        if (event.target !== el || event.propertyName !== 'opacity') return;
        el.style.removeProperty('transition-delay');
        el.removeEventListener('transitionend', clearEntranceDelay);
      });
    }
  });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // One highlight update per frame, with no background timer or touch tracking.
  if (window.matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('.glass, .site-header').forEach(function (card) {
      var frame = 0, pointer = null, active = false, last = 0;
      var lightX = 30, lightY = 0, lightAlpha = 0, aimX = 30, aimY = 0;
      function resetLight() {
        cancelAnimationFrame(frame); frame = 0; pointer = null; active = false;
        lightX = aimX = 30; lightY = aimY = lightAlpha = 0;
        ['--mx','--my','--sheen-opacity','--tilt-x','--tilt-y'].forEach(function (name) { card.style.removeProperty(name); });
      }
      function paintLight(now) {
        frame = 0;
        if (motion.matches) { resetLight(); return; }
        var dt = Math.min((now - last) / 1000, .05), follow = 1 - Math.exp(-dt * 12), fade = 1 - Math.exp(-dt * 10);
        last = now;
        if (pointer) {
          var rect = card.getBoundingClientRect();
          var px = Math.max(0,Math.min(100,(pointer.clientX - rect.left) / rect.width * 100));
          var py = Math.max(0,Math.min(100,(pointer.clientY - rect.top) / rect.height * 100));
          // A broad reflection moves less than the pointer, rather than acting as a spotlight.
          aimX = 15 + px * .7; aimY = py * .8;
          var tiltScale = card.classList.contains('site-header') ? .35 : 1;
          card.style.setProperty('--tilt-x', (0.5 - py / 100) * 3 * tiltScale + 'deg');
          card.style.setProperty('--tilt-y', (px / 100 - 0.5) * 4 * tiltScale + 'deg');
          pointer = null;
        }
        lightX += (aimX - lightX) * follow; lightY += (aimY - lightY) * follow;
        lightAlpha += ((active ? 1 : 0) - lightAlpha) * fade;
        card.style.setProperty('--mx', lightX + '%'); card.style.setProperty('--my', lightY + '%');
        card.style.setProperty('--sheen-opacity', lightAlpha.toFixed(4));
        if (Math.abs(aimX-lightX) + Math.abs(aimY-lightY) > .05 || Math.abs((active?1:0)-lightAlpha) > .002) frame = requestAnimationFrame(paintLight);
        else if (!active) resetLight();
      }
      function wakeLight() {
        if (!frame) { last = performance.now(); frame = requestAnimationFrame(paintLight); }
      }
      function trackPointer(event) {
        if (motion.matches || event.pointerType === 'touch') return;
        active = true; pointer = event; wakeLight();
      }
      card.addEventListener('pointerenter', function (event) {
        card.style.removeProperty('transition-delay'); trackPointer(event);
      });
      card.addEventListener('pointermove', trackPointer);
      function leaveLight() {
        pointer = null; active = false; aimX = 30; aimY = 0;
        card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y');
        if (motion.matches) resetLight(); else wakeLight();
      }
      card.addEventListener('pointerleave', leaveLight);
      card.addEventListener('pointercancel', leaveLight);
      motion.addEventListener('change', function () { if (motion.matches) resetLight(); });
    });
  }

  // Release metadata is rendered together at deployment from the shared changelog.
})();
