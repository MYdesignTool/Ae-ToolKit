#include "AEConfig.h"
resource 'PiPL' (16001) {
    {
        Kind { AEGP },
        Name { "AE Local Toolkit WebView2" },
        Category { "General Plugin" },
        Version { 65536 },
#ifdef AE_OS_WIN
        CodeWin64X86 { "AeltToolkitEntry" },
#endif
    }
};
