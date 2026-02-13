@echo off
echo ===============================================
echo VibeToText - VERBOSE DEBUG MODE
echo ===============================================
echo.
echo This mode shows EVERY key press to help diagnose the issue
echo.
echo Killing old processes...
taskkill /F /IM vibetotext.exe 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq vibetotext*" 2>nul
timeout /t 1 /nobreak >nul
echo.
echo INSTRUCTIONS:
echo 1. Wait for "vibetotext ready"
echo 2. Press Ctrl+Shift (the combo that DOESN'T work)
echo 3. Watch the [KEY] messages to see what's detected
echo 4. Release the keys
echo 5. Then try Ctrl+Shift+Windows (the combo that DOES work)
echo 6. Compare the [KEY] messages
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
echo.

"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+shift" ^
  --greppy-hotkey "f24" ^
  --cleanup-hotkey "f23" ^
  --plan-hotkey "f22" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

pause
