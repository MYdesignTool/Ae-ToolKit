#include "AEConfig.h"
resource 'PiPL' (16000) {
    {
        Kind { AEGP },
        Name { "AeLocalToolkit Input Probe" },
        Category { "General Plugin" },
        Version { 65536 },
#ifdef AE_OS_WIN
        CodeWin64X86 { "AeltInputProbeEntry" },
#endif
    }
};
