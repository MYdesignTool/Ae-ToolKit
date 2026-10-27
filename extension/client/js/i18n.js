/* Chinese source keys, English UI translations. User content is never translated. */
function t(key, values) { return AELT.i18n.translate(key, values); }
AELT.i18n = (function () {
  var language = 'zh-CN', records = [], dictionary = {};
  function translate(key, values) {
    var text = language === 'en' && Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key;
    return String(text).replace(/\{(\w+)\}/g, function (match, name) { return values && values[name] !== undefined ? String(values[name]) : match; });
  }
  function capture() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('script, style, textarea, #languageSelect')) continue;
      if (/[\u4e00-\u9fff]/.test(node.nodeValue)) {
        var key = node.nodeValue.trim();
        records.push({node:node, key:key, prefix:node.nodeValue.match(/^\s*/)[0], suffix:node.nodeValue.match(/\s*$/)[0]});
      }
    }
    document.querySelectorAll('[placeholder], [title], [aria-label], img[alt]').forEach(function (element) {
      ['placeholder', 'title', 'aria-label', 'alt'].forEach(function (attribute) {
        var key = element.getAttribute(attribute);
        if (key && /[\u4e00-\u9fff]/.test(key)) records.push({node:element, attribute:attribute, key:key});
      });
    });
  }
  function apply() {
    document.documentElement.lang = language;
    document.title = translate('AE工具箱');
    records.forEach(function (entry) {
      if (!entry.node.isConnected) return;
      if (entry.attribute) entry.node.setAttribute(entry.attribute, translate(entry.key));
      else entry.node.nodeValue = entry.prefix + translate(entry.key) + entry.suffix;
    });
    applyLabels(document);
    if (els.languageSelect) els.languageSelect.value = language;
    if (AELT.selects) AELT.selects.refresh();
  }
  function applyLabels(root) {
    root.querySelectorAll('[data-i18n]').forEach(function (element) { element.textContent = translate(element.dataset.i18n); });
    root.querySelectorAll('[data-i18n-title]').forEach(function (element) { element.title = translate(element.dataset.i18nTitle); });
  }
  function setLanguage(value, persist) {
    language = value === 'en' ? 'en' : 'zh-CN';
    apply();
    if (persist) {
      $('toastContainer').textContent = '';
      AELT.settings.set('language', language);
      // Flush through the existing serial writer so quick close/reopen keeps the choice.
      AELT.settings.persist();
    }
    if (state.rules) {
      renderSchemeSelect(); renderExpressions(); AELT.organizer.refreshTagLabels();
      AELT.organizer.syncSaveUI();
    }
    if (state.ready) {
      renderScripts(); renderDebug(); renderChangelog();
      if (!state.scriptFolder) els.scriptFolderStatus.textContent = translate('未选择脚本文件夹');
      if ($('changelogModal').style.display !== 'none') showChangelog();
      refreshSelection();
    }
    if (AELT.editor) AELT.editor.refreshLanguage();
    if (AELT.app) AELT.app.positionTabIndicator(false);
  }
  function init() {
    dictionary = AELT.translations.en;
    capture(); apply();
    els.languageSelect.addEventListener('change', function () {
      setLanguage(els.languageSelect.value, true); setStatus(translate('界面语言已切换。'));
    });
  }
  function builtin(item, key) {
    if (!item.builtin && key === 'category' && item[key] === '自定义') return translate('自定义');
    return item.builtin ? translate(item[key]) : item[key];
  }
  function hostMessage(message) {
    if (language !== 'en') return message;
    var source = String(message).replace(/^Error:\s*/, '');
    if (Object.prototype.hasOwnProperty.call(dictionary, source)) return translate(source);
    var prefixes = AELT.hostMessagePrefixes;
    for (var prefix in prefixes) {
      if (Object.prototype.hasOwnProperty.call(prefixes, prefix) && source.indexOf(prefix) === 0) {
        var detail = source.slice(prefix.length);
        detail = detail.replace('。请确认 AE 已允许脚本写文件，且当前 Windows 用户对扩展 data 目录有写入权限。', '. Allow script file access in AE and grant this Windows user write access to the extension data folder.');
        return prefixes[prefix] + detail;
      }
    }
    return message;
  }
  return {translate:translate, init:init, apply:apply, applyLabels:applyLabels, setLanguage:setLanguage, builtin:builtin, hostMessage:hostMessage, getLanguage:function () { return language; }};
})();
