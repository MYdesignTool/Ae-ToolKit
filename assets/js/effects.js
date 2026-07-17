// Ae-ToolKit 发布页 · 动态视觉特效
// 1) Hero 内打字机式源码片段  2) 全站跟随鼠标的发光粒子
// 尊重 prefers-reduced-motion，移动端自动降级

(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var ctx = canvas.getContext("2d");
    function resize() {
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    return { ctx: ctx, dpr: dpr, resize: resize };
  }

  /* ---------- 1. 打字机式源码片段 (Hero) — 随机位置、不重叠、闪烁消失 ---------- */
  // 截取自本地仓库 D:\Project\Code\AeLocalToolkit 的真实代码，避免无意义的乱码
  var SOURCE_SNIPPETS = [
    "prop.expressionEnabled = true;",
    "app.beginUndoGroup(\"AE Local Toolkit\");",
    "app.endUndoGroup();",
    "$.evalFile(file);",
    "summary.applied++;",
    "items.sort(sortByName);",
    "var decoded = decodeURI(filePath);",
    "if (!file.exists) return result;",
    "files.push({ name: fileName });",
    "prop.expression = expression;",
    "for (var i = 0; i < rules.length; i++) {\n  organizeInto(rules[i]);\n}",
    "if (hasExpression(prop) && !overwrite) {\n  summary.existing++;\n  continue;\n}",
    "var items = folder.getFiles();\nitems.sort(sortByName);",
    "try {\n  prop.expression = expression;\n} catch (e) {\n  summary.errors++;\n}"
  ];

  function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function initTypewriter() {
    var canvas = document.getElementById("matrix-fx");
    if (!canvas) return;
    var hero = canvas.parentElement || document.body;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var FONT_SIZE = 15;
    var LINE_H = 22;
    var PAD = 24;          // 片段之间的安全间距，避免重叠
    var MAX_ACTIVE = 6;    // 同时存在的片段上限

    var active = [];       // 当前显示的片段对象
    var rects = [];        // 占用矩形（用于重叠检测）
    var contentEl = hero.querySelector(".hero-content");
    var contentBox = null; // 中央文字框（永久避让区）
    var CONTENT_PAD = 30;  // 文字框周围的安全留白

    function getSize() {
      var w = hero.clientWidth || window.innerWidth;
      var h = hero.clientHeight || window.innerHeight;
      return { w: w, h: h };
    }

    // 实时计算中央文字框相对 hero 的坐标，避免打字机在其上生成
    function updateContentBox() {
      if (!contentEl) { contentBox = null; return; }
      var hb = hero.getBoundingClientRect();
      var cb = contentEl.getBoundingClientRect();
      contentBox = { x: cb.left - hb.left, y: cb.top - hb.top, w: cb.width, h: cb.height };
    }

    function resize() {
      var s = getSize();
      canvas.width = s.w * dpr;
      canvas.height = s.h * dpr;
      canvas.style.width = s.w + "px";
      canvas.style.height = s.h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function measure(text) {
      ctx.font = FONT_SIZE + "px monospace";
      var lines = text.split("\n");
      var w = 0;
      for (var i = 0; i < lines.length; i++) {
        w = Math.max(w, ctx.measureText(lines[i]).width);
      }
      return { w: Math.ceil(w), h: lines.length * LINE_H };
    }

    function overlaps(x, y, w, h) {
      // 永远避开中央文字框
      if (contentBox) {
        if (x < contentBox.x + contentBox.w + CONTENT_PAD && x + w + CONTENT_PAD > contentBox.x &&
            y < contentBox.y + contentBox.h + CONTENT_PAD && y + h + CONTENT_PAD > contentBox.y) return true;
      }
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (x < r.x + r.w + PAD && x + w + PAD > r.x &&
            y < r.y + r.h + PAD && y + h + PAD > r.y) return true;
      }
      return false;
    }

    function trySpawn() {
      if (active.length >= MAX_ACTIVE) return;
      updateContentBox();
      var text = SOURCE_SNIPPETS[(Math.random() * SOURCE_SNIPPETS.length) | 0];
      var m = measure(text);
      var W = hero.clientWidth, H = hero.clientHeight;
      var maxX = Math.max(1, W - m.w - 40);
      var maxY = Math.max(1, H - m.h - 40);
      for (var attempt = 0; attempt < 14; attempt++) {
        var x = 20 + Math.random() * maxX;
        var y = 20 + Math.random() * maxY;
        if (!overlaps(x, y, m.w, m.h)) {
          var rect = { x: x, y: y, w: m.w, h: m.h };
          rects.push(rect);
          active.push({
            text: text,
            x: x, y: y, w: m.w, h: m.h, rect: rect,
            typed: 0,
            state: "typing",
            fade: 1,
            lastType: performance.now(),
            typeDelay: 12 + Math.random() * 26,   // 每字符间隔(ms)
            doneAt: 0, blinkStart: 0, fadeStart: 0, visible: true
          });
          return;
        }
      }
    }

    function drawSnippet(it, now) {
      var alpha = it.fade;
      var sub = it.text.slice(0, it.typed);
      var lines = sub.split("\n");
      ctx.font = FONT_SIZE + "px monospace";
      ctx.textBaseline = "top";

      // 玻璃卡片底（暗色 + 弱描边，低调融入背景）
      ctx.save();
      ctx.globalAlpha = 0.10 * alpha;
      ctx.fillStyle = "#07061a";
      roundRectPath(ctx, it.x - 12, it.y - 10, it.w + 24, it.h + 20, 10);
      ctx.fill();
      ctx.globalAlpha = 0.20 * alpha;
      ctx.strokeStyle = "rgba(120,100,190,1)";
      ctx.lineWidth = 1;
      roundRectPath(ctx, it.x - 12, it.y - 10, it.w + 24, it.h + 20, 10);
      ctx.stroke();
      ctx.restore();

      // 文字（暗紫灰 + 极弱辉光，不抢主体）
      ctx.shadowColor = "rgba(120,90,200,0.35)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = "rgba(160,150,195," + (0.52 * alpha) + ")";
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], it.x, it.y + li * LINE_H);
      }
      ctx.shadowBlur = 0;

      // 光标（打字/停留时闪烁）
      if (it.state === "typing" || it.state === "hold") {
        var caretOn = Math.floor(now / 420) % 2 === 0;
        if (caretOn) {
          var lastLine = lines[lines.length - 1];
          var ly = it.y + (lines.length - 1) * LINE_H;
          var lw = ctx.measureText(lastLine).width;
          ctx.fillStyle = "rgba(150,130,210," + (0.6 * alpha) + ")";
          ctx.fillRect(it.x + lw + 2, ly + 2, 7, LINE_H - 4);
        }
      }
    }

    var lastSpawn = -10000;
    function frame(now) {
      var s = getSize();
      var W = s.w, H = s.h;
      ctx.clearRect(0, 0, W, H);

      // 调度生成
      if (now - lastSpawn > 700 + Math.random() * 900) {
        trySpawn();
        lastSpawn = now;
      }

      for (var i = active.length - 1; i >= 0; i--) {
        var it = active[i];

        if (it.state === "typing") {
          if (now - it.lastType > it.typeDelay) {
            it.typed++;
            it.lastType = now;
            if (it.typed >= it.text.length) {
              it.state = "hold";
              it.doneAt = now;
            }
          }
        } else if (it.state === "hold") {
          if (now - it.doneAt > 800 + Math.random() * 700) {
            it.state = "blinking";
            it.blinkStart = now;
          }
        } else if (it.state === "blinking") {
          var bt = now - it.blinkStart;
          it.visible = Math.floor(bt / 45) % 2 === 0;
          if (bt > 45 * 6) { it.state = "fading"; it.fadeStart = now; }
        } else if (it.state === "fading") {
          var ft = now - it.fadeStart;
          it.fade = Math.max(0, 1 - ft / 450);
          if (it.fade <= 0) {
            var ri = rects.indexOf(it.rect);
            if (ri >= 0) rects.splice(ri, 1);
            active.splice(i, 1);
            continue;
          }
        }

        if (it.state === "blinking" && !it.visible) continue; // 闪烁熄灭帧
        drawSnippet(it, now);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 2. 跟随鼠标的发光粒子 ---------- */
  function initCursorFX() {
    var canvas = document.getElementById("cursor-fx");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var particles = [];
    var mouse = { x: -999, y: -999, active: false };

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    var isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      window.addEventListener("mousemove", function (e) {
        mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
        // 每次移动生成 1 个粒子
        var n = 1;
        for (var i = 0; i < n; i++) {
          particles.push({
            x: mouse.x + (Math.random() - 0.5) * 8,
            y: mouse.y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6 - 0.2,
            life: 1,
            r: 1.5 + Math.random() * 2.5,
            hue: 265 + Math.random() * 40
          });
        }
        if (particles.length > 220) particles.splice(0, particles.length - 220);
      }, { passive: true });
      window.addEventListener("mouseleave", function () { mouse.active = false; });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // 鼠标光晕
      if (mouse.active && !reduceMotion) {
        var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
        g.addColorStop(0, "rgba(167,139,250,0.16)");
        g.addColorStop(1, "rgba(167,139,250,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2);
        ctx.fill();
      }

      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.012; // 轻微上浮/下沉
        p.life -= 0.018;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + p.hue + ",90%,72%," + (p.life * 0.9) + ")";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "hsla(" + p.hue + ",90%,70%," + p.life + ")";
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initTypewriter();
      initCursorFX();
    });
  } else {
    initTypewriter();
    initCursorFX();
  }
})();
