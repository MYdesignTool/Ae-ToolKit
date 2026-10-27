/* Offline JavaScript editing. Parsing never evaluates the user's expression. */
AELT.editor = (function () {
  var cm = null, diagnostic = null, timer = null, completion = null;
  function check(code) {
    if (!code.trim()) return null;
    try {
      acorn.parse(code, {ecmaVersion: 2020, sourceType: 'script', allowReturnOutsideFunction: true, locations: true});
      return null;
    } catch (error) {
      return {line: error.loc ? error.loc.line - 1 : 0, ch: error.loc ? error.loc.column : 0,
        message: error.message.replace(/ \(\d+:\d+\)$/, '')};
    }
  }
  function errorText(error) {
    var message = error.message;
    if (/Unterminated string/.test(message)) message = t('字符串未闭合');
    else if (/Unterminated template/.test(message)) message = t('模板字符串未闭合');
    else if (/Unterminated comment/.test(message)) message = t('注释未闭合');
    else if (/Unterminated regular expression/.test(message)) message = t('正则表达式未闭合');
    else if (/Unexpected token/.test(message)) message = t('意外的符号，请检查括号或缺失的内容');
    else if (/Unexpected character/.test(message)) message = t('无效字符');
    else if (/Assigning to rvalue/.test(message)) message = t('赋值目标无效');
    return t('第 {line} 行，第 {column} 列：{message}', {line:error.line + 1, column:error.ch + 1, message:message});
  }
  function renderStatus() {
    if (!els.editorStatus) return;
    var code = cm ? cm.getValue() : els.expressionCode.value;
    els.editorStatus.textContent = diagnostic ? errorText(diagnostic) : code.trim() ? t('语法检查通过 · 运行结果以 AE 为准') : t('JavaScript · 输入表达式开始编辑');
    els.editorStatus.classList.toggle('has-error', !!diagnostic);
    els.editorStatus.title = diagnostic ? diagnostic.message : t('仅检查语法；AE 属性和运行时错误由宿主验证');
    els.editorStatus.disabled = !diagnostic;
    if (cm) cm.getInputField().setAttribute('aria-invalid', String(!!diagnostic));
  }
  function annotations(code) {
    diagnostic = check(code); renderStatus();
    if (!diagnostic) return [];
    var from = CodeMirror.Pos(diagnostic.line, diagnostic.ch);
    var line = code.split('\n')[diagnostic.line] || '';
    return [{from:from, to:CodeMirror.Pos(from.line, Math.min(from.ch + 1, line.length)), message:errorText(diagnostic), severity:'error'}];
  }
  function formatCode(code) {
    // Preserve statement order, strings, comments and automatic semicolon semantics.
    return prettier.format(code, {parser:'babel', plugins:prettierPlugins, tabWidth:2, useTabs:false, printWidth:80, endOfLine:'lf'}).replace(/\n$/, '');
  }
  function format() {
    if (state.expressionBusy || !cm || !cm.getValue().trim()) return;
    if (completion) completion.close();
    var source = cm.getValue();
    try {
      var syntaxError = check(source);
      if (syntaxError) throw new SyntaxError(syntaxError.message);
      var formatted = formatCode(source);
      if (formatted !== source) {
        var cursor = cm.indexFromPos(cm.getCursor()), scroll = cm.getScrollInfo();
        cm.operation(function () {
          cm.replaceRange(formatted, {line:0, ch:0}, cm.posFromIndex(source.length), '+format');
          cm.setCursor(cm.posFromIndex(Math.min(cursor, formatted.length)));
        });
        cm.scrollTo(scroll.left, scroll.top);
      }
      cm.focus(); setStatus(t('表达式已格式化。'));
    } catch (error) {
      // Invalid drafts stay intact, including their undo history.
      diagnostic = check(source); renderStatus();
      setStatus(t('无法格式化，请先修复语法错误。'));
      showToast(diagnostic ? errorText(diagnostic) : String(error.message), 'error');
    }
  }
  function refreshLanguage() {
    if (completion) completion.close();
    if (cm) {
      cm.setOption('screenReaderLabel', t('表达式内容'));
      cm.getInputField().setAttribute('aria-describedby', 'editorStatus');
      cm.getWrapperElement().title = t('Tab 缩进 · Shift+Tab 取消缩进 · Shift+Alt+F 格式化 · Ctrl/Cmd+Enter 应用');
      cm.performLint();
    }
    renderStatus();
  }
  function init() {
    var composing = false, compositionCommitted = false;
    cm = CodeMirror.fromTextArea(els.expressionCode, {
      spellcheck:false,
      mode:{name:'javascript', globalVars:true}, theme:'aelt', lineNumbers:true,
      indentUnit:2, tabSize:2, indentWithTabs:false, lineWrapping:false,
      matchBrackets:true, autoCloseBrackets:true, gutters:['CodeMirror-linenumbers', 'CodeMirror-lint-markers'],
      lint:{getAnnotations:annotations, delay:350}, viewportMargin:10,
      extraKeys:{
        Tab:function (editor) { if (editor.somethingSelected()) editor.indentSelection('add'); else editor.replaceSelection('  ', 'end', '+input'); },
        'Shift-Tab':function (editor) { editor.indentSelection('subtract'); },
        'Shift-Alt-F':format,
        'Ctrl-Enter':function () { applyExpression(); }, 'Cmd-Enter':function () { applyExpression(); }
      }
    });
    completion = AELT.completion.attach(cm);
    var input = cm.getInputField();
    input.addEventListener('compositionstart', function () { composing = true; compositionCommitted = false; });
    input.addEventListener('compositionend', function () { composing = false; compositionCommitted = true; });
    input.addEventListener('blur', function () { composing = false; compositionCommitted = false; });
    cm.on('cursorActivity', function (editor) {
      if (compositionCommitted && editor.hasFocus()) {
        compositionCommitted = false;
        requestAnimationFrame(function () {
          if (!composing && editor.hasFocus()) editor.scrollIntoView(editor.getCursor(), 12);
        });
      }
    });
    cm.on('change', function () { cm.save(); syncExpressionEditor(); });
    els.formatExpressionBtn.addEventListener('click', format);
    els.editorStatus.addEventListener('click', function () {
      if (!diagnostic) return;
      cm.focus(); cm.setCursor({line:diagnostic.line, ch:diagnostic.ch}); cm.scrollIntoView(cm.getCursor(), 30);
    });
    // Programmatic textarea input is also supported for integrations and fallback tools.
    els.expressionCode.addEventListener('input', function () { setValue(els.expressionCode.value); });
    refreshLanguage();
    new ResizeObserver(function () { clearTimeout(timer); timer = setTimeout(function () { cm.refresh(); }, 0); }).observe(cm.getWrapperElement());
  }
  function setValue(code) {
    if (completion) completion.close();
    code = String(code || '').replace(/\r\n?/g, '\n');
    if (cm && cm.getValue() !== code) { cm.setValue(code); cm.clearHistory(); }
    els.expressionCode.value = code;
    if (cm) cm.performLint();
  }
  function sync() {
    if (!cm) return;
    cm.setOption('readOnly', state.expressionBusy);
    if (state.expressionBusy && completion) completion.close();
    els.formatExpressionBtn.disabled = state.expressionBusy || !els.expressionCode.value.trim();
  }
  return {init:init, setValue:setValue, sync:sync, format:format, formatCode:formatCode, check:check,
    setCompletionEnabled:function (enabled) { if (completion) completion.setEnabled(enabled); },
    setCompletionAcceptKey:function (key) { if (completion) completion.setAcceptKey(key); },
    setCompletionHelpEnabled:function (enabled) { if (completion) completion.setHelpEnabled(enabled); },
    refreshLanguage:refreshLanguage, getInstance:function () { return cm; }};
})();
