(function () {
  'use strict';
  var status = document.getElementById('connection');
  var shortcutStatus = document.getElementById('shortcut-status');
  var serial = 0, pending = Object.create(null), channel = 'org.aelocaltoolkit.inputprobe/1';
  var webview = window.chrome && window.chrome.webview;
  var editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    mode: 'javascript', lineNumbers: true, lineWrapping: false, indentUnit: 2, tabSize: 2, spellcheck: false,
    extraKeys: {'Ctrl-Enter': function () { shortcutStatus.textContent = 'Ctrl+Enter 已响应'; }, 'Tab': 'indentMore', 'Shift-Tab': 'indentLess'}
  });
  window.inputProbe = {editor: editor};
  document.getElementById('environment').textContent = navigator.userAgent + '\nDPI 比例：' + devicePixelRatio + '\nCodeMirror：' + CodeMirror.version;
  function call(method, payload) {
    return new Promise(function (resolve, reject) {
      if (!webview) { reject(new Error('当前页面未运行在原生 WebView2 面板中')); return; }
      var id = 'wv-' + (++serial), timer = setTimeout(function () { delete pending[id]; reject(new Error('宿主响应超时')); }, 9000);
      pending[id] = {resolve: resolve, reject: reject, timer: timer};
      webview.postMessage({channel: channel, id: id, method: method, payload: payload});
    });
  }
  if (webview) webview.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || message.channel !== channel || !pending[message.id]) return;
    var request = pending[message.id]; delete pending[message.id]; clearTimeout(request.timer);
    try { request.resolve(JSON.parse(message.result)); } catch (error) { request.reject(error); }
  });
  function ping() {
    status.textContent = '正在连接宿主…';
    return call('probe.ping', '中文连接测试').then(function (response) {
      if (!response.ok || response.echo !== '中文连接测试') throw new Error('宿主返回异常');
      status.textContent = 'AEGP + WebView2 已连接';
    }).catch(function (error) { status.textContent = error.message; });
  }
  document.getElementById('ping').addEventListener('click', ping);
  window.addEventListener('beforeunload', function () {
    Object.keys(pending).forEach(function (id) { clearTimeout(pending[id].timer); pending[id].reject(new Error('页面已关闭')); });
    pending = Object.create(null);
  });
  ping();
}());
