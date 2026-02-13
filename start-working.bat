@echo off
echo ===============================================
echo VibeToText - WORKING VERSION
echo ===============================================
echo.
echo Using the hotkey combo you said works:
echo   Ctrl + Shift + Windows key
echo.
echo Killing old processes...
taskkill /F /IM vibetotext.exe 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq vibetotext*" 2>nul
timeout /t 1 /nobreak >nul
echo.
echo INSTRUCTIONS:
echo 1. Wait for "vibetotext ready"
echo 2. Press and HOLD: Ctrl + Shift + Windows key
echo 3. Speak clearly into microphone
echo 4. RELEASE all keys to transcribe
echo 5. Text auto-pastes to cursor
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
echo.

REM Set hotkey to the combination that works: ctrl+shift+cmd
REM (cmd = Windows key on Windows)
"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+shift+cmd" ^
  --greppy-hotkey "f24" ^
  --cleanup-hotkey "f23" ^
  --plan-hotkey "f22" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

pause
