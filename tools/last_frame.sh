#!/usr/bin/env bash
# ==============================================================================
# AURA — tools/last_frame.sh (macOS / Linux)
# Extracts the exact final frame of Clip A to use as start frame for Clip B
# ==============================================================================

set -euo pipefail

# Verify ffmpeg
if ! command -v ffmpeg &> /dev/null; then
  echo ""
  echo "======================================================================"
  echo "ERROR: ffmpeg is not installed or not found in your PATH."
  echo "Please install ffmpeg before running this tool:"
  echo "  - macOS: brew install ffmpeg"
  echo "  - Debian/Ubuntu: sudo apt-get install ffmpeg"
  echo "  - Fedora: sudo dnf install ffmpeg"
  echo "  - Arch: sudo pacman -S ffmpeg"
  echo "======================================================================"
  echo ""
  exit 1
fi

INPUT_CLIP="source/clipA.mp4"
OUTPUT_FRAME="source/clipA_last.png"

if [ ! -f "$INPUT_CLIP" ]; then
  echo ""
  echo "ERROR: Input file '$INPUT_CLIP' was not found."
  echo "Please place your exported Clip A video at: $INPUT_CLIP"
  echo ""
  exit 1
fi

echo "Extracting final frame from $INPUT_CLIP -> $OUTPUT_FRAME..."

ffmpeg -y -sseof -0.2 -i "$INPUT_CLIP" -update 1 -q:v 1 "$OUTPUT_FRAME"

echo ""
echo "SUCCESS: Saved final frame to $OUTPUT_FRAME"
echo "You can now upload $OUTPUT_FRAME as the start frame for Clip B in Google Flow."
echo ""
