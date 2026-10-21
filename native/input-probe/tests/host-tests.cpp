// Exercises the extracted production queue with fake AE suites, no AE/browser.
#include "../../panel-host/PanelHost.cpp"
#include <cstring>
#include <iostream>
using namespace aelt::native_panel;
namespace {
unsigned checks{},failures{},executions{},acquisitions{},releases{};
bool suppressed=true,scripting=true;HWND main_window{};
AEGP_UtilitySuite6 utility{};
void check(bool ok,const char* label){++checks;if(!ok){++failures;std::cerr<<"FAIL: "<<label<<'\n';}}
SPErr acquire(const char* name,int32,const void** output){++acquisitions;*output=!std::strcmp(name,kAEGPUtilitySuite)?&utility:nullptr;return *output?kSPNoError:kSPBadParameterError;}
SPErr release(const char*,int32){++releases;return kSPNoError;}
std::wstring message(std::wstring_view id,std::wstring_view payload=L"中文"){
    return L"{\"channel\":\"probe/1\",\"id\":"+wire::quote(id)+L",\"method\":\"probe.ping\",\"payload\":"+wire::quote(payload)+L"}";
}
class WebMessage final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ICoreWebView2WebMessageReceivedEventArgs>{
public:
    std::wstring source=L"https://probe.invalid/index.html",json;
    static HRESULT copy(const std::wstring& text,LPWSTR* output){*output=static_cast<LPWSTR>(CoTaskMemAlloc((text.size()+1)*sizeof(wchar_t)));if(!*output)return E_OUTOFMEMORY;std::memcpy(*output,text.c_str(),(text.size()+1)*sizeof(wchar_t));return S_OK;}
    HRESULT STDMETHODCALLTYPE get_Source(LPWSTR* output)override{return copy(source,output);}
    HRESULT STDMETHODCALLTYPE get_WebMessageAsJson(LPWSTR* output)override{return copy(json,output);}
    HRESULT STDMETHODCALLTYPE TryGetWebMessageAsString(LPWSTR*)override{return E_INVALIDARG;}
};
}
int main(){
    const auto foreground=GetForegroundWindow();wire::Message parsed;
    const auto valid=message(L"wv-1",L"中文\\\"\n");
    check(wire::parse(valid,L"probe/1",parsed)&&parsed.payload==L"中文\\\"\n","Unicode payload survives parsing");
    for(std::size_t i=0;i<valid.size();++i)check(!wire::parse(std::wstring_view(valid).substr(0,i),L"probe/1",parsed),"truncated input rejects");
    check(!wire::parse(valid,L"other/1",parsed),"wrong channel rejects");
    check(!wire::parse(valid+L"x",L"probe/1",parsed),"trailing bytes reject");
    check(!wire::parse(message(L"../escape"),L"probe/1",parsed),"unsafe ID rejects");
    check(!wire::parse(message(L"wv-1",std::wstring(wire::max_payload+1,L'x')),L"probe/1",parsed),"oversized payload rejects");
    const auto duplicate=L"{\"channel\":\"probe/1\",\"id\":\"wv-1\",\"id\":\"wv-2\",\"payload\":\"\"}";
    check(!wire::parse(duplicate,L"probe/1",parsed),"duplicate fields reject");
    utility.AEGP_GetSuppressInteractiveUI=[](A_Boolean* out)->A_Err{*out=suppressed;return 0;};
    utility.AEGP_GetMainHWND=[](void* out)->A_Err{*static_cast<HWND*>(out)=main_window;return 0;};
    utility.AEGP_IsScriptingAvailable=[](A_Boolean* out)->A_Err{*out=scripting;return 0;};
    SPBasicSuite sdk{};sdk.AcquireSuite=acquire;sdk.ReleaseSuite=release;
    Config options;options.match_name="probe";options.menu_name="Probe";options.title="Probe";options.virtual_host=L"probe.invalid";options.window_class=L"Probe.Window";options.channel=L"probe/1";
    options.content_root=fs::current_path();options.profile_root=fs::current_path()/L".artifacts/unused-profile";
    std::vector<std::wstring> dispatched;
    options.dispatch=[&](std::wstring_view method,std::wstring_view payload){++executions;check(method==L"probe.ping","dispatch receives the parsed method");check(!step(),"dispatch cannot reenter the idle queue");dispatched.emplace_back(payload);return L"ok";};
    check(initialize(&sdk,42,std::move(options)),"headless initialization accepts caller configuration");
    check(!environment&&!com_owned&&!creating_environment&&views.empty(),"headless initialization creates no browser or COM apartment");
    main_window=CreateWindowExW(0,L"STATIC",L"",0,0,0,0,0,HWND_MESSAGE,nullptr,GetModuleHandleW(nullptr),nullptr);
    check(main_window&&!IsWindowVisible(main_window),"test host is an invisible owned window");
    auto view=std::make_shared<View>();views.push_back(view);view->epoch=1;
    auto event=Microsoft::WRL::Make<WebMessage>();event->json=message(L"wv-1");event->source=L"https://wrong.invalid/index.html";
    view->receive(event.Get());check(requests.empty(),"untrusted page cannot enqueue");
    event->source=view->url();view->receive(event.Get());check(requests.size()==1&&executions==0,"browser callback only queues owned data");
    view->receive(event.Get());check(requests.size()==1,"duplicate request cannot execute twice");
    const auto acquired=acquisitions;std::thread worker([&]{check(!step()&&executions==0,"worker cannot access the host");});worker.join();check(acquisitions==acquired,"thread guard precedes suite access");
    EnableWindow(main_window,FALSE);check(!step()&&executions==0&&requests.size()==1,"modal AE defers queued work");EnableWindow(main_window,TRUE);
    scripting=false;check(!step()&&executions==0,"scripting unavailable defers queued work");scripting=true;
    config.can_dispatch=[] {return false;};check(!step()&&executions==0,"caller transaction guard defers work");config.can_dispatch={};
    step();check(executions==1&&dispatched[0]==L"中文"&&queued_bytes==0,"idle dispatch executes once and releases bytes");
    event->json=message(L"wv-2");view->receive(event.Get());requests.front().expires={};step();check(executions==1&&requests.empty(),"expired work never executes");
    event->json=message(L"wv-3");view->receive(event.Get());++view->epoch;step();check(executions==1&&requests.empty(),"navigation invalidates pending work");
    for(unsigned i=4;i<68;++i){event->json=message(L"wv-"+std::to_wstring(i),std::to_wstring(i));view->receive(event.Get());}
    check(requests.size()==64,"queue accepts exact capacity");event->json=message(L"wv-68");view->receive(event.Get());check(requests.size()==64,"queue overflow rejects");
    while(!requests.empty())step();check(executions==65&&dispatched[1]==L"4"&&dispatched.back()==L"67"&&queued_bytes==0,"FIFO order and byte accounting preserved");
    event->json=message(L"wv-69");view->receive(event.Get());view->close();step();check(executions==65&&requests.empty(),"closed view cannot execute queued work");
    check(acquisitions==releases,"all acquired fake suites released");stop();check(views.empty()&&requests.empty()&&!environment,"shutdown clears owned state");DestroyWindow(main_window);
    check(GetForegroundWindow()==foreground,"tests preserve the user's foreground window");
    std::cout<<checks<<" checks, "<<failures<<" failures; extracted production host, no AE or browser\n";return failures?1:0;
}
