@echo off
echo ===============================================
echo VibeToText - FIXED VERSION
echo ===============================================
echo.
echo FIXES APPLIED:
echo  ✓ Fixed Windows hotkey detection (ctrl_l/shift_l issue)
echo  ✓ Added debug output for UI launch
echo.
echo Step 1: Killing any old vibetotext processes...
taskkill /F /IM vibetotext.exe 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq vibetotext*" 2>nul
timeout /t 1 /nobreak >nul
echo.
echo Step 2: Clearing old logs...
del "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log" 2>nul
del "C:\Users\Lars\AppData\Local\Temp\vibetotext_crash.log" 2>nul
del "C:\Users\Lars\AppData\Local\Temp\vibetotext_ui_error.log" 2>nul
echo.
echo Step 3: Starting VibeToText with FIXES...
echo.
echo WHAT TO EXPECT:
echo  1. Model will load (15 seconds)
echo  2. You'll see "vibetotext ready"
echo  3. A small floating window should appear at screen bottom
echo  4. Press and HOLD Ctrl+Shift
echo  5. Speak clearly into your microphone
echo  6. RELEASE Ctrl+Shift to stop recording
echo  7. Watch for [HOTKEY] and [UI] messages in this window
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
echo.
echo ===============================================
echo.

"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+shift" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

echo.
echo.
echo ===============================================
echo VibeToText stopped.
echo.
echo Checking logs...
echo.
if exist "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log" (
    echo DEBUG LOG:
    type "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log"
    echo.
)
if exist "C:\Users\Lars\AppData\Local\Temp\vibetotext_crash.log" (
    echo CRASH LOG:
    type "C:\Users\Lars\AppData\Local\Temp\vibetotext_crash.log"
    echo.
)
pause
