param([Parameter(Mandatory=$true)][string]$Plugin)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ProbeResourceReader {
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr LoadLibraryEx(string file,IntPtr reserved,uint flags);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr FindResource(IntPtr module,IntPtr name,string type);
  [DllImport("kernel32.dll")]static extern IntPtr LoadResource(IntPtr module,IntPtr resource);
  [DllImport("kernel32.dll")]static extern IntPtr LockResource(IntPtr resource);
  [DllImport("kernel32.dll")]static extern uint SizeofResource(IntPtr module,IntPtr resource);
  [DllImport("kernel32.dll")]static extern bool FreeLibrary(IntPtr module);
  public static byte[] Read(string file) {
    IntPtr module=LoadLibraryEx(file,IntPtr.Zero,0x22);if(module==IntPtr.Zero)throw new Exception("Resource-only load failed");
    try {IntPtr resource=FindResource(module,new IntPtr(16000),"PiPL");if(resource==IntPtr.Zero)throw new Exception("PiPL missing");
      var bytes=new byte[SizeofResource(module,resource)];Marshal.Copy(LockResource(LoadResource(module,resource)),bytes,0,bytes.Length);return bytes;
    } finally {FreeLibrary(module);}
  }
}
'@
$probeBytes=[ProbeResourceReader]::Read([IO.Path]::GetFullPath($Plugin))
$probeStream=[IO.MemoryStream]::new($probeBytes)
$probeReader=[IO.BinaryReader]::new($probeStream)
try {
    if($probeReader.ReadUInt16() -ne 1 -or $probeReader.ReadUInt32() -ne 0 -or $probeReader.ReadUInt32() -ne 5){throw 'Incorrect Windows PiPL header'}
    $probeProperties=@{}
    for($probeIndex=0;$probeIndex -lt 5;$probeIndex++) {
        if([Text.Encoding]::ASCII.GetString($probeReader.ReadBytes(4)) -cne 'MIB8'){throw 'Unexpected property vendor'}
        $probeKeyBytes=$probeReader.ReadBytes(4);[Array]::Reverse($probeKeyBytes);$probeKey=[Text.Encoding]::ASCII.GetString($probeKeyBytes)
        if($probeReader.ReadUInt32() -ne 0){throw 'Unexpected property index'}
        $probeLength=$probeReader.ReadUInt32();if($probeLength -eq 0 -or ($probeLength % 4) -ne 0 -or $probeLength -gt 4096){throw 'Incorrect property size'}
        if($probeProperties.ContainsKey($probeKey)){throw 'Duplicate PiPL property'}
        $probeProperties[$probeKey]=$probeReader.ReadBytes($probeLength)
    }
    if($probeStream.Position -ne $probeStream.Length){throw 'Unexpected PiPL trailing data'}
    if([Text.Encoding]::ASCII.GetString($probeProperties['kind']) -cne 'xgEA'){throw 'Not a General AEGP'}
    if([Text.Encoding]::ASCII.GetString($probeProperties['8664']).TrimEnd([char]0) -cne 'AeltInputProbeEntry'){throw 'Entry point mismatch'}
    if([BitConverter]::ToUInt32($probeProperties['vers'],0) -ne 65536){throw 'Version mismatch'}
    $probeName=$probeProperties['name'];if([Text.Encoding]::ASCII.GetString($probeName,1,$probeName[0]) -cne 'AeLocalToolkit Input Probe'){throw 'Plugin name mismatch'}
    $probeCategory=$probeProperties['catg'];if([Text.Encoding]::ASCII.GetString($probeCategory,1,$probeCategory[0]) -cne 'General Plugin'){throw 'Category mismatch'}
    Write-Output 'PASS: actual AEX resource has five correct, aligned General AEGP properties and independent plugin identity; module code was not executed.'
} finally {$probeReader.Dispose();$probeStream.Dispose()}
