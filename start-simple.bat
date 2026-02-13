@echo off
echo ===============================================
echo VibeToText - SIMPLE MODE (Ctrl+Shift only)
echo ===============================================
echo.
echo Killing old processes...
taskkill /F /IM vibetotext.exe 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq vibetotext*" 2>nul
timeout /t 1 /nobreak >nul
echo.
echo Clearing old logs...
del "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log" 2>nul
echo.
echo CONFIGURATION:
echo  - ONLY Ctrl+Shift hotkey enabled (basic transcription)
echo  - Greppy/Cleanup/Plan modes DISABLED
echo  - Text will auto-paste after transcription
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
echo.

REM Disable all other hotkeys by setting them to impossible combinations
REM This ensures ONLY ctrl+shift works for basic transcription
"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+shift" ^
  --greppy-hotkey "f24" ^
  --cleanup-hotkey "f23" ^
  --plan-hotkey "f22" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

pause
