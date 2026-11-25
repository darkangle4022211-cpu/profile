@echo off
REM ==============================================================================
REM AURA — tools/make_frames.bat (Windows)
REM Normalizes Clip A and Clip B, stitches into final.mp4, and exports WebP frames
REM ==============================================================================

setlocal enabledelayedexpansion

REM ------------------------------------------------------------------------------
REM WATERMARK CONFIGURATION
REM Set to 0.00 since Google Flow Veo 1080p exports are clean with no watermark.
REM ------------------------------------------------------------------------------
set "WATERMARK_W_PCT=0.00"
set "WATERMARK_H_PCT=0.00"

REM Verify ffmpeg & ffprobe
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

where ffprobe >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo ERROR: ffprobe is not found in your PATH. Please reinstall ffmpeg.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

set "CLIP_A=source\clipA.mp4"
set "CLIP_B=source\clipB.mp4"
set "FINAL_VIDEO=source\final.mp4"

if not exist "%CLIP_A%" (
    echo.
    echo ERROR: Input file '%CLIP_A%' was not found.
    echo.
    pause
    exit /b 1
)

echo Analyzing source clips...

for /f "delims=" %%i in ('ffprobe -v error -show_entries format^=duration -of default^=noprint_wrappers^=1:nokey^=1 "%CLIP_A%"') do set "DUR_A=%%i"

if not exist "%CLIP_B%" (
    for /f %%a in ('powershell -NoProfile -Command "$a=[double]'%DUR_A%'; $c=[math]::Round($a * 0.75 * 15); Write-Output $c"') do set "CIGAR_START=%%a"
    set "TARGET_FPS=15"
    echo Clip A duration: %DUR_A%s ^(Single clip 15 fps HIGH profile^)
    ffmpeg -y -i "%CLIP_A%" -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=15,setsar=1[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "%FINAL_VIDEO%"
) else (
    for /f "delims=" %%i in ('ffprobe -v error -show_entries format^=duration -of default^=noprint_wrappers^=1:nokey^=1 "%CLIP_B%"') do set "DUR_B=%%i"
    for /f "tokens=1,2,3 delims= " %%a in ('powershell -NoProfile -Command "$a=[double]'%DUR_A%'; $b=[double]'%DUR_B%'; $tot=$a+$b; $fps=15; if ($tot -gt 9.0) { $fps=[math]::Floor(150 / $tot); if ($fps -lt 10) { $fps=10 } }; $cigar=[math]::Round($a * $fps); Write-Output ('{0:F2} {1} {2}' -f $tot, $fps, $cigar)"') do (
        set "TOTAL_DUR=%%a"
        set "TARGET_FPS=%%b"
        set "CIGAR_START=%%c"
    )
    echo Clip A duration: %DUR_A%s
    echo Clip B duration: %DUR_B%s
    echo Total duration:  %TOTAL_DUR%s
    echo Target FPS:      %TARGET_FPS% fps ^(Cigar transition at frame ~%CIGAR_START%^)
    ffmpeg -y -i "%CLIP_A%" -i "%CLIP_B%" -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=%TARGET_FPS%,setsar=1[v0]; [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=%TARGET_FPS%,setsar=1[v1]; [v0][v1]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "%FINAL_VIDEO%"
)

REM Step 2: Clean old frames
echo.
echo Step 2/3: Cleaning existing frame sequences...
if exist frames\frame_*.webp del /q frames\frame_*.webp
if exist frames-m\frame_*.webp del /q frames-m\frame_*.webp
if not exist frames mkdir frames
if not exist frames-m mkdir frames-m

REM Step 3: Export HIGH profile Desktop & Mobile WebP frames (never upscaling)
echo.
echo Step 3/3 (a): Generating HIGH desktop frames (max 1600px wide, quality 80, curves & watermark mask)...
ffmpeg -y -i "%FINAL_VIDEO%" -vf "scale='min(iw,1600)':-2,drawbox=x=iw-iw*%WATERMARK_W_PCT%:y=ih-ih*%WATERMARK_H_PCT%:w=iw*%WATERMARK_W_PCT%:h=ih*%WATERMARK_H_PCT%:color=black:t=fill,curves=all='0/0 0.06/0 1/1'" -c:v libwebp -quality 80 -preset picture -compression_level 6 frames\frame_%%03d.webp

echo.
echo Step 3/3 (b): Generating HIGH mobile frames (9:16 crop, max 1280px tall, quality 78, curves)...
ffmpeg -y -i "%FINAL_VIDEO%" -vf "crop=trunc(ih*9/32)*2:ih,scale=-2:'min(ih,1280)',curves=all='0/0 0.06/0 1/1'" -c:v libwebp -quality 78 -preset picture -compression_level 6 frames-m\frame_%%03d.webp

REM Count frames and probe dimensions using PowerShell
for /f %%c in ('powershell -NoProfile -Command "(Get-ChildItem frames\frame_*.webp).Count"') do set "FRAME_COUNT=%%c"
for /f "tokens=1,2" %%a in ('ffprobe -v error -select_streams v:0 -show_entries stream^=width^,height -of default^=noprint_wrappers^=1:nokey^=1 frames\frame_001.webp') do (
    if not defined DESK_W (set "DESK_W=%%a") else (set "DESK_H=%%a")
)
for /f "tokens=1,2" %%a in ('ffprobe -v error -select_streams v:0 -show_entries stream^=width^,height -of default^=noprint_wrappers^=1:nokey^=1 frames-m\frame_001.webp') do (
    if not defined MOB_W (set "MOB_W=%%a") else (set "MOB_H=%%a")
)

REM Write manifest.js
echo // Auto-generated by tools/make_frames.bat> frames\manifest.js
echo window.AURA_MANIFEST = { count: %FRAME_COUNT%, cigarStartFrame: %CIGAR_START%, width: %DESK_W%, height: %DESK_H%, mobileWidth: %MOB_W%, mobileHeight: %MOB_H% };>> frames\manifest.js

echo.
echo ======================================================================
echo SUCCESS: Sequence processing complete!
echo   Desktop frames: %FRAME_COUNT% (in frames/)
echo   Transition:     Clip A ends at frame %CIGAR_START%
echo   Manifest:       frames/manifest.js updated
echo ======================================================================
echo.

endlocal
