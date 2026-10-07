# scripts/start-embedding-server.ps1
# Launcher dedicado para o modelo EmbeddingGemma 2 (GGUF) via llama-server para o Benito

param (
    [int]$Port = 8085,
    [int]$ContextSize = 4096,
    [int]$BatchSize = 4096,
    [int]$ParallelSlots = 1,
    [int]$GpuLayers = 99,
    [string]$ModelFile = "embeddinggemma-2-Q8_0.gguf"
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path "$PSScriptRoot/.."
$ModelsDir = Join-Path $RootDir ".models"
$BinDir = Join-Path $ModelsDir "bin"
$ModelPath = Join-Path $ModelsDir $ModelFile

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   BENITO - SERVICO DE EMBEDDINGS (LLAMA-SERVER)  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Garante existencia dos diretorios
if (-not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
}
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# 2. Localiza llama-server.exe
$LlamaServerExe = $null

$SystemLlama = Get-Command "llama-server.exe" -ErrorAction SilentlyContinue
if ($SystemLlama) {
    $LlamaServerExe = $SystemLlama.Source
} elseif (Test-Path (Join-Path $BinDir "llama-server.exe")) {
    $LlamaServerExe = Join-Path $BinDir "llama-server.exe"
}

if (-not $LlamaServerExe) {
    Write-Host "`n[1/3] llama-server.exe nao encontrado localmente." -ForegroundColor Yellow
    Write-Host "Localizando release recente do llama.cpp para Windows x64..." -ForegroundColor Cyan

    $ZipPath = Join-Path $BinDir "llama-server-win-x64.zip"
    $DownloadUrl = $null

    try {
        $Releases = Invoke-RestMethod -Uri "https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=10" -Headers @{ "User-Agent" = "BenitoAgent/1.0" }
        foreach ($rel in $Releases) {
            if ($rel.assets) {
                $asset = $rel.assets | Where-Object { $_.name -like "*bin-win-cpu-x64.zip" } | Select-Object -First 1
                if ($asset) {
                    $DownloadUrl = $asset.browser_download_url
                    Write-Host "Encontrada versao $($rel.tag_name): $($asset.name)" -ForegroundColor Gray
                    break
                }
            }
        }
    } catch {
        Write-Host "Aviso: Nao foi possivel consultar API do GitHub. Tentando download direto..." -ForegroundColor Yellow
    }

    if (-not $DownloadUrl) {
        $DownloadUrl = "https://github.com/ggerganov/llama.cpp/releases/download/b11457/llama-b11457-bin-win-cpu-x64.zip"
    }

    try {
        Write-Host "Baixando de: $DownloadUrl" -ForegroundColor Cyan
        if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) {
            & curl.exe -L -o "$ZipPath" "$DownloadUrl"
        } else {
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing
        }

        Write-Host "Extraindo arquivos..." -ForegroundColor Cyan
        Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
        Remove-Item $ZipPath -Force

        if (Test-Path (Join-Path $BinDir "llama-server.exe")) {
            $LlamaServerExe = Join-Path $BinDir "llama-server.exe"
            Write-Host "[OK] llama-server instalado com sucesso em: $BinDir" -ForegroundColor Green
        } else {
            throw "llama-server.exe nao encontrado apos extrair o arquivo compactado."
        }
    } catch {
        Write-Host "[ERRO] Nao foi possivel baixar automaticamente o llama.cpp: $_" -ForegroundColor Red
        Write-Host "Por favor, baixe o llama-server manualmente de https://github.com/ggerganov/llama.cpp/releases e coloque em '$BinDir\llama-server.exe'." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[OK] Binario llama-server localizado: $LlamaServerExe" -ForegroundColor Green
}

# 3. Verifica o Modelo GGUF (EmbeddingGemma 2)
if (-not (Test-Path $ModelPath)) {
    Write-Host "`n[2/3] Modelo $ModelFile nao encontrado em $ModelsDir." -ForegroundColor Yellow
    Write-Host "Baixando 'unsloth/embeddinggemma-2-GGUF' (Q8_0, ~309MB) do Hugging Face..." -ForegroundColor Cyan
    
    $ModelUrl = "https://huggingface.co/unsloth/embeddinggemma-2-GGUF/resolve/main/embeddinggemma-2-Q8_0.gguf"
    try {
        Write-Host "Baixando de: $ModelUrl" -ForegroundColor Cyan
        if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) {
            & curl.exe -L -o "$ModelPath" "$ModelUrl"
        } else {
            Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelPath -UseBasicParsing
        }
        Write-Host "[OK] Modelo GGUF baixado com sucesso: $ModelPath" -ForegroundColor Green
    } catch {
        Write-Host "[ERRO] Falha ao baixar o modelo GGUF: $_" -ForegroundColor Red
        Write-Host "Voce pode baixa-lo manualmente em: $ModelUrl e salvar em '$ModelPath'." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[OK] Modelo GGUF localizado: $ModelPath" -ForegroundColor Green
}

# 4. Inicia o llama-server com as flags de embeddings
Write-Host "`n[3/3] Iniciando llama-server na porta $Port..." -ForegroundColor Cyan
Write-Host "  Endpoint OpenAI: http://127.0.0.1:$Port/v1/embeddings" -ForegroundColor Gray
Write-Host "  Contexto (ctx):  $ContextSize tokens" -ForegroundColor Gray
Write-Host "  GPU Layers:      $GpuLayers" -ForegroundColor Gray
Write-Host "  Modo:            --embedding" -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para encerrar o servico.`n" -ForegroundColor Yellow

& $LlamaServerExe --port $Port --embedding --model "$ModelPath" -np $ParallelSlots -c $ContextSize -b $BatchSize -ub $BatchSize -ngl $GpuLayers --host 127.0.0.1
