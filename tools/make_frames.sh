#!/usr/bin/env bash
# ==============================================================================
# AURA — tools/make_frames.sh (macOS / Linux)
# Normalizes Clip A and Clip B, stitches into final.mp4, and exports WebP frames
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# WATERMARK CONFIGURATION
# Set to 0.00 since Google Flow Veo 1080p exports are clean with no watermark.
# (If your video has a watermark, set e.g. 0.16 and 0.10)
# ------------------------------------------------------------------------------
WATERMARK_W_PCT="0.00"
WATERMARK_H_PCT="0.00"

# Verify ffmpeg and ffprobe
if ! command -v ffmpeg &> /dev/null || ! command -v ffprobe &> /dev/null; then
  echo ""
  echo "======================================================================"
  echo "ERROR: ffmpeg and/or ffprobe are not installed or not in PATH."
  echo "Please install ffmpeg before running this tool:"
  echo "  - macOS: brew install ffmpeg"
  echo "  - Debian/Ubuntu: sudo apt-get install ffmpeg"
  echo "  - Fedora: sudo dnf install ffmpeg"
  echo "  - Arch: sudo pacman -S ffmpeg"
  echo "======================================================================"
  echo ""
  exit 1
fi

CLIP_A="source/clipA.mp4"
CLIP_B="source/clipB.mp4"
FINAL_VIDEO="source/final.mp4"

if [ ! -f "$CLIP_A" ]; then
  echo ""
  echo "ERROR: At least Clip A is required: $CLIP_A"
  echo "Please place your exported video clip at: $CLIP_A"
  echo ""
  exit 1
fi

echo "Analyzing source clips..."
durA=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CLIP_A")

if [ -f "$CLIP_B" ]; then
  durB=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CLIP_B")
  read -r totalDur targetFps cigarFrames <<< $(awk -v a="$durA" -v b="$durB" 'BEGIN {
    tot = a + b;
    fps = 15;
    if (tot > 9.0) {
      fps = int(150 / tot);
      if (fps < 10) fps = 10;
    }
    cigar = int(a * fps + 0.5);
    printf "%.2f %d %d\n", tot, fps, cigar;
  }')
  echo "Clip A duration: ${durA}s"
  echo "Clip B duration: ${durB}s"
  echo "Total duration:  ${totalDur}s"
  echo "Target FPS:      ${targetFps} fps (Cigar transition at frame ~${cigarFrames})"

  echo ""
  echo "Step 1/3: Normalizing and concatenating into $FINAL_VIDEO..."
  ffmpeg -y \
    -i "$CLIP_A" \
    -i "$CLIP_B" \
    -filter_complex "\
      [0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=${targetFps},setsar=1[v0]; \
      [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=${targetFps},setsar=1[v1]; \
      [v0][v1]concat=n=2:v=1:a=0[v]" \
    -map "[v]" \
    -an \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
    "$FINAL_VIDEO"
else
  targetFps=24
  cigarFrames=$(awk -v a="$durA" -v fps="$targetFps" 'BEGIN { printf "%d\n", int(a * 0.75 * fps) }')
  echo "Clip A duration: ${durA}s"
  echo "Target FPS:      ${targetFps} fps (24 fps native color HIGH profile, cigar ~frame ${cigarFrames})"

  echo ""
  echo "Step 1/3: Conforming single clip into $FINAL_VIDEO..."
  ffmpeg -y \
    -i "$CLIP_A" \
    -filter_complex "\
      [0:v]scale='min(iw,1600)':-2,fps=${targetFps},setsar=1[v]" \
    -map "[v]" \
    -an \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
    "$FINAL_VIDEO"
fi

# Step 2: Clean old frames
echo ""
echo "Step 2/3: Cleaning existing frame sequences..."
rm -f frames/frame_*.webp frames-m/frame_*.webp
mkdir -p frames frames-m

# Step 3: Export HIGH profile Desktop & Mobile WebP frames (native color, never upscaling)
echo ""
echo "Step 3/3 (a): Generating HIGH desktop frames (max 1600px wide, quality 82, libwebp method/compression 6)..."
ffmpeg -y -i "$FINAL_VIDEO" \
  -vf "scale='min(iw,1600)':-2,drawbox=x=iw-iw*${WATERMARK_W_PCT}:y=ih-ih*${WATERMARK_H_PCT}:w=iw*${WATERMARK_W_PCT}:h=ih*${WATERMARK_H_PCT}:color=black:t=fill" \
  -c:v libwebp -quality 82 -preset picture -compression_level 6 \
  frames/frame_%03d.webp

echo "Step 3/3 (b): Generating HIGH mobile frames (9:16 crop, max 1280px tall, quality 80)..."
ffmpeg -y -i "$FINAL_VIDEO" \
  -vf "crop=trunc(ih*9/32)*2:ih,scale=-2:'min(ih,1280)'" \
  -c:v libwebp -quality 80 -preset picture -compression_level 6 \
  frames-m/frame_%03d.webp

# Count output frames and probe exported dimensions
desktopFrameCount=$(find frames -type f -name "frame_*.webp" | wc -l)
mobileFrameCount=$(find frames-m -type f -name "frame_*.webp" | wc -l)
read -r deskW deskH <<< $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 frames/frame_001.webp | tr '\n' ' ')
read -r mobW mobH <<< $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 frames-m/frame_001.webp | tr '\n' ' ')

# Write frames/manifest.js
echo "Writing frames/manifest.js..."
cat <<EOF > frames/manifest.js
// Auto-generated by tools/make_frames.sh
window.AURA_MANIFEST = {
  count: ${desktopFrameCount},
  cigarStartFrame: ${cigarFrames},
  width: ${deskW},
  height: ${deskH},
  mobileWidth: ${mobW},
  mobileHeight: ${mobH}
};
EOF

echo ""
echo "======================================================================"
echo "SUCCESS: Sequence processing complete!"
echo "  Desktop frames: $desktopFrameCount (in frames/)"
echo "  Mobile frames:  $mobileFrameCount (in frames-m/)"
echo "  Transition:     Clip A ends at frame $cigarFrames"
echo "  Manifest:       frames/manifest.js updated"
echo "======================================================================"
echo ""
