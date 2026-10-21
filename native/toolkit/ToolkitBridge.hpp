#pragma once
#include "AE_GeneralPlug.h"
#include "SPBasic.h"
#include <filesystem>
#include <string>
#include <string_view>
namespace aelt::toolkit {
std::wstring file_url(const std::filesystem::path&);
std::wstring wide(std::string_view);
std::string utf8(std::wstring_view);
class Bridge final {
    SPBasicSuite* basic_;AEGP_PluginID plugin_;std::filesystem::path root_;std::wstring host_source_;
    std::wstring execute(std::wstring_view);
public:
    Bridge(SPBasicSuite*,AEGP_PluginID,std::filesystem::path);
    std::wstring call(std::wstring_view method,std::wstring_view payload);
};
}
