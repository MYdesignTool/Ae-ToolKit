#pragma once
#include "../panel-host/Protocol.hpp"
#include <array>
#include <stdexcept>
#include <string>
#include <string_view>

namespace aelt::toolkit {
inline constexpr std::array<std::wstring_view,17> methods={L"AELT_setModuleBase",L"AELT_ping",L"AELT_bootstrap",L"AELT_loadSettings",L"AELT_saveSettings",L"AELT_loadOrganizerSchemes",L"AELT_saveOrganizerScheme",L"AELT_deleteOrganizerScheme",L"AELT_organizeProjectWithScheme",L"AELT_getSelectedPropertySummary",L"AELT_applyExpression",L"AELT_removeExpressions",L"AELT_selectScriptFolder",L"AELT_scanScripts",L"AELT_launchScript",L"AELT_exportUserData",L"AELT_importUserData"};
inline bool allowed(std::wstring_view name){for(const auto method:methods)if(name==method)return true;return false;}
inline std::wstring script(std::wstring_view root,std::wstring_view host_source,std::wstring_view method,std::wstring_view payload){
    if(!allowed(method))throw std::invalid_argument("Unknown toolkit method");
    namespace wire=aelt::native_panel::wire;std::wstring table;
    for(const auto name:methods){if(!table.empty())table+=L",";table+=wire::quote(name)+L":"+std::wstring(name);}
    // Lexical factory keeps all AELT_* declarations out of CEP's global scope.
    const auto factory=L"(function(){\n"+std::wstring(host_source)+L"\nvar first=AELT_setModuleBase("+wire::quote(root)+L");if(!AELocalToolkit.ready)throw new Error(first);var methods={"+table+L"};return function(name,payload){var args=AELocalToolkit.json.parse(payload);if(!(args instanceof Array))throw new Error('Host arguments must be an array');if(name==='AELT_setModuleBase'&&(args.length!==1||new Folder(args[0]).fullName!==AELocalToolkit.moduleBase))throw new Error('Native module root cannot be changed');return methods[name].apply(null,args);};})()";
    // JSON fallback does not depend on a successfully loaded JSON module.
    const std::wstring error=L"var text=String(error);var quoted='\"';for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);quoted+=(c<32||c===34||c===92)?'\\\\u'+('0000'+c.toString(16)).slice(-4):text.charAt(i);}quoted+='\"';return '{\"ok\":false,\"messages\":['+quoted+']}';";
    return L"(function(){try{var root="+wire::quote(root)+L";var registry=$.global.__AELT_WEBVIEW2_V1||($.global.__AELT_WEBVIEW2_V1={});var key='$'+root;if(!registry[key])registry[key]="+factory+L";return registry[key]("+wire::quote(method)+L","+wire::quote(payload)+L");}catch(error){"+error+L"}})()";
}
}
