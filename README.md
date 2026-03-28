# IYD Product Studio
**By ItsYourDesigner — for Happy Fount Kitchen Wares**

Mobile-first PWA (Progressive Web App). Works like a native Android app. No Play Store needed.

---

## Features
- Upload product image (camera or gallery)
- Edit: brightness, contrast, saturation, warmth, rotate, flip
- 3 Pose Frames: front view, 3/4 angle, detail close-up
- Size Diagram: width/height/depth arrows with custom color
- AI Tips: Claude analyzes your product for pose & background ideas
- Export all 4 frames as PNG
- Installable on Android home screen

---

## Setup

```bash
# 1. Install
npm install

# 2. Add API key (for AI suggestions)
cp .env.local.example .env.local
# Open .env.local → paste your Anthropic API key

# 3. Run
npm run dev
```

App runs at: http://localhost:3000

---

## Use on Android phone

### Option A — Same WiFi (easiest)
1. Find your laptop's IP address:
   - Windows: open CMD → type `ipconfig` → look for IPv4 Address (e.g. 192.168.1.5)
2. Run: `npm run dev -- --hostname 0.0.0.0`
3. On Android Chrome, open: `http://192.168.1.5:3000`
4. Tap menu (3 dots) → "Add to Home Screen" → Install
5. Opens like a native app from your home screen

### Option B — Deploy to Vercel (access anywhere)
1. Push this project to GitHub
2. Go to vercel.com → Import project
3. Add environment variable: ANTHROPIC_API_KEY
4. Deploy → share the URL with your client

### Option C — Build & serve locally
```bash
npm run build
npm start
```

---

## Android install tips
- Use Chrome on Android
- Open the URL → wait for page to load fully
- Chrome shows "Add to Home Screen" banner automatically
- Or: tap 3-dot menu → "Add to Home screen"
- Icon appears on home screen, opens full screen like a native app

---

Built by ItsYourDesigner | Hosur, Tamil Nadu
