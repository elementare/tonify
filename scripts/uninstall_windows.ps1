$ErrorActionPreference = "Stop"
$taskName = "Tonify-Piper-Bridge"
try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false } catch {}

$venv = Join-Path $env:LOCALAPPDATA "tonify-tts\venv"
$ans = Read-Host "Remove the Python venv at $venv? [y/N]"
if ($ans -eq "y" -or $ans -eq "Y") {
  Remove-Item -Recurse -Force $venv
  Write-Host "Venv removed."
}
Write-Host "Uninstall complete."
