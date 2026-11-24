// AURA Cinematic Portfolio Configuration
// ALL PERSONAL CONTENT AND SETTINGS LIVE HERE

window.AURA_CONFIG = {
  // Personal & Brand Identity
  NAME: "MUHAMMAD HAMZA ZAFAR",
  BRAND: "AURA",
  ROLE_LINE: "VIBE CODER & AI ENGINEER // FOUNDER AXOVION.IO",
  FOOTER_NOTE: "Cinematic sequence: AI-generated. Crafted by Muhammad Hamza Zafar.",

  // Video Frame Configuration
  FRAME_COUNT: 120,
  FRAME_PATH: "frames/frame_{n}.webp", // 3-digit zero-padded (001, 002, ...)
  FRAME_PATH_MOBILE: "frames-m/frame_{n}.webp",
  FRAME_MAP: [
    [0.00, 0],
    [0.75, 70],
    [0.92, 119],
    [1.00, 119]
  ],

  // Act 1: Cinematic Hero Quotes
  HERO_QUOTES: [
    {
      kicker: "// ACT I — 01 • THE DISCIPLINE",
      quote: "Quiet hands build",
      accent: "loud things."
    },
    {
      kicker: "// ACT I — 02 • THE ARCHITECTURE",
      quote: "Details are where",
      accent: "empires are decided."
    },
    {
      kicker: "// ACT I — 03 • THE VELOCITY",
      quote: "I don't chase deadlines.",
      accent: "I outwalk them."
    },
    {
      kicker: "// ACT I — 04 • THE STANDARD",
      quote: "Measured twice.",
      accent: "Shipped once."
    }
  ],
  FINAL_LINE: "By order of the craft.",

  // Act 2: Dossier - Projects (Sourced from GitHub: darkangle4022211-cpu)
  PROJECTS: [
    {
      title: "AI REEL CLIPPER STUDIO",
      description: "Autonomous short-form viral reel generator & multi-platform publisher for Instagram, YouTube Shorts, and TikTok.",
      tech: ["AI AUTOMATION", "JAVASCRIPT", "FFMPEG", "PIPELINES"],
      url: "https://github.com/darkangle4022211-cpu/clipper"
    },
    {
      title: "ESTATERADAR ENTERPRISE",
      description: "Enterprise mobile workforce and real-time property survey application with spatial intelligence.",
      tech: ["JAVASCRIPT", "MOBILE APP", "SURVEY ENGINE", "GEOLOCATION"],
      url: "https://github.com/darkangle4022211-cpu/estateradar-app"
    },
    {
      title: "HYPERDRAIN PLATFORM",
      description: "High-throughput desktop download accelerator and responsive software distribution web platform.",
      tech: ["JAVASCRIPT", "DESKTOP ENGINE", "STREAMING", "CSS"],
      url: "https://github.com/darkangle4022211-cpu/hyperdrain"
    },
    {
      title: "PULSAR AUDIO",
      description: "High-fidelity offline music player and audio workstation interface built for audiophiles.",
      tech: ["WEB AUDIO API", "JAVASCRIPT", "HIGH-FIDELITY DSP", "MODERN CSS"],
      url: "https://github.com/darkangle4022211-cpu/pulsar-audio"
    },
    {
      title: "PULSERELEASE CONSOLE",
      description: "Developer release console and universal auto-update orchestration engine for modern desktop software.",
      tech: ["RELEASE MANAGEMENT", "CI/CD", "DEV TOOLS", "VANILLA JS"],
      url: "https://github.com/darkangle4022211-cpu/pulserelease"
    }
  ],

  // Act 2: Dossier - Work Experience
  EXPERIENCE: [
    {
      period: "2024 — PRESENT",
      role: "Founder & Lead AI Engineer",
      org: "Axovion.io",
      points: [
        "Pioneered agentic vibe-coding workflows to architect, deploy, and scale bespoke custom software and intelligent web applications.",
        "Engineered end-to-end multi-modal AI automation pipelines and specialized client products across international domains.",
        "Delivered complex client specifications into high-impact production releases with uncompromising speed and craftsmanship."
      ]
    },
    {
      period: "2024",
      role: "AI Systems & Software Developer",
      org: "Software House",
      points: [
        "Engineered full-stack web applications and automated intelligent agent scripts for high-volume enterprise contracts.",
        "Built and launched breakthrough automation modules that defied conventional engineering timelines."
      ]
    },
    {
      period: "2020 — 2024",
      role: "Senior Sales Executive & Client Strategist",
      org: "International Call Center",
      points: [
        "Negotiated and closed high-value B2B and B2C sales solutions across competitive international markets.",
        "Cultivated elite client relationship management strategies, consistently shattering sales benchmarks and targets."
      ]
    }
  ],

  // Act 2: Dossier - Technical Skills (Exact User Groupings)
  SKILLS: {
    "AI-Directed Development": [
      "Prompt Engineering",
      "Agentic Coding Workflows (Google Antigravity, Google AI Studio)",
      "Gemini & Claude Multi-Modal Models",
      "Project Specification & Planning",
      "Debugging & Iterating with AI"
    ],
    "Web & Front-End": [
      "HTML5 & Semantic Markup",
      "Modern CSS & Glassmorphism",
      "Vanilla JavaScript Architecture",
      "Responsive Fluid Design",
      "Scroll-Driven Choreography"
    ],
    "Tools & Deployment": [
      "Git & Version Control",
      "GitHub & Remote Collaboration",
      "GitHub Pages Production Deployment",
      "FFmpeg Video Transcoding",
      "Terminal & POSIX Shell Workflows"
    ],
    "Creative & Media": [
      "AI Image Generation (Nano Banana)",
      "AI Video (Veo, Google Flow)",
      "Visual Art Direction",
      "Cinematic Storytelling",
      "Film Grain & Atmospheric Shaders"
    ],
    "Strategy & Languages": [
      "Client Relationship Management",
      "Executive Negotiation & Sales",
      "Urdu (Native / Bilingual)",
      "English (Professional)"
    ]
  },

  // Act 2: Dossier - Social Profiles
  SOCIALS: [
    {
      label: "GitHub",
      url: "https://github.com/darkangle4022211-cpu",
      icon: "github"
    },
    {
      label: "WhatsApp",
      url: "https://wa.me/923228081409",
      icon: "whatsapp"
    },
    {
      label: "Email",
      url: "mailto:hamza.zafar4022211@gmail.com",
      icon: "email"
    }
  ],

  // Primary Contact
  CONTACT: {
    type: "whatsapp", // "whatsapp" | "email"
    value: "+923228081409",
    email: "hamza.zafar4022211@gmail.com"
  }
};
