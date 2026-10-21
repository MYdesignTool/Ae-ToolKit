#ifndef NOMINMAX
#define NOMINMAX
#endif
#include "ToolkitBridge.hpp"
#include "ToolkitScript.hpp"
#include <windows.h>
#include <shellapi.h>
#include <cstring>
#include <fstream>
#include <iterator>
#include <stdexcept>
namespace aelt::toolkit {
namespace {
template<class T>struct Suite{SPBasicSuite* basic;const char* name;A_long version;const T* value{};
    Suite(SPBasicSuite* b,const char* n,A_long v):basic(b),name(n),version(v){basic->AcquireSuite(n,v,reinterpret_cast<const void**>(&value));}
    ~Suite(){if(value)basic->ReleaseSuite(name,version);}
};
std::wstring failure(std::wstring_view message){return L"{\"ok\":false,\"messages\":["+native_panel::wire::quote(message)+L"]}";}
std::string read_text(const AEGP_MemorySuite1* memory,AEGP_MemHandle handle,std::size_t limit){
    if(!handle)return {};AEGP_MemSize size{};if(memory->AEGP_GetMemHandleSize(handle,&size)||size>limit)throw std::runtime_error("AE response size is invalid");if(!size)return {};
    void* pointer{};if(memory->AEGP_LockMemHandle(handle,&pointer)||!pointer)throw std::runtime_error("AE response is unreadable");
    struct Lock{const AEGP_MemorySuite1* memory;AEGP_MemHandle handle;~Lock(){memory->AEGP_UnlockMemHandle(handle);}}lock{memory,handle};
    const auto* bytes=static_cast<const char*>(pointer);const auto* end=static_cast<const char*>(std::memchr(bytes,0,size));if(!end)throw std::runtime_error("Unterminated AE response");return {bytes,static_cast<std::size_t>(end-bytes)};
}
}
std::wstring wide(std::string_view text){
    if(text.empty())return {};const auto count=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),static_cast<int>(text.size()),nullptr,0);if(!count)throw std::runtime_error("Invalid UTF-8");
    std::wstring out(static_cast<std::size_t>(count),L'\0');if(!MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),static_cast<int>(text.size()),out.data(),count))throw std::runtime_error("UTF-8 conversion failed");return out;
}
std::string utf8(std::wstring_view text){
    if(text.empty())return {};const auto count=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text.data(),static_cast<int>(text.size()),nullptr,0,nullptr,nullptr);if(!count)throw std::runtime_error("Invalid UTF-16");
    std::string out(static_cast<std::size_t>(count),'\0');if(!WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text.data(),static_cast<int>(text.size()),out.data(),count,nullptr,nullptr))throw std::runtime_error("UTF-16 conversion failed");return out;
}
std::wstring file_url(const std::filesystem::path& path){
    const auto input=utf8(path.generic_wstring());std::string out=input.rfind("//",0)==0?"file:":"file:///";constexpr char hex[]="0123456789ABCDEF";
    for(const unsigned char c:input){if((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='-'||c=='_'||c=='.'||c=='~'||c=='/'||c==':')out+=static_cast<char>(c);else{out+='%';out+=hex[c>>4];out+=hex[c&15];}}
    return wide(out);
}
Bridge::Bridge(SPBasicSuite* basic,AEGP_PluginID plugin,std::filesystem::path root):basic_(basic),plugin_(plugin),root_(std::move(root)){
    std::ifstream file(root_/L"host/index.jsx",std::ios::binary);if(!file)throw std::runtime_error("Toolkit host entry not found");
    std::string source{std::istreambuf_iterator<char>(file),std::istreambuf_iterator<char>()};if(source.size()>256*1024)throw std::runtime_error("Toolkit host entry is oversized");if(source.rfind("\xEF\xBB\xBF",0)==0)source.erase(0,3);host_source_=wide(source);
}
std::wstring Bridge::execute(std::wstring_view text){
    Suite<AEGP_UtilitySuite6> utility(basic_,kAEGPUtilitySuite,kAEGPUtilitySuiteVersion6);Suite<AEGP_MemorySuite1> memory(basic_,kAEGPMemorySuite,kAEGPMemorySuiteVersion1);
    if(!utility.value||!memory.value)return failure(L"AE scripting suites are unavailable.");
    AEGP_MemHandle result{},diagnostic{};struct Handles{const AEGP_MemorySuite1* memory;AEGP_MemHandle& result;AEGP_MemHandle& diagnostic;~Handles(){if(result)memory->AEGP_FreeMemHandle(result);if(diagnostic)memory->AEGP_FreeMemHandle(diagnostic);}}handles{memory.value,result,diagnostic};
    AEGP_ErrReportState state{};if(!utility.value->AEGP_StartQuietErrors||!utility.value->AEGP_EndQuietErrors||utility.value->AEGP_StartQuietErrors(&state))return failure(L"AE cannot safely execute this request.");
    A_Err error{};{struct Quiet{const AEGP_UtilitySuite6* utility;AEGP_ErrReportState* state;~Quiet(){utility->AEGP_EndQuietErrors(FALSE,state);}}quiet{utility.value,&state};const auto source=utf8(text);error=utility.value->AEGP_ExecuteScript(plugin_,source.c_str(),FALSE,&result,&diagnostic);}
    const auto detail=read_text(memory.value,diagnostic,8192);if(error||!detail.empty())return failure(detail.empty()?L"AE rejected the request.":wide(detail));
    const auto response=read_text(memory.value,result,8*1024*1024);return response.empty()?failure(L"AE returned no result."):wide(response);
}
std::wstring Bridge::call(std::wstring_view method,std::wstring_view payload){
    if(method==L"native.openExternal"){
        native_panel::wire::Message value;
        if(!native_panel::wire::parse(L"{\"channel\":\"url\",\"id\":\"wv-1\",\"method\":\"url\",\"payload\":"+std::wstring(payload)+L"}",L"url",value)||value.payload.size()>2048||value.payload.find_first_of(L"\r\n")!=std::wstring::npos||(value.payload.rfind(L"https://",0)!=0&&value.payload.rfind(L"http://",0)!=0))return failure(L"Invalid external URL.");
        return reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr,L"open",value.payload.c_str(),nullptr,nullptr,SW_SHOWNORMAL))>32?L"{\"ok\":true}":failure(L"Unable to open the default browser.");
    }
    if(!allowed(method))return failure(L"Unknown toolkit method.");
    return execute(script(root_.generic_wstring(),host_source_,method,payload));
}
}
