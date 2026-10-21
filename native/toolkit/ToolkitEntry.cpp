#include "AEConfig.h"
#include "../panel-host/PanelHost.hpp"
#include "../panel-host/Protocol.hpp"
#include "ToolkitBridge.hpp"
#include <windows.h>
#include <memory>
namespace {
std::shared_ptr<aelt::toolkit::Bridge> bridge;
A_Err idle(AEGP_GlobalRefcon,AEGP_IdleRefcon,A_long* sleep)noexcept{const bool pending=aelt::native_panel::step();if(sleep)*sleep=pending?0:20;return A_Err_NONE;}
A_Err death(AEGP_GlobalRefcon,AEGP_DeathRefcon)noexcept{aelt::native_panel::stop();bridge.reset();return A_Err_NONE;}
}
extern "C" __declspec(dllexport) A_Err AeltToolkitEntry(SPBasicSuite* basic,A_long,A_long,AEGP_PluginID id,AEGP_GlobalRefcon* refcon)noexcept try{
    if(refcon)*refcon=nullptr;if(!basic)return A_Err_NONE;const AEGP_RegisterSuite5* registrations{};
    if(basic->AcquireSuite(kAEGPRegisterSuite,kAEGPRegisterSuiteVersion5,reinterpret_cast<const void**>(&registrations))||!registrations)return A_Err_NONE;
    struct Release{SPBasicSuite* basic;~Release(){basic->ReleaseSuite(kAEGPRegisterSuite,kAEGPRegisterSuiteVersion5);}}release{basic};
    if(registrations->AEGP_RegisterDeathHook(id,death,nullptr)||registrations->AEGP_RegisterIdleHook(id,idle,nullptr))return A_Err_NONE;
    HMODULE module{};GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(&AeltToolkitEntry),&module);
    std::wstring path(32768,L'\0');const auto count=GetModuleFileNameW(module,path.data(),static_cast<DWORD>(path.size()));if(!count||count>=path.size())return A_Err_NONE;path.resize(count);
    const auto directory=std::filesystem::canonical(path).parent_path();const auto root=directory/L"extension";
    bridge=std::make_shared<aelt::toolkit::Bridge>(basic,id,root);
    aelt::native_panel::Config options;options.match_name="org.aelocaltoolkit.webview2.toolkit";options.menu_name="AE Local Toolkit (WebView2)";options.title="AE Local Toolkit (WebView2)";
    options.virtual_host=L"aelt-toolkit.invalid";options.window_class=L"AeLocalToolkit.WebView2.Toolkit.V1";options.channel=L"org.aelocaltoolkit.toolkit/1";
#ifdef AELT_NATIVE_DEBUG_PORT
    options.debug_port=AELT_NATIVE_DEBUG_PORT;
#endif
    options.content_root=root/L"client";options.document_url=aelt::toolkit::file_url(options.content_root/L"index.html");options.profile_root=directory.parent_path()/L"profile";
    options.bootstrap_script=L"window.__aeltToolkitNative=Object.freeze({channel:"+aelt::native_panel::wire::quote(options.channel)+L",extensionRoot:"+aelt::native_panel::wire::quote(root.generic_wstring())+L"});";
    options.dispatch=[](std::wstring_view method,std::wstring_view payload){return bridge->call(method,payload);};options.retain_on_close=[](std::wstring_view method){return method==L"AELT_saveSettings";};
    (void)aelt::native_panel::initialize(basic,id,std::move(options));return A_Err_NONE;
}catch(...){return A_Err_NONE;}
