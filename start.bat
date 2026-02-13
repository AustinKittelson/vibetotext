@echo off
echo ===============================================
echo           VibeToText for Windows
echo ===============================================
echo.
echo HOTKEY: Ctrl + Space
echo   - Tap once to START recording
echo   - Tap again to STOP and transcribe
echo   - Press ESC to cancel recording
echo.
echo Text auto-pastes to your cursor after transcription.
echo Keep this window open while using VibeToText.
echo Press Ctrl+C here to quit.
echo.
echo ===============================================
echo.

REM Kill any old processes
taskkill /F /IM vibetotext.exe >nul 2>&1
timeout /t 1 /nobreak >nul

REM Start VibeToText with Ctrl+Space toggle mode
"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+space" ^
  --greppy-hotkey "f24" ^
  --cleanup-hotkey "f23" ^
  --plan-hotkey "f22" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

echo.
echo VibeToText stopped.
pause
