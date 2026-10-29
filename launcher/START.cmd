@echo off
setlocal
set "APP=%~dp0WaveDromStudio.html"
if not exist "%APP%" (
  echo WaveDromStudio.html was not found next to this launcher.
  echo Keep START.cmd and WaveDromStudio.html in the same folder.
  pause
  exit /b 1
)
start "" "%APP%"
endlocal
