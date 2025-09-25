$ErrorActionPreference = "Stop"

# Paths
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srv  = Join-Path $repo "server"
$venv = Join-Path $env:LOCALAPPDATA "tonify-tts\venv"
$envFile = Join-Path $srv ".env"
$modelDir = Join-Path $env:USERPROFILE ".local\share\piper-voices\zh_CN"
New-Item -ItemType Directory -Force -Path $modelDir | Out-Null

# Create venv and install deps
if (!(Test-Path $venv)) {
  py -m venv $venv
}
& "$venv\Scripts\pip.exe" install --upgrade pip
& "$venv\Scripts\pip.exe" install -r (Join-Path $srv "requirements.txt")

# .env
Copy-Item (Join-Path $srv ".env.example") $envFile -Force
(Get-Content $envFile) -replace "%USER_HOME%", $env:USERPROFILE | Set-Content $envFile

# Piper binary on Windows is usually piper-tts.exe. If not in PATH, user must install it manually.
if (-not (Get-Command "piper-tts.exe" -ErrorAction SilentlyContinue)) {
  Write-Host "piper-tts.exe not found in PATH. Install Piper and update PIPER_BIN in .env if needed."
}

# Download Mandarin model if missing
$onnx = Join-Path $modelDir "zh_CN-huayan-medium.onnx"
$json = "$onnx.json"
if (!(Test-Path $onnx) -or !(Test-Path $json)) {
  Write-Host "Downloading zh_CN huayan medium model"
  Invoke-WebRequest -UseBasicParsing -Uri "https://huggingface.co/csukuangfj/vits-piper-zh_CN-huayan-medium/resolve/main/zh_CN-huayan-medium.onnx?download=true" -OutFile $onnx
  Invoke-WebRequest -UseBasicParsing -Uri "https://huggingface.co/csukuangfj/vits-piper-zh_CN-huayan-medium/resolve/main/zh_CN-huayan-medium.onnx.json?download=true" -OutFile $json
}
# Update PIPER_MODEL in .env
$content = Get-Content $envFile
$content = $content -replace "^PIPER_MODEL=.*$", "PIPER_MODEL=$onnx"
if ($content -notmatch "^PIPER_MODEL=") { $content += "`nPIPER_MODEL=$onnx" }
Set-Content $envFile $content

# Register a Task Scheduler entry to start the bridge at logon
$taskName = "Tonify-Piper-Bridge"
$batFull = Join-Path $repo "scripts\run_local_bridge.bat"

$action = New-ScheduledTaskAction -Execute "$batFull"
$trigger = New-ScheduledTaskTrigger -AtLogOn
try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
} catch {}
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName $taskName -Description "Tonify Piper local bridge" -RunLevel LeastPrivilege

Write-Host "OK. To start now, run: $batFull"
Write-Host "The bridge will also start automatically at logon."
