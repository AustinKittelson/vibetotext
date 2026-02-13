@echo off
echo Starting VibeToText...
echo.
echo Available hotkeys:
echo   Ctrl+Shift       - Raw transcription
echo   Cmd+Shift        - Greppy mode (semantic code search)
echo.
echo Press Ctrl+C in this window to stop VibeToText
echo.

"C:\Users\Lars\AppData\Local\Programs\Python\Python312\Scripts\vibetotext.exe" --model base --codebase "C:\Users\Lars\Documents\Repos\Lars-OpenClaw"

pause
