// ============================================================================
// AE Local Toolkit — 工程整理模块 (client/js/organizer.js)
// 整理方案的读取/渲染/校验/保存/删除，以及一键整理逻辑。
// 依赖 core.js 的 state/els/fallbackRules 与 util.js 的规范化函数。
// ============================================================================

  function getSelectedScheme() {
    for (var i = 0; i < state.organizerSchemes.length; i++) {
      if (state.organizerSchemes[i].id === state.selectedSchemeId) {
        return state.organizerSchemes[i];
      }
    }
    return state.organizerSchemes[0] || normalizeScheme(fallbackRules);
  }

  function getSchemeFromEditor() {
    var current = getSelectedScheme();
    var rules = [];
    var cards = els.ruleGrid.querySelectorAll("[data-rule-index]");
    for (var i = 0; i < cards.length; i++) {
      var pathInput = cards[i].querySelector("[data-rule-path]");
      var extensionsInput = cards[i].querySelector("[data-rule-extensions]");
      var itemTypesInput = cards[i].querySelector("[data-rule-item-types]");
      rules.push({
        path: normalizePath(pathInput.value),
        itemTypes: normalizeItemTypes(itemTypesInput.value),
        extensions: normalizeExtensions(extensionsInput.value)
      });
    }

   return normalizeScheme({
     id: current.id,
     name: els.schemeNameInput.value.trim() || "整理方案",
      builtin: false,
      fallbackPath: normalizePath(els.fallbackPathInput.value || "Footage"),
      rules: rules
    });
  }

  function validateScheme(scheme) {
    var seen = {};
    var seenItemTypes = {};
    var duplicates = [];
    var duplicateItemTypes = [];
    var invalidRules = [];

    scheme.rules.forEach(function (rule, ruleIndex) {
      if (!rule.path) invalidRules.push(ruleIndex + 1);
      rule.extensions.forEach(function (ext) {
        if (seen[ext]) {
          duplicates.push(ext);
        } else {
          seen[ext] = rule.path;
        }
      });
      rule.itemTypes.forEach(function (itemType) {
        if (seenItemTypes[itemType]) {
          duplicateItemTypes.push(itemType);
        } else {
          seenItemTypes[itemType] = rule.path;
        }
      });
    });

    if (invalidRules.length) {
      return { ok: false, message: "有规则缺少文件夹路径。" };
    }
    if (duplicates.length) {
      return { ok: false, message: "文件类型不能重复：" + duplicates.join(", ") };
    }
    if (duplicateItemTypes.length) {
      return { ok: false, message: "AE 类型不能重复：" + duplicateItemTypes.join(", ") };
    }
    return { ok: true, message: "" };
  }

  function renderSchemeSelect() {
    els.schemeSelect.innerHTML = state.organizerSchemes.map(function (scheme) {
      var selected = scheme.id === state.selectedSchemeId ? " selected" : "";
      var label = scheme.name + (scheme.builtin ? " · 预设" : "");
      return '<option value="' + escapeHtml(scheme.id) + '"' + selected + ">" + escapeHtml(label) + "</option>";
    }).join("");
  }

  function renderRules() {
    var scheme = getSelectedScheme();
    state.selectedSchemeId = scheme.id;
    els.schemeNameInput.value = scheme.name || "";
    els.fallbackPathInput.value = scheme.fallbackPath || "Footage";
    renderSchemeSelect();

    var html = "";
    scheme.rules.forEach(function (rule, index) {
      var itemTypes = (rule.itemTypes || []).map(function (t) { return String(t).trim(); }).filter(Boolean);
      var hasExt = (rule.extensions || []).length > 0;
      var hasTypes = itemTypes.length > 0;
      var hasComp = itemTypes.indexOf("CompItem") >= 0;
      var hasSolid = itemTypes.indexOf("SolidSource") >= 0;

      html += '<div class="rule-item" data-rule-index="' + index + '">';

      // Header row
      html += '<div class="rule-header">';
      html += '<label class="field"><span>文件夹路径</span><input data-rule-path type="text" value="' + escapeHtml(rule.path) + '" placeholder="Footage/Image" /></label>';
      html += '<button class="icon-btn danger" data-remove-rule="' + index + '" title="删除规则">\u2716</button>';
      html += '</div>';

      // Side-by-side criteria
      html += '<div class="rule-criteria-row">';

      // File types column
      html += '<div class="rule-criterion">';
      html += '<label class="checkbox-row"><input type="checkbox" data-toggle-extensions' + (hasExt ? ' checked' : '') + ' /><span>文件类型</span></label>';
      html += '<div class="rule-section" data-extensions-section' + (hasExt ? '' : ' style="display:none"') + '>';
      html += '<input data-rule-extensions type="text" value="' + escapeHtml((rule.extensions || []).join(", ")) + '" placeholder="MP4, MOV, PNG" />';
      html += '</div>';
      html += '</div>';

      // AE types column
      html += '<div class="rule-criterion">';
      html += '<label class="checkbox-row"><input type="checkbox" data-toggle-item-types' + (hasTypes ? ' checked' : '') + ' /><span>AE内部项目</span></label>';
      html += '<div class="rule-section" data-item-types-section' + (hasTypes ? '' : ' style="display:none"') + '>';
      html += '<label class="check-label"><input type="checkbox" data-item-type value="CompItem"' + (hasComp ? ' checked' : '') + ' /> 合成</label>';
      html += '<label class="check-label"><input type="checkbox" data-item-type value="SolidSource"' + (hasSolid ? ' checked' : '') + ' /> 固态层</label>';
      html += '<input data-rule-item-types type="hidden" value="' + escapeHtml(itemTypes.join(", ")) + '" />';
      html += '</div>';
      html += '</div>';

      html += '</div>';  // end criteria-row
      html += '</div>';  // end rule-item
    });
    els.ruleGrid.innerHTML = html || '<div class="selection-status">暂无规则</div>';

    // Toggle sections
    var toggles = els.ruleGrid.querySelectorAll("[data-toggle-extensions], [data-toggle-item-types]");
    for (var ti = 0; ti < toggles.length; ti++) {
      toggles[ti].addEventListener("change", function () {
        var isExt = this.hasAttribute("data-toggle-extensions");
        var sec = this.closest(".rule-item").querySelector(isExt ? "[data-extensions-section]" : "[data-item-types-section]");
        if (sec) sec.style.display = this.checked ? "block" : "none";
        if (!this.checked) {
          var inp = sec.querySelector(isExt ? "[data-rule-extensions]" : "[data-rule-item-types]");
          if (inp) inp.value = "";
        }
      });
    }

    // Sync type checkboxes with hidden input
    var typeCbs = els.ruleGrid.querySelectorAll("[data-item-type]");
    for (var ci = 0; ci < typeCbs.length; ci++) {
      typeCbs[ci].addEventListener("change", function () {
        var sec = this.closest("[data-item-types-section]");
        if (!sec) return;
        var hid = sec.querySelector("[data-rule-item-types]");
        if (!hid) return;
        var chk = sec.querySelectorAll("[data-item-type]:checked");
        var vals = [];
        for (var vi = 0; vi < chk.length; vi++) vals.push(chk[vi].value);
        hid.value = vals.join(", ");
      });
    }
  }

  function loadOrganizerSchemesFromHost() {
    evalAe("AELT_loadOrganizerSchemes()", function (result) {
      if (result.ok && result.schemes && result.schemes.length) {
        state.organizerSchemes = result.schemes.map(normalizeScheme);
        if (!state.organizerSchemes.some(function (scheme) { return scheme.id === state.selectedSchemeId; })) {
          state.selectedSchemeId = state.organizerSchemes[0].id;
        }
        renderRules();
        setStatus("已加载整理方案 " + state.organizerSchemes.length + " 套。");
      } else {
        state.organizerSchemes = [normalizeScheme(fallbackRules)];
        state.selectedSchemeId = "preset-default";
        renderRules();
        setStatus("整理方案文件读取失败，已使用内置预设。");
      }
    });
  }

 function organizeProject() {
   var scheme = getSchemeFromEditor();
   var validation = validateScheme(scheme);
   if (!validation.ok) {
     setStatus(validation.message);
     showToast(validation.message, "error");
     return;
   }

    setStatus("正在整理工程：" + scheme.name);
    var script = "AELT_organizeProjectWithScheme('" + escapeForEvalScript(JSON.stringify(scheme)) + "')";
    evalAe(script, function (result) {
      if (!result.ok) {
        setStatus((result.messages && result.messages[0]) || "整理失败。");
        return;
      }
      setStatus("整理完成：移动 " + result.moved + " 项，跳过 " + result.skipped + " 项，错误 " + result.errors + " 个。");
      showToast("整理完成：移动 " + result.moved + " 项", "success");
    });
  }

  function newScheme() {
    var scheme = normalizeScheme({
   id: createId("scheme"),
   name: "新的整理方案",
   builtin: false,
      fallbackPath: "Footage",
      rules: [
        { path: "Footage/Image", itemTypes: [], extensions: ["PNG", "JPG", "JPEG"] },
        { path: "Footage/Video", itemTypes: [], extensions: ["MP4", "MOV"] }
      ]
    });
    state.organizerSchemes.push(scheme);
    state.selectedSchemeId = scheme.id;
    renderRules();
    setStatus("已创建新方案，保存后会写入方案文件。");
      showToast("已创建新方案", "success");
  }

 function saveScheme() {
   var scheme = getSchemeFromEditor();
   if (scheme.id === "preset-default") {
     scheme.id = createId("scheme");
   }
   var validation = validateScheme(scheme);
    if (!validation.ok) {
      setStatus(validation.message);
      showToast(validation.message, "error");
      return;
    }

    var script = "AELT_saveOrganizerScheme('" + escapeForEvalScript(JSON.stringify(scheme)) + "')";
    evalAe(script, function (result) {
      if (!result.ok) {
        setStatus((result.messages && result.messages[0]) || "方案保存失败。");
        return;
      }

      var replaced = false;
      for (var i = 0; i < state.organizerSchemes.length; i++) {
        if (state.organizerSchemes[i].id === scheme.id) {
          state.organizerSchemes[i] = scheme;
          replaced = true;
          break;
        }
      }
      if (!replaced) state.organizerSchemes.push(scheme);
      state.selectedSchemeId = scheme.id;
      renderRules();
      setStatus("方案已保存：" + scheme.name);
      showToast("方案已保存", "success");
    });
  }

  function deleteScheme() {
    var scheme = getSelectedScheme();
    if (scheme.builtin) {
      setStatus("预设方案不能删除。");
      showToast("预设方案不能删除", "error");
      return;
    }
    if (!confirmAction("确认删除整理方案“" + scheme.name + "”？")) return;

    evalAe("AELT_deleteOrganizerScheme('" + escapeForEvalScript(scheme.id) + "')", function (result) {
      if (!result.ok) {
        setStatus((result.messages && result.messages[0]) || "方案删除失败。");
        return;
      }
      state.organizerSchemes = state.organizerSchemes.filter(function (item) {
        return item.id !== scheme.id;
      });
      state.selectedSchemeId = state.organizerSchemes[0] ? state.organizerSchemes[0].id : "preset-default";
      renderRules();
      setStatus("方案已删除。");
      showToast("方案已删除", "success");
    });
  }

  function addRule() {
   var scheme = getSchemeFromEditor();
    if (scheme.id === "preset-default") {
      var newScheme = normalizeScheme({
        id: createId("scheme"),
        name: "新的整理方案",
        builtin: false,
        fallbackPath: scheme.fallbackPath || "Footage",
        rules: JSON.parse(JSON.stringify(scheme.rules))
      });
      newScheme.rules.push({ path: "Footage/New Folder", itemTypes: [], extensions: [] });
      state.organizerSchemes.push(newScheme);
      state.selectedSchemeId = newScheme.id;
      renderRules();
      return;
    }
   scheme.rules.push({ path: "Footage/New Folder", itemTypes: [], extensions: [] });
    replaceOrAppendScheme(scheme);
    state.selectedSchemeId = scheme.id;
    renderRules();
  }

  function replaceOrAppendScheme(scheme) {
    for (var i = 0; i < state.organizerSchemes.length; i++) {
      if (state.organizerSchemes[i].id === scheme.id) {
        state.organizerSchemes[i] = scheme;
        return;
      }
    }
    state.organizerSchemes.push(scheme);
  }


AELT.organizer = {
  getSelectedScheme: getSelectedScheme,
  getSchemeFromEditor: getSchemeFromEditor,
  validateScheme: validateScheme,
  renderSchemeSelect: renderSchemeSelect,
  renderRules: renderRules,
  loadOrganizerSchemesFromHost: loadOrganizerSchemesFromHost,
  organizeProject: organizeProject,
  newScheme: newScheme,
  saveScheme: saveScheme,
  deleteScheme: deleteScheme,
  addRule: addRule,
  replaceOrAppendScheme: replaceOrAppendScheme
};
