/* ==========================================================================
   AURA CINEMATIC PORTFOLIO — CORE APPLICATION SCRIPT
   High-performance frame orchestration, procedural fallback, and editorial UI
   ========================================================================== */

(function () {
  "use strict";

  // Cache config
  const cfg = window.AURA_CONFIG || {};

  // Manifest override support (if frames/manifest.js was loaded)
  let frameCount = cfg.FRAME_COUNT || 120;
  let frameMap = cfg.FRAME_MAP ? [...cfg.FRAME_MAP] : [
    [0.00, 0],
    [0.75, 70],
    [0.92, 119],
    [1.00, 119]
  ];

  if (window.AURA_MANIFEST) {
    if (typeof window.AURA_MANIFEST.count === "number" && window.AURA_MANIFEST.count > 0) {
      frameCount = window.AURA_MANIFEST.count;
    }
    if (typeof window.AURA_MANIFEST.cigarStartFrame === "number") {
      frameMap[1] = [0.75, window.AURA_MANIFEST.cigarStartFrame];
      frameMap[2] = [0.92, frameCount - 1];
      frameMap[3] = [1.00, frameCount - 1];
    }
  }

  // DOM Elements
  const heroEl = document.getElementById("hero");
  const canvas = document.getElementById("hero-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloader-bar");
  const preloaderStatus = document.getElementById("preloader-status");
  const devNotice = document.getElementById("dev-notice");
  const panelsContainer = document.getElementById("panels-container");
  const tabIndicator = document.getElementById("tab-indicator");

  // State Variables
  const frames = new Array(frameCount);
  let framesLoadedCount = 0;
  let isProceduralFallback = false;
  let targetProgress = 0;
  let currentFrameFloat = 0;
  let lastDrawnFrame = -1;
  let isRafRunning = false;
  let lastRafTime = performance.now();
  let emberGlow = 0;
  let fogOffset = 0;

  // Prevent scroll restoration jump
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  /* --------------------------------------------------------------------------
     1. FILM GRAIN CANVAS GENERATOR
     -------------------------------------------------------------------------- */
  function initFilmGrain() {
    const grainCanvas = document.getElementById("grain-canvas");
    if (!grainCanvas) return;
    const gCtx = grainCanvas.getContext("2d");
    const w = 256;
    const h = 256;
    const imgData = gCtx.createImageData(w, h);
    const buffer32 = new Uint32Array(imgData.data.buffer);
    const len = buffer32.length;
    for (let i = 0; i < len; i++) {
      // Monochromatic subtle noise
      const noise = (Math.random() * 255) | 0;
      buffer32[i] = (45 << 24) | (noise << 16) | (noise << 8) | noise;
    }
    gCtx.putImageData(imgData, 0, 0);
  }

  /* --------------------------------------------------------------------------
     2. CONTENT HYDRATION (From js/config.js)
     -------------------------------------------------------------------------- */
  function hydrateContent() {
    // Document Title & Meta
    if (cfg.NAME && cfg.BRAND) {
      document.title = `${cfg.BRAND} — ${cfg.NAME}`;
    }

    // Preloader and Hero Intro
    const preloaderName = document.getElementById("preloader-name");
    if (preloaderName) preloaderName.textContent = cfg.BRAND || cfg.NAME || "AURA";

    const heroName = document.getElementById("hero-name");
    if (heroName && cfg.NAME) heroName.textContent = cfg.NAME;

    const heroRole = document.getElementById("hero-role");
    if (heroRole && cfg.ROLE_LINE) heroRole.textContent = cfg.ROLE_LINE;

    // Quotes
    if (Array.isArray(cfg.HERO_QUOTES)) {
      for (let i = 0; i < 4; i++) {
        const qEl = document.getElementById(`quote-${i + 1}`);
        if (qEl && cfg.HERO_QUOTES[i]) qEl.textContent = cfg.HERO_QUOTES[i];
      }
    }

    // Final Creed
    const finalEl = document.getElementById("final-line");
    if (finalEl && cfg.FINAL_LINE) finalEl.textContent = cfg.FINAL_LINE;

    // Footer Note
    const footerNote = document.getElementById("footer-note");
    if (footerNote && cfg.FOOTER_NOTE) footerNote.textContent = cfg.FOOTER_NOTE;

    // Contact Action
    const contactBtn = document.getElementById("contact-button");
    if (contactBtn && cfg.CONTACT) {
      if (cfg.CONTACT.type === "whatsapp") {
        const cleanNumber = String(cfg.CONTACT.value).replace(/[^0-9]/g, "");
        contactBtn.href = `https://wa.me/${cleanNumber}`;
      } else {
        contactBtn.href = `mailto:${cfg.CONTACT.value}`;
      }
    }

    // Projects Grid
    const projectsGrid = document.getElementById("projects-grid");
    if (projectsGrid && Array.isArray(cfg.PROJECTS)) {
      projectsGrid.innerHTML = cfg.PROJECTS.map((proj, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const techLine = Array.isArray(proj.tech) ? proj.tech.join(" / ") : "";
        return `
          <a href="${proj.url || '#'}" target="_blank" rel="noopener noreferrer" class="project-card">
            <div>
              <div class="project-card-header">
                <span class="project-index">${num}</span>
                <svg class="project-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </div>
              <h3 class="project-title">${proj.title}</h3>
              <p class="project-desc">${proj.description}</p>
            </div>
            <div class="project-tech">${techLine}</div>
          </a>
        `;
      }).join("");
    }

    // Experience Editorial Rows
    const experienceList = document.getElementById("experience-list");
    if (experienceList && Array.isArray(cfg.EXPERIENCE)) {
      experienceList.innerHTML = cfg.EXPERIENCE.map(exp => `
        <article class="experience-row">
          <div class="experience-period">${exp.period}</div>
          <div class="experience-content">
            <h3 class="experience-role">${exp.role}</h3>
            <div class="experience-org">${exp.org}</div>
            <ul class="experience-points">
              ${(exp.points || []).map(pt => `<li class="experience-point">${pt}</li>`).join("")}
            </ul>
          </div>
        </article>
      `).join("");
    }

    // Skills Columns
    const skillsGrid = document.getElementById("skills-grid");
    if (skillsGrid && cfg.SKILLS && typeof cfg.SKILLS === "object") {
      skillsGrid.innerHTML = Object.entries(cfg.SKILLS).map(([groupTitle, items]) => `
        <div class="skill-group">
          <h3 class="skill-group-title">[ ${groupTitle} ]</h3>
          <ul class="skill-list">
            ${(items || []).map(item => `<li class="skill-item">${item}</li>`).join("")}
          </ul>
        </div>
      `).join("");
    }

    // Social Links
    const socialsList = document.getElementById("socials-list");
    if (socialsList && Array.isArray(cfg.SOCIALS)) {
      const iconSvgs = {
        github: '<svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
        linkedin: '<svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
        x: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
        whatsapp: '<svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>',
        email: '<svg viewBox="0 0 24 24"><path d="M0 3v18h24v-18h-24zm21.518 2l-9.518 7.713-9.518-7.713h19.036zm-19.518 14v-11.817l10 8.104 10-8.104v11.817h-20z"/></svg>'
      };

      socialsList.innerHTML = cfg.SOCIALS.map(soc => {
        const iconSvg = iconSvgs[soc.icon.toLowerCase()] || `<span>${soc.label}</span>`;
        return `
          <li>
            <a href="${soc.url}" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="${soc.label}">
              ${iconSvg}
            </a>
          </li>
        `;
      }).join("");
    }
  }

  /* --------------------------------------------------------------------------
     3. CANVAS SIZING & DPR RESOLUTION
     -------------------------------------------------------------------------- */
  function resizeCanvas() {
    const isMobile = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawCurrentFrame(true);
  }

  /* --------------------------------------------------------------------------
     4. FRAME PRELOADER & PROCEDURAL FALLBACK
     -------------------------------------------------------------------------- */
  function getFrameUrl(index) {
    const isMobile = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
    const template = (isMobile && cfg.FRAME_PATH_MOBILE) ? cfg.FRAME_PATH_MOBILE : (cfg.FRAME_PATH || "frames/frame_{n}.webp");
    const num = String(index + 1).padStart(3, "0");
    return template.replace("{n}", num);
  }

  function loadImageWithRetry(src, isRetry = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;

      // Fail-safe timeout to prevent hanging on network 404s
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Timeout loading " + src));
        }
      }, 1000);

      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (typeof img.decode === "function") {
          img.decode().then(() => resolve(img)).catch(() => resolve(img));
        } else {
          resolve(img);
        }
      };

      img.onerror = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!isRetry) {
          loadImageWithRetry(src, true).then(resolve).catch(reject);
        } else {
          reject(err || new Error("Failed to load " + src));
        }
      };

      img.src = src;
    });
  }

  async function preloadFrames() {
    const minHoldPromise = new Promise(resolve => setTimeout(resolve, 900));
    let progressPercent = 0;

    // Load Frame 1 first
    try {
      const firstImg = await loadImageWithRetry(getFrameUrl(0));
      frames[0] = firstImg;
      framesLoadedCount = 1;
      progressPercent = Math.round((1 / frameCount) * 100);
      updatePreloader(progressPercent);

      // Batch load the remaining frames in parallel groups of 10
      const batchSize = 10;
      for (let i = 1; i < frameCount; i += batchSize) {
        const batchPromises = [];
        for (let j = i; j < Math.min(i + batchSize, frameCount); j++) {
          const idx = j;
          batchPromises.push(
            loadImageWithRetry(getFrameUrl(idx))
              .then(img => {
                frames[idx] = img;
                framesLoadedCount++;
                progressPercent = Math.round((framesLoadedCount / frameCount) * 100);
                updatePreloader(progressPercent);
              })
              .catch(() => {
                // If individual frame fails, keep null
              })
          );
        }
        await Promise.all(batchPromises);
      }

      // If > 60% of frames missing, fallback to procedural placeholder
      if (framesLoadedCount < frameCount * 0.4) {
        enableProceduralFallback();
      }
    } catch (e) {
      // Frame 1 404'd or unreachable -> activate procedural fallback
      enableProceduralFallback();
      // Animate progress smoothly to 100%
      updatePreloader(50);
      await new Promise(r => setTimeout(r, 200));
      updatePreloader(100);
    }

    // Await minimum hold of 900ms to guarantee calm pacing
    await minHoldPromise;

    // Draw frame 0 before revealing to prevent flash
    drawCurrentFrame(true);

    // Fade out preloader
    preloader.classList.add("loaded");
    document.body.classList.remove("loading-locked");

    // Start rAF loop
    startRafLoop();
  }

  function updatePreloader(pct) {
    if (preloaderBar) preloaderBar.style.width = `${pct}%`;
    if (preloaderStatus) preloaderStatus.textContent = `INITIALIZING ${String(pct).padStart(2, "0")}%`;
  }

  function enableProceduralFallback() {
    isProceduralFallback = true;
    if (devNotice) devNotice.classList.add("visible");
  }

  /* --------------------------------------------------------------------------
     5. PROCEDURAL CANVAS RENDERER (Fallback Mode)
     -------------------------------------------------------------------------- */
  function renderProceduralScene(cw, ch, progress) {
    // Pure black void
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cw, ch);

    // Drifting Fog layers
    fogOffset += 0.003;
    const centerX = cw * 0.5;
    const centerY = ch * 0.55;

    // Low Ground Atmosphere
    const grad1 = ctx.createRadialGradient(
      centerX + Math.sin(fogOffset) * 60,
      ch * 0.82,
      20,
      centerX,
      ch * 0.82,
      cw * 0.55
    );
    grad1.addColorStop(0, "rgba(232, 163, 61, 0.04)");
    grad1.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
    grad1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad1;
    ctx.fillRect(0, ch * 0.5, cw, ch * 0.5);

    // Subtle Silhouette Form (1920s peaked silhouette placeholder)
    const silhouetteHeight = ch * 0.48;
    const silhouetteWidth = silhouetteHeight * 0.35;
    const headRadius = silhouetteWidth * 0.22;
    const figY = centerY - silhouetteHeight * 0.15;

    ctx.save();
    ctx.fillStyle = "#080808";
    // Body / Overcoat
    ctx.beginPath();
    ctx.moveTo(centerX - silhouetteWidth * 0.45, figY + silhouetteHeight);
    ctx.lineTo(centerX - silhouetteWidth * 0.35, figY + headRadius * 2.8);
    ctx.lineTo(centerX - silhouetteWidth * 0.25, figY + headRadius * 1.5);
    // Flat cap contour
    ctx.lineTo(centerX - headRadius * 1.25, figY + headRadius * 0.6);
    ctx.arc(centerX, figY, headRadius * 0.95, Math.PI, 0, false);
    ctx.lineTo(centerX + headRadius * 1.35, figY + headRadius * 0.7);
    ctx.lineTo(centerX + silhouetteWidth * 0.25, figY + headRadius * 1.5);
    ctx.lineTo(centerX + silhouetteWidth * 0.35, figY + headRadius * 2.8);
    ctx.lineTo(centerX + silhouetteWidth * 0.45, figY + silhouetteHeight);
    ctx.closePath();
    ctx.fill();

    // Subtle rim light along the shoulder and cap
    ctx.strokeStyle = "rgba(232, 163, 61, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Growing Ember at hand level, rising toward mouth as progress exceeds 0.75
    let emberX = centerX + silhouetteWidth * 0.22;
    let emberY = figY + silhouetteHeight * 0.62;

    if (progress > 0.75) {
      const lift = Math.min((progress - 0.75) / 0.17, 1);
      emberX = emberX + (centerX + headRadius * 0.2 - emberX) * lift;
      emberY = emberY + (figY + headRadius * 1.2 - emberY) * lift;
    }

    const emberSize = 2.5 + progress * 3;
    emberGlow = 0.8 + Math.sin(fogOffset * 5) * 0.25;

    const emberGrad = ctx.createRadialGradient(emberX, emberY, 0, emberX, emberY, emberSize * 8);
    emberGrad.addColorStop(0, `rgba(255, 184, 77, ${emberGlow})`);
    emberGrad.addColorStop(0.3, `rgba(232, 163, 61, ${emberGlow * 0.6})`);
    emberGrad.addColorStop(1, "rgba(232, 163, 61, 0)");
    ctx.fillStyle = emberGrad;
    ctx.beginPath();
    ctx.arc(emberX, emberY, emberSize * 8, 0, Math.PI * 2);
    ctx.fill();

    // Exhaled Smoke drifting after progress > 0.80
    if (progress > 0.80) {
      const smokeAlpha = Math.min((progress - 0.80) / 0.15, 0.25);
      const smokeGrad = ctx.createRadialGradient(
        emberX + Math.sin(fogOffset * 2) * 20,
        emberY - 20,
        5,
        emberX + 40,
        emberY - 50,
        80
      );
      smokeGrad.addColorStop(0, `rgba(237, 234, 227, ${smokeAlpha})`);
      smokeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = smokeGrad;
      ctx.beginPath();
      ctx.arc(emberX + 30, emberY - 40, 80, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* --------------------------------------------------------------------------
     6. CANVAS FRAME DRAWING (Cover Fit & Centered)
     -------------------------------------------------------------------------- */
  function drawCurrentFrame(force = false) {
    const targetIdx = Math.max(0, Math.min(Math.round(currentFrameFloat), frameCount - 1));
    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    if (isProceduralFallback) {
      renderProceduralScene(cw, ch, targetProgress);
      lastDrawnFrame = targetIdx;
      return;
    }

    if (!force && targetIdx === lastDrawnFrame) {
      return;
    }

    const img = frames[targetIdx] || frames[0];
    if (img && img.naturalWidth) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, cw, ch);

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = Math.max(cw / imgW, ch / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (cw - dw) * 0.5;
      const dy = (ch - dh) * 0.5;

      ctx.drawImage(img, dx, dy, dw, dh);
      lastDrawnFrame = targetIdx;
    } else {
      // Fallback if individual frame not loaded yet
      renderProceduralScene(cw, ch, targetProgress);
    }
  }

  /* --------------------------------------------------------------------------
     7. PIECEWISE LINEAR FRAME MAPPING & SMOOTHING
     -------------------------------------------------------------------------- */
  function progressToFrame(p) {
    if (p <= frameMap[0][0]) return frameMap[0][1];
    if (p >= frameMap[frameMap.length - 1][0]) {
      return frameMap[frameMap.length - 1][1];
    }

    for (let i = 0; i < frameMap.length - 1; i++) {
      const p0 = frameMap[i][0];
      const p1 = frameMap[i + 1][0];
      if (p >= p0 && p <= p1) {
        const f0 = frameMap[i][1];
        const f1 = frameMap[i + 1][1];
        const t = (p - p0) / (p1 - p0);
        return f0 + t * (f1 - f0);
      }
    }
    return frameMap[0][1];
  }

  function startRafLoop() {
    if (isRafRunning) return;
    isRafRunning = true;
    lastRafTime = performance.now();
    requestAnimationFrame(rafTick);
  }

  function rafTick(now) {
    const dt = Math.min(Math.max(now - lastRafTime, 1), 50);
    lastRafTime = now;

    // Target frame from scroll progress
    const targetFrame = progressToFrame(targetProgress);

    // Smoothing factor: current += (target - current) * (1 - Math.pow(1 - 0.09, dt/16.67))
    const decay = 1 - Math.pow(1 - 0.09, dt / 16.67);
    currentFrameFloat += (targetFrame - currentFrameFloat) * decay;

    // Redraw frame
    drawCurrentFrame(isProceduralFallback);

    // Check if settled
    const frameDiff = Math.abs(targetFrame - currentFrameFloat);
    if (!isProceduralFallback && frameDiff < 0.001) {
      currentFrameFloat = targetFrame;
      isRafRunning = false;
      return;
    }

    // Keep running if procedural (drifting fog) or animating toward target
    requestAnimationFrame(rafTick);
  }

  /* --------------------------------------------------------------------------
     8. SCROLL CHOREOGRAPHY & BEAT TIMING
     -------------------------------------------------------------------------- */
  const beats = [
    { el: document.getElementById("beat-0"), min: 0.00, max: 0.20 },
    { el: document.getElementById("beat-1"), min: 0.21, max: 0.32 },
    { el: document.getElementById("beat-2"), min: 0.34, max: 0.45 },
    { el: document.getElementById("beat-3"), min: 0.47, max: 0.58 },
    { el: document.getElementById("beat-4"), min: 0.60, max: 0.72 },
    { el: document.getElementById("beat-5"), min: 0.80, max: 1.00 } // Holds to end
  ];

  function updateNarrativeBeats(p) {
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      if (!beat.el) continue;
      const isActive = p >= beat.min && p <= beat.max;
      beat.el.classList.toggle("active", isActive);
    }
  }

  function onScroll() {
    const heroTop = heroEl.offsetTop;
    const heroHeight = heroEl.offsetHeight;
    const maxScroll = heroHeight - window.innerHeight;

    if (maxScroll <= 0) return;

    const scrollY = window.scrollY;
    targetProgress = Math.min(Math.max((scrollY - heroTop) / maxScroll, 0), 1);

    // Update narrative beats
    updateNarrativeBeats(targetProgress);

    // Dim canvas as visitor scrolls into the Dossier (Act 2)
    if (scrollY > maxScroll) {
      const dossierOverScroll = scrollY - maxScroll;
      const dimFactor = Math.min(dossierOverScroll / (window.innerHeight * 0.6), 1);
      const targetOpacity = (1.0 - 0.8 * dimFactor).toFixed(3);
      canvas.style.opacity = targetOpacity;
    } else {
      canvas.style.opacity = "1";
    }

    // Wake up rAF loop
    startRafLoop();
  }

  /* --------------------------------------------------------------------------
     9. ACCESSIBLE DOSSIER TABS & ANIMATED HEIGHT
     -------------------------------------------------------------------------- */
  function initTabs() {
    const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
    const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
    if (!tabButtons.length || !tabPanels.length) return;

    function activateTab(targetBtn, smoothScroll = false) {
      if (!targetBtn) return;
      const targetId = targetBtn.getAttribute("aria-controls");
      const targetPanel = document.getElementById(targetId);
      if (!targetPanel) return;

      // Update ARIA and states
      tabButtons.forEach(btn => {
        const isSelected = btn === targetBtn;
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
        btn.setAttribute("tabindex", isSelected ? "0" : "-1");
      });

      // Crossfade panels
      tabPanels.forEach(panel => {
        panel.classList.remove("active");
      });
      targetPanel.classList.add("active");

      // Position sliding indicator
      if (tabIndicator) {
        tabIndicator.style.transform = `translateX(${targetBtn.offsetLeft}px)`;
        tabIndicator.style.width = `${targetBtn.offsetWidth}px`;
      }

      // Smooth container height
      if (panelsContainer) {
        panelsContainer.style.height = `${targetPanel.scrollHeight}px`;
      }

      // Deep link without jumping scroll
      const hash = targetId.replace("panel-", "");
      if (location.hash !== `#${hash}`) {
        history.replaceState(null, "", `#${hash}`);
      }

      if (smoothScroll) {
        const dossierWrapper = document.getElementById("dossier-wrapper");
        if (dossierWrapper) {
          dossierWrapper.scrollIntoView({ behavior: "smooth" });
        }
      }
    }

    // Click handler
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => activateTab(btn));
    });

    // Keyboard navigation (Left / Right / Home / End)
    tabButtons.forEach((btn, idx) => {
      btn.addEventListener("keydown", (e) => {
        let newIdx = idx;
        if (e.key === "ArrowRight") {
          newIdx = (idx + 1) % tabButtons.length;
        } else if (e.key === "ArrowLeft") {
          newIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
        } else if (e.key === "Home") {
          newIdx = 0;
        } else if (e.key === "End") {
          newIdx = tabButtons.length - 1;
        } else {
          return;
        }
        e.preventDefault();
        tabButtons[newIdx].focus();
        activateTab(tabButtons[newIdx]);
      });
    });

    // Handle deep links from URL hash
    function checkHash() {
      const rawHash = (location.hash || "").replace("#", "").toLowerCase();
      if (["projects", "experience", "skills"].includes(rawHash)) {
        const targetBtn = document.getElementById(`tab-${rawHash}`);
        if (targetBtn) activateTab(targetBtn, false);
      } else {
        activateTab(tabButtons[0], false);
      }
    }

    window.addEventListener("hashchange", checkHash);
    checkHash();

    // Re-adjust height on window resize
    window.addEventListener("resize", () => {
      const activePanel = document.querySelector(".tab-panel.active");
      const activeBtn = document.querySelector('.tab-button[aria-selected="true"]');
      if (activePanel && panelsContainer) {
        panelsContainer.style.height = `${activePanel.scrollHeight}px`;
      }
      if (activeBtn && tabIndicator) {
        tabIndicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
        tabIndicator.style.width = `${activeBtn.offsetWidth}px`;
      }
    });
  }

  /* --------------------------------------------------------------------------
     10. INITIALIZATION
     -------------------------------------------------------------------------- */
  function init() {
    initFilmGrain();
    hydrateContent();
    resizeCanvas();
    initTabs();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("orientationchange", resizeCanvas, { passive: true });

    onScroll();
    preloadFrames();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
