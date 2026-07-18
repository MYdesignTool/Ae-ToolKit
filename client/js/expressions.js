// ============================================================================
// AE Local Toolkit — 表达式模块 (client/js/expressions.js)
// 表达式下拉渲染、应用/移除、自定义表达式保存/删除/更新，以及选中属性刷新。
// 依赖 core.js 的 state/els 与 util.js 的存储/规范化函数。
// ============================================================================

 function renderExpressions() {
   var query = els.expressionSearch.value.trim().toLowerCase();
   var html = '<select class="expression-select">';
   html += '<option value="">-- 选择表达式 --</option>';
   state.expressions
     .filter(function (item) {
       var haystack = [item.name, item.category, item.description, (item.tags || []).join(" ")].join(" ").toLowerCase();
       return !query || haystack.indexOf(query) >= 0;
     })
     .forEach(function (item) {
       var selected = item.id === state.selectedExpressionId ? " selected" : "";
       html += '<option value="' + escapeHtml(item.id) + '"' + selected + ">" + escapeHtml(item.name + " · " + item.category) + "</option>";
     });
   html += "</select>";
   els.expressionList.innerHTML = html || '<div class="selection-status">没有匹配的表达式</div>';
   var sel = els.expressionList.querySelector("select");
   if (sel) sel.onchange = function () {
     var id = this.value;
     if (!id) { state.selectedExpressionId = null; els.expressionCode.value = ""; if (els.updateExpressionBtn) els.updateExpressionBtn.style.display = "none"; return; }
     var found = state.expressions.find(function (item) { return item.id === id; });
     if (!found) return;
     state.selectedExpressionId = id;
     els.expressionCode.value = found.code;
      if (els.updateExpressionBtn) {
        els.updateExpressionBtn.style.display = found.builtin ? "none" : "";
      }
   };
 }

 function refreshSelection() {
    evalAe("AELT_getSelectedPropertySummary()", function (result) {
      if (!result.ok) {
        els.selectionStatus.textContent = result.messages.join(" ");
        return;
      }
      els.selectionStatus.textContent = "已选择 " + result.total + " 个属性，已有表达式 " + result.existing + " 个，不支持 " + result.skipped + " 个。";
    });
  }

  function applyExpression() {
    var expression = els.expressionCode.value;
    if (!expression.trim()) {
      setStatus("表达式内容为空。");
      return;
    }

    evalAe("AELT_getSelectedPropertySummary()", function (summary) {
      if (!summary.ok) {
        setStatus(summary.messages.join(" "));
        return;
      }

      function runApply() {
        var script = "AELT_applyExpression('" + escapeForEvalScript(expression) + "', true)";
        evalAe(script, function (result) {
          setStatus("已应用 " + result.applied + " 个属性，跳过 " + result.skipped + " 个，错误 " + result.errors + " 个。");
          showToast("已应用表达式到 " + result.applied + " 个属性", "success");
          refreshSelection();
        });
      }
      if (summary.existing > 0) {
        confirmAction("检测到 " + summary.existing + " 个属性已有表达式，是否覆盖？", function (overwrite) {
          if (!overwrite) {
            setStatus("已取消应用表达式。");
            return;
          }
          runApply();
        });
        return;
      }
      runApply();
    });
  }

  function removeExpressions() {
    confirmAction("确认移除选中属性上的表达式？", function (ok) {
      if (!ok) {
        setStatus("已取消移除表达式。");
        return;
      }

      evalAe("AELT_removeExpressions()", function (result) {
        if (!result.ok) {
          setStatus(result.messages.join(" "));
          return;
        }
        setStatus("已移除 " + result.removed + " 个表达式，跳过 " + result.skipped + " 个，错误 " + result.errors + " 个。");
        showToast("已移除 " + result.removed + " 个表达式", "success");
        refreshSelection();
      });
    });
  }

  function saveExpression() {
    var code = els.expressionCode.value.trim();
    if (!code) {
      setStatus("表达式内容为空。");
      return;
    }

    showInputDialog("保存为自定义表达式", "自定义表达式", function (name) {
      if (!name) return;

      var items = getUserExpressions();
      var item = {
        id: "user-" + Date.now(),
        name: name,
        category: "自定义",
        description: "用户保存的本地表达式。",
        code: code,
        tags: ["自定义"],
        builtin: false,
        favorite: false
      };

      items.push(item);
      if (!setUserExpressions(items)) {
        setStatus("保存失败：当前 CEP 本地存储不可用。");
        showToast("保存失败", "error");
        return;
      }
      state.expressions.push(item);
      state.selectedExpressionId = item.id;
      renderExpressions();
      setStatus("已保存到本地表达式库。");
      showToast("表达式已保存", "success");
    });
  }

  function deleteExpression() {
    if (!state.selectedExpressionId) {
      setStatus("请先选择一个自定义表达式。");
      showToast("请先选择一个自定义表达式", "error");
      return;
    }

    var selected = state.expressions.find(function (item) {
      return item.id === state.selectedExpressionId;
    });

    if (!selected || selected.builtin) {
      setStatus("内置表达式不能删除。");
      showToast("内置表达式不能删除", "error");
      return;
    }

    confirmAction("确认删除这个自定义表达式？", function (ok) {
      if (!ok) return;

      var next = getUserExpressions().filter(function (item) {
        return item.id !== state.selectedExpressionId;
      });
      if (!setUserExpressions(next)) {
        setStatus("删除失败：当前 CEP 本地存储不可用。");
        showToast("删除失败", "error");
        return;
      }
      state.expressions = state.expressions.filter(function (item) {
        return item.id !== state.selectedExpressionId;
      });
      state.selectedExpressionId = null;
      els.expressionCode.value = "";
      renderExpressions();
      setStatus("已删除自定义表达式。");
      showToast("自定义表达式已删除", "success");
    });
  }

  function updateExpression() {
    if (!state.selectedExpressionId) {
      setStatus("请先选择一个自定义表达式。");
      showToast("请先选择一个自定义表达式", "error");
      return;
    }
    var selected = state.expressions.find(function (item) {
      return item.id === state.selectedExpressionId;
    });
    if (!selected || selected.builtin) {
      setStatus("内置表达式不能编辑。");
      showToast("内置表达式不能编辑", "error");
      return;
    }
    var code = els.expressionCode.value.trim();
    if (!code) {
      setStatus("表达式内容为空。");
      return;
    }
    showInputDialog("更新表达式名称", selected.name, function (name) {
      if (!name) return;
      selected.name = name;
      selected.code = code;
      var userItems = getUserExpressions();
      for (var i = 0; i < userItems.length; i++) {
        if (userItems[i].id === state.selectedExpressionId) {
          userItems[i] = selected;
          break;
        }
      }
      if (!setUserExpressions(userItems)) {
        setStatus("保存失败：当前 CEP 本地存储不可用。");
        showToast("保存失败", "error");
        return;
      }
      renderExpressions();
      setStatus("表达式已更新。");
      showToast("表达式已更新", "success");
    });
  }


AELT.expressions = {
  renderExpressions: renderExpressions,
  refreshSelection: refreshSelection,
  applyExpression: applyExpression,
  removeExpressions: removeExpressions,
  saveExpression: saveExpression,
  deleteExpression: deleteExpression,
  updateExpression: updateExpression
};
