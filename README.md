<div align="center">
  <img src="graphics/deloosional-logo2.png" alt="Deloosional Logo" width="400">
</div>

# Deloosional

A web-based investigation board application that transforms note-taking into a detective-style experience. Built as a client-side application using vanilla JavaScript, featuring multiple boards, sticky notes, media attachments, and visual connections represented as red strings.

## Project Overview

Deloosional is a single-page application that simulates a detective's crime board. Users can create multiple investigation boards, each containing sticky notes, images, and connections between items. The application uses localStorage for persistence, allowing users to maintain multiple boards without server-side infrastructure.

## Technical Architecture

### Core Technologies

- **HTML5**: Semantic markup with canvas elements for line rendering
- **CSS3**: Custom styling with CSS Grid, Flexbox, and CSS animations
- **Vanilla JavaScript**: No frameworks or build tools required
- **Canvas API**: Custom line drawing for connection visualization
- **html2canvas**: Client-side screenshot generation for board exports
- **localStorage API**: Persistent data storage for boards and metadata
- **File API**: Image upload and base64 encoding for media attachments

## Key Features

- **Multi-Board System**: Up to 6 independent boards with preview thumbnails, rename, delete, and download capabilities
- **Sticky Notes**: Four note types (Concept, Fact, Question, Theory) with custom colors, inline editing, drag-and-drop, and resizing
- **Media Attachments**: Image uploads with base64 storage, resizing, and canvas-based annotation/highlighting system
- **Connection System**: Red string lines connecting notes and media with four anchor points, toggleable visibility, and automatic cleanup
- **Zoom and Pan**: 0.25x to 3x zoom range with mouse drag panning and coordinate transformation
- **Board Export**: PNG export using html2canvas with high-resolution rendering
- **Case Closed Animation**: Custom SVG animation with sound effects triggered on board clear
- **Welcome Page**: Board management interface with rotating animated titles and preview generation
- **Sidebar Navigation**: Collapsible sidebar with persistent state and keyboard shortcuts

## Implementation

Data is persisted in localStorage with automatic saving on all modifications. The application uses Canvas API for line rendering, CSS transforms for zoom/pan, and html2canvas for board exports. All rendering is client-side with no backend required.

## Requirements

- Modern browser with ES6+ support, Canvas API, localStorage, and File API
- Stack Sans Headline font (optional, falls back to system fonts)
- html2canvas library (loaded via CDN)

## License

MIT License - See LICENSE file for details

Copyright (c) 2025 Beray Nil Atabey
