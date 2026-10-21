# Source and boundary

This module adapts the author's MIT-licensed Starfield implementation:

- Repository: local `newStardust`, `ae_plugin/WebPanelHost.cpp/.hpp` and `WebPanelProtocol.hpp`.
- `WebPanelHost.cpp` last-changing commit: `6b20685e488dbdb38abaa84e4e16cba4e7c2ebc4`.
- Source SHA-256: `8F54C6D00F716F56D5F19C7A8F7EA3314CA3FFDA89355AEBF363D0532D47D3AB`.
- Copyright (c) 2026 MYdesignTool. See the accompanying MIT license.

The adaptation parameterizes identities, paths and business dispatch; removes
Starfield graph repair, native command injection, preset windows and particle
transactions; and retains standard HWND WebView2, owned asynchronous callbacks,
navigation epochs, bounded FIFO requests and AE idle-thread dispatch. It makes
no changes to the source Starfield checkout, its deployment or caches.

Adobe SDK and Microsoft WebView2 SDK have separate terms. Private, versioned
copies now live in this worktree's ignored `.local-deps/`, together with the
required x64 toolchain. `native/dependencies.lock.json` records their hashes.
They are not runtime references to Starfield, not committed source dependencies,
and not included in product payloads. Microsoft WebView2 loader license and
notices accompany the Windows binary; the offline runtime prerequisite is
included once in the Windows installer staging area.
The development probe copies this project's existing CodeMirror runtime and its
license into an ignored build directory only. No installer is generated.
