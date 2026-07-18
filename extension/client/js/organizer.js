// ============================================================================
// AE Local Toolkit — 工程整理模块 (client/js/organizer.js)
// 整理方案的读取/渲染/校验/保存/删除，以及一键整理逻辑。
// 依赖 core.js 的 state/els/fallbackRules 与 util.js 的规范化函数。
// ============================================================================

  // ==========================================================================
  // 全局整理文件夹（合成 / 固态层 / 未匹配素材）
  // 这三项由所有整理方案共用，持久化于扩展目录 data/settings.json（随扩展一起拷贝），
  // 主界面只配置素材规则。主界面渲染时剥离内部项目规则；整理/保存时再动态注入回 scheme，
  // 保证发给 host 的数据结构与旧版完全一致。
  // ==========================================================================
  var ORG_FOLDER_DEFAULTS = { comp: "Comp", solid: "Solids", fallback: "Footage" };

  function getGlobalFolders() {
    return {
      comp: AELT.settings.get("compFolder", ORG_FOLDER_DEFAULTS.comp),
      solid: AELT.settings.get("solidFolder", ORG_FOLDER_DEFAULTS.solid),
      fallback: AELT.settings.get("fallbackFolder", ORG_FOLDER_DEFAULTS.fallback)
    };
  }

  function setGlobalFolder(kind, value) {
    var key = { comp: "compFolder", solid: "solidFolder", fallback: "fallbackFolder" }[kind];
    if (!key) return;
    AELT.settings.set(key, normalizePath(value));
  }

  // 首次启动时，从已有方案吸收合成/固态层/未匹配文件夹作为全局初始值；
  // 仅在对应设置尚未写入过时生效（幂等，切换方案不会覆盖用户设置）。
  function absorbGlobalFoldersFromScheme(scheme) {
    function setIfAbsent(key, value) {
      if (AELT.settings.get(key, undefined) === undefined && value) AELT.settings.set(key, value);
    }
    var comp = "", solid = "";
    (scheme.rules || []).forEach(function (rule) {
      var types = rule.itemTypes || [];
      if (types.indexOf("CompItem") >= 0) comp = rule.path;
      if (types.indexOf("SolidSource") >= 0) solid = rule.path;
    });
    setIfAbsent("compFolder", comp);
    setIfAbsent("solidFolder", solid);
    setIfAbsent("fallbackFolder", scheme.fallbackPath);
  }

  // 判断一条规则是否为“内部项目规则”（合成/固态层），这类规则不在主界面展示。
  function isInternalRule(rule) {
    var types = rule.itemTypes || [];
    return types.indexOf("CompItem") >= 0 || types.indexOf("SolidSource") >= 0;
  }

  // 将全局文件夹值回填到设置页输入框。
  function fillGlobalFolderInputs() {
    var folders = getGlobalFolders();
    if (els.compFolderInput) els.compFolderInput.value = folders.comp;
    if (els.solidFolderInput) els.solidFolderInput.value = folders.solid;
    if (els.fallbackFolderInput) els.fallbackFolderInput.value = folders.fallback;
  }

  // 绑定设置页全局文件夹输入框，输入即持久化到扩展目录 data/settings.json（全局共用）。
  function bindGlobalFolderInputs() {
    if (els.compFolderInput) {
      els.compFolderInput.addEventListener("input", function () {
        setGlobalFolder("comp", els.compFolderInput.value);
      });
    }
    if (els.solidFolderInput) {
      els.solidFolderInput.addEventListener("input", function () {
        setGlobalFolder("solid", els.solidFolderInput.value);
      });
    }
    if (els.fallbackFolderInput) {
      els.fallbackFolderInput.addEventListener("input", function () {
        setGlobalFolder("fallback", els.fallbackFolderInput.value);
      });
    }
  }

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
      rules.push({
        path: normalizePath(pathInput.value),
        itemTypes: [],
        extensions: normalizeExtensions(extensionsInput.value)
      });
    }

    // 注意：这里只返回主界面编辑的“可见规则”，不注入内部项目规则。
    // 内部规则（合成/固态层）由 buildHostScheme 在发给 host 的边界处注入，
    // 避免 addRule/removeRule/saveScheme 等内部状态操作导致重复注入。
    var folders = getGlobalFolders();
    return normalizeScheme({
      id: current.id,
      name: els.schemeNameInput.value.trim() || "整理方案",
      builtin: false,
      fallbackPath: normalizePath(folders.fallback || "Footage"),
      rules: rules
    });
  }

  // 在编辑器方案基础上注入全局的合成/固态层规则，生成与旧版一致、
  // 可直接发给 host 的完整方案。仅用于整理/保存等 host 边界。
  function buildHostScheme() {
    var scheme = getSchemeFromEditor();
    var folders = getGlobalFolders();
    scheme.rules.push({ path: normalizePath(folders.comp), itemTypes: ["CompItem"], extensions: [] });
    scheme.rules.push({ path: normalizePath(folders.solid), itemTypes: ["SolidSource"], extensions: [] });
    return scheme;
  }

  function validateScheme(scheme) {
    var seen = {};
    var duplicates = [];
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
    });

    if (invalidRules.length) {
      return { ok: false, message: "有规则缺少文件夹路径。" };
    }
    if (duplicates.length) {
      return { ok: false, message: "文件类型不能重复：" + duplicates.join(", ") };
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
    // 首次从当前方案吸收全局文件夹初始值（幂等）。
    absorbGlobalFoldersFromScheme(scheme);
    // 回填设置页的全局文件夹输入框（此时已吸收过，显示用户/方案值）。
    fillGlobalFolderInputs();
    renderSchemeSelect();

    // 剥离内部项目规则（合成/固态层），主界面只展示素材路径规则。
    var visibleRules = (scheme.rules || []).filter(function (rule) {
      return !isInternalRule(rule);
    });

    var html = "";
    visibleRules.forEach(function (rule, index) {
      html += '<div class="rule-item" data-rule-index="' + index + '">';

      // Header row
      html += '<div class="rule-header">';
      html += '<label class="field"><span>文件夹路径</span><input data-rule-path type="text" value="' + escapeHtml(rule.path) + '" placeholder="Footage/Image" /></label>';
      html += '<button class="icon-btn danger" data-remove-rule="' + index + '" title="删除规则">\u2716</button>';
      html += '</div>';

      // File types
      html += '<label class="field"><span>文件类型</span><input data-rule-extensions type="text" value="' + escapeHtml((rule.extensions || []).join(", ")) + '" placeholder="MP4, MOV, PNG" /></label>';

      html += '</div>';  // end rule-item
    });
    els.ruleGrid.innerHTML = html || '<div class="selection-status">暂无规则</div>';
  }

  // 确保 host 模块已加载：重新设置模块根目录（幂等），避免面板初始化顺序竞态导致
  // 整理/读取方案时 organizer 模块尚未就绪。
  function ensureModules(callback) {
    evalAe('AELT_setModuleBase("' + escape(getExtensionRoot()) + '")', function () { callback(); });
  }

  function loadOrganizerSchemesFromHost() {
    ensureModules(function () {
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
    });
  }

 function organizeProject() {
   var scheme = buildHostScheme();
   var validation = validateScheme(scheme);
   if (!validation.ok) {
     setStatus(validation.message);
     showToast(validation.message, "error");
     return;
   }

    if (els.organizeBtn) els.organizeBtn.disabled = true;
    showOrganizeProgress();
    setStatus("正在整理工程：" + scheme.name);
    var script = "AELT_organizeProjectWithScheme('" + escape(escapeForEvalScript(JSON.stringify(scheme))) + "')";
    ensureModules(function () {
      evalAe(script, function (result) {
        hideOrganizeProgress();
        if (els.organizeBtn) els.organizeBtn.disabled = false;
        if (!result.ok) {
          setStatus((result.messages && result.messages[0]) || "整理失败。");
          return;
        }
        setStatus("整理完成：移动 " + result.moved + " 项，跳过 " + result.skipped + " 项，错误 " + result.errors + " 个。");
        showToast("整理完成：移动 " + result.moved + " 项", "success");
      });
    });
  }

  function showOrganizeProgress() {
    var el = document.getElementById("organizeProgress");
    if (el) el.classList.remove("hidden");
  }

  function hideOrganizeProgress() {
    var el = document.getElementById("organizeProgress");
    if (el) el.classList.add("hidden");
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
    var scheme = buildHostScheme();
    if (scheme.id === "preset-default") {
     scheme.id = createId("scheme");
   }
   var validation = validateScheme(scheme);
    if (!validation.ok) {
      setStatus(validation.message);
      showToast(validation.message, "error");
      return;
    }

    var script = "AELT_saveOrganizerScheme('" + escape(escapeForEvalScript(JSON.stringify(scheme))) + "')";
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
  replaceOrAppendScheme: replaceOrAppendScheme,
  fillGlobalFolderInputs: fillGlobalFolderInputs,
  bindGlobalFolderInputs: bindGlobalFolderInputs
};
