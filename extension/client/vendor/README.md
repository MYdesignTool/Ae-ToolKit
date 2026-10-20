# Offline editor dependencies

These browser distributions are committed locally. The panel makes no CDN requests.

| Library | Version | Files | License |
| --- | --- | --- | --- |
| [CodeMirror 5](https://codemirror.net/5/) | 5.65.21 | codemirror.js/css, javascript.js, matchbrackets.js, closebrackets.js, lint.js/css | MIT, LICENSE-codemirror |
| [Acorn](https://github.com/acornjs/acorn) | 8.15.0 | acorn.js | MIT, LICENSE-acorn |
| [Prettier](https://prettier.io/) | 2.8.8 | prettier.js (standalone), parser-babel.js | MIT and third-party notices, LICENSE-prettier |

Files were retrieved from the corresponding pinned npm package paths on unpkg.com.
CodeMirror 5 and Prettier 2 retain compatibility with CEP 11 / Chromium 88 and the
existing classic-script setup. Acorn parses ES2020 syntax with top-level return
allowed, without executing expressions or checking whether AE globals exist.
AE remains responsible for expression engine and property validation.

For updates, replace distributions and license notices together, then run the
editor unit tests and both browser regression suites. Do not minify or modify
the vendored distributions in place.
