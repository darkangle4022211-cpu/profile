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
  const pinWrap = document.getElementById("pin-wrap");
  const canvas = document.getElementById("hero-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloader-bar");
  const preloaderStatus = document.getElementById("preloader-status");
  const devNotice = document.getElementById("dev-notice");

  // State Variables
  const frames = new Array(frameCount);
  const frameBitmaps = new Array(frameCount);
  const frameStatus = new Uint8Array(frameCount); // 0=idle, 1=loading, 2=loaded, 3=failed
  const bitmapDecoding = new Uint8Array(frameCount);
  const KEYFRAME_STEP = 8;
  const MAX_MOBILE_BITMAPS = 44;
  let framesLoadedCount = 0;
  let isProceduralFallback = false;
  let targetS = 0;
  let smoothedS = 0;
  let currentFrameFloat = 0;
  let lastDesiredFrameIdx = 0;
  let lastDrawnFrame = -1;
  let isRafRunning = false;
  let lastRafTime = performance.now();
  let emberGlow = 0;
  let fogOffset = 0;

  // Cached Layout & DOM State (avoids layout thrashing and per-frame DOM queries)
  let cachedVw = 0;
  let cachedVh = 0;
  let cachedWrapTop = 0;
  let cachedMetrics = null;
  let cachedRadius = 420;
  let lastActiveCardIdx = -1;
  let heroLayerEl = null;
  let ringLayerEl = null;
  let projectRingEl = null;
  let counterCurrentEl = null;
  let beat5El = null;
  let ringPillEls = [];
  let ringCardEls = [];
  let cardRenderState = [];

  // Prevent scroll restoration jump
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  /* --------------------------------------------------------------------------
     1. STAGE METRICS & SCROLL BUDGET
     -------------------------------------------------------------------------- */
  function isMobileLayout() {
    return window.innerWidth <= 768 || window.matchMedia("(max-aspect-ratio: 1/1)").matches;
  }

  function isPortraitMedia() {
    return window.matchMedia("(max-aspect-ratio: 1/1)").matches;
  }

  function computeStageMetrics() {
    const vh = cachedVh || window.innerHeight;
    const mobile = isMobileLayout();
    const numProjects = (Array.isArray(cfg.PROJECTS) && cfg.PROJECTS.length > 0) ? cfg.PROJECTS.length : 5;
    const heroVh = mobile ? (cfg.HERO_SCROLL_VH_MOBILE || 200) : (cfg.HERO_SCROLL_VH || 300);
    const transVh = mobile ? (cfg.TRANSITION_VH_MOBILE || 45) : (cfg.TRANSITION_VH || 65);
    const stepVh = mobile ? (cfg.RING_STEP_VH_MOBILE || 38) : (cfg.RING_STEP_VH || 50);
    const exitVh = mobile ? (cfg.EXIT_VH_MOBILE || 30) : (cfg.EXIT_VH || 40);

    const heroScroll = heroVh * 0.01 * vh;
    const transition = transVh * 0.01 * vh;
    const ringScroll = (numProjects - 1) * stepVh * 0.01 * vh;
    const exit = exitVh * 0.01 * vh;
    const wrapHeight = vh + heroScroll + transition + ringScroll + exit;

    return {
      vh,
      mobile,
      numProjects,
      heroScroll,
      transition,
      ringScroll,
      exit,
      wrapHeight
    };
  }

  function getStageMetrics() {
    if (!cachedMetrics) {
      cachedMetrics = computeStageMetrics();
    }
    return cachedMetrics;
  }

  function layoutRingCards() {
    if (!ringCardEls.length) return;
    const vw = window.innerWidth;
    if (isMobileLayout()) {
      const cardWidth = Math.min(vw * 0.86, 380);
      cachedRadius = Math.round(Math.max(cardWidth * 0.96, 330));
    } else {
      cachedRadius = Math.round(Math.min(Math.max(vw * 0.42, 380), 520));
    }

    const anglePerCard = 360 / ringCardEls.length;
    ringCardEls.forEach((card, i) => {
      card.style.transform = `rotateY(${i * anglePerCard}deg) translateZ(${cachedRadius}px)`;
    });
  }

  function syncStageLayout(force = false) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Ignore minor vertical browser chrome (address bar) show/hide changes on mobile
    if (!force && cachedVw === vw && Math.abs(vh - cachedVh) <= 120) {
      return;
    }

    cachedVw = vw;
    cachedVh = vh;
    cachedMetrics = computeStageMetrics();

    if (pinWrap) {
      pinWrap.style.height = `${Math.round(cachedMetrics.wrapHeight)}px`;
      cachedWrapTop = pinWrap.offsetTop;
    }

    layoutRingCards();
    resizeCanvas();
  }

  /* --------------------------------------------------------------------------
     2. FILM GRAIN CANVAS GENERATOR
     -------------------------------------------------------------------------- */
  function initFilmGrain() {
    if (isMobileLayout() || window.matchMedia("(pointer: coarse)").matches) return;
    const grainCanvas = document.getElementById("grain-canvas");
    if (!grainCanvas) return;
    const gCtx = grainCanvas.getContext("2d");
    const w = 256;
    const h = 256;
    const imgData = gCtx.createImageData(w, h);
    const buffer32 = new Uint32Array(imgData.data.buffer);
    const len = buffer32.length;
    for (let i = 0; i < len; i++) {
      const noise = (Math.random() * 255) | 0;
      buffer32[i] = (45 << 24) | (noise << 16) | (noise << 8) | noise;
    }
    gCtx.putImageData(imgData, 0, 0);
  }

  /* --------------------------------------------------------------------------
     3. CONTENT HYDRATION (From js/config.js)
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
    if (heroName && cfg.NAME) {
      heroName.setAttribute("aria-label", cfg.NAME);
      const words = cfg.NAME.split(" ");
      heroName.innerHTML = words.map(word => {
        const letters = word.split("").map(ch => 
          `<span class="hero-char" aria-hidden="true">${ch}</span>`
        ).join("");
        return `<span class="hero-word">${letters}</span>`;
      }).join('<span class="char-space">&nbsp;</span>');
    }

    const heroRole = document.getElementById("hero-role");
    if (heroRole && cfg.ROLE_LINE) {
      if (cfg.ROLE_LINE.includes("//")) {
        const parts = cfg.ROLE_LINE.split("//");
        heroRole.innerHTML = `
          <div class="role-primary">${parts[0].trim()}</div>
          <div class="role-secondary"><span class="role-sep">//</span> ${parts[1].trim()}</div>
        `;
      } else {
        heroRole.textContent = cfg.ROLE_LINE;
      }
    }

    // Quotes
    if (Array.isArray(cfg.HERO_QUOTES)) {
      for (let i = 0; i < 4; i++) {
        const qEl = document.getElementById(`quote-${i + 1}`);
        const kickerEl = document.getElementById(`quote-kicker-${i + 1}`);
        const item = cfg.HERO_QUOTES[i];
        if (!item || !qEl) continue;

        if (typeof item === "object") {
          qEl.innerHTML = `${item.quote} <span class="quote-gold">${item.accent}</span>`;
          if (kickerEl && item.kicker) kickerEl.innerHTML = item.kicker;
        } else if (typeof item === "string") {
          const words = item.split(" ");
          if (words.length > 2) {
            const splitAt = Math.max(1, words.length - 2);
            const main = words.slice(0, splitAt).join(" ");
            const acc = words.slice(splitAt).join(" ");
            qEl.innerHTML = `${main} <span class="quote-gold">${acc}</span>`;
          } else {
            qEl.textContent = item;
          }
        }
      }
    }

    // Final Creed
    const finalEl = document.getElementById("final-line");
    if (finalEl && cfg.FINAL_LINE) {
      finalEl.setAttribute("aria-label", cfg.FINAL_LINE);
      const words = cfg.FINAL_LINE.split(" ");
      if (words.length > 2) {
        const splitAt = Math.max(1, words.length - 2);
        const main = words.slice(0, splitAt).join(" ");
        const acc = words.slice(splitAt).join(" ");
        finalEl.innerHTML = `${main} <span class="creed-gold">${acc}</span>`;
      } else {
        finalEl.textContent = cfg.FINAL_LINE;
      }
    }

    // 3D Ring Project Cards
    const projectRing = document.getElementById("project-ring");
    const ringPills = document.getElementById("ring-pills");
    const counterTotal = document.getElementById("counter-total");

    if (projectRing && Array.isArray(cfg.PROJECTS)) {
      projectRing.innerHTML = cfg.PROJECTS.map((proj, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const category = proj.category || "AI WORKSTATION";
        const themeColor = proj.themeColor || "#E8A33D";
        const techTags = Array.isArray(proj.tech)
          ? proj.tech.map(t => `<span class="tech-tag">${t}</span>`).join("")
          : "";
        const iconSrc = proj.icon || "assets/icons/clipper.svg";
        const isLiveProfile = proj.hasProfile === true;
        const profileUrl = proj.profileUrl || proj.githubUrl || "#";
        const githubUrl = proj.githubUrl || profileUrl;

        return `
          <article class="ring-card" data-index="${idx}" style="--card-theme: ${themeColor};">
            <div class="card-header-row">
              <div class="card-identity">
                <div class="card-app-icon-wrap" style="--app-glow: ${themeColor};">
                  <img src="${iconSrc}" class="card-app-icon" alt="${proj.title} icon" loading="lazy" />
                </div>
                <div class="card-heading-group">
                  <div class="card-kicker">${category} // ${num}</div>
                  <h3 class="card-title">${proj.title}</h3>
                </div>
              </div>
            </div>

            <div class="card-body-row">
              <p class="card-desc">${proj.description}</p>
              <div class="card-tech-row">
                ${techTags}
              </div>
            </div>

            <div class="card-actions-row">
              ${isLiveProfile ? `
                <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-primary">
                  <span>VISIT PROFILE</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>
                <a href="${githubUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-secondary">
                  <span>VIEW SOURCE</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>
              ` : `
                <a href="${githubUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-primary">
                  <span>VIEW REPOSITORY</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>
              `}
            </div>
          </article>
        `;
      }).join("");

      if (ringPills) {
        const shortNames = ["CLIPPER", "HYPERDRAIN", "PULSAR AUDIO", "PULSERELEASE", "ESTATERADAR"];
        ringPills.innerHTML = cfg.PROJECTS.map((proj, idx) => {
          const num = String(idx + 1).padStart(2, "0");
          const name = shortNames[idx] || proj.title;
          return `
            <button class="ring-pill ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="Go to project ${num}">
              <span class="pill-num">${num}</span> ${name}
            </button>
          `;
        }).join("");
      }

      if (counterTotal) {
        counterTotal.textContent = String(cfg.PROJECTS.length).padStart(2, "0");
      }
    }

    // Work Experience Rows
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

    // Technical Skills Grid
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
    heroLayerEl = document.getElementById("hero-layer");
    ringLayerEl = document.getElementById("ring-layer");
    projectRingEl = document.getElementById("project-ring");
    counterCurrentEl = document.getElementById("counter-current");
    beat5El = document.getElementById("beat-5");
    ringPillEls = Array.from(document.querySelectorAll(".ring-pill"));
    ringCardEls = Array.from(document.querySelectorAll(".ring-card"));
    cardRenderState = ringCardEls.map(() => ({ opacity: -1, active: false, pointer: "", visible: true }));
    lastActiveCardIdx = -1;
  }

  /* --------------------------------------------------------------------------
     4. CANVAS SIZING, DPR RESOLUTION & MOBILE BITMAP CACHE
     -------------------------------------------------------------------------- */
  function clearFrameBitmaps() {
    for (let i = 0; i < frameBitmaps.length; i++) {
      if (frameBitmaps[i]) {
        try {
          if (typeof frameBitmaps[i].close === "function") frameBitmaps[i].close();
        } catch (e) {}
        frameBitmaps[i] = null;
      }
      bitmapDecoding[i] = 0;
    }
  }

  function resizeCanvas() {
    const mobile = isMobileLayout();
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2.0);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      clearFrameBitmaps();
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = mobile ? "medium" : "high";
    drawCurrentFrame(true);
  }

  function isKeyframeIndex(idx) {
    return idx === 0 || idx === frameCount - 1 || idx === frameMap[1][1] || (idx % KEYFRAME_STEP === 0);
  }

  function evictDistantBitmaps(centerIdx) {
    let activeCount = 0;
    for (let i = 0; i < frameBitmaps.length; i++) {
      if (frameBitmaps[i]) activeCount++;
    }
    if (activeCount <= MAX_MOBILE_BITMAPS) return;

    // Close farthest non-keyframes first until under cap
    while (activeCount > MAX_MOBILE_BITMAPS) {
      let bestIdx = -1;
      let bestDist = -1;
      for (let i = 0; i < frameBitmaps.length; i++) {
        if (!frameBitmaps[i] || isKeyframeIndex(i)) continue;
        const dist = Math.abs(i - centerIdx);
        if (dist > bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      try {
        if (typeof frameBitmaps[bestIdx].close === "function") frameBitmaps[bestIdx].close();
      } catch (e) {}
      frameBitmaps[bestIdx] = null;
      activeCount--;
    }
  }

  function decodeBitmapForFrame(index, centerIdx) {
    if (!isMobileLayout() || typeof createImageBitmap !== "function") return;
    const img = frames[index];
    if (!img || !img.naturalWidth || frameBitmaps[index] || bitmapDecoding[index]) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (!cw || !ch) return;

    bitmapDecoding[index] = 1;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const coverScale = Math.max(cw / imgW, ch / imgH);
    const zoomHeadroom = (index >= frameCount - 6) ? 1.2 : 1.0;
    const destW = Math.min(imgW, Math.max(64, Math.round(imgW * coverScale * zoomHeadroom)));
    const destH = Math.min(imgH, Math.max(64, Math.round(destW * (imgH / imgW))));

    const finishDecode = (bm) => {
      bitmapDecoding[index] = 0;
      if (!bm) return;
      frameBitmaps[index] = bm;
      evictDistantBitmaps(centerIdx);
      if (index === lastDesiredFrameIdx && lastDrawnFrame !== index) {
        drawCurrentFrame(true);
      }
    };

    try {
      createImageBitmap(img, {
        resizeWidth: destW,
        resizeHeight: destH,
        resizeQuality: "high"
      })
        .then(finishDecode)
        .catch(() => {
          createImageBitmap(img).then(finishDecode).catch(() => {
            bitmapDecoding[index] = 0;
          });
        });
    } catch (e) {
      createImageBitmap(img).then(finishDecode).catch(() => {
        bitmapDecoding[index] = 0;
      });
    }
  }

  function ensureBitmapsAround(centerIdx) {
    if (!isMobileLayout() || typeof createImageBitmap !== "function") return;
    // Decode immediate center + lookahead/lookbehind window off main thread
    const offsets = [0, 1, -1, 2, -2, 3, 4, -3, 5, 6, -4, 7, 8];
    for (let i = 0; i < offsets.length; i++) {
      const idx = centerIdx + offsets[i];
      if (idx >= 0 && idx < frameCount && frames[idx] && !frameBitmaps[idx]) {
        decodeBitmapForFrame(idx, centerIdx);
      }
    }
  }

  /* --------------------------------------------------------------------------
     5. ADAPTIVE FRAME LOADER, NETWORK RECOVERY & KEYFRAME STREAMING
     -------------------------------------------------------------------------- */
  let urgentQueue = [];
  let stagedQueue = [];
  let activeWorkers = 0;
  let retryScheduled = false;

  function getNetworkProfile() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(conn && conn.saveData);
    const eff = conn && conn.effectiveType ? conn.effectiveType : "";
    const downlink = conn && typeof conn.downlink === "number" ? conn.downlink : 0;

    if (saveData || eff === "slow-2g" || eff === "2g" || (downlink > 0 && downlink < 1.2)) {
      return { concurrency: 2, timeoutMs: 22000, maxRetries: 4, tier: "slow" };
    }
    if (eff === "3g" || (downlink > 0 && downlink < 3.5)) {
      return { concurrency: 3, timeoutMs: 16000, maxRetries: 4, tier: "medium" };
    }
    return { concurrency: isMobileLayout() ? 4 : 6, timeoutMs: 12000, maxRetries: 3, tier: "fast" };
  }

  function getFrameUrl(index) {
    const portrait = isPortraitMedia();
    const template = (portrait && cfg.FRAME_PATH_MOBILE) ? cfg.FRAME_PATH_MOBILE : (cfg.FRAME_PATH || "frames/frame_{n}.webp");
    const num = String(index + 1).padStart(3, "0");
    return template.replace("{n}", num) + "?v=8";
  }

  function fetchSingleImage(src, timeoutMs) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          img.onload = null;
          img.onerror = null;
          img.src = ""; // abort hung socket cleanly on unstable networks
          reject(new Error("Timeout loading " + src));
        }
      }, timeoutMs);

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
        reject(err || new Error("Failed to load " + src));
      };

      img.src = src;
    });
  }

  async function loadImageWithRetry(index, customProfile) {
    if (frameStatus[index] === 2 && frames[index]) return frames[index];
    if (frameStatus[index] === 1) return null;

    const profile = customProfile || getNetworkProfile();
    const src = getFrameUrl(index);
    const delays = [500, 1200, 2500, 4000];
    frameStatus[index] = 1;

    for (let attempt = 0; attempt <= profile.maxRetries; attempt++) {
      try {
        const img = await fetchSingleImage(src, profile.timeoutMs);
        frames[index] = img;
        frameStatus[index] = 2;
        framesLoadedCount++;

        // Recover gracefully if earlier outage forced procedural fallback
        if (isProceduralFallback) {
          isProceduralFallback = false;
          if (devNotice) devNotice.classList.remove("visible");
          drawCurrentFrame(true);
        }

        if (isMobileLayout() && Math.abs(index - lastDesiredFrameIdx) <= 10) {
          decodeBitmapForFrame(index, lastDesiredFrameIdx);
        }
        if (Math.abs(index - lastDesiredFrameIdx) <= 4 && lastDrawnFrame !== lastDesiredFrameIdx) {
          drawCurrentFrame(true);
        }
        return img;
      } catch (err) {
        if (attempt < profile.maxRetries) {
          const waitMs = delays[Math.min(attempt, delays.length - 1)];
          await new Promise(res => setTimeout(res, waitMs));
        }
      }
    }

    frameStatus[index] = 3;
    throw new Error("Retries exhausted for frame " + index);
  }

  function buildKeyframePriorityList() {
    const added = new Uint8Array(frameCount);
    const list = [];
    const pushUnique = (idx) => {
      if (idx >= 0 && idx < frameCount && !added[idx] && frameStatus[idx] !== 2) {
        added[idx] = 1;
        list.push(idx);
      }
    };

    // Pass 1: Keyframes across entire narrative arc + cigar moment + end frame
    pushUnique(0);
    pushUnique(frameCount - 1);
    if (Array.isArray(frameMap) && frameMap[1]) pushUnique(frameMap[1][1]);
    for (let step = 8; step >= 1; step = Math.floor(step / 2)) {
      for (let i = 0; i < frameCount; i += step) {
        pushUnique(i);
      }
    }
    return list;
  }

  function boostFramePriority(centerIdx) {
    if (frameStatus[centerIdx] === 2) return;
    const windowOffsets = [0, 1, -1, 2, -2, 3, 4, 5, 6];
    for (let i = windowOffsets.length - 1; i >= 0; i--) {
      const idx = centerIdx + windowOffsets[i];
      if (idx >= 0 && idx < frameCount) {
        if (frameStatus[idx] === 3 && navigator.onLine !== false) {
          frameStatus[idx] = 0;
        }
        if (frameStatus[idx] === 0 && !urgentQueue.includes(idx)) {
          urgentQueue.unshift(idx);
        }
      }
    }
    runWorkerPool();
  }

  function popNextFrameIndex() {
    while (urgentQueue.length > 0) {
      const idx = urgentQueue.shift();
      if (frameStatus[idx] === 0) return idx;
    }
    while (stagedQueue.length > 0) {
      const idx = stagedQueue.shift();
      if (frameStatus[idx] === 0) return idx;
    }
    return -1;
  }

  function runWorkerPool() {
    const profile = getNetworkProfile();
    while (activeWorkers < profile.concurrency && (urgentQueue.length > 0 || stagedQueue.length > 0)) {
      activeWorkers++;
      (async () => {
        try {
          while (true) {
            const idx = popNextFrameIndex();
            if (idx === -1) break;
            try {
              await loadImageWithRetry(idx, getNetworkProfile());
            } catch (e) {}
          }
        } finally {
          activeWorkers--;
          if (urgentQueue.length === 0 && stagedQueue.length === 0 && activeWorkers === 0) {
            scheduleFailedRetry();
          }
        }
      })();
    }
  }

  function scheduleFailedRetry() {
    if (retryScheduled) return;
    const hasFailed = frameStatus.some(s => s === 3);
    if (!hasFailed) return;
    retryScheduled = true;
    setTimeout(() => {
      retryScheduled = false;
      resumePendingFrames();
    }, 3000);
  }

  function resumePendingFrames() {
    if (navigator.onLine === false) return;
    let queuedAny = false;
    for (let i = 0; i < frameCount; i++) {
      if (frameStatus[i] === 3 || frameStatus[i] === 0) {
        frameStatus[i] = 0;
        queuedAny = true;
      }
    }
    if (!queuedAny) return;
    if (frameStatus[0] !== 2) {
      urgentQueue.unshift(0);
    }
    stagedQueue = buildKeyframePriorityList();
    runWorkerPool();
  }

  async function preloadFrames() {
    const minHoldPromise = new Promise(resolve => setTimeout(resolve, 550));
    const profile = getNetworkProfile();

    try {
      await loadImageWithRetry(0, profile);
      updatePreloader(45);
      drawCurrentFrame(true);

      // Load only 2–4 crisp early keyframes before opening UI so weak connections never hang
      const earlyIndices = profile.tier === "slow" ? [8, frameCount - 1] : [4, 8, 16, frameCount - 1];
      const earlyPromise = Promise.allSettled(
        earlyIndices.filter(idx => idx > 0 && idx < frameCount).map(idx => loadImageWithRetry(idx, profile))
      );
      const graceCap = new Promise(resolve => setTimeout(resolve, profile.tier === "slow" ? 1800 : 1200));
      await Promise.race([earlyPromise, graceCap]);
      updatePreloader(100);
    } catch (e) {
      enableProceduralFallback();
      updatePreloader(100);
    }

    await minHoldPromise;
    drawCurrentFrame(true);

    preloader.classList.add("loaded");
    document.body.classList.remove("loading-locked");
    startRafLoop();

    // Stream remaining frames across whole timeline via keyframe priority worker pool
    stagedQueue = buildKeyframePriorityList();
    runWorkerPool();
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
     6. PROCEDURAL CANVAS RENDERER (Fallback Mode)
     -------------------------------------------------------------------------- */
  function renderProceduralScene(cw, ch, progress) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cw, ch);

    fogOffset += 0.003;
    const centerX = cw * 0.5;
    const centerY = ch * 0.55;

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

    const silhouetteHeight = ch * 0.48;
    const silhouetteWidth = silhouetteHeight * 0.35;
    const headRadius = silhouetteWidth * 0.22;
    const figY = centerY - silhouetteHeight * 0.15;

    ctx.save();
    ctx.fillStyle = "#080808";
    ctx.beginPath();
    ctx.moveTo(centerX - silhouetteWidth * 0.45, figY + silhouetteHeight);
    ctx.lineTo(centerX - silhouetteWidth * 0.35, figY + headRadius * 2.8);
    ctx.lineTo(centerX - silhouetteWidth * 0.25, figY + headRadius * 1.5);
    ctx.lineTo(centerX - headRadius * 1.25, figY + headRadius * 0.6);
    ctx.arc(centerX, figY, headRadius * 0.95, Math.PI, 0, false);
    ctx.lineTo(centerX + headRadius * 1.35, figY + headRadius * 0.7);
    ctx.lineTo(centerX + silhouetteWidth * 0.25, figY + headRadius * 1.5);
    ctx.lineTo(centerX + silhouetteWidth * 0.35, figY + headRadius * 2.8);
    ctx.lineTo(centerX + silhouetteWidth * 0.45, figY + silhouetteHeight);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(232, 163, 61, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

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
     7. CANVAS FRAME DRAWING (Cover Fit, Nearest Keyframe & Bitmap Blit)
     -------------------------------------------------------------------------- */
  function findNearestLoadedSource(targetIdx) {
    const mobile = isMobileLayout();
    const hasReady = (k) => {
      if (k < 0 || k >= frameCount) return false;
      if (mobile && frameBitmaps[k]) return true;
      return Boolean(frames[k] && frames[k].naturalWidth);
    };

    let matchedIdx = -1;
    if (hasReady(targetIdx)) {
      matchedIdx = targetIdx;
    } else {
      for (let delta = 1; delta < frameCount; delta++) {
        if (hasReady(targetIdx - delta)) {
          matchedIdx = targetIdx - delta;
          break;
        }
        if (hasReady(targetIdx + delta)) {
          matchedIdx = targetIdx + delta;
          break;
        }
      }
    }
    if (matchedIdx === -1) return null;
    const source = (mobile && frameBitmaps[matchedIdx]) ? frameBitmaps[matchedIdx] : frames[matchedIdx];
    return { idx: matchedIdx, source };
  }

  function drawCurrentFrame(force = false) {
    const targetIdx = Math.max(0, Math.min(Math.round(currentFrameFloat), frameCount - 1));
    lastDesiredFrameIdx = targetIdx;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const { heroScroll } = getStageMetrics();
    const p = heroScroll > 0 ? Math.min(Math.max(smoothedS / heroScroll, 0), 1) : 0;

    if (isProceduralFallback) {
      renderProceduralScene(cw, ch, p);
      lastDrawnFrame = targetIdx;
      return;
    }

    if (frameStatus[targetIdx] !== 2) {
      boostFramePriority(targetIdx);
    }
    ensureBitmapsAround(targetIdx);

    const resolved = findNearestLoadedSource(targetIdx);
    if (!resolved || !resolved.source) {
      renderProceduralScene(cw, ch, p);
      return;
    }

    if (!force && resolved.idx === lastDrawnFrame) {
      return;
    }

    const src = resolved.source;
    const srcW = src.naturalWidth || src.width;
    const srcH = src.naturalHeight || src.height;

    if (srcW && srcH) {
      const scale = Math.max(cw / srcW, ch / srcH);
      const dw = srcW * scale;
      const dh = srcH * scale;
      const dx = (cw - dw) * 0.5;
      const dy = (ch - dh) * 0.5;

      if (dx > 0 || dy > 0) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.drawImage(src, dx, dy, dw, dh);
      lastDrawnFrame = resolved.idx;
    } else {
      renderProceduralScene(cw, ch, p);
    }
  }

  /* --------------------------------------------------------------------------
     8. PIECEWISE LINEAR FRAME MAPPING
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

  /* --------------------------------------------------------------------------
     9. UNIFIED rAF LOOP & SCROLL CHOREOGRAPHY
     -------------------------------------------------------------------------- */
  function startRafLoop() {
    if (isRafRunning) return;
    isRafRunning = true;
    lastRafTime = performance.now();
    requestAnimationFrame(rafTick);
  }

  function rafTick(now) {
    const dt = Math.min(Math.max(now - lastRafTime, 1), 50);
    lastRafTime = now;

    const { mobile, heroScroll, transition, ringScroll, exit } = getStageMetrics();

    // Mobile-responsive scroll smoothing (snappier tracking for native touch inertia)
    const smoothFactor = mobile ? 0.24 : 0.11;
    const decay = 1 - Math.pow(1 - smoothFactor, dt / 16.67);
    smoothedS += (targetS - smoothedS) * decay;

    if (Math.abs(targetS - smoothedS) < 0.35) {
      smoothedS = targetS;
    }

    // Derived phases: fully scroll-linked, reversible, zero state flags
    const p = heroScroll > 0 ? Math.min(Math.max(smoothedS / heroScroll, 0), 1) : 1;
    const q = transition > 0 ? Math.min(Math.max((smoothedS - heroScroll) / transition, 0), 1) : 0;
    const r = ringScroll > 0 ? Math.min(Math.max((smoothedS - heroScroll - transition) / ringScroll, 0), 1) : 0;
    const x = exit > 0 ? Math.min(Math.max((smoothedS - heroScroll - transition - ringScroll) / exit, 0), 1) : 0;

    // Phase (a) & (b): Hero video frames, narrative beats, and slow push-in
    const heroHidden = q >= 0.99;
    if (heroLayerEl) {
      heroLayerEl.style.visibility = heroHidden ? "hidden" : "visible";
    }
    if (!heroHidden) {
      currentFrameFloat = progressToFrame(p);
      drawCurrentFrame(isProceduralFallback);
      updateNarrativeBeats(p, q);
      if (canvas) {
        const heroScale = 1 + q * 0.35;
        canvas.style.transformOrigin = "50% 38%";
        canvas.style.transform = `scale3d(${heroScale.toFixed(4)}, ${heroScale.toFixed(4)}, 1)`;
        canvas.style.opacity = Math.max(0, 1 - q * 1.15).toFixed(3);
      }
    } else if (canvas && canvas.style.opacity !== "0") {
      canvas.style.opacity = "0";
    }

    // Phase (c): 3D Ring emergence, rotation, and exit
    update3DRing(q, r, x);

    // Check if settled
    const isSettled = Math.abs(targetS - smoothedS) < 0.35;
    if (!isProceduralFallback && isSettled) {
      isRafRunning = false;
      return;
    }

    requestAnimationFrame(rafTick);
  }

  /* --------------------------------------------------------------------------
     10. NARRATIVE BEATS TIMING & CREED FADE
     -------------------------------------------------------------------------- */
  const beats = [
    { el: document.getElementById("beat-0"), min: 0.00, max: 0.20 },
    { el: document.getElementById("beat-1"), min: 0.21, max: 0.32 },
    { el: document.getElementById("beat-2"), min: 0.34, max: 0.45 },
    { el: document.getElementById("beat-3"), min: 0.47, max: 0.58 },
    { el: document.getElementById("beat-4"), min: 0.60, max: 0.72 },
    { el: document.getElementById("beat-5"), min: 0.80, max: 1.00 }
  ];

  function updateNarrativeBeats(p, q) {
    for (let i = 0; i < beats.length - 1; i++) {
      const beat = beats[i];
      if (!beat.el) continue;
      const isActive = (q === 0) && (p >= beat.min && p <= beat.max);
      beat.el.classList.toggle("active", isActive);
    }

    // Beat 5 (The Creed): active from 0.80, dissolves with push-in (q) with NO translateY
    if (beat5El) {
      if (p >= 0.80) {
        beat5El.classList.add("active");
        if (q > 0) {
          const beat5Alpha = Math.max(0, 1 - q * 2.5);
          beat5El.style.opacity = beat5Alpha.toFixed(3);
          beat5El.style.pointerEvents = (beat5Alpha > 0.1) ? "auto" : "none";
        } else {
          beat5El.style.opacity = "1";
          beat5El.style.pointerEvents = "auto";
        }
      } else {
        beat5El.classList.remove("active");
        beat5El.style.opacity = "0";
        beat5El.style.pointerEvents = "none";
      }
    }
  }

  /* --------------------------------------------------------------------------
     11. 3D RING EMERGENCE, ROTATION & NAVIGATION
     -------------------------------------------------------------------------- */
  function update3DRing(q, r, x) {
    if (!ringLayerEl || !projectRingEl || !ringCardEls.length) return;

    // Ring layer opacity & GPU visibility culling
    const ringOpacity = (q > 0) ? Math.min(1, q * 1.35) * Math.max(0, 1 - x * 1.35) : 0;
    const isInteractive = (q >= 0.75 && x < 0.25);

    if (ringOpacity <= 0.002) {
      if (ringLayerEl.style.visibility !== "hidden") {
        ringLayerEl.style.opacity = "0";
        ringLayerEl.style.visibility = "hidden";
        ringLayerEl.style.pointerEvents = "none";
      }
      return;
    }

    if (ringLayerEl.style.visibility !== "visible") {
      ringLayerEl.style.visibility = "visible";
    }
    ringLayerEl.style.opacity = ringOpacity.toFixed(3);
    ringLayerEl.style.pointerEvents = isInteractive ? "auto" : "none";

    // Depth emergence & exit push
    const mobile = isMobileLayout();
    const exitPush = mobile ? 180 : 280;
    const depthZ = (1 - q) * -520 + x * exitPush;

    // Rotation angle
    const numCards = ringCardEls.length;
    const anglePerCard = 360 / numCards; // 72 deg for 5 cards
    const totalSpan = (numCards - 1) * anglePerCard; // 288 deg
    const currentAngle = r * totalSpan;

    projectRingEl.style.transform = `translateZ(${(-cachedRadius + depthZ).toFixed(1)}px) rotateY(${(-currentAngle).toFixed(2)}deg)`;

    // Active card calculation
    const activeIdx = Math.min(Math.max(Math.round(r * (numCards - 1)), 0), numCards - 1);

    for (let i = 0; i < numCards; i++) {
      const card = ringCardEls[i];
      const st = cardRenderState[i];
      const cardAngle = i * anglePerCard;

      let diff = (cardAngle - currentAngle) % 360;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      const absDiff = Math.abs(diff);
      const isFront = absDiff < anglePerCard * 0.48;
      const cosVal = Math.max(0, Math.cos(diff * Math.PI / 180));
      const targetOp = isFront ? 1 : (cosVal <= 0.14 ? 0 : Math.pow(cosVal, 1.55) * 0.65);
      const targetVisible = targetOp > 0.01;
      const targetPointer = (isFront && isInteractive) ? "auto" : "none";

      if (st.active !== isFront) {
        st.active = isFront;
        card.classList.toggle("active-card", isFront);
      }
      if (st.visible !== targetVisible) {
        st.visible = targetVisible;
        card.style.visibility = targetVisible ? "visible" : "hidden";
      }
      if (Math.abs(st.opacity - targetOp) > 0.008) {
        st.opacity = targetOp;
        card.style.opacity = targetOp === 1 ? "1" : targetOp.toFixed(2);
      }
      if (st.pointer !== targetPointer) {
        st.pointer = targetPointer;
        card.style.pointerEvents = targetPointer;
      }
    }

    if (activeIdx !== lastActiveCardIdx) {
      lastActiveCardIdx = activeIdx;
      if (counterCurrentEl) {
        counterCurrentEl.textContent = String(activeIdx + 1).padStart(2, "0");
      }
      for (let i = 0; i < ringPillEls.length; i++) {
        ringPillEls[i].classList.toggle("active", i === activeIdx);
      }
    }
  }

  function navigateToCard(targetIdx) {
    if (!pinWrap || !ringCardEls.length) return;

    const numCards = ringCardEls.length;
    const clamped = Math.min(Math.max(targetIdx, 0), numCards - 1);
    const { heroScroll, transition, ringScroll } = getStageMetrics();

    const targetScroll = cachedWrapTop + heroScroll + transition + (clamped / (numCards - 1)) * ringScroll + 2;
    window.scrollTo({ top: targetScroll, behavior: "smooth" });
  }

  function initRingControls() {
    const prevBtn = document.getElementById("ring-prev-btn");
    const nextBtn = document.getElementById("ring-next-btn");

    const getCurrentIdx = () => {
      const { heroScroll, transition, ringScroll, numProjects } = getStageMetrics();
      const r = ringScroll > 0 ? Math.min(Math.max((smoothedS - heroScroll - transition) / ringScroll, 0), 1) : 0;
      return Math.round(r * (numProjects - 1));
    };

    if (prevBtn) {
      prevBtn.addEventListener("click", () => navigateToCard(getCurrentIdx() - 1));
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => navigateToCard(getCurrentIdx() + 1));
    }

    ringPillEls.forEach(pill => {
      pill.addEventListener("click", () => {
        const idx = parseInt(pill.getAttribute("data-index") || "0", 10);
        navigateToCard(idx);
      });
    });

    // Optional passive horizontal touch swipe on card stage (never blocks native vertical scroll)
    if (ringLayerEl) {
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartT = 0;

      ringLayerEl.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartT = performance.now();
      }, { passive: true });

      ringLayerEl.addEventListener("touchend", (e) => {
        if (!e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = performance.now() - touchStartT;
        if (dt < 500 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          navigateToCard(getCurrentIdx() + (dx < 0 ? 1 : -1));
        }
      }, { passive: true });
    }
  }

  /* --------------------------------------------------------------------------
     12. NATIVE SCROLL LISTENER (Zero layout reads, zero scroll-jacking)
     -------------------------------------------------------------------------- */
  function onScroll() {
    if (!pinWrap) return;

    const { wrapHeight, vh } = getStageMetrics();
    const maxS = Math.max(0, wrapHeight - vh);

    targetS = Math.min(Math.max(window.scrollY - cachedWrapTop, 0), maxS);

    startRafLoop();
  }

  /* --------------------------------------------------------------------------
     13. NOIR CIPHER TEXT SCRAMBLE
     -------------------------------------------------------------------------- */
  function initTextScramble() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_//--++**";

    function scrambleElement(el) {
      if (!el || el.dataset.scrambling === "true") return;

      const original = el.dataset.originalText || el.textContent.trim();
      if (!original) return;
      el.dataset.originalText = original;
      el.dataset.scrambling = "true";
      el.classList.add("scramble-active");

      const length = original.length;
      let frame = 0;
      const totalFrames = 8;

      const timer = setInterval(() => {
        frame++;
        const revealedCount = Math.floor((frame / totalFrames) * length);

        let scrambled = "";
        for (let i = 0; i < length; i++) {
          const char = original[i];
          if (char === " " || char === "/" || char === "[" || char === "]" || char === "&" || char === "-") {
            scrambled += char;
          } else if (i < revealedCount) {
            scrambled += char;
          } else {
            scrambled += chars[Math.floor(Math.random() * chars.length)];
          }
        }

        el.textContent = scrambled;

        if (frame >= totalFrames) {
          clearInterval(timer);
          el.textContent = original;
          el.dataset.scrambling = "false";
          el.classList.remove("scramble-active");
        }
      }, 25);
    }

    const scrambleSelector = ".hero-role, .role-primary, .role-secondary, .quote-kicker, .scroll-cue-text, .final-lead, .eyebrow-main, .card-kicker, .experience-period, .experience-org, .skill-group-title, .footer-note, .btn-action-primary span, .btn-action-secondary span, .section-kicker";

    document.addEventListener("mouseenter", (e) => {
      const target = e.target;
      if (target && target.matches && target.matches(scrambleSelector)) {
        scrambleElement(target);
      }
    }, true);
  }

  /* --------------------------------------------------------------------------
     14. AMBIENT NOIR CURSOR FOLLOWER & FONT FOCUS AURA
     -------------------------------------------------------------------------- */
  function initAuraCursor() {
    if (isMobileLayout() || window.matchMedia("(pointer: coarse)").matches) return;
    const cursorWrap = document.getElementById("aura-cursor");
    if (!cursorWrap) return;
    const dot = cursorWrap.querySelector(".aura-cursor-dot");
    const ring = cursorWrap.querySelector(".aura-cursor-ring");
    if (!dot || !ring) return;

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isVisible = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        cursorWrap.classList.add("active");
        ringX = mouseX;
        ringY = mouseY;
      }
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      if (reducedMotion) {
        ring.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }
    }, { passive: true });

    window.addEventListener("mouseleave", () => {
      isVisible = false;
      cursorWrap.classList.remove("active");
    });

    if (!reducedMotion) {
      function renderCursor() {
        if (isVisible) {
          ringX += (mouseX - ringX) * 0.18;
          ringY += (mouseY - ringY) * 0.18;
          ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
        }
        requestAnimationFrame(renderCursor);
      }
      requestAnimationFrame(renderCursor);
    }

    document.addEventListener("mouseover", (e) => {
      const target = e.target;
      if (!target) return;

      const actionEl = target.closest("a, button, .contact-action, .social-link, .btn-action-primary, .btn-action-secondary, .ring-pill, .ring-arrow-btn");
      if (actionEl) {
        cursorWrap.classList.add("hovering-action");
        cursorWrap.classList.remove("hovering-text");
        return;
      }

      const textEl = target.closest("h1, h2, h3, p, span, li, .hero-name, .hero-role, .beat-quote, .final-title, .experience-org, .skill-item");
      if (textEl) {
        cursorWrap.classList.add("hovering-text");
        cursorWrap.classList.remove("hovering-action");
        return;
      }

      cursorWrap.classList.remove("hovering-text", "hovering-action");
    }, { passive: true });
  }

  /* --------------------------------------------------------------------------
     15. AMBIENT HERO LANTERN / MATCH LIGHT TRACKER
     -------------------------------------------------------------------------- */
  function initHeroLantern() {
    const pinStage = document.getElementById("pin");
    if (!pinStage || isMobileLayout() || window.matchMedia("(pointer: coarse)").matches) return;

    let ticking = false;
    pinStage.addEventListener("mousemove", (e) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const rect = pinStage.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          pinStage.style.setProperty("--mouse-x", `${x}px`);
          pinStage.style.setProperty("--mouse-y", `${y}px`);
          pinStage.classList.add("mouse-active");
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    pinStage.addEventListener("mouseleave", () => {
      pinStage.classList.remove("mouse-active");
    });
  }

  function registerOfflineCache() {
    if (
      "serviceWorker" in navigator &&
      (location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1")
    ) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  /* --------------------------------------------------------------------------
     16. INITIALIZATION
     -------------------------------------------------------------------------- */
  function init() {
    registerOfflineCache();
    initFilmGrain();
    hydrateContent();
    syncStageLayout(true);
    initRingControls();
    initTextScramble();
    initAuraCursor();
    initHeroLantern();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("online", resumePendingFrames, { passive: true });
    window.addEventListener("resize", () => {
      syncStageLayout(false);
      onScroll();
    }, { passive: true });
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        syncStageLayout(true);
        onScroll();
      }, 150);
    }, { passive: true });

    onScroll();
    preloadFrames();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
