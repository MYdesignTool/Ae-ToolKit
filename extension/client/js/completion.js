/* Offline expression vocabulary and completion UI. Never evaluates a draft or calls AE. */
AELT.completion = (function () {
  var types = {}, roots = [];
  function fields(type, names, result) {
    names.split(' ').forEach(function (name) {
      (types[type] || (types[type] = [])).push({name:name, kind:'property', owner:type, type:result || ''});
    });
  }
  function methods(type, definitions) {
    definitions.forEach(function (definition) {
      var parts = definition.split('|'), signature = parts[0], start = signature.indexOf('(');
      (types[type] || (types[type] = [])).push({name:signature.slice(0, start),
        params:signature.slice(start), kind:'function', owner:type, result:parts[1] || ''});
    });
  }
  // AE expression identifiers/signatures: Adobe Expression Language Reference.
  fields('Property', 'value velocity speed numKeys propertyIndex name');
  methods('Property', [
    'valueAtTime(t)', 'velocityAtTime(t)', 'speedAtTime(t)',
    'wiggle(freq, amp, octaves=1, amp_mult=.5, t=time)',
    'temporalWiggle(freq, amp, octaves=1, amp_mult=.5, t=time)',
    'smooth(width=.2, samples=5, t=time)', 'loopIn(type="cycle", numKeyframes=0)',
    'loopOut(type="cycle", numKeyframes=0)', 'loopInDuration(type="cycle", duration=0)',
    'loopOutDuration(type="cycle", duration=0)', 'key(index)|Key', 'nearestKey(t)|Key',
    'propertyGroup(countUp=1)|Group'
  ]);
  fields('Key', 'time value index');
  fields('Transform', 'anchorPoint position scale rotation opacity xPosition yPosition zPosition xRotation yRotation zRotation orientation', 'Property');
  fields('Layer', 'index name width height inPoint outPoint startTime stretch active enabled hasParent hasVideo hasAudio audioActive');
  fields('Layer', 'parent', 'Layer');
  fields('Layer', 'source', 'Comp');
  fields('Layer', 'transform', 'Transform');
  fields('Layer', 'anchorPoint position scale rotation opacity orientation', 'Property');
  fields('Layer', 'text', 'Text');
  fields('Layer', 'marker', 'Marker');
  methods('Layer', [
    'effect(nameOrIndex)|Group', 'content(nameOrIndex)|Group', 'mask(nameOrIndex)|Mask',
    'toComp(point, t=time)', 'fromComp(point, t=time)', 'toWorld(point, t=time)', 'fromWorld(point, t=time)',
    'toCompVec(vec, t=time)', 'fromCompVec(vec, t=time)', 'toWorldVec(vec, t=time)', 'fromWorldVec(vec, t=time)',
    'fromCompToSurface(point, t=time)', 'sourceRectAtTime(t=time, includeExtents=false)',
    'sampleImage(point, radius=[.5,.5], postEffect=true, t=time)', 'sourceTime(t=time)'
  ]);
  fields('Comp', 'name width height pixelAspect duration frameDuration displayStartTime numLayers ntscDropFrame shutterAngle shutterPhase bgColor');
  fields('Comp', 'activeCamera', 'Layer');
  fields('Comp', 'marker', 'Marker');
  methods('Comp', ['layer(nameOrIndex)|Layer', 'layerByComment(comment)|Layer']);
  fields('Footage', 'name width height pixelAspect duration frameDuration ntscDropFrame sourceData sourceText');
  methods('Footage', ['dataValue(dataPath)', 'dataKeyCount(dataPath)', 'dataKeyTimes(dataPath, t0=startTime, t1=endTime)', 'dataKeyValues(dataPath, t0=startTime, t1=endTime)']);
  fields('Text', 'sourceText', 'SourceText');
  fields('SourceText', 'value');
  fields('SourceText', 'style', 'TextStyle');
  methods('SourceText', ['getStyleAt(charIndex, t=time)|TextStyle']);
  methods('TextStyle', ['setText(text)|TextStyle', 'setFont(font)|TextStyle', 'setFontSize(size)|TextStyle',
    'setFillColor(color)|TextStyle', 'setApplyFill(value)|TextStyle', 'setApplyStroke(value)|TextStyle',
    'setStrokeColor(color)|TextStyle', 'setStrokeWidth(width)|TextStyle', 'setTracking(value)|TextStyle',
    'setLeading(value)|TextStyle', 'setAutoLeading(value)|TextStyle']);
  fields('TextStyle', 'font fontSize fillColor applyFill applyStroke strokeColor strokeWidth tracking leading autoLeading');
  fields('Marker', 'numKeys');
  methods('Marker', ['key(nameOrIndex)|Key', 'nearestKey(t)|Key']);
  fields('Mask', 'maskOpacity maskFeather maskExpansion', 'Property');
  fields('Mask', 'maskPath', 'Path');
  fields('Mask', 'invert');
  methods('Path', ['points(t=time)', 'inTangents(t=time)', 'outTangents(t=time)', 'isClosed()',
    'pointOnPath(percentage=.5, t=time)', 'tangentOnPath(percentage=.5, t=time)',
    'normalOnPath(percentage=.5, t=time)', 'createPath(points=[[0,0],[100,0],[100,100],[0,100]], inTangents=[], outTangents=[], isClosed=true)|Path']);
  fields('Group', 'name numProperties propertyIndex');
  methods('Group', ['propertyGroup(countUp=1)|Group']);
  fields('Math', 'PI E LN2 LN10 LOG2E LOG10E SQRT1_2 SQRT2');
  methods('Math', ['abs(x)', 'acos(x)', 'asin(x)', 'atan(x)', 'atan2(y, x)', 'ceil(x)', 'cos(x)',
    'exp(x)', 'floor(x)', 'log(x)', 'max(a, b)', 'min(a, b)', 'pow(base, exponent)', 'random()',
    'round(x)', 'sin(x)', 'sqrt(x)', 'tan(x)', 'sign(x)', 'trunc(x)']);
  methods('JSON', ['parse(text, reviver)', 'stringify(value, replacer, space)']);
  fields('Global', 'thisComp', 'Comp');
  fields('Global', 'thisLayer', 'Layer');
  fields('Global', 'thisProperty', 'Property');
  fields('Global', 'Math', 'Math');
  fields('Global', 'JSON', 'JSON');
  fields('Global', 'time colorDepth textIndex textTotal selectorValue');
  methods('Global', ['comp(name)|Comp', 'footage(name)|Footage', 'posterizeTime(framesPerSecond)',
    'timeToFrames(t=time+thisComp.displayStartTime, fps=1/thisComp.frameDuration, isDuration=false)', 'framesToTime(frames, fps=1/thisComp.frameDuration)',
    'timeToTimecode(t=time+thisComp.displayStartTime, timecodeBase=30, isDuration=false)',
    'timeToCurrentFormat(t=time+thisComp.displayStartTime, fps=1/thisComp.frameDuration, isDuration=false, ntscDropFrame=thisComp.ntscDropFrame)',
    'degreesToRadians(degrees)', 'radiansToDegrees(radians)', 'clamp(value, limit1, limit2)',
    'linear(t, tMin, tMax, value1, value2)', 'ease(t, tMin, tMax, value1, value2)',
    'easeIn(t, tMin, tMax, value1, value2)', 'easeOut(t, tMin, tMax, value1, value2)',
    'random(minValOrArray, maxValOrArray)', 'gaussRandom(minValOrArray, maxValOrArray)', 'seedRandom(offset, timeless=false)',
    'noise(valOrArray)', 'add(vec1, vec2)', 'sub(vec1, vec2)', 'mul(vec, amount)', 'div(vec, amount)',
    'dot(vec1, vec2)', 'cross(vec1, vec2)', 'normalize(vec)', 'length(vec1, vec2)', 'lookAt(fromPoint, atPoint)',
    'rgbToHsl(rgbaArray)', 'hslToRgb(hslaArray)', 'hexToRgb(hexString)',
    'parseInt(string, radix)', 'parseFloat(string)', 'isNaN(value)', 'isFinite(value)']);
  types.Global.concat(types.Layer, types.Property, types.Transform).forEach(function (entry) {
    if (!roots.some(function (existing) { return existing.name === entry.name; })) roots.push(entry);
  });
  'var let const function return if else for while do break continue switch case default true false null undefined NaN Infinity try catch finally throw new typeof instanceof'.split(' ').forEach(function (name) {
    roots.push({name:name, kind:'keyword', owner:'Keyword'});
  });
  function find(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }
  function identifier(char) { return /[\w$\u00a0-\uffff]/.test(char || ''); }
  function matchIndex(name, prefix) {
    var lower = name.toLowerCase(), search = prefix.toLowerCase();
    if (!search || lower.indexOf(search) === 0) return 0;
    for (var i = 1; i < name.length; i++) {
      var char = name.charAt(i), previous = name.charAt(i - 1), next = name.charAt(i + 1);
      var boundary = /[_$\d]/.test(previous) || /[A-Z]/.test(char) &&
        (/[a-z]/.test(previous) || /[A-Z]/.test(previous) && /[a-z]/.test(next));
      if (boundary && lower.slice(i, i + search.length) === search) return i;
    }
    return -1;
  }
  function scan(code) {
    var tokens = [], comments = [], tokenizer = acorn.tokenizer(code, {ecmaVersion:2020,
      onComment:function (block, text, start, end) { comments.push({start:start, end:end, block:block}); }});
    try {
      while (true) {
        var token = tokenizer.getToken();
        if (token.type.label === 'eof') break;
        tokens.push({label:token.type.label, value:token.value, start:token.start, end:token.end});
      }
    } catch (error) { return null; } // Incomplete strings, regexes and comments are never completed.
    var last = tokens[tokens.length - 1];
    if (comments.some(function (comment) { return comment.end === code.length && !comment.block; }) ||
        (last && /^(string|regexp|template|`)$/.test(last.label))) return null;
    return tokens;
  }
  function suggestions(code, index, manual) {
    var start = index, end = index;
    while (start > 0 && identifier(code.charAt(start - 1))) start--;
    while (end < code.length && identifier(code.charAt(end))) end++;
    var prefix = code.slice(start, index), before = code.slice(0, start);
    // Bound work for unusually large imported drafts. Tokenization never executes source.
    if (index > 200000) return null;
    var tokens = scan(code.slice(0, index));
    if (!tokens) return null;
    if (prefix) {
      var word = tokens[tokens.length - 1];
      if (!word || word.start !== start || !/^(name|var|const|let|function|return|if|else|for|while|true|false|null|new|typeof)$/.test(word.label)) return null;
      tokens.pop();
    }
    var member = tokens.length && tokens[tokens.length - 1].label === '.';
    if (!manual && !member && !prefix.length) return null;
    if (!manual && !prefix && !/\.\s*$/.test(before)) return null;
    function resolve(at, depth) {
      if (at < 0 || depth > 24) return null;
      var token = tokens[at], entry;
      if (token.label === 'name') {
        if (at > 0 && tokens[at - 1].label === '.') {
          var receiver = resolve(at - 2, depth + 1);
          return receiver ? find(types[receiver.type] || [], token.value) : null;
        }
        return find(roots, token.value);
      }
      if (token.label === ')') {
        var level = 1, open = at;
        while (--open >= 0) {
          if (tokens[open].label === ')') level++;
          else if (tokens[open].label === '(' && --level === 0) break;
        }
        if (open < 0) return null;
        entry = resolve(open - 1, depth + 1);
        if (entry) return {type:entry.result || (entry.type === 'Group' ? 'Property' : '')};
        // Parenthesized receivers, such as (thisComp).layer(...).
        if (open === 0 || !/^(name|\)|\])$/.test(tokens[open - 1].label)) return resolve(at - 1, depth + 1);
      }
      return null;
    }
    var pool;
    if (member) {
      var receiver = resolve(tokens.length - 2, 0);
      pool = receiver ? types[receiver.type] || [] : [];
    } else {
      pool = roots.slice();
      var seen = Object.create(null);
      pool.forEach(function (entry) { seen[entry.name] = true; });
      tokens.forEach(function (token, i) {
        // Include draft identifiers, including AE's common implicit variable assignments.
        if (token.label === 'name' && (!i || tokens[i - 1].label !== '.') && !seen[token.value]) {
          seen[token.value] = true;
          pool.push({name:token.value, kind:'variable'});
        }
      });
    }
    var list = pool.filter(function (entry) {
      return matchIndex(entry.name, prefix) >= 0 && (manual || entry.name !== prefix || entry.kind === 'function');
    });
    if (prefix || member) list.sort(function (a, b) {
      function rank(entry) { return entry.name.indexOf(prefix) === 0 ? 0 : matchIndex(entry.name, prefix) === 0 ? 1 : 2; }
      return rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });
    return list.length ? {list:list.slice(0, 7), from:start, to:end, prefix:prefix} : null;
  }
  function attach(cm) {
    var popup = null, closingPopup = null, result = null, selected = 0, timer = null, composing = false, anchor = null;
    var input = cm.getInputField(), enabled = false, helpEnabled = true, acceptKey = 'Enter', upwards = null;
    function releaseInput() {
      cm.removeKeyMap(keys); result = null;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant');
    }
    function close() {
      clearTimeout(timer); releaseInput(); anchor = null; upwards = null;
      if (!popup) return;
      var leaving = popup; popup = null; closingPopup = leaving;
      leaving.style.pointerEvents = 'none'; leaving.setAttribute('aria-hidden', 'true');
      animatePopup(leaving, false, function () {
        leaving.remove(); if (closingPopup === leaving) closingPopup = null;
      });
    }
    function position() {
      if (!popup) return;
      var caret = cm.cursorCoords(null, 'window'), gap = 4, margin = 8;
      popup.style.width = Math.min(380, window.innerWidth - margin * 2) + 'px';
      var below = window.innerHeight - caret.bottom - margin - gap, above = caret.top - margin - gap;
      if (upwards === null) upwards = below < 360 && above > below;
      var available = Math.floor(upwards ? above : below);
      if (available < 110) { close(); return; }
      var list = popup.querySelector('.completion-list'), detail = popup.querySelector('.completion-detail');
      var budget = available - 36;
      list.style.maxHeight = Math.min(196, Math.max(28, Math.floor(budget * .45))) + 'px';
      var detailed = helpEnabled && result.list[selected].kind === 'function';
      detail.style.maxHeight = Math.min(detailed ? 240 : 110, Math.max(28, budget - list.offsetHeight)) + 'px';
      detail.classList.toggle('is-compact', !detailed);
      // Above the caret, put help above the list so changing its height cannot move the rows.
      popup.classList.toggle('is-above', upwards);
      popup.style.left = Math.max(margin, Math.min(caret.left, window.innerWidth - popup.offsetWidth - margin)) + 'px';
      popup.style.top = (upwards ? Math.max(margin, caret.top - gap - popup.offsetHeight) : caret.bottom + gap) + 'px';
    }
    function highlight() {
      if (!popup) return;
      var options = popup.querySelectorAll('[role=option]');
      for (var i = 0; i < options.length; i++) {
        options[i].classList.toggle('is-selected', i === selected);
        options[i].setAttribute('aria-selected', String(i === selected));
      }
      var entry = result.list[selected], detail = popup.querySelector('.completion-detail');
      detail.textContent = '';
      function line(className, text) {
        var node = document.createElement('div'); node.className = className; node.textContent = text;
        detail.appendChild(node); return node;
      }
      line('completion-signature', entry.name + (entry.params || ''));
      var help = helpEnabled ? AELT.expressionHelp.describe(entry, AELT.i18n.getLanguage()) : null;
      if (help) {
        line('completion-summary', help.summary);
        line('completion-count', help.count);
        if (help.note) line('completion-note', help.note);
        help.parameters.forEach(function (param) {
          var row = line('completion-argument', '');
          var name = document.createElement('code'); name.textContent = param.name; row.appendChild(name);
          var meta = document.createElement('span'); meta.className = 'completion-argument-meta';
          meta.textContent = ' · ' + (param.conditional ? t('按调用形式') : param.optional ? t('可选') : t('必填')) + ' · ' + param.type;
          row.appendChild(meta);
          var description = document.createElement('div'); description.textContent = param.description;
          if (param.defaultValue) description.textContent += ' ' + t('默认：{value}', {value:param.defaultValue});
          row.appendChild(description);
        });
        if (help.forms.length) line('completion-forms', t('调用形式：') + '\n' + help.forms.join('\n'));
      }
      detail.scrollTop = 0;
      position();
      if (!popup) return;
      var row = options[selected], list = row.parentNode;
      if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
      input.setAttribute('aria-activedescendant', row.id);
    }
    function accept() {
      if (!result || composing || cm.getOption('readOnly')) { close(); return; }
      var entry = result.list[selected], from = cm.posFromIndex(result.from), to = cm.posFromIndex(result.to);
      var following = cm.getValue().slice(result.to), parens = entry.kind === 'function' && !/^\s*\(/.test(following);
      var text = entry.name + (parens ? '()' : '');
      close();
      cm.operation(function () {
        cm.replaceRange(text, from, to, '+complete');
        cm.setCursor({line:from.line, ch:from.ch + text.length - (parens ? 1 : 0)});
      });
      cm.focus();
    }
    function move(delta) { selected = (selected + delta + result.list.length) % result.list.length; highlight(); }
    var keys = {Up:function () { move(-1); }, Down:function () { move(1); },
      Enter:function () { if (acceptKey === 'Enter') accept(); else { close(); return CodeMirror.Pass; } },
      Tab:function () { if (acceptKey === 'Tab') accept(); else { close(); return CodeMirror.Pass; } },
      'Shift-Tab':function () { close(); return CodeMirror.Pass; }};
    function show() {
      clearTimeout(timer);
      if (!enabled || composing || cm.display.input.composing || cm.getOption('readOnly') || cm.somethingSelected() || !cm.hasFocus()) { close(); return; }
      var cursor = cm.getCursor(), token = cm.getTokenAt(cursor);
      if (token.type && /comment|string/.test(token.type)) { close(); return; }
      result = suggestions(cm.getValue(), cm.indexFromPos(cursor), false);
      if (!result) { close(); return; }
      selected = 0; anchor = cursor;
      var entering = !popup;
      if (!popup && closingPopup) { popup = closingPopup; closingPopup = null; }
      if (!popup) {
        popup = document.createElement('div'); popup.className = 'expression-completion';
        popup.addEventListener('mousedown', function (event) { event.preventDefault(); });
      }
      popup.textContent = ''; popup.style.pointerEvents = ''; popup.removeAttribute('aria-hidden');
      var list = document.createElement('div'); list.className = 'completion-list'; list.id = 'expressionCompletionList';
      list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t('表达式代码补全'));
      result.list.forEach(function (entry, index) {
        var row = document.createElement('div'); row.className = 'completion-item'; row.id = 'expressionCompletion-' + index;
        row.setAttribute('role', 'option'); row.setAttribute('aria-label', entry.name + (entry.params || ''));
        var badge = document.createElement('span'); badge.className = 'completion-kind is-' + entry.kind;
        badge.textContent = {function:'f', property:'p', variable:'v', keyword:'k'}[entry.kind]; badge.setAttribute('aria-hidden', 'true');
        var label = document.createElement('span'); label.className = 'completion-name';
        var match = matchIndex(entry.name, result.prefix);
        label.appendChild(document.createTextNode(entry.name.slice(0, match)));
        var strong = document.createElement('strong'); strong.textContent = entry.name.slice(match, match + result.prefix.length); label.appendChild(strong);
        label.appendChild(document.createTextNode(entry.name.slice(match + result.prefix.length)));
        if (entry.params) { var suffix = document.createElement('span'); suffix.className = 'completion-params'; suffix.textContent = '()'; label.appendChild(suffix); }
        row.appendChild(badge); row.appendChild(label);
        row.addEventListener('mousedown', function (event) { event.preventDefault(); selected = index; accept(); });
        row.addEventListener('mouseenter', function () { selected = index; highlight(); });
        list.appendChild(row);
      });
      popup.appendChild(list);
      var detail = document.createElement('div'); detail.className = 'completion-detail';
      detail.setAttribute('role', 'region'); detail.setAttribute('aria-label', t('函数帮助')); popup.appendChild(detail);
      var help = document.createElement('div'); help.className = 'completion-help'; help.textContent = t('↑↓ 选择 · {key} 补全', {key:acceptKey}); popup.appendChild(help);
      if (!popup.isConnected) document.body.appendChild(popup);
      cm.removeKeyMap(keys); cm.addKeyMap(keys);
      input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'true');
      highlight();
      if (popup && entering) animatePopup(popup, true);
    }
    // Keyboard deletion emits change without inputRead in CodeMirror's textarea mode.
    // Use the committed document change for both typing and deleting.
    cm.on('change', function (editor, change) {
      clearTimeout(timer);
      if ((change.origin !== '+input' && change.origin !== '+delete') || !enabled || composing || cm.display.input.composing) { close(); return; }
      // Keep the visible panel while refreshing, but never accept a stale candidate.
      releaseInput();
      if (popup) { popup.style.pointerEvents = 'none'; popup.setAttribute('aria-hidden', 'true'); }
      anchor = cm.getCursor();
      timer = setTimeout(show, 90);
    });
    cm.on('cursorActivity', function () {
      var cursor = cm.getCursor();
      if (anchor && (cursor.line !== anchor.line || cursor.ch !== anchor.ch || cm.somethingSelected())) close();
    });
    cm.on('blur', close);
    cm.on('scroll', function () { if (popup && result) close(); });
    input.addEventListener('compositionstart', function () { composing = true; close(); });
    input.addEventListener('compositionend', function () { composing = false; close(); });
    // Remove the completion keymap before IME candidate keys reach CodeMirror.
    input.addEventListener('keydown', function (event) {
      if (event.isComposing || event.keyCode === 229) close();
    }, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', function (event) {
      // CodeMirror scrolls its hidden textarea as text arrives; list scrolling also stays local.
      if (popup && result && event.target !== input && !popup.contains(event.target)) close();
    }, true);
    return {close:close, setEnabled:function (value) { close(); enabled = !!value; },
      setAcceptKey:function (value) { close(); acceptKey = value === 'Tab' ? 'Tab' : 'Enter'; },
      setHelpEnabled:function (value) { close(); helpEnabled = !!value; }};
  }
  return {suggestions:suggestions, attach:attach};
})();
