#pragma once
#include "AE_GeneralPlug.h"
#include "SPBasic.h"
#include <filesystem>
#include <cstdint>
#include <functional>
#include <string>
#include <string_view>

namespace aelt::native_panel {
// One independently identified dockable panel per resident General AEGP module.
// The caller owns business dispatch; it runs only from step() on AE's UI thread.
struct Config {
    std::string match_name, menu_name, title;
    std::wstring virtual_host, window_class, channel;
    std::wstring document_url, bootstrap_script;
    std::uint16_t debug_port{}; // Development builds only; 0 disables remote debugging.
    std::filesystem::path content_root, profile_root;
    std::function<std::wstring(std::wstring_view method, std::wstring_view payload)> dispatch;
    std::function<bool()> can_dispatch;
    std::function<bool(std::wstring_view method)> retain_on_close;
};
bool initialize(SPBasicSuite*, AEGP_PluginID, Config) noexcept;
bool step() noexcept;
void stop() noexcept;
}
