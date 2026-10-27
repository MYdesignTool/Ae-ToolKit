/* Animated dropdowns retain native select values/change events as their data model. */
AELT.selects = (function () {
  var controls = [], active = null, menu = null, cursor = -1, bound = false, serial = 0, typeTimer = null, typed = '';
  function enabled(option) { return !option.disabled && !(option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled); }
  function content(option) {
    var row = document.createElement('span'), name = document.createElement('span');
    row.className = 'select-content'; name.className = 'select-name'; name.textContent = option ? option.textContent : ''; row.appendChild(name);
    if (option && option.hasAttribute('data-tags')) {
      var tags = document.createElement('span'); tags.className = 'select-tags';
      JSON.parse(option.dataset.tags).forEach(function (label) {
        var tag = document.createElement('span'); tag.className = 'select-tag'; tag.textContent = label; tags.appendChild(tag);
      });
      row.appendChild(tags);
    }
    return row;
  }
  function label(select) {
    var field = select.closest('label'), heading = field && field.querySelector('span');
    return select.getAttribute('aria-label') || (heading && heading.textContent) || '';
  }
  function sync(record) {
    var select = record.select, button = record.button;
    button.disabled = select.disabled; button.hidden = select.hidden;
    button.setAttribute('aria-label', label(select));
    button.textContent = ''; button.appendChild(content(select.options[select.selectedIndex]));
    var arrow = document.createElement('span'); arrow.className = 'select-arrow'; arrow.setAttribute('aria-hidden', 'true'); button.appendChild(arrow);
    var option = select.options[select.selectedIndex];
    button.title = option ? option.textContent + (option.dataset.tags ? ' · ' + JSON.parse(option.dataset.tags).join(' / ') : '') : '';
    if (active === record) {
      if (select.disabled || !button.getClientRects().length) close(false);
      else renderMenu();
    }
  }
  function close(restoreFocus) {
    clearTimeout(typeTimer); typed = '';
    if (!active) return;
    var previous = active; active = null;
    previous.button.setAttribute('aria-expanded', 'false'); previous.button.removeAttribute('aria-activedescendant');
    menu.style.pointerEvents = 'none'; menu.setAttribute('aria-hidden', 'true');
    if (restoreFocus && previous.button.isConnected && !previous.button.disabled) previous.button.focus();
    animatePopup(menu, false, function () { menu.hidden = true; });
  }
  function position() {
    if (!active) return;
    var rect = active.button.getBoundingClientRect();
    if (!rect.width || !rect.height || !active.button.isConnected || rect.bottom < 0 || rect.top > innerHeight) { close(false); return; }
    menu.style.width = Math.min(rect.width, innerWidth - 24) + 'px';
    var margin = 12, gap = 5, below = innerHeight - rect.bottom - margin - gap, above = rect.top - margin - gap;
    var down = below >= Math.min(280, menu.scrollHeight) || below >= above;
    menu.dataset.popupSide = down ? 'below' : 'above';
    menu.style.maxHeight = Math.max(40, Math.min(320, down ? below : above)) + 'px';
    menu.style.left = Math.max(margin, Math.min(rect.left, innerWidth - menu.offsetWidth - margin)) + 'px';
    menu.style.top = Math.max(margin, Math.min(down ? rect.bottom + gap : rect.top - gap - menu.offsetHeight, innerHeight - menu.offsetHeight - margin)) + 'px';
  }
  function highlight(scroll) {
    if (!active) return;
    menu.querySelectorAll('[role=option]').forEach(function (row) {
      row.classList.toggle('is-active', Number(row.dataset.optionIndex) === cursor);
    });
    var row = menu.querySelector('[data-option-index="' + cursor + '"]');
    if (row) {
      active.button.setAttribute('aria-activedescendant', row.id);
      if (scroll) {
        if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
        else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
      }
    }
  }
  function renderMenu() {
    if (!active) return;
    var select = active.select, oldScroll = menu.scrollTop, group = null;
    menu.textContent = ''; menu.setAttribute('aria-label', label(select));
    Array.from(select.options).forEach(function (option, index) {
      if (option.parentElement.tagName === 'OPTGROUP' && option.parentElement !== group) {
        group = option.parentElement;
        var heading = document.createElement('div'); heading.className = 'select-group'; heading.textContent = group.label; heading.setAttribute('role', 'presentation'); menu.appendChild(heading);
      }
      var row = document.createElement('div'); row.className = 'select-option'; row.id = 'select-option-' + active.id + '-' + index; row.dataset.optionIndex = index;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === select.selectedIndex)); row.setAttribute('aria-disabled', String(!enabled(option)));
      row.title = option.textContent; row.appendChild(content(option));
      row.addEventListener('mouseenter', function () { if (active && enabled(option)) { cursor = index; highlight(false); } });
      menu.appendChild(row);
    });
    if (!select.options[cursor] || !enabled(select.options[cursor])) cursor = Array.from(select.options).findIndex(enabled);
    menu.scrollTop = oldScroll; position(); highlight(false);
  }
  function open(record, last) {
    if (record.select.disabled) return;
    if (active && active !== record) close(false);
    active = record; cursor = record.select.selectedIndex;
    if (cursor < 0 || !enabled(record.select.options[cursor])) {
      var indexes = Array.from(record.select.options).map(function (option, i) { return enabled(option) ? i : -1; }).filter(function (i) { return i >= 0; });
      cursor = last ? indexes[indexes.length - 1] : indexes[0];
    }
    menu.hidden = false; menu.style.pointerEvents = ''; menu.removeAttribute('aria-hidden');
    record.button.setAttribute('aria-expanded', 'true'); record.button.focus();
    renderMenu(); highlight(true); animatePopup(menu, true);
  }
  function choose(index) {
    if (!active) return;
    var record = active, option = record.select.options[index];
    if (!option || !enabled(option)) return;
    var changed = record.select.selectedIndex !== index;
    record.select.selectedIndex = index; close(true); sync(record);
    if (changed) {
      record.select.dispatchEvent(new Event('input', {bubbles:true}));
      record.select.dispatchEvent(new Event('change', {bubbles:true}));
      if (record.select.isConnected) sync(record);
      else requestAnimationFrame(function () {
        var next = document.querySelector('[data-select-for="' + record.select.id + '"]');
        if (next && document.activeElement === document.body) next.focus();
      });
    }
  }
  function keys(event, record) {
    if (event.isComposing || event.keyCode === 229) return;
    var key = event.key;
    if (key === 'Tab') { if (active === record) close(false); return; }
    if (key === 'Escape') { if (active === record) { event.preventDefault(); event.stopPropagation(); close(true); } return; }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault(); event.stopPropagation(); if (active === record) choose(cursor); else open(record); return;
    }
    if (['ArrowDown','ArrowUp','Home','End'].indexOf(key) >= 0) {
      event.preventDefault(); event.stopPropagation();
      if (active !== record) { open(record, key === 'ArrowUp'); return; }
      var indexes = Array.from(record.select.options).map(function (option, i) { return enabled(option) ? i : -1; }).filter(function (i) { return i >= 0; });
      var at = indexes.indexOf(cursor);
      if (key === 'Home') at = 0; else if (key === 'End') at = indexes.length - 1; else at = (at + (key === 'ArrowDown' ? 1 : -1) + indexes.length) % indexes.length;
      cursor = indexes[at]; highlight(true); return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); if (active !== record) open(record);
      typed += key.toLowerCase(); clearTimeout(typeTimer); typeTimer = setTimeout(function () { typed = ''; }, 600);
      var index = Array.from(record.select.options).findIndex(function (option) { return enabled(option) && option.textContent.toLowerCase().indexOf(typed) === 0; });
      if (index >= 0) { cursor = index; highlight(true); }
    }
  }
  function enhance(select) {
    if (select._aeltSelect || select.multiple) return;
    var button = document.createElement('button'), id = ++serial;
    button.type = 'button'; button.className = 'custom-select-trigger' + (select.classList.contains('settings-input') ? ' settings-input' : '');
    if (!select.id) select.id = 'aelt-select-' + id;
    button.dataset.selectFor = select.id; button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-controls', 'aelt-select-menu'); button.setAttribute('aria-expanded', 'false');
    var record = {select:select, button:button, id:id}; select._aeltSelect = record;
    select.classList.add('custom-select-source'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true'); select.after(button); controls.push(record);
    button.addEventListener('click', function () { if (active === record) close(true); else open(record); });
    button.addEventListener('keydown', function (event) { keys(event, record); });
    select.addEventListener('change', function () { sync(record); });
    record.observer = new MutationObserver(function () { sync(record); });
    record.observer.observe(select, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['disabled','selected','label','aria-label','hidden','data-tags']});
    sync(record);
  }
  function refresh() {
    if (!bound) return;
    controls = controls.filter(function (record) {
      if (record.select.isConnected) { sync(record); return true; }
      if (active === record) close(false); record.observer.disconnect(); record.button.remove(); return false;
    });
    document.querySelectorAll('select').forEach(enhance);
  }
  function init() {
    if (bound) return; bound = true;
    menu = document.createElement('div'); menu.id = 'aelt-select-menu'; menu.className = 'custom-select-menu'; menu.setAttribute('role', 'listbox'); menu.hidden = true; document.body.appendChild(menu);
    menu.addEventListener('mousedown', function (event) { event.preventDefault(); });
    menu.addEventListener('click', function (event) { var row = event.target.closest('[data-option-index]'); if (row) choose(Number(row.dataset.optionIndex)); });
    new MutationObserver(function (records) {
      if (records.some(function (record) { return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) { return node.nodeType === 1 && (node.tagName === 'SELECT' || node.querySelector('select')); }); })) refresh();
    }).observe(document.body, {childList:true, subtree:true});
    document.addEventListener('pointerdown', function (event) { if (active && !menu.contains(event.target) && !active.button.contains(event.target)) close(false); }, true);
    document.addEventListener('focusin', function (event) { if (active && !menu.contains(event.target) && !active.button.contains(event.target)) close(false); });
    document.addEventListener('scroll', function (event) { if (active && !menu.contains(event.target)) position(); }, true);
    window.addEventListener('resize', position); window.addEventListener('blur', function () { close(false); }); refresh();
  }
  return {init:init, refresh:refresh, close:close, control:function (select) { return select._aeltSelect ? select._aeltSelect.button : select; }};
})();
