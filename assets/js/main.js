// Ae-ToolKit 发布页交互脚本

(function () {
  "use strict";

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

  // Header 滚动时增加背景深度
  var header = document.querySelector(".site-header");
  var lastScroll = 0;
  window.addEventListener("scroll", function () {
    var s = window.scrollY;
    if (s > 60) {
      header.style.background = "rgba(7,7,28,.92)";
    } else {
      header.style.background = "rgba(7,7,28,.75)";
    }
    lastScroll = s;
  }, { passive: true });

  // Feature cards 进入视口时的淡入动画（IntersectionObserver）
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll(".feature-card, .step").forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(30px)";
      el.style.transition = "opacity .6s ease, transform .6s ease";
      observer.observe(el);
    });
  }

})();
