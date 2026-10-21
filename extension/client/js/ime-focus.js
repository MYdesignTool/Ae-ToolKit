/* CEP 11 / Windows: rebind the text client after native window focus settles.
 * CEF #3306 can notify the input method before the HWND has keyboard focus.
 * This is a scoped compatibility attempt, not the upstream C++ focus-order fix.
 */
AELT.imeFocus = (function () {
  var bound = false, pending = null, frame = 0, pointerDown = false, repairing = false, composing = null;
  function editable(node) {
    if (!node || node.nodeType !== 1 || node.disabled || node.readOnly) return null;
    if (node.tagName === 'TEXTAREA') return node;
    if (node.tagName === 'INPUT') return /^(text|search|url|tel)$/.test(node.type) ? node : null;
    return node.isContentEditable ? node.closest('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]') : null;
  }
  function cancel() { if (frame) cancelAnimationFrame(frame); frame = 0; pending = null; }
  function queue(node) {
    cancel(); pending = editable(node);
    if (pending && !pointerDown && !repairing && !composing) frame = requestAnimationFrame(rebind);
  }
  function rebind() {
    var field = pending; frame = 0; pending = null;
    if (!field || pointerDown || repairing || composing || document.activeElement !== field || !document.hasFocus() || !field.isConnected || !field.getClientRects().length || editable(field) !== field) return;
    // A tag editor commits pending text on blur. Never commit it just to repair focus.
    if (field.matches('.rule-extension-input input') && field.value.trim()) return;
    var selection = null, range = null;
    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
      selection = {start:field.selectionStart, end:field.selectionEnd, direction:field.selectionDirection};
    } else {
      var current = window.getSelection();
      if (!current.rangeCount || !field.contains(current.anchorNode) || !field.contains(current.focusNode)) return;
      // Save anchor and focus separately to preserve backwards selections too.
      range = {anchor:current.anchorNode, anchorOffset:current.anchorOffset, focus:current.focusNode, focusOffset:current.focusOffset};
    }
    repairing = true;
    try {
      field.blur();
      // A real blur handler may move focus or remove/lock the field. Respect that.
      if (!field.isConnected || editable(field) !== field || document.activeElement !== document.body) return;
      field.focus({preventScroll:true});
      if (document.activeElement !== field) return;
      if (selection) field.setSelectionRange(selection.start, selection.end, selection.direction);
      else if (range.anchor.isConnected && range.focus.isConnected && field.contains(range.anchor) && field.contains(range.focus)) {
        window.getSelection().setBaseAndExtent(range.anchor, range.anchorOffset, range.focus, range.focusOffset);
      }
    } catch (error) {
      // A compatibility refresh must not break editing if the DOM changed in a blur handler.
    } finally { repairing = false; }
  }
  function init() {
    if (bound) return;
    if (!window.__adobe_cep__ || !/^Win/i.test(navigator.platform) || !/\bChrome\/88\./.test(navigator.userAgent)) return;
    bound = true;
    document.addEventListener('focusin', function (event) { if (!repairing) queue(event.target); });
    // Re-entering the panel can leave the same DOM element focused, so focusin
    // alone is insufficient. Wait for the user's click/selection to finish.
    document.addEventListener('click', function (event) { if (!repairing && editable(event.target)) queue(event.target); });
    document.addEventListener('focusout', function (event) {
      if (!repairing) cancel();
      if (editable(event.target) === composing) composing = null;
    });
    document.addEventListener('pointerdown', function () { cancel(); pointerDown = true; }, true);
    document.addEventListener('pointerup', function () { pointerDown = false; if (pending) queue(pending); }, true);
    document.addEventListener('pointercancel', function () { pointerDown = false; cancel(); }, true);
    ['keydown','beforeinput','input','paste','cut','drop'].forEach(function (name) { document.addEventListener(name, cancel, true); });
    document.addEventListener('compositionstart', function (event) { cancel(); composing = editable(event.target); }, true);
    document.addEventListener('compositionend', function () { composing = null; }, true);
    window.addEventListener('blur', function () { cancel(); pointerDown = false; });
    window.addEventListener('focus', function () { if (!repairing) queue(document.activeElement); });
  }
  return {init:init};
})();
