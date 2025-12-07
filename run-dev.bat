@echo off
ECHO Starting the development server and opening the browser...

REM Start the Next.js development server
start "MechQuote Dev Server" npm run dev

REM Wait for a few seconds to give the server time to start up
timeout /t 8 /nobreak > nul

REM Open the default browser to the correct URL
start http://localhost:9002

ECHO The server is running in a separate window.
