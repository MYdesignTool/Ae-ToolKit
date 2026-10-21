#include "../ToolkitBridge.hpp"
#include "../ToolkitScript.hpp"
#include <windows.h>
#include <cstring>
#include <fstream>
#include <iostream>
using namespace aelt::toolkit;
namespace {
unsigned checks{},failures{},executions{},freed{},acquired{},released{},quiet_starts{},quiet_ends{};bool script_failure{},quiet_failure{};std::string captured;
AEGP_UtilitySuite6 utility{};AEGP_MemorySuite1 memory{};
void check(bool ok,const char* name){++checks;if(!ok){++failures;std::cerr<<name<<'\n';}}
struct Text{std::string bytes;};
SPErr acquire(const char* name,int32,const void** out){++acquired;*out=!std::strcmp(name,kAEGPUtilitySuite)?static_cast<const void*>(&utility):!std::strcmp(name,kAEGPMemorySuite)?static_cast<const void*>(&memory):nullptr;return *out?kSPNoError:kSPBadParameterError;}
SPErr release(const char*,int32){++released;return kSPNoError;}
}
int main(int argc,char** argv){
    utility.AEGP_StartQuietErrors=[](AEGP_ErrReportState*)->A_Err{if(quiet_failure)return 1;++quiet_starts;return 0;};
    utility.AEGP_EndQuietErrors=[](A_Boolean report,AEGP_ErrReportState*)->A_Err{check(!report,"quiet scope does not display captured errors");++quiet_ends;return 0;};
    utility.AEGP_ExecuteScript=[](AEGP_PluginID,const A_char* source,A_Boolean encoding,AEGP_MemHandle* result,AEGP_MemHandle* error)->A_Err{
        ++executions;check(!encoding,"script is UTF-8");captured=source;*result=reinterpret_cast<AEGP_MemHandle>(new Text{"{\"ok\":true}"});*error=reinterpret_cast<AEGP_MemHandle>(new Text{script_failure?"中文 failure":""});return script_failure?1:0;};
    memory.AEGP_GetMemHandleSize=[](AEGP_MemHandle value,AEGP_MemSize* out)->A_Err{*out=static_cast<AEGP_MemSize>(reinterpret_cast<Text*>(value)->bytes.size()+1);return 0;};
    memory.AEGP_LockMemHandle=[](AEGP_MemHandle value,void** out)->A_Err{*out=reinterpret_cast<Text*>(value)->bytes.data();return 0;};
    memory.AEGP_UnlockMemHandle=[](AEGP_MemHandle)->A_Err{return 0;};
    memory.AEGP_FreeMemHandle=[](AEGP_MemHandle value)->A_Err{delete reinterpret_cast<Text*>(value);++freed;return 0;};
    SPBasicSuite basic{};basic.AcquireSuite=acquire;basic.ReleaseSuite=release;
    Bridge bridge(&basic,42,std::filesystem::current_path()/L"extension");
    check(bridge.call(L"notAllowed",L"[]").find(L"false")!=std::wstring::npos&&executions==0,"unknown method cannot execute AE code");
    check(bridge.call(L"AELT_ping",L"[]")==L"{\"ok\":true}"&&freed==2,"empty diagnostic handle is success and both handles freed");
    check(captured.find("__AELT_WEBVIEW2_V1")!=std::string::npos,"generated code uses a private session registry");
    script_failure=true;check(bridge.call(L"AELT_ping",L"[]").find(L"中文 failure")!=std::wstring::npos&&freed==4,"script error text and handle ownership preserved");script_failure=false;
    quiet_failure=true;const auto before=executions;bridge.call(L"AELT_ping",L"[]");check(executions==before,"failed quiet setup cannot execute");quiet_failure=false;
    check(quiet_starts==quiet_ends&&acquired==released,"quiet state and suites balanced");
    check(file_url(std::filesystem::path(L"C:\\中文 %20 #\\file.js"))==L"file:///C:/%E4%B8%AD%E6%96%87%20%2520%20%23/file.js","file URL escapes Unicode, literal percent and hash exactly once");
    check(file_url(std::filesystem::path(L"\\\\server\\share\\file name.jpg"))==L"file://server/share/file%20name.jpg","UNC file URL preserved");
    if(argc==2){
        const auto root=(std::filesystem::current_path()/L"extension").generic_wstring();std::ifstream file(std::filesystem::path(L"extension/host/index.jsx"),std::ios::binary);std::string source{std::istreambuf_iterator<char>(file),std::istreambuf_iterator<char>()};
        std::ofstream output(argv[1],std::ios::binary);output<<"{";bool first=true;
        for(const auto method:methods){if(!first)output<<",";first=false;output<<utf8(aelt::native_panel::wire::quote(method))<<":"<<utf8(aelt::native_panel::wire::quote(script(root,wide(source),method,method==L"AELT_setModuleBase"?L"["+aelt::native_panel::wire::quote(root)+L"]":L"[]")));}
        output<<",\"invalidArguments\":"<<utf8(aelt::native_panel::wire::quote(script(root,wide(source),L"AELT_ping",L"not valid \" JSON\n")))<<"}";
    }
    std::cout<<checks<<" bridge checks, "<<failures<<" failures\n";return failures?1:0;
}
