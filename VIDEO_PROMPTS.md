# AURA — Cinematic Video Generation & Prompt Guide

This guide provides exact step-by-step instructions to produce the two cinematic video clips using **Google Flow** (`labs.google/flow`, included in Google AI Pro) with **Veo 3.1**, and convert them into high-performance WebP frame sequences.

---

## Pro-Workflow Pacing & Settings
- **Tool**: Google Flow (`https://labs.google/flow`)
- **Model Mode**: Veo 3.1 "Frames to Video" (image-to-video)
- **Aspect Ratio**: 16:9 Landscape
- **Duration**: Shortest duration option that fits the action (typically 4s–5s per clip)
- **Upscaling**: 1080p upscaling enabled on final export
- **Efficiency Tip**:
  - Set iterations to **2 variants per run** so you can pick the best likeness and motion.
  - Test camera lock and stride dynamics with the **Fast** model first.
  - Once motion looks good, generate the keeper using the **Quality** model.

---

## Step 0: Base Character Image (`source/start.png`)

If you haven't yet generated your gangster character start frame, generate it in Google Flow (Text-to-Image / Image-to-Image with face reference) using `source/me.jpg` as the face reference:

### Prompt for Start Image:
```text
Use the reference photo as the exact face. Cinematic full-length photo of this same man in 1920s Birmingham gangster attire: charcoal tweed three-piece suit, waistcoat with pocket-watch chain, long dark wool overcoat, flat cap, white collarless shirt. Build: slim. Facial hair: short beard and mustache. Standing centered, facing the camera, full body visible and occupying about 55% of frame height, lit cigar held low in the right hand. Pure black void background #000000, no environment. Hard rim light from behind-left on the coat and cap, soft key light on the face, 35mm film look, high contrast, 16:9, subject in the center third.
```
> Save the resulting high-res image as: `source/start.png`

---

## Step 1: Clip A — The Approach

### Settings:
- **Mode**: Frames to Video (Image to Video)
- **Start Frame**: Upload `source/start.png`
- **Duration**: ~4–5 seconds

### Prompt for Clip A:
```text
Locked-off static camera, no zoom, no camera movement. The man walks slowly and steadily straight toward the camera with heavy confident strides, coat swaying. Pure black background, faint low fog drifting at ground level, hard rim light on coat and cap. He ends at a medium shot, knees up. Keep face and clothing identical. No cuts, no other people, no text.
```

### Action:
1. Generate 2 variants, select the smoothest stride with zero camera drift.
2. Download and save as: `source/clipA.mp4`

---

## Step 2: Extract Last Frame of Clip A

Run the extraction tool to grab the exact ending frame from Clip A:
- **macOS / Linux**:
  ```bash
  ./tools/last_frame.sh
  ```
- **Windows**:
  ```cmd
  tools\last_frame.bat
  ```

> This creates `source/clipA_last.png`.

---

## Step 3: Clip B — The Cigar Exhale

### Settings:
- **Mode**: Frames to Video (Image to Video)
- **Start Frame**: Upload `source/clipA_last.png`
- **Duration**: ~4–5 seconds

### Prompt for Clip B:
```text
Static camera, same lighting, same pure black background. He stops walking and stands still, slowly raises the cigar to his mouth, the ember glows amber, lowers it slightly, and exhales a long slow plume of smoke that curls across the dark frame. No cuts, no camera movement.
```

### Action:
1. Generate 2 variants, select the cleanest smoke curl.
2. Download and save as: `source/clipB.mp4`

---

## Step 4: Transcode Sequence & Generate WebP Frames

Once both `source/clipA.mp4` and `source/clipB.mp4` are present:
- **macOS / Linux**:
  ```bash
  ./tools/make_frames.sh
  ```
- **Windows**:
  ```cmd
  tools\make_frames.bat
  ```

### What this automated script does:
1. Normalizes resolution and frame rate (15 fps adaptive) across both clips.
2. Seamlessly stitches both into `source/final.mp4`.
3. Strips audio and applies black-crushing curves (`curves=all='0/0 0.06/0 1/1'`).
4. Masks corner watermarks using a black drawbox rectangle.
5. Exports desktop frames into `frames/` (1280px WebP, quality 72).
6. Exports mobile portrait frames into `frames-m/` (540px portrait 9:16 crop, quality 70).
7. Automatically writes `frames/manifest.js` with exact frame counts and the cigar transition index.
