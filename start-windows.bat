@echo off
echo ===============================================
echo Starting VibeToText (Windows Edition)
echo ===============================================
echo.
echo WORKING HOTKEYS FOR WINDOWS:
echo   Ctrl+Shift       - Raw transcription (auto-paste)
echo   Alt+Shift        - Will fail (needs Gemini API)
echo.
echo NOTE: Greppy and Plan modes use 'cmd' key which
echo doesn't exist on Windows. Only Ctrl+Shift works!
echo.
echo Press Ctrl+C here to stop VibeToText
echo ===============================================
echo.

"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" ^
  --model base ^
  --hotkey "ctrl+shift" ^
  --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

pause
