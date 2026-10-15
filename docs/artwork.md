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

## 发布页透明人设（2026-10-15）

使用内置 imagegen 编辑，沿用原团队人设；最终透明素材转为 WebP，保留 alpha。扩展内部插画未改变。未采用的挥手、抱玩具火箭等草稿留在生成记录中，不进入项目。

| 文件 | 用途 | 大小 |
| --- | --- | --- |
| assets/img/team-peek.webp | 双手扒着更新横幅下沿 | 1200×400 |
| assets/img/team-guide.webp | 从安装提示侧边探头并指向说明 | 384×384 |
| assets/img/team-rocket.webp | 小人抱大火箭的返回顶部按钮 | 288×288 |

原始输出位于 Codex generated_images，采用的 PNG 分别为 exec-5a32e301-dba0-47a9-a65b-a27fbb98da0f.png、exec-d3b6ecf1-1e97-4294-bfe9-8198d1d493b7.png、exec-37721bf6-151f-4219-af7e-98d888a09b8f.png。火箭在 CSS 中旋转 -11° 使其竖直，悬停只向上移动。

最终生成提示词：

### 扒边

Use case: identity-preserve. Asset type: transparent mascot cutout for a website release-card banner. Edit target is the supplied transparent wide mascot. Change ONLY the pose: the same chibi girl peeks up from behind an imaginary horizontal card edge, BOTH small hands gripping the bottom ledge with fingers curled over it, chin just above her hands, playful welcoming smile, both ruby red eyes open. Hands sit on a common horizontal line at about 91 percent of image height; their rounded fingers extend to 97 percent, fully visible. Only head, shoulders and gripping hands show above this imaginary edge; hide lower torso below the crop. NO real ledge, bar, rectangle or frame should be drawn: the website supplies the ledge. Preserve character identity exactly: fluffy ivory-white hair, dark brown cat ears with pink interiors and white speckles, turquoise hair sparkles, ruby eyes, long side braid trailing to the right, red bow with blue trim, same red and blue outfit. Keep the original elegant soft painted anime chibi style. Wide 3:1 composition with left 60 percent empty transparent, character occupies right 40 percent; all ears fully visible with small top breathing room. Actual transparent RGBA background with clean soft alpha edges on pale blue or dark navy. Remove all existing background. No paw-print decorations, no words, no shadows, no extra characters, no checkerboard painted into image.

### 指向说明

Use case: identity-preserve. Edit the supplied mascot reference into a new pose for a website installation note. Same exact chibi character identity and polished soft anime painting: ivory fluffy hair, dark brown cat ears with pink inner ear and white speckles, ruby red eyes, turquoise hair sparkles, long side braid, red and blue bow and red-blue outfit. NEW POSE: she leans into view from behind the LEFT SIDE of an imaginary vertical glass card edge: head tilted playfully to her right, her left hand wraps around the unseen edge near her cheek, her right arm extends a little to point to the RIGHT toward instructions. Upper body portrait, gentle helpful open-eyed smile, ears and both hands completely visible, lower torso softly cropped at the bottom. Invisible vertical edge is at about 75% of image width, head and shoulders mostly to its left; pointing hand can extend to the right. Do NOT draw a card, edge, line, panel or any props, the website supplies the actual surface. Character only on a true transparent RGBA background, clean natural alpha edges on pale blue and navy. Square canvas, character fills central 90%, small breathing room around ears and pointing fingertip. No text, no decorative paw prints, no background, no cast shadow, no checkerboard.

### 小人抱大火箭

Use case: identity-preserve. Asset type: a tiny transparent website back-to-top illustration. Reference image supplies ONLY the chibi character identity and painting style. COMPOSITION IS CRITICAL: one LARGE upward-pointing rocket occupies about 85% of canvas height. One TINY FULL-BODY chibi girl hugs the LEFT SIDE of this large rocket with both arms and dangling bent legs. The rocket is at least TWO TIMES as tall as the ENTIRE girl including ears. The girl's whole body is only 40% of canvas height, her head only 20% of canvas height. Her head must NOT dominate. Show her complete small body, shoes, hands, red outfit and trailing braid. She clings to the rocket as if being carried gently upward. Rocket is clearly the main silhouette: tall slim pearl-white fuselage, cobalt blue nose and fins, simple pale blue porthole, tiny soft blue flame under the base. It points almost straight up, slight 8-degree right tilt. Character is the same ivory fluffy-haired cat girl with dark brown pink-interior speckled ears, ruby eyes, turquoise sparkles, red bow with blue trim and red-blue outfit; cute happy smile. Use the same elegant soft anime painted style as the reference, simplified to read at 100px. Square canvas, whole rocket and whole little girl visible with 8% transparent margins, centered composition. Real clean transparent RGBA background, no haze, no ground, no rectangle, no text, no shadow, no stars. NOT a close-up portrait, NOT a huge head holding a toy rocket: tiny whole girl with oversized rocket.
