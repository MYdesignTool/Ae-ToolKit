/* Optional WebView2 transport. CEP keeps its original bridge and input path. */
(function () {
  'use strict';
  var config = window.__aeltToolkitNative;
  var webview = window.chrome && window.chrome.webview;
  if (!config || !webview || !config.channel || !config.extensionRoot) return;
  var serial = 0, pending = Object.create(null), closed = false;
  function failed(message) { return {ok:false,messages:[String(message)]}; }
  function request(method, payload, callback) {
    if (closed) { callback(failed('The native panel is closed.')); return; }
    var id = 'wv-' + (++serial);
    var timer = setTimeout(function () {
      if (!pending[id]) return;
      delete pending[id]; callback(failed('The native host did not respond. Check AE before retrying.'));
    }, 300000);
    pending[id] = {callback:callback,timer:timer};
    try { webview.postMessage({channel:config.channel,id:id,method:method,payload:JSON.stringify(payload)}); }
    catch (error) { clearTimeout(timer); delete pending[id]; callback(failed(error)); }
  }
  webview.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || message.channel !== config.channel || !pending[message.id]) return;
    var item = pending[message.id]; delete pending[message.id]; clearTimeout(item.timer);
    var result;
    try {
      result = JSON.parse(message.result);
      if (!result || typeof result.ok !== 'boolean') throw new Error('Invalid native host response');
      if (!result.ok && !Array.isArray(result.messages)) result.messages = [String(result.error && result.error.message || result.error || 'The native host request failed.')];
    } catch (error) { result = failed(error); }
    item.callback(result);
  });
  window.AeltNativeBridge = {
    extensionRoot:config.extensionRoot,
    callHost:function (name, args, callback) { request(name, args || [], callback); },
    openExternal:function (url, callback) { request('native.openExternal', url, callback || function () {}); }
  };
  window.addEventListener('pagehide', function () {
    closed = true;
    Object.keys(pending).forEach(function (id) {
      var item = pending[id]; delete pending[id]; clearTimeout(item.timer);
      item.callback(failed('The panel document was closed. No automatic retry was made.'));
    });
  });
}());
