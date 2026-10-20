# scripts/install-desktop-launcher.ps1
# Compila o executavel nativo Benito.exe (com Windows Job Object KILL_ON_JOB_CLOSE e CtrlCloseHandler)
# e instala diretamente na Area de Trabalho do usuario.

param (
    [string]$IconPath = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path "$PSScriptRoot/..").Path
$DesktopDir = [Environment]::GetFolderPath("Desktop")
$DesktopExePath = Join-Path $DesktopDir "Benito.exe"
$LocalExePath = Join-Path $ProjectRoot "Benito.exe"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   INSTALADOR DO EXECUTAVEL UNICO - BENITO.EXE    " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "• Diretorio do Projeto: $ProjectRoot" -ForegroundColor Gray
Write-Host "• Area de Trabalho:     $DesktopExePath" -ForegroundColor Gray

# Localiza o compilador C# nativo do Windows (.NET Framework 4.x)
$CscPaths = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$CscExe = $CscPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $CscExe) {
    throw "Compilador C# nativo do Windows (csc.exe) nao encontrado."
}

$EscapedRoot = $ProjectRoot.Replace("\", "\\")

$CSharpSource = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace BenitoLauncher
{
    class Program
    {
        private static readonly string ProjectRoot = "$EscapedRoot";
        private static Process childProcess = null;
        private static bool cleanedUp = false;
        private static readonly object cleanupLock = new object();

        // Win32 Console Ctrl Handler (captura clique no X da janela, Ctrl+C, Shutdown)
        private delegate bool ConsoleCtrlDelegate(int sig);
        [DllImport("Kernel32")]
        private static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate handler, bool add);
        private static ConsoleCtrlDelegate ctrlHandler;

        // Win32 Job Object (garante no Kernel do Windows que nenhum processo filho fique orfao)
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll")]
        private static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public Int64 PerProcessUserTimeLimit;
            public Int64 PerJobUserTimeLimit;
            public UInt32 LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public UInt32 ActiveProcessLimit;
            public UIntPtr Affinity;
            public UInt32 PriorityClass;
            public UInt32 SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct IO_COUNTERS
        {
            public UInt64 ReadOperationCount;
            public UInt64 WriteOperationCount;
            public UInt64 OtherOperationCount;
            public UInt64 ReadTransferCount;
            public UInt64 WriteTransferCount;
            public UInt64 OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
        private const int JobObjectExtendedLimitInformation = 9;
        private static IntPtr jobHandle = IntPtr.Zero;

        private static void SetupKernelJobObject()
        {
            try
            {
                jobHandle = CreateJobObject(IntPtr.Zero, null);
                if (jobHandle != IntPtr.Zero)
                {
                    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                    int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                    IntPtr extendedInfoPtr = Marshal.AllocHGlobal(length);
                    try
                    {
                        Marshal.StructureToPtr(info, extendedInfoPtr, false);
                        SetInformationJobObject(jobHandle, JobObjectExtendedLimitInformation, extendedInfoPtr, (uint)length);
                        AssignProcessToJobObject(jobHandle, Process.GetCurrentProcess().Handle);
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(extendedInfoPtr);
                    }
                }
            }
            catch
            {
                // Ignora se ja estiver dentro de um Job restrito do Windows
            }
        }

        private static void RunSilentCommand(string fileName, string arguments, int timeoutMs)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    WorkingDirectory = ProjectRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using (var p = Process.Start(psi))
                {
                    if (p != null)
                    {
                        p.WaitForExit(timeoutMs);
                    }
                }
            }
            catch
            {
                // Ignora erros de processos ja fechados
            }
        }

        private static bool IsSearxngConfigured()
        {
            try
            {
                string envPath = Path.Combine(ProjectRoot, ".env");
                if (!File.Exists(envPath)) return false;
                foreach (var line in File.ReadAllLines(envPath))
                {
                    string trimmed = line.Trim();
                    if (trimmed.StartsWith("#") || !trimmed.Contains("=")) continue;
                    var parts = trimmed.Split(new char[] { '=' }, 2);
                    if (parts[0].Trim() == "SEARCH_PROVIDER" && parts[1].Trim().ToLowerInvariant().Contains("searxng"))
                    {
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static void CleanupAllDependencies()
        {
            lock (cleanupLock)
            {
                if (cleanedUp) return;
                cleanedUp = true;
            }

            try
            {
                if (childProcess != null && !childProcess.HasExited)
                {
                    RunSilentCommand("taskkill.exe", "/F /T /PID " + childProcess.Id, 2500);
                }
            }
            catch { }

            // Garante encerramento do servidor de embeddings (llama-server.exe)
            RunSilentCommand("taskkill.exe", "/F /IM llama-server.exe /T", 2500);

            // Garante encerramento total do Ollama (libera 100% da VRAM e RAM)
            RunSilentCommand("taskkill.exe", "/F /IM \"ollama app.exe\" /T", 2500);
            RunSilentCommand("taskkill.exe", "/F /IM ollama.exe /T", 2500);

            // Se SearXNG estiver configurado como provedor de busca, para o container
            if (IsSearxngConfigured())
            {
                RunSilentCommand("docker.exe", "stop searxng", 4000);
            }
        }

        private static bool OnConsoleCtrlEvent(int sig)
        {
            // sig: 0 = CTRL_C, 1 = CTRL_BREAK, 2 = CTRL_CLOSE (X da janela), 5 = LOGOFF, 6 = SHUTDOWN
            if (sig == 2 || sig == 5 || sig == 6)
            {
                CleanupAllDependencies();
            }
            return false;
        }

        static int Main(string[] args)
        {
            try
            {
                Console.Title = "Benito - Agente Pessoal Local";
                Console.OutputEncoding = Encoding.UTF8;
                Console.InputEncoding = Encoding.UTF8;
            }
            catch { }

            SetupKernelJobObject();

            ctrlHandler = new ConsoleCtrlDelegate(OnConsoleCtrlEvent);
            SetConsoleCtrlHandler(ctrlHandler, true);
            AppDomain.CurrentDomain.ProcessExit += (s, e) => CleanupAllDependencies();

            if (!Directory.Exists(ProjectRoot))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Erro: Diretorio do projeto nao encontrado em: " + ProjectRoot);
                Console.ResetColor();
                Console.WriteLine("Pressione qualquer tecla para sair...");
                Console.ReadKey();
                return 1;
            }

            Directory.SetCurrentDirectory(ProjectRoot);

            string forwardedArgs = args.Length > 0 ? " " + string.Join(" ", args) : "";
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c npx tsx src/launcher.ts" + forwardedArgs,
                WorkingDirectory = ProjectRoot,
                UseShellExecute = false
            };

            try
            {
                childProcess = Process.Start(psi);
                if (childProcess != null)
                {
                    childProcess.WaitForExit();
                    int code = childProcess.ExitCode;
                    CleanupAllDependencies();
                    return code;
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Falha ao iniciar o Benito: " + ex.Message);
                Console.ResetColor();
                CleanupAllDependencies();
                return 1;
            }

            CleanupAllDependencies();
            return 0;
        }
    }
}
"@

$TempCsFile = Join-Path $env:TEMP "BenitoLauncherBuild.cs"
Set-Content -Path $TempCsFile -Value $CSharpSource -Encoding UTF8

# Converte PNG/JPG/BMP automaticamente para .ico (256x256) se necessario
function Convert-ImageToIco([string]$SourceImage, [string]$DestIco) {
    Add-Type -AssemblyName System.Drawing
    $srcBitmap = [System.Drawing.Bitmap]::FromFile($SourceImage)
    $resized = New-Object System.Drawing.Bitmap(256, 256)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcBitmap, 0, 0, 256, 256)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = $ms.ToArray()
    $ms.Dispose()
    $resized.Dispose()
    $srcBitmap.Dispose()

    $fs = [System.IO.File]::OpenWrite($DestIco)
    $bw = New-Object System.IO.BinaryWriter($fs)
    # Cabecalho ICONDIR (6 bytes)
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]1)
    # Entrada ICONDIRENTRY (16 bytes) -> 0 representa 256px
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$pngBytes.Length)
    $bw.Write([UInt32]22)
    # Dados PNG
    $bw.Write($pngBytes)
    $bw.Flush()
    $bw.Close()
    $fs.Close()
}

