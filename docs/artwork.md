# 面板图像素材

使用内置 imagegen 生成，运行时均为扩展内本地素材，无远程图片或个人目录依赖。A、B 已获用户选择；第三款候选未纳入项目。

| 文件（相对扩展 client） | 用途 | 导出 |
| --- | --- | --- |
| `images/placeholder-landscape.webp` | A：柔和地形 | 480×120，4:1 |
| `images/placeholder-ribbon.webp` | B：蓝紫流线 | 480×120，4:1 |
| `images/header-brand.webp` | 顶部 AE工具箱品牌图 | 648×144，显示 216×48 |

占位图按脚本完整路径在面板会话内缓存随机结果。搜索、收藏、重新扫描和切页不会重新抽选；脚本自带图片优先，缺图或加载失败才使用占位图。WebP 仅做留白裁切、缩放和编码以适配小横幅，圆角由现有 CSS 提供。旧占位图已移除。

以下记录最终采用素材的生成提示词，便于后续调整；未采用的头图草稿不进入产品。

## A

```text
Create one exquisite minimal panoramic banner illustration for a small script-library placeholder in a charcoal desktop creative tool. Aspect ratio 4:1, full-bleed rectangle, no rounded corners. Layered sculpted rolling terrain in midnight indigo, soft periwinkle and dusty violet, one small pearl sun near the right side, subtle luminous horizon. Calm, premium editorial 3D paper landscape with smooth clean silhouettes and restrained satin lighting. Designed to remain recognizable at 120 by 30 pixels: only a few large simple forms, generous calm space, no fine detail. No words, letters, logos, icons, borders, frames, mockups or user interface. Single banner, not a contact sheet.
```

## B

```text
Create one exquisite minimal panoramic banner illustration for a small script-library placeholder in a charcoal desktop creative tool. Aspect ratio 4:1, full-bleed rectangle, no rounded corners. A single graceful folded ribbon sweeping horizontally through a dark navy space, satin translucent cobalt and lavender material with a small muted cyan reflected edge, smooth soft studio illumination and elegant depth. Sophisticated restrained motion-design aesthetic, composition legible at 120 by 30 pixels, a few bold fluid shapes, no tiny detail, not neon or busy. No words, letters, logos, icons, borders, frames, mockups or user interface. Single banner, not a contact sheet.
```

## 顶部品牌图

```text
Use case: logo-brand. Create a finished compact horizontal header artwork for a charcoal desktop creative application. Wide 3:1 canvas, uniform solid opaque charcoal background RGB(23,23,23), absolutely no transparency. Only foreground: a beautiful small sculptural folded ribbon emblem in cobalt blue and periwinkle at the left, followed by the exact text "AE工具箱" in clean bold white modern sans-serif. White letters are solid, flat, smooth and crisp like professionally typeset text. NO distressed texture, NO outlines, NO grunge, NO scratches, NO broken strokes, NO erosion, NO missing pieces in the letters. All typography must read AE工具箱 accurately. Keep generous spacing between emblem and letters. Emblem simple enough to work at small scale, satin blue folds, no extra loops behind text. This is one usable premium image logo, not a screenshot or mockup. Put the whole compact lockup in the central 60% of the image height with generous empty charcoal margins above/below and modest margins on left/right; centered vertically and horizontally. Intended final small display is 216 by 48 pixels: use bold thick letter strokes with good spacing. Do not add any subtitle, slogan, watermark, Adobe logo, box, border or extra words.
```


## 更新日志团队插画

`extension/client/images/changelog-team.webp`：1200×400，由用户提供的人设图作为身份参考，使用内置 imagegen 生成。保留白发、猫耳、红瞳、侧编发与红蓝服装特征；在日志顶部右侧展示，版本、日期和正文保持真实文字。

```text
Use case: stylized-concept. Asset type: a compact illustrated update-log header banner for a charcoal desktop creative tool. Use the attached image ONLY as the character identity reference. Preserve the team's exact chibi mascot identity: fluffy ivory/white hair, tall dark brown/black cat ears with soft pink interiors and little pale spots, bright ruby-red eyes, a long side braid, red ribbon bow with blue trim, the red diamond-patterned costume with white frills, and the small blue/red/gold heart badge. Create a new charming waist-up pose, one paw-like hand raised in a small welcoming wave, both ruby eyes open, warm happy smile, cute soft rounded proportions. Beautiful clean anime/chibi illustration with soft polished shading, faithful to the reference. COMPOSITION: wide 3:1 horizontal banner, the character occupies the rightmost 35 percent, fully visible ears and face, bottom cropped naturally near waist. Left 60 percent remains quiet empty negative space for live UI text added later. Opaque deep warm charcoal #202020 background throughout, very subtle burgundy glow behind the character only, at most two tiny subdued paw-print accents near the character. No white background, no transparency, no typography, no words, no version numbers, no watermark, no extra characters, no UI mockup, no border. This is one usable banner artwork; simple composition must remain clear at about 450x140 pixels.
```
