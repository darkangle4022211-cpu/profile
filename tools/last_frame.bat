@echo off
REM ==============================================================================
REM AURA — tools/last_frame.bat (Windows)
REM Extracts the exact final frame of Clip A to use as start frame for Clip B
REM ==============================================================================

setlocal enabledelayedexpansion

REM Verify ffmpeg
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo ERROR: ffmpeg is not installed or not found in your PATH.
    echo Please install ffmpeg using winget in PowerShell or Command Prompt:
    echo     winget install ffmpeg
    echo Then restart your terminal window.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

set "INPUT_CLIP=source\clipA.mp4"
set "OUTPUT_FRAME=source\clipA_last.png"

if not exist "%INPUT_CLIP%" (
    echo.
    echo ERROR: Input file '%INPUT_CLIP%' was not found.
    echo Please place your exported Clip A video at: %INPUT_CLIP%
    echo.
    pause
    exit /b 1
)

echo Extracting final frame from %INPUT_CLIP% -^> %OUTPUT_FRAME%...

ffmpeg -y -sseof -0.2 -i "%INPUT_CLIP%" -update 1 -q:v 1 "%OUTPUT_FRAME%"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Saved final frame to %OUTPUT_FRAME%
    echo You can now upload %OUTPUT_FRAME% as the start frame for Clip B in Google Flow.
    echo.
) else (
    echo.
    echo ERROR: Failed to extract final frame. Check ffmpeg output above.
    echo.
)

endlocal
