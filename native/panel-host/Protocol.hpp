// Adapted from Starfield WebPanelProtocol.hpp; see NOTICE.md and LICENSE.
#pragma once
#include <array>
#include <string>
#include <string_view>
#include <utility>

namespace aelt::native_panel::wire {
inline constexpr std::size_t max_payload=1024*1024, max_message=4*1024*1024;
inline constexpr std::size_t max_requests=64, max_queued_bytes=8*1024*1024;
struct Message { std::wstring id, method, payload; };
inline std::wstring quote(std::wstring_view value) {
    constexpr wchar_t hex[]=L"0123456789abcdef";
    std::wstring result=L"\"";
    for(const auto c:value) {
        if(c==L'"'||c==L'\\'){result+=L'\\';result+=c;}
        else if(c<32||c==0x2028||c==0x2029){result+=L"\\u";for(int shift=12;shift>=0;shift-=4)result+=hex[(unsigned(c)>>shift)&15];}
        else result+=c;
    }
    return result+L'"';
}
inline bool parse(std::wstring_view json,std::wstring_view channel,Message& output) {
    if(json.empty()||json.size()>max_message)return false;
    std::size_t at=0;
    const auto ws=[&]{while(at<json.size()&&(json[at]==L' '||json[at]==L'\r'||json[at]==L'\n'||json[at]==L'\t'))++at;};
    const auto take=[&](wchar_t c){ws();if(at==json.size()||json[at]!=c)return false;++at;return true;};
    const auto string=[&](std::wstring& value){
        if(!take(L'"'))return false;value.clear();
        while(at<json.size()) {
            auto c=json[at++];if(c==L'"')return true;if(c<32)return false;
            if(c==L'\\') {
                if(at==json.size())return false;c=json[at++];
                switch(c) {
                case L'"':case L'\\':case L'/':break;
                case L'b':c=L'\b';break;case L'f':c=L'\f';break;case L'n':c=L'\n';break;case L'r':c=L'\r';break;case L't':c=L'\t';break;
                case L'u':{unsigned n=0;for(int i=0;i<4;++i){if(at==json.size())return false;const auto h=json[at++];
                    const int d=h>=L'0'&&h<=L'9'?h-L'0':h>=L'a'&&h<=L'f'?h-L'a'+10:h>=L'A'&&h<=L'F'?h-L'A'+10:-1;
                    if(d<0)return false;n=n*16+unsigned(d);}c=static_cast<wchar_t>(n);break;}
                default:return false;
                }
            }
            if(!c)return false;value+=c;
        }
        return false;
    };
    if(!take(L'{'))return false;
    std::array<bool,4> seen{};std::wstring key,value;Message candidate;bool closed=false;
    for(std::size_t count=0;count<4;++count) {
        if(!string(key)||!take(L':')||!string(value))return false;
        const auto index=key==L"channel"?0:key==L"id"?1:key==L"method"?2:key==L"payload"?3:4;
        if(index==4||seen[index])return false;seen[index]=true;
        if(index==0&&value!=channel)return false;
        if(index==1)candidate.id=value;if(index==2)candidate.method=value;if(index==3)candidate.payload=value;
        ws();if(at<json.size()&&json[at]==L'}'){++at;closed=true;break;}if(!take(L','))return false;
    }
    ws();if(!closed||at!=json.size()||!seen[0]||!seen[1]||!seen[2]||!seen[3]||candidate.id.empty()||candidate.id.size()>64||candidate.method.empty()||candidate.method.size()>80||candidate.payload.size()>max_payload)return false;
    for(const auto c:candidate.id)if(!((c>=L'0'&&c<=L'9')||(c>=L'a'&&c<=L'z')||c==L'-'))return false;
    for(const auto c:candidate.method)if(!((c>=L'0'&&c<=L'9')||(c>=L'a'&&c<=L'z')||(c>=L'A'&&c<=L'Z')||c==L'.'||c==L'_'))return false;
    output=std::move(candidate);return true;
}
}
