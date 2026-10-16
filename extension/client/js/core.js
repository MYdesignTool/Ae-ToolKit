/* Shared panel state. Shipped defaults are read once from data/ by the host. */
window.AELT = {};
var state = {
  ready: false, startupError: false, rules: null, organizerSchemes: [], selectedSchemeId: 'preset-default',
  changelog: null, expressions: [], selectedExpressionId: null, selection: null,
  expressionBusy: false, debugEntries: [], quietMode: false, debugMode: false,
  scriptFolder: '', scripts: [], favFilterOn: false, selectedScriptFsName: null, scriptBusy: false
};
var els = {};
function $(id) { return document.getElementById(id); }
AELT.state = state;
