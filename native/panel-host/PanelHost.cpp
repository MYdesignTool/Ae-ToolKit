// Adapted from Starfield WebPanelHost.cpp; see NOTICE.md and LICENSE.
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include "PanelHost.hpp"
#include "Protocol.hpp"
#include "AE_GeneralPlugPanels.h"
#include <windows.h>
#include <commctrl.h>
#include <WebView2.h>
#include <wrl.h>
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <deque>
#include <memory>
#include <stdexcept>
#include <thread>
#include <vector>

namespace aelt::native_panel {
namespace {
using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
namespace fs=std::filesystem;
SPBasicSuite* basic{};AEGP_PluginID plugin{};AEGP_Command command{};
Config config;std::thread::id ui_thread;
bool initialized{},stopped=true,stepping{},creating_environment{},com_owned{};
ComPtr<ICoreWebView2Environment> environment;
struct View;std::vector<std::shared_ptr<View>> views;
struct Pending {std::weak_ptr<View> view;std::uint64_t epoch{};wire::Message message;std::chrono::steady_clock::time_point expires;};
std::deque<Pending> requests;std::size_t queued_bytes{};
template<class T> struct Suite {
    const char* name;A_long version;const T* value{};
    Suite(const char* n,A_long v):name(n),version(v){if(basic)basic->AcquireSuite(n,v,reinterpret_cast<const void**>(&value));}
    ~Suite(){if(value)basic->ReleaseSuite(name,version);}
};
struct CoString {LPWSTR value{};~CoString(){CoTaskMemFree(value);}};
std::wstring failure(std::wstring_view code,std::wstring_view message){return L"{\"ok\":false,\"error\":{\"code\":"+wire::quote(code)+L",\"message\":"+wire::quote(message)+L"}}";}
HMODULE own_module(){HMODULE module{};GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(&initialize),&module);return module;}
bool host_available(){
    Suite<AEGP_UtilitySuite6> utility(kAEGPUtilitySuite,kAEGPUtilitySuiteVersion6);HWND main{};A_Boolean available{};
    return utility.value&&utility.value->AEGP_GetMainHWND&&!utility.value->AEGP_GetMainHWND(&main)&&main&&IsWindow(main)&&IsWindowEnabled(main)&&utility.value->AEGP_IsScriptingAvailable&&!utility.value->AEGP_IsScriptingAvailable(&available)&&available;
}
LRESULT CALLBACK view_proc(HWND,UINT,WPARAM,LPARAM);
LRESULT CALLBACK parent_proc(HWND,UINT,WPARAM,LPARAM,UINT_PTR,DWORD_PTR);
struct View:std::enable_shared_from_this<View> {
    HWND hwnd{},parent{},status{};bool alive=true,subclassed{};std::uint64_t epoch{},last_request{};
    ComPtr<ICoreWebView2Controller> controller;ComPtr<ICoreWebView2> web;
    std::wstring url()const{return L"https://"+config.virtual_host+L"/index.html";}
    void error(std::wstring_view message){
        if(!alive||!hwnd)return;
        if(!status)status=CreateWindowExW(0,L"STATIC",L"",WS_CHILD|WS_VISIBLE|SS_LEFT,12,12,450,160,hwnd,nullptr,own_module(),nullptr);
        if(status){SetWindowTextW(status,std::wstring(message).c_str());ShowWindow(status,SW_SHOW);}
    }
    void resize(){
        if(!alive||!hwnd)return;RECT rect{};GetClientRect(hwnd,&rect);
        if(status)MoveWindow(status,12,12,std::max(1L,rect.right-24),std::max(1L,rect.bottom-24),TRUE);
        if(controller){controller->put_Bounds(rect);controller->NotifyParentWindowPositionChanged();controller->put_IsVisible(IsWindowVisible(hwnd)?TRUE:FALSE);}
    }
    void reply(std::wstring_view id,std::wstring_view result){
        if(!alive||!web||stopped)return;
        const auto json=L"{\"channel\":"+wire::quote(config.channel)+L",\"id\":"+wire::quote(id)+L",\"result\":"+wire::quote(result)+L"}";
        (void)web->PostWebMessageAsJson(json.c_str());
    }
    void close()noexcept{
        if(!alive)return;alive=false;++epoch;
        if(subclassed&&parent){RemoveWindowSubclass(parent,parent_proc,reinterpret_cast<UINT_PTR>(this));subclassed=false;}
        if(controller){controller->Close();web.Reset();controller.Reset();}
    }
    void receive(ICoreWebView2WebMessageReceivedEventArgs* args){
        if(!alive||stopped)return;CoString source,json;
        if(FAILED(args->get_Source(&source.value))||!source.value||source.value!=url()||FAILED(args->get_WebMessageAsJson(&json.value))||!json.value)return;
        wire::Message message;if(!wire::parse(json.value,config.channel,message)||message.id.substr(0,3)!=L"wv-")return;
        std::uint64_t serial{};
        for(std::size_t i=3;i<message.id.size();++i){const auto c=message.id[i];if(c<L'0'||c>L'9'||serial>900719925474099ULL)return;serial=serial*10+unsigned(c-L'0');}
        if(!serial||serial<=last_request)return;last_request=serial;
        const auto size=message.payload.size()*sizeof(wchar_t);
        if(requests.size()>=wire::max_requests||size>wire::max_queued_bytes-queued_bytes){reply(message.id,failure(L"host_busy",L"The native panel queue is full."));return;}
        requests.push_back({weak_from_this(),epoch,std::move(message),std::chrono::steady_clock::now()+std::chrono::seconds(7)});queued_bytes+=size;
    }
    void configure(){
        ComPtr<ICoreWebView2Settings> settings;
        if(SUCCEEDED(web->get_Settings(&settings))&&settings){settings->put_AreDevToolsEnabled(FALSE);settings->put_IsStatusBarEnabled(FALSE);settings->put_IsZoomControlEnabled(FALSE);
            ComPtr<ICoreWebView2Settings3> newer;if(SUCCEEDED(settings.As(&newer)))newer->put_AreBrowserAcceleratorKeysEnabled(FALSE);}
        ComPtr<ICoreWebView2_3> mapping;
        if(FAILED(web.As(&mapping))||FAILED(mapping->SetVirtualHostNameToFolderMapping(config.virtual_host.c_str(),config.content_root.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY))){error(L"WebView2 local-content mapping is unavailable.");return;}
        const auto weak=weak_from_this();EventRegistrationToken token{};
        web->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>([weak](ICoreWebView2*,ICoreWebView2NavigationStartingEventArgs* args)->HRESULT {try{
            const auto view=weak.lock();CoString uri;if(!view||!view->alive||FAILED(args->get_Uri(&uri.value))||!uri.value||uri.value!=view->url())args->put_Cancel(TRUE);else{++view->epoch;view->last_request=0;}return S_OK;
        }catch(...){args->put_Cancel(TRUE);return S_OK;}}).Get(),&token);
        web->add_FrameNavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>([](ICoreWebView2*,ICoreWebView2NavigationStartingEventArgs* args)->HRESULT{args->put_Cancel(TRUE);return S_OK;}).Get(),&token);
        web->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2NewWindowRequestedEventArgs* args)->HRESULT{args->put_Handled(TRUE);return S_OK;}).Get(),&token);
        web->add_PermissionRequested(Callback<ICoreWebView2PermissionRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2PermissionRequestedEventArgs* args)->HRESULT{args->put_State(COREWEBVIEW2_PERMISSION_STATE_DENY);return S_OK;}).Get(),&token);
        web->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([weak](ICoreWebView2*,ICoreWebView2WebMessageReceivedEventArgs* args)->HRESULT{try{if(const auto view=weak.lock())view->receive(args);return S_OK;}catch(...){return E_FAIL;}}).Get(),&token);
        web->add_ProcessFailed(Callback<ICoreWebView2ProcessFailedEventHandler>([weak](ICoreWebView2*,ICoreWebView2ProcessFailedEventArgs*)->HRESULT{try{if(const auto view=weak.lock()){++view->epoch;view->error(L"The browser process stopped. Close and reopen this panel.");}return S_OK;}catch(...){return E_FAIL;}}).Get(),&token);
        web->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>([weak](ICoreWebView2*,ICoreWebView2NavigationCompletedEventArgs* args)->HRESULT{try{if(const auto view=weak.lock()){BOOL success{};args->get_IsSuccess(&success);if(success&&view->status)ShowWindow(view->status,SW_HIDE);else if(!success)view->error(L"Unable to load the bundled panel page.");}return S_OK;}catch(...){return E_FAIL;}}).Get(),&token);
        const auto bootstrap=L"window.__aeltNativeHost=Object.freeze({channel:"+wire::quote(config.channel)+L"});";
        const auto result=web->AddScriptToExecuteOnDocumentCreated(bootstrap.c_str(),Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>([weak](HRESULT code,LPCWSTR)->HRESULT{try{
            if(const auto view=weak.lock();view&&view->alive&&!stopped){if(FAILED(code)||FAILED(view->web->Navigate(view->url().c_str())))view->error(L"The panel bridge could not initialize.");}return S_OK;
        }catch(...){return E_FAIL;}}).Get());
        if(FAILED(result))error(L"The panel bridge could not initialize.");resize();
    }
    void create_controller(){
        if(!alive||stopped||!environment||controller)return;const auto weak=weak_from_this();
        const auto code=environment->CreateCoreWebView2Controller(hwnd,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([weak](HRESULT result,ICoreWebView2Controller* value)->HRESULT{try{
            const auto view=weak.lock();if(!view||!view->alive||stopped){if(value)value->Close();return S_OK;}
            if(FAILED(result)||!value){view->error(L"WebView2 controller creation failed.");return S_OK;}view->controller=value;
            if(FAILED(value->get_CoreWebView2(&view->web))||!view->web){view->error(L"WebView2 content initialization failed.");return S_OK;}view->configure();return S_OK;
        }catch(...){return E_FAIL;}}).Get());
        if(FAILED(code))error(L"WebView2 controller creation could not start.");
    }
};
void ensure_environment(const std::shared_ptr<View>& view){
    if(environment){view->create_controller();return;}if(creating_environment)return;
    if(!com_owned){const auto code=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);if(FAILED(code)){view->error(L"The panel thread is not compatible with WebView2 STA.");return;}com_owned=true;}
    if(!fs::is_regular_file(config.content_root/L"index.html")){view->error(L"The configured panel content was not found.");return;}
    fs::create_directories(config.profile_root);creating_environment=true;
    const auto code=CreateCoreWebView2EnvironmentWithOptions(nullptr,config.profile_root.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([](HRESULT result,ICoreWebView2Environment* value)->HRESULT{try{
        creating_environment=false;if(stopped)return S_OK;
        if(FAILED(result)||!value){for(const auto& current:views)current->error(L"Microsoft WebView2 Runtime is unavailable.");return S_OK;}
        environment=value;for(const auto& current:views)current->create_controller();return S_OK;
    }catch(...){return E_FAIL;}}).Get());
    if(FAILED(code)){creating_environment=false;view->error(L"WebView2 Runtime could not start.");}
}
LRESULT CALLBACK view_proc(HWND hwnd,UINT message,WPARAM wparam,LPARAM lparam){
    auto* view=reinterpret_cast<View*>(GetWindowLongPtrW(hwnd,GWLP_USERDATA));
    if(message==WM_NCCREATE){view=static_cast<View*>(reinterpret_cast<CREATESTRUCTW*>(lparam)->lpCreateParams);SetWindowLongPtrW(hwnd,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(view));view->hwnd=hwnd;}
    try{if(view)switch(message){
    case WM_SIZE:case WM_MOVE:case WM_SHOWWINDOW:case WM_WINDOWPOSCHANGED:view->resize();break;
    case WM_SETFOCUS:if(view->controller)view->controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);break;
    case WM_NCDESTROY:view->close();view->hwnd=nullptr;SetWindowLongPtrW(hwnd,GWLP_USERDATA,0);break;
    default:break;
    }}catch(...){}return DefWindowProcW(hwnd,message,wparam,lparam);
}
LRESULT CALLBACK parent_proc(HWND hwnd,UINT message,WPARAM wparam,LPARAM lparam,UINT_PTR id,DWORD_PTR ref){
    auto* view=reinterpret_cast<View*>(ref);try{
        if(message==WM_NCDESTROY){RemoveWindowSubclass(hwnd,parent_proc,id);view->subclassed=false;view->close();}
        else if(message==WM_SIZE||message==WM_SHOWWINDOW||message==WM_WINDOWPOSCHANGED){RECT rect{};GetClientRect(hwnd,&rect);if(view->hwnd)MoveWindow(view->hwnd,0,0,rect.right,rect.bottom,TRUE);view->resize();}
        else if(message==WM_SETFOCUS&&view->controller)view->controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
    }catch(...){}return DefSubclassProc(hwnd,message,wparam,lparam);
}
std::shared_ptr<View> make_view(HWND parent){
    if(views.size()>=16)throw std::runtime_error("Too many panel views");
    WNDCLASSEXW cls{};cls.cbSize=sizeof(cls);cls.lpfnWndProc=view_proc;cls.hInstance=own_module();cls.hCursor=LoadCursorW(nullptr,IDC_ARROW);cls.hbrBackground=static_cast<HBRUSH>(GetStockObject(DKGRAY_BRUSH));cls.lpszClassName=config.window_class.c_str();
    if(!RegisterClassExW(&cls)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS)throw std::runtime_error("Window class registration failed");
    auto view=std::make_shared<View>();view->parent=parent;
    if(!CreateWindowExW(0,config.window_class.c_str(),L"",WS_CHILD|WS_CLIPCHILDREN|WS_CLIPSIBLINGS|WS_VISIBLE,0,0,580,400,parent,nullptr,own_module(),view.get()))throw std::runtime_error("Panel creation failed");
    views.push_back(view);view->subclassed=SetWindowSubclass(parent,parent_proc,reinterpret_cast<UINT_PTR>(view.get()),reinterpret_cast<DWORD_PTR>(view.get()))!=FALSE;
    if(!view->subclassed){view->error(L"Panel resize handling could not initialize.");return view;}
    RECT rect{};GetClientRect(parent,&rect);MoveWindow(view->hwnd,0,0,rect.right,rect.bottom,TRUE);
    view->error(L"Loading WebView2...");ensure_environment(view);return view;
}
A_Err snap_sizes(AEGP_PanelRefcon,A_LPoint*,A_long* count)noexcept{if(count)*count=0;return A_Err_NONE;}
A_Err flyout_items(AEGP_PanelRefcon,AEGP_FlyoutMenuItem*,A_long* count)noexcept{if(count)*count=0;return A_Err_NONE;}
A_Err flyout_command(AEGP_PanelRefcon,AEGP_FlyoutMenuCmdID)noexcept{return A_Err_NONE;}
A_Err create_panel(AEGP_GlobalRefcon,AEGP_CreatePanelRefcon,AEGP_PlatformViewRef container,AEGP_PanelH panel,AEGP_PanelFunctions1* functions,AEGP_PanelRefcon* refcon)noexcept try{
    if(stopped||std::this_thread::get_id()!=ui_thread||!container||!functions||!refcon)return A_Err_GENERIC;
    *functions={snap_sizes,flyout_items,flyout_command};*refcon=nullptr;const auto view=make_view(container);*refcon=reinterpret_cast<AEGP_PanelRefcon>(view.get());
    Suite<AEGP_PanelSuite1> panels(kAEGPPanelSuite,kAEGPPanelSuiteVersion1);if(panels.value)panels.value->AEGP_SetTitle(panel,reinterpret_cast<const A_u_char*>(config.title.c_str()));return A_Err_NONE;
}catch(...){return A_Err_GENERIC;}
A_Err command_hook(AEGP_GlobalRefcon,AEGP_CommandRefcon,AEGP_Command id,AEGP_HookPriority,A_Boolean,A_Boolean* handled)noexcept try{
    if(id!=command)return A_Err_NONE;if(handled)*handled=TRUE;if(stopped||std::this_thread::get_id()!=ui_thread)return A_Err_NONE;
    Suite<AEGP_PanelSuite1> panels(kAEGPPanelSuite,kAEGPPanelSuiteVersion1);if(panels.value)panels.value->AEGP_ToggleVisibility(reinterpret_cast<const A_u_char*>(config.match_name.c_str()));return A_Err_NONE;
}catch(...){return A_Err_NONE;}
A_Err menu_hook(AEGP_GlobalRefcon,AEGP_UpdateMenuRefcon,AEGP_WindowType)noexcept{Suite<AEGP_CommandSuite1> commands(kAEGPCommandSuite,kAEGPCommandSuiteVersion1);if(!stopped&&command&&commands.value)commands.value->AEGP_EnableCommand(command);return A_Err_NONE;}
}
bool initialize(SPBasicSuite* suites,AEGP_PluginID id,Config options)noexcept try{
    if(initialized||!suites||options.match_name.empty()||options.menu_name.empty()||options.title.empty()||options.virtual_host.empty()||options.window_class.empty()||options.channel.empty()||!options.dispatch||!options.content_root.is_absolute()||!options.profile_root.is_absolute())return false;
    basic=suites;plugin=id;config=std::move(options);ui_thread=std::this_thread::get_id();stopped=false;initialized=true;
    Suite<AEGP_UtilitySuite6> utility(kAEGPUtilitySuite,kAEGPUtilitySuiteVersion6);A_Boolean suppressed=TRUE;
    if(!utility.value||utility.value->AEGP_GetSuppressInteractiveUI(&suppressed)||suppressed)return true;
    Suite<AEGP_PanelSuite1> panels(kAEGPPanelSuite,kAEGPPanelSuiteVersion1);Suite<AEGP_RegisterSuite5> registrations(kAEGPRegisterSuite,kAEGPRegisterSuiteVersion5);Suite<AEGP_CommandSuite1> commands(kAEGPCommandSuite,kAEGPCommandSuiteVersion1);
    if(!panels.value||!registrations.value||!commands.value)return false;
    if(panels.value->AEGP_RegisterCreatePanelHook(id,reinterpret_cast<const A_u_char*>(config.match_name.c_str()),create_panel,nullptr,TRUE))return false;
    if(commands.value->AEGP_GetUniqueCommand(&command)||registrations.value->AEGP_RegisterCommandHook(id,AEGP_HP_BeforeAE,command,command_hook,nullptr)||commands.value->AEGP_InsertMenuCommand(command,config.menu_name.c_str(),AEGP_Menu_WINDOW,AEGP_MENU_INSERT_SORTED))return false;
    return !registrations.value->AEGP_RegisterUpdateMenuHook(id,menu_hook,nullptr);
}catch(...){return false;}
bool step()noexcept try{
    if(stopped||stepping||std::this_thread::get_id()!=ui_thread)return false;
    views.erase(std::remove_if(views.begin(),views.end(),[](const auto& view){return !view->alive;}),views.end());if(requests.empty())return false;
    stepping=true;struct Stepping{~Stepping(){stepping=false;}} scope;
    const auto view=requests.front().view.lock();const bool stale=!view||!view->alive||view->epoch!=requests.front().epoch;
    const bool expired=std::chrono::steady_clock::now()>=requests.front().expires;
    if(!stale&&!expired&&(!host_available()||(config.can_dispatch&&!config.can_dispatch())))return false;
    auto pending=std::move(requests.front());requests.pop_front();queued_bytes-=pending.message.payload.size()*sizeof(wchar_t);
    if(stale)return !requests.empty();if(expired){view->reply(pending.message.id,failure(L"host_timeout",L"The request expired without executing."));return !requests.empty();}
    std::wstring response;try{response=config.dispatch(pending.message.method,pending.message.payload);}catch(...){response=failure(L"host_failed",L"The request failed. No automatic retry was made.");}
    if(view->alive&&view->epoch==pending.epoch)view->reply(pending.message.id,response);return !requests.empty();
}catch(...){stepping=false;return false;}
void stop()noexcept{
    stopped=true;requests.clear();queued_bytes=0;for(const auto& view:views){view->close();if(view->hwnd)DestroyWindow(view->hwnd);}views.clear();environment.Reset();
    if(com_owned){CoUninitialize();com_owned=false;}
}
}
