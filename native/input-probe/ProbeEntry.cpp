#include "AEConfig.h"
#include "PanelHost.hpp"
#include "Protocol.hpp"
#include <windows.h>
#include <filesystem>

namespace {
A_Err idle(AEGP_GlobalRefcon,AEGP_IdleRefcon,A_long* sleep)noexcept {
    const bool pending=aelt::native_panel::step();if(sleep)*sleep=pending?0:20;return A_Err_NONE;
}
A_Err death(AEGP_GlobalRefcon,AEGP_DeathRefcon)noexcept{aelt::native_panel::stop();return A_Err_NONE;}
std::wstring dispatch(std::wstring_view method,std::wstring_view payload){
    if(method!=L"probe.ping")return L"{\"ok\":false,\"error\":\"unknown_method\"}";
    return L"{\"ok\":true,\"host\":\"AEGP + WebView2\",\"echo\":"+aelt::native_panel::wire::quote(payload)+L"}";
}
}
extern "C" __declspec(dllexport) A_Err AeltInputProbeEntry(SPBasicSuite* basic,A_long,A_long,AEGP_PluginID id,AEGP_GlobalRefcon* refcon)noexcept try {
    if(refcon)*refcon=nullptr;if(!basic)return A_Err_NONE;
    const AEGP_RegisterSuite5* registrations{};
    if(basic->AcquireSuite(kAEGPRegisterSuite,kAEGPRegisterSuiteVersion5,reinterpret_cast<const void**>(&registrations))||!registrations)return A_Err_NONE;
    struct Release{SPBasicSuite* basic;~Release(){basic->ReleaseSuite(kAEGPRegisterSuite,kAEGPRegisterSuiteVersion5);}} release{basic};
    if(registrations->AEGP_RegisterDeathHook(id,death,nullptr)||registrations->AEGP_RegisterIdleHook(id,idle,nullptr))return A_Err_NONE;
    HMODULE module{};GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(&AeltInputProbeEntry),&module);
    std::wstring filename(32768,L'\0');const auto count=GetModuleFileNameW(module,filename.data(),static_cast<DWORD>(filename.size()));if(!count||count>=filename.size())return A_Err_NONE;filename.resize(count);
    const auto directory=std::filesystem::canonical(filename).parent_path();
    aelt::native_panel::Config options;
    options.match_name="org.aelocaltoolkit.inputprobe.webview2";options.menu_name="AeLocalToolkit Input Probe (WebView2)";options.title="AeLocalToolkit Input Probe";
    options.virtual_host=L"aelt-input-probe.invalid";options.window_class=L"AeLocalToolkit.InputProbe.WebView2.V1";options.channel=L"org.aelocaltoolkit.inputprobe/1";
    options.content_root=directory/L"content";options.profile_root=directory.parent_path()/L"profile";options.dispatch=dispatch;
    (void)aelt::native_panel::initialize(basic,id,std::move(options));return A_Err_NONE;
}catch(...){return A_Err_NONE;}
