![Homepage](app-screenshots/image0.png)

## Project Overview

Deloosional is a detective-themed investigation board application that reimagines the traditional corkboard investigation aesthetic as a digital learning tool. Users create visual investigation boards with sticky notes, media attachments, and connection strings to map relationships between concepts. The application leverages vanilla JavaScript and modern browser APIs to deliver a zero-build, framework-free experience.

![Investigation Board Example](app-screenshots/image2.png)

## Technical Architecture

### Core Technologies
- **Vanilla JavaScript (ES6+)**: Zero framework overhead with modern syntax
- **HTML5 Canvas API**: Real-time rendering of connection lines between elements
- **CSS3 Animations**: Hardware-accelerated transforms for drag operations and UI transitions
- **Web Storage API (localStorage)**: Client-side data persistence with JSON serialization
- **File API**: Base64 image encoding for media attachments without server storage
- **html2canvas (CDN)**: High-resolution board export to PNG via DOM-to-canvas rendering

### Technical Features

- **Multi-Board State Management**: Up to 6 concurrent boards with independent state trees, programmatic thumbnail generation, localStorage persistence with automatic serialization, and timestamp-based unique identifiers
- **Canvas-Based Connection System**: Real-time Bézier curve rendering with proximity-based hit detection, dynamic line styling with anti-aliasing, toggleable visibility, and custom drag-to-connect interaction model
- **Transform and Viewport Management**: CSS transform-based zoom (0.25x-3x) with origin preservation, mousedown/mousemove event delegation for panning, transform matrix coordinate conversion, and requestAnimationFrame-optimized smooth transitions
- **Drag-and-Drop Physics**: Custom draggable implementation with collision detection, z-index management for overlay stacking, mouse offset calculations for grab point consistency, and pointer event normalization for mobile compatibility
- **Inline Content Editing**: ContentEditable API integration with CSS pseudo-element placeholder simulation, dynamic text contrast based on luminance calculation, and auto-resize with min/max constraints
- **Media Annotation System**: Client-side image upload via File Reader API with canvas overlay for freehand annotation, persistent drawing state as canvas data URLs, color picker with real-time preview, and adjustable brush controls
- **Audio Integration**: Embedded jazz radio with play/pause state management, synchronized sound effects for animations (gavel impact at keyframe 42%), audio preloading with lazy initialization, and autoplay policy fallback handling
- **Export Functionality**: High-resolution board capture via html2canvas DOM traversal with automatic scaling for quality enhancement and programmatic PNG download generation via canvas-to-blob conversion
- **Visual Effects**: CSS brightness filter for "Lights Off" mode with selective logo compensation, SVG gavel animation with multi-keyframe choreography, cubic-bezier stamp appearance with overshoot effect, and synchronized audio playback

## Feature Breakdown

- **Board Management**: Create, rename, delete up to 6 independent boards with auto-generated previews and PNG export capability
- **Sticky Notes**: Four semantic types (Concept, Fact, Question, Theory) with custom colors, inline editing, drag-and-drop positioning, and resize handles
- **Media Attachments**: Image upload with annotation tools, freehand drawing, customizable highlighting, and drag-and-drop repositioning
- **Red String Connections**: Visual linking between any elements with four-directional connection points, toggleable visibility, and bulk clear
- **Zoom and Pan**: 0.25x-3x zoom range with click-and-drag navigation and instant reset to centered viewport
- **Atmospheric Features**: Jazz radio toggle, lights-off mode for focused sessions, and case closed animation with synchronized sound effects

## Technical Requirements

**Browser Compatibility:**
- ES6+ JavaScript support (Chrome 51+, Firefox 54+, Safari 10+, Edge 15+)
- HTML5 Canvas API
- localStorage with minimum 5MB quota
- File API for image handling
- Audio element support

**Optional:**
- Stack Sans Headline font (fallback to system sans-serif if unavailable)
- Download font from [Foss Fonts](https://fossfonts.com/stack-sans-headline) and place in `/fonts` directory

## Installation and Usage

1. Clone the repository
2. Open `index.html` in a modern web browser
3. No build step, no package installation, no server required

```bash
git clone <repository-url>
cd Deloosional
# Open index.html in browser - case opens immediately
```

## Project Structure

```
Deloosional/
├── index.html              # Main application shell
├── script.js               # Core application logic and state management
├── gavel-animation.js      # Case closed animation controller
├── styles.css              # Complete stylesheet with animations
├── graphics/               # Logo and background assets
├── audios/                 # Sound effects (gavel, lamp, stamp)
└── app-screenshots/        # Documentation images
```

## Implementation Notes

**State Persistence:** All board data serializes to localStorage with automatic save on every modification. Media attachments convert to base64 data URLs for storage without external dependencies.

**Canvas Rendering:** Connection lines redraw on every state change (note move, zoom, pan) using a clear-and-redraw pattern. Performance remains acceptable due to small element count (typical boards < 50 elements).

**Coordinate Systems:** The application maintains two coordinate spaces-viewport coordinates (screen pixels) and board coordinates (corkboard pixels). Transform matrices convert between spaces for accurate click detection during zoom/pan operations.

## License

MIT License - See LICENSE file for details

Copyright (c) 2025 Beray Nil Atabey

---

*"Come, Watson! The Game is Afoot!"*
