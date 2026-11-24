# AURA — Cinematic Personal Brand Portfolio

A bespoke, high-performance cinematic personal brand and portfolio site built in pure static HTML5, CSS3, and vanilla JavaScript. 

Inspired by 1920s Birmingham gangster cinema (*Peaky Blinders* aesthetic) blended with an editorial digital dossier.

---

## Architecture & Visual System

- **Act 1 (The Approach)**: Sticky 650vh hero sequence playing a frame-synchronized cinematic loop tied directly to scroll progress with sub-pixel interpolation. Features dynamic narrative typography timed across narrative intervals that never obscure the face.
- **Act 2 (The Dossier)**: Dark glass card panel (`rgba(255, 255, 255, 0.025)`, 16px blur) revealing accessible tabs for Projects, Experience, and Skills with animated container heights and deep link URL hashes.
- **Pure Static Stack**: Zero dependencies, zero build steps, zero npm/Node/TypeScript. Deployable anywhere from GitHub Pages to an S3/Cloudflare bucket.
- **Procedural Resiliency**: Features a procedural fallback engine (drifting mist and interactive amber ember) that renders gracefully even if video frames are missing.

---

## Project Structure

```text
.
├── index.html            # Core HTML markup & semantic structure
├── css/
│   └── style.css         # Editorial styling, typography, transitions, & grain
├── js/
│   ├── config.js         # Single source of truth for all content & settings
│   └── main.js           # Frame preloader, rAF interpolation, & tab manager
├── frames/               # Desktop 1280px WebP sequence (frame_001.webp...)
│   ├── .gitkeep
│   └── manifest.js       # Auto-generated frame count & transition markers
├── frames-m/             # Mobile portrait 540px WebP sequence
│   └── .gitkeep
├── source/               # Reference photos, start frame, and video clips
│   ├── me.jpg            # Face reference portrait
│   └── me_2.jpg          # Secondary reference photo
├── tools/                # Automated FFmpeg CLI scripts for video processing
│   ├── last_frame.sh     # macOS/Linux final frame extractor
│   ├── last_frame.bat    # Windows final frame extractor
│   ├── make_frames.sh    # macOS/Linux sequence processor & WebP exporter
│   └── make_frames.bat   # Windows sequence processor & WebP exporter
├── VIDEO_PROMPTS.md      # Exact Google Flow / Veo 3.1 video prompts
└── README.md             # Documentation & deployment guide
```

---

## 1. Customizing Content (`js/config.js`)

All personal data, copy, quotes, and links are centralized inside [`js/config.js`](file:///run/media/hamza/Disk%20D/profile/js/config.js):

- `NAME`: Your name (e.g. `"HAMZA"`).
- `BRAND`: Your brand moniker (e.g. `"AURA"`).
- `ROLE_LINE`: Subtitle line in small mono caps.
- `HERO_QUOTES`: 4 short editorial quotes paced along the walk.
- `FINAL_LINE`: The closing creed before the dossier.
- `PROJECTS`: Array of projects (`title`, `description`, `tech[]`, `url`).
- `EXPERIENCE`: Array of roles (`period`, `role`, `org`, `points[]`).
- `SKILLS`: Grouped object of technical capabilities.
- `SOCIALS`: Links to GitHub, LinkedIn, and X.
- `CONTACT`: Object `{ type: "email" | "whatsapp", value: "..." }`.

---

## 2. Prerequisites & FFmpeg Installation

The frame extraction tools require `ffmpeg` and `ffprobe`:

### Windows
Open PowerShell or Command Prompt and run:
```cmd
winget install ffmpeg
```
*Restart your terminal afterwards.*

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu / Debian)
```bash
sudo apt update && sudo apt install ffmpeg
```

---

## 3. Video Production Workflow

Refer to [`VIDEO_PROMPTS.md`](file:///run/media/hamza/Disk%20D/profile/VIDEO_PROMPTS.md) for full prompt guidelines.

1. **Start Frame (`source/start.png`)**: Generate your 1920s gangster portrait using the prompt in `VIDEO_PROMPTS.md` with `source/me.jpg` as the face reference. Save as `source/start.png`.
2. **Generate Clip A (`source/clipA.mp4`)**: In Google Flow (`labs.google/flow`), use Veo 3.1 *Frames to Video* with `source/start.png` as start frame. Prompt the confident forward walk.
3. **Extract Last Frame**:
   - macOS/Linux: `./tools/last_frame.sh`
   - Windows: `tools\last_frame.bat`
   *(Generates `source/clipA_last.png`)*
4. **Generate Clip B (`source/clipB.mp4`)**: In Google Flow, use `source/clipA_last.png` as start frame. Prompt the stop, cigar lift, and smoke exhale.
5. **Generate WebP Frame Sequences**:
   - macOS/Linux: `./tools/make_frames.sh`
   - Windows: `tools\make_frames.bat`

### Watermark Masking Customization
`tools/make_frames.sh` and `tools/make_frames.bat` include variables at the very top:
```bash
WATERMARK_W_PCT="0.16"  # 16% width of frame
WATERMARK_H_PCT="0.10"  # 10% height of frame
```
By default, the script paints a black box over the bottom-right corner. If your AI video tool places a watermark in a different corner or size, simply modify `WATERMARK_W_PCT` or the `drawbox` coordinates (`x` and `y`) in the script.

---

## 4. Local Testing

To test locally with frame loading enabled (browsers restrict local file canvas access over `file://`):

```bash
# Using Python 3 built-in HTTP server:
python3 -m http.server 8000
# or
python -m http.server 8000
```
Then open your browser at:
`http://localhost:8000`

---

## 5. GitHub Pages Deployment

Because the project uses relative paths and classic scripts, deploying to GitHub Pages is zero-configuration:

1. Create a repository on GitHub (e.g. `username.github.io` or `aura-portfolio`).
2. Push your files:
   ```bash
   git init
   git add .
   git commit -m "feat: initial aura release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. In your GitHub repository settings:
   - Navigate to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **Deploy from a branch**.
   - Branch: `main` / Folder: `/(root)`.
   - Click **Save**.

### Custom Domain (Optional)
To use a custom domain (e.g. `yourname.com`):
1. In the repository root, create a file named `CNAME` containing your bare domain:
   ```text
   yourname.com
   ```
2. Configure your DNS provider:
   - Apex domain (`@`): create `A` records pointing to GitHub Pages IP addresses:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - `www` subdomain: create a `CNAME` record pointing to `<your-username>.github.io`.
3. In GitHub Pages settings, check **Enforce HTTPS**.
