# scripts/start-embedding-server.ps1
# Launcher dedicado para o modelo EmbeddingGemma 2 (GGUF) via llama-server para o Benito

param (
    [int]$Port = 8085,
    [int]$ContextSize = 8192,
    [int]$GpuLayers = 99,
    [string]$ModelFile = "embeddinggemma-2-Q8_0.gguf"
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path "$PSScriptRoot/.."
$ModelsDir = Join-Path $RootDir ".models"
$BinDir = Join-Path $ModelsDir "bin"
$ModelPath = Join-Path $ModelsDir $ModelFile

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   BENITO - SERVIÇO DE EMBEDDINGS (LLAMA-SERVER)  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Garante existência dos diretórios
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
    Write-Host "`n[1/3] llama-server.exe não encontrado localmente." -ForegroundColor Yellow
    Write-Host "Baixando pre-built release do llama.cpp para Windows x64..." -ForegroundColor Cyan

    $ZipPath = Join-Path $BinDir "llama-b-win-x64.zip"
    $DownloadUrl = "https://github.com/ggerganov/llama.cpp/releases/latest/download/llama-b-win-x64.zip"
    
    try {
        Write-Host "Baixando de: $DownloadUrl" -ForegroundColor Gray
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing
        Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
        Remove-Item $ZipPath -Force
        $LlamaServerExe = Join-Path $BinDir "llama-server.exe"
        Write-Host "✔ llama-server instalado com sucesso em: $BinDir" -ForegroundColor Green
    } catch {
        Write-Host "✖ Não foi possível baixar automaticamente o llama.cpp: $_" -ForegroundColor Red
        Write-Host "Por favor, baixe o llama-server manualmente de https://github.com/ggerganov/llama.cpp/releases e coloque em '$BinDir\llama-server.exe'." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✔ Binário llama-server localizado: $LlamaServerExe" -ForegroundColor Green
}

# 3. Verifica o Modelo GGUF (EmbeddingGemma 2)
if (-not (Test-Path $ModelPath)) {
    Write-Host "`n[2/3] Modelo $ModelFile não encontrado em $ModelsDir." -ForegroundColor Yellow
    Write-Host "Baixando 'unsloth/embeddinggemma-2-GGUF' (Q8_0, ~800MB) do Hugging Face..." -ForegroundColor Cyan
    
    $ModelUrl = "https://huggingface.co/unsloth/embeddinggemma-2-GGUF/resolve/main/embeddinggemma-2-Q8_0.gguf"
    try {
        Write-Host "Baixando de: $ModelUrl" -ForegroundColor Gray
        Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelPath -UseBasicParsing
        Write-Host "✔ Modelo GGUF baixado com sucesso: $ModelPath" -ForegroundColor Green
    } catch {
        Write-Host "✖ Falha ao baixar o modelo GGUF: $_" -ForegroundColor Red
        Write-Host "Você pode baixá-lo manualmente em: $ModelUrl e salvar em '$ModelPath'." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✔ Modelo GGUF localizado: $ModelPath" -ForegroundColor Green
}

# 4. Inicia o llama-server com as flags de embeddings
Write-Host "`n[3/3] Iniciando llama-server na porta $Port..." -ForegroundColor Cyan
Write-Host "• Endpoint OpenAI: http://127.0.0.1:$Port/v1/embeddings" -ForegroundColor Gray
Write-Host "• Contexto (ctx):  $ContextSize tokens" -ForegroundColor Gray
Write-Host "• GPU Layers:      $GpuLayers (RTX 4070 Ti)" -ForegroundColor Gray
Write-Host "• Modo:            --embedding" -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para encerrar o serviço.`n" -ForegroundColor Yellow

$LlamaArgs = @(
    "--port", $Port,
    "--embedding",
    "--model", "`"$ModelPath`"",
    "-c", $ContextSize,
    "-ngl", $GpuLayers,
    "--host", "127.0.0.1"
)

& $LlamaServerExe --port $Port --embedding --model "$ModelPath" -c $ContextSize -ngl $GpuLayers --host 127.0.0.1