$AssetsDir = Join-Path $ProjectRoot "assets"
if (-not (Test-Path $AssetsDir)) {
    New-Item -ItemType Directory -Path $AssetsDir -Force | Out-Null
}

# Descobre a imagem caso nao tenha sido passada por parametro
if (-not $IconPath) {
    $CandidatePaths = @(
        (Join-Path $AssetsDir "icon.ico"),
        (Join-Path $AssetsDir "icon.png"),
        (Join-Path $AssetsDir "icon.jpg"),
        (Join-Path $AssetsDir "icon.jpeg"),
        (Join-Path $AssetsDir "benito.ico"),
        (Join-Path $AssetsDir "benito.png"),
        (Join-Path $AssetsDir "benito.jpg"),
        (Join-Path $ProjectRoot "icon.ico"),
        (Join-Path $ProjectRoot "icon.png"),
        (Join-Path $ProjectRoot "icon.jpg")
    )
    $IconPath = $CandidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

$FinalIcoPath = $null
if ($IconPath -and (Test-Path $IconPath)) {
    $ResolvedImg = (Resolve-Path $IconPath).Path
    $Ext = [System.IO.Path]::GetExtension($ResolvedImg).ToLowerInvariant()
    if ($Ext -eq ".ico") {
        $FinalIcoPath = $ResolvedImg
        Write-Host "• Icone .ico detectado: $FinalIcoPath" -ForegroundColor Green
    } else {
        $FinalIcoPath = Join-Path $AssetsDir "icon.ico"
        Write-Host "• Convertendo imagem ($ResolvedImg) para formato .ico (256x256)..." -ForegroundColor Cyan
        Convert-ImageToIco -SourceImage $ResolvedImg -DestIco $FinalIcoPath
        Write-Host "• Icone gerado com sucesso: $FinalIcoPath" -ForegroundColor Green
    }
}

Write-Host "`n[1/2] Compilando Benito.exe nativo (x64) com protecao Job Object..." -ForegroundColor Cyan
if ($FinalIcoPath -and (Test-Path $FinalIcoPath)) {
    & $CscExe /nologo /target:exe /optimize+ /platform:anycpu /win32icon:"$FinalIcoPath" /out:"$LocalExePath" "$TempCsFile"
} else {
    & $CscExe /nologo /target:exe /optimize+ /platform:anycpu /out:"$LocalExePath" "$TempCsFile"
}
if ($LASTEXITCODE -ne 0) {
    Remove-Item $TempCsFile -Force -ErrorAction SilentlyContinue
    throw "Falha na compilacao do Benito.exe"
}
Remove-Item $TempCsFile -Force -ErrorAction SilentlyContinue

Write-Host "[2/2] Copiando Benito.exe para a Area de Trabalho..." -ForegroundColor Cyan
Copy-Item -Path $LocalExePath -Destination $DesktopExePath -Force

# Atualiza o cache de icones do Windows Explorer imediatamente (SHChangeNotify)
try {
    $ShellNotifyCode = @"
using System;
using System.Runtime.InteropServices;
public class ShellIconRefresh {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
    public static void Refresh() {
        SHChangeNotify(0x08000000, 0x0000, IntPtr.Zero, IntPtr.Zero);
    }
}
"@
    Add-Type -TypeDefinition $ShellNotifyCode -ErrorAction SilentlyContinue
    [ShellIconRefresh]::Refresh()
    & ie4uinit.exe -show | Out-Null
} catch { }

Write-Host "`n[OK] Executavel instalado com sucesso!" -ForegroundColor Green
Write-Host "  • Na Area de Trabalho: $DesktopExePath" -ForegroundColor Green
Write-Host "  • Na Raiz do Projeto:  $LocalExePath`n" -ForegroundColor Gray
