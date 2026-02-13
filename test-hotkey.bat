@echo off
echo Testing VibeToText Hotkey Detection
echo ===================================
echo.
echo Step 1: Checking for log files...
echo.
if exist "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log" (
    echo DEBUG LOG FOUND:
    type "C:\Users\Lars\AppData\Local\Temp\vibetotext_debug.log"
    echo.
) else (
    echo No debug log found.
)
echo.
if exist "C:\Users\Lars\AppData\Local\Temp\vibetotext_crash.log" (
    echo CRASH LOG FOUND:
    type "C:\Users\Lars\AppData\Local\Temp\vibetotext_crash.log"
    echo.
) else (
    echo No crash log found.
)
echo.
if exist "C:\Users\Lars\AppData\Local\Temp\vibetotext_ui_error.log" (
    echo UI ERROR LOG FOUND:
    type "C:\Users\Lars\AppData\Local\Temp\vibetotext_ui_error.log"
    echo.
) else (
    echo No UI error log found.
)
echo.
echo Step 2: Testing if pynput is installed...
python -c "import pynput; print('pynput version:', pynput.__version__)"
echo.
echo Step 3: Testing if tkinter is available...
python -c "import tkinter; print('tkinter available')"
echo.
pause
