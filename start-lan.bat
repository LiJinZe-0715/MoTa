@echo off
cd /d "%~dp0"
python tools/serve.py --bind 0.0.0.0 --port 8123
echo.
echo Server stopped.
pause
