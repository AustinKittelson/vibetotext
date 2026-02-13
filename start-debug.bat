@echo off
echo ===============================================
echo VibeToText DEBUG MODE
echo ===============================================
echo.
echo Step 1: Checking logs from previous run...
echo.
if exist "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log" (
    echo Last 10 lines of debug log:
    powershell -Command "Get-Content 'C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log' -Tail 10"
    echo.
    echo Clearing old debug log...
    del "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log"
)
echo.
echo Step 2: Starting VibeToText...
echo.
echo IMPORTANT:
echo   - A small floating window should appear at the bottom of your screen
echo   - Press and HOLD Ctrl+Shift, speak, then RELEASE to transcribe
echo   - Watch this terminal for [HOTKEY] messages
echo.
pause
echo.

"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+shift" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

pause
