# 🔥 BEATFORGE Sample Studio

A browser-based sample production studio for creating hip-hop beats — powered by AI.

![BEATFORGE](https://img.shields.io/badge/BEATFORGE-Sample%20Studio-FF9500?style=for-the-badge)

## Features

### 💿 Multi-Track Sampling
- Load up to 4 audio samples simultaneously
- Start/end point trimming with waveform visualization
- Speed control for chipmunk soul (pitch up) or chopped & screwed (pitch down)
- Per-track volume, loop, and mute controls

### 🥁 Drum Machine
- 16-step sequencer with 8 synthesized drum voices (kick, snare, hi-hat, open hat, clap, tom, rim, cowbell)
- Built-in presets: Boom Bap, Trap, Lo-Fi, House, R&B
- Per-instrument preview and volume control

### 🎤 Vocal Layer
- Load vocal tracks / acapellas over your beats
- Speed/pitch control for vocal effects
- Waveform display with start point control

### 🎚 Effects Rack
- **Filter**: Lowpass / Highpass / Bandpass with frequency + resonance
- **Reverb**: Convolution-based room reverb with wet/dry mix
- **Delay**: Time, feedback, and mix controls
- **Sidechain Pump**: Auto-duck on every beat for that classic breathing effect

### 🧠 AI Sample Advisor
- Type any song name and get AI-powered production advice
- Suggested chop points with timestamps
- Auto-generated drum pattern matched to the sample
- BPM suggestions, FX settings, speed recommendations
- Reference tracks and production tips
- One-tap "Apply" buttons for drums and FX

### ⏺ Export
- Record your full session (samples + drums + vocals + FX)
- Download as audio file

### 📱 Works Offline (PWA)
- Installable as a standalone app on mobile and desktop
- Service worker caches all assets for offline use
- Works without internet after first load

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/beatforge.git
cd beatforge

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deploy

The `dist/` folder after `npm run build` can be deployed to any static host:

- **Vercel**: `npx vercel`
- **Netlify**: Drag & drop `dist/` folder
- **GitHub Pages**: Use `gh-pages` branch with the `dist/` folder

## Tech Stack

- **React 18** — UI framework
- **Vite** — Build tool
- **Web Audio API** — All audio synthesis and playback
- **Anthropic Claude API** — AI sample analysis
- **Service Worker** — Offline caching (PWA)

## Audio File Support

Supports MP3, WAV, OGG, and AAC files. Note that DRM-protected files (Apple Music streams, Spotify downloads) cannot be loaded — use files you own or have licensed (iTunes purchases, CD rips, Splice, Tracklib, etc.).

## License

MIT

## Credits

Built with ❤️ and the Web Audio API.
