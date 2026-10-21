# Reusable AEGP + WebView2 panel host

Windows x64, standard HWND WebView2, extracted from Starfield under MIT (see
`NOTICE.md` and `LICENSE`). This directory has no particle, preset or toolkit
business dependency. Adobe and WebView2 SDKs are external build inputs.

Supply `Config` identities, absolute content/cache directories, and a business
dispatch callback. Call `initialize()` once from a resident General AEGP entry,
`step()` from its AE idle hook, and `stop()` from its death hook. A General AEGP
must remain loaded while its registered callback code is reachable.

Requests are `{channel,id,method,payload}` with four string fields. IDs are
monotonic `wv-N`. The transport checks exact document origin/path, bounds,
replay, queue capacity, document generation and expiry. WebView2 callbacks only
enqueue owned bytes; business callbacks run on the initialization thread during
idle, after host availability and an optional caller transaction guard. The
caller must whitelist methods and manage AE operations/quiet errors itself.
No arbitrary script executor is included. A failed operation is not retried.

The migration branch also permits an explicit bundled `document_url` (local
file loading) and trusted caller `bootstrap_script`. The exact document remains
the navigation/message boundary. `debug_port` defaults to zero; a development
consumer may opt into a loopback diagnostic endpoint. `retain_on_close` is an
explicit exception for already admitted immutable data snapshots; ordinary
project mutations are still discarded after their document becomes stale.

Each linked AEGP module owns one host configuration, with potentially multiple
views restored by AE. Supply unique panel match name, window class, domain,
channel and user-data directory for another plugin. Do not initialize multiple
independent configurations in the same linked module. Future support for that
case needs an instance-based registration design.

`../input-probe/` is the first consumer. It tests input/textarea/CodeMirror and
an echo-only idle bridge; it does not load project data or perform AE edits.
Compilation and fake-suite tests do not qualify actual IME placement, docking,
shortcuts or host lifecycle. Those remain real AE acceptance gates.
