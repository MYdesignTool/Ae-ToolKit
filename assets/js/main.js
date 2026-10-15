// Ae-ToolKit 发布页交互脚本

(function () {
  "use strict";

  // 标记 JS 可用，启用滚动揭示动画（无 JS 时内容正常显示）
  document.documentElement.classList.add("js");

  function syncPreviews(theme) {
    document.querySelectorAll('img[data-light-src]').forEach(function (image) {
      image.src = theme === 'light' ? image.dataset.lightSrc : image.dataset.darkSrc;
      image.alt = image.dataset.label + (theme === 'light' ? '浅色功能示意' : '面板预览');
    });
  }

  // Keep the saved light/dark preference; the head script applies it before first paint.
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById("theme-toggle");
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
    syncPreviews(root.getAttribute('data-theme'));
    if (btn) btn.setAttribute('aria-pressed', String(saved === 'dark'));
    var desiredTheme = root.getAttribute('data-theme'), themeTransition;
    if (btn) {
      btn.addEventListener("click", function () {
        var next = desiredTheme === "light" ? "dark" : "light";
        desiredTheme = next;
        if (themeTransition) themeTransition.skipTransition();
        function applyTheme() { root.setAttribute('data-theme', desiredTheme); syncPreviews(desiredTheme); }
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

  var preview = document.getElementById('image-preview');
  document.querySelectorAll('.preview-button').forEach(function (button) {
    button.addEventListener('click', function () { var image=button.querySelector('img'); var target=preview.querySelector('img'); target.src=image.src; target.alt=image.alt; preview.showModal(); });
  });
  preview.addEventListener('click', function (event) { if (event.target===preview) preview.close(); });

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

  // 滚动揭示：进入视口时淡入上浮（错落出现）
  var revealEls = document.querySelectorAll(
    ".section-title, .section-subtitle, .feature-card, .release-card, .code-panel, .step, .footer-top, .footer-bottom"
  );
  revealEls.forEach(function (el) { el.classList.add("reveal"); });

  // 同组元素按出现顺序错落延迟
  revealEls.forEach(function (el) {
    var parent = el.parentElement;
    var sibs = Array.prototype.filter.call(parent.children, function (c) {
      return c.classList && c.classList.contains("reveal");
    });
    var idx = sibs.indexOf(el);
    if (idx > 0) el.style.transitionDelay = Math.min(idx * 45, 90) + "ms";
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
      var frame = 0, pointer;
      card.addEventListener('pointermove', function (event) {
        if (motion.matches) return;
        pointer = event;
        if (frame) return;
        frame = requestAnimationFrame(function () {
          frame = 0;
          var rect = card.getBoundingClientRect();
          card.style.setProperty('--mx', (pointer.clientX - rect.left) / rect.width * 100 + '%');
          card.style.setProperty('--my', (pointer.clientY - rect.top) / rect.height * 100 + '%');
          if (card.classList.contains('feature-card')) {
            card.style.setProperty('--tilt-x', (0.5 - (pointer.clientY - rect.top) / rect.height) * 3 + 'deg');
            card.style.setProperty('--tilt-y', ((pointer.clientX - rect.left) / rect.width - 0.5) * 4 + 'deg');
          }
        });
      });
      card.addEventListener('pointerleave', function () {
        cancelAnimationFrame(frame); frame = 0;
        card.style.removeProperty('--mx'); card.style.removeProperty('--my');
        card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y');
      });
    });
  }

  // Preserve the bundled version offline and never downgrade it to an older release.
  var badge = document.getElementById('app-version');
  var download = document.querySelector('[data-download]');
  var bundled = badge.textContent.replace(/^v/, '').split('.').map(Number);
  var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 5000);
  fetch('https://api.github.com/repos/MYdesignTool/Ae-ToolKit/releases/latest', { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
    .then(function (response) { if (!response.ok) throw new Error('Release unavailable'); return response.json(); })
    .then(function (data) {
      var match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(data.tag_name || '');
      if (!match) return;
      var version = match.slice(1).map(Number), order = 0;
      for (var i = 0; i < 3; i++) { if (version[i] !== bundled[i]) { order = version[i] - bundled[i]; break; } }
      if (order < 0) return;
      badge.textContent = data.tag_name;
      download.href = 'https://github.com/MYdesignTool/Ae-ToolKit/releases/tag/' + encodeURIComponent(data.tag_name);
      download.querySelector('[data-download-label]').textContent = '下载 ' + match.slice(1).join('.');
    })
    .catch(function () { /* Static download and version stay available offline. */ })
    .finally(function () { clearTimeout(timeout); });
})();
