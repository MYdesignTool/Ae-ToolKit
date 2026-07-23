// Ae-ToolKit 发布页交互脚本

(function () {
  "use strict";

  // 标记 JS 可用，启用滚动揭示动画（无 JS 时内容正常显示）
  document.documentElement.classList.add("js");

  // 主题切换：默认亮色，灯泡按钮切换并持久化到 localStorage
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById("theme-toggle");
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    root.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
    if (btn) {
      btn.addEventListener("click", function () {
        var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    }
  })();

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
      document.querySelector(".nav-links")?.classList.remove("open");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // 滚动揭示：进入视口时淡入上浮（错落出现）
  var revealEls = document.querySelectorAll(
    ".section-title, .section-subtitle, .feature-card, .code-panel, .project-tree, .step, .footer-top, .footer-bottom"
  );
  revealEls.forEach(function (el) { el.classList.add("reveal"); });

  // 同组元素按出现顺序错落延迟
  revealEls.forEach(function (el) {
    var parent = el.parentElement;
    var sibs = Array.prototype.filter.call(parent.children, function (c) {
      return c.classList && c.classList.contains("reveal");
    });
    var idx = sibs.indexOf(el);
    if (idx > 0) el.style.transitionDelay = (idx * 0.1).toFixed(2) + "s";
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

  // 液态玻璃：鼠标跟随高光（仅精确指针设备），覆盖所有玻璃元素（含导航栏）
  if (window.matchMedia && window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll(".glass, .site-header").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width) * 100;
        var y = ((e.clientY - r.top) / r.height) * 100;
        card.style.setProperty("--mx", x + "%");
        card.style.setProperty("--my", y + "%");
      });
      card.addEventListener("mouseleave", function () {
        card.style.setProperty("--mx", "50%");
        card.style.setProperty("--my", "0%");
      });
    });
  }

  // 自动获取 GitHub 最新 Release 版本号，避免每次手动更新发布页
  // 兜底值：API 不可用时仍显示合理版本；成功则覆盖为线上最新版
  (function () {
    var REPO = "MYdesignTool/Ae-ToolKit";
    var FALLBACK = "v0.2.5";
    var badge = document.getElementById("app-version");
    var download = document.querySelector('a.btn-primary[href*="releases/latest"]');

    if (badge) {
      badge.textContent = FALLBACK;
      fetch("https://api.github.com/repos/" + REPO + "/releases/latest", {
        headers: { Accept: "application/vnd.github+json" }
      })
        .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function (data) {
          if (!data || !data.tag_name) return;
          badge.textContent = data.tag_name;
          if (download) download.href = "https://github.com/" + REPO + "/releases/tag/" + data.tag_name;
        })
        .catch(function () { /* 保持兜底值，不影响页面 */ });
    }
  })();
})();
