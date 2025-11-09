// global state
let notes = [];
let connections = [];
let noteIdCounter = 0;
let isDragging = false;
let currentNote = null;
let dragOffset = { x: 0, y: 0 };
let isConnecting = false;
let connectionStart = null;
let linesVisible = true;
let connectionHandlers = new Map();
let currentBoardId = null; // track which board is currently being edited
const MAX_BOARDS = 6; // maximum number of boards (3 columns, 2 rows)

// DOM elements
const corkboard = document.getElementById('corkboard');
const notesContainer = document.getElementById('notesContainer');
const lineCanvas = document.getElementById('lineCanvas');
const ctx = lineCanvas.getContext('2d');
const addNoteBtn = document.getElementById('addNoteBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const toggleLinesSwitch = document.getElementById('toggleLinesSwitch');
const clearStringsBtn = document.getElementById('clearStringsBtn');
const downloadBtn = document.getElementById('downloadBtn');
const addMediaBtn = document.getElementById('addMediaBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const zoomContainer = document.getElementById('zoomContainer');
const boardContainer = document.querySelector('.board-container');
const noteModal = document.getElementById('noteModal');
const mediaModal = document.getElementById('mediaModal');
const closeModal = document.querySelector('.close');
const closeMediaModal = document.querySelector('.close-media');
const createNoteBtn = document.getElementById('createNoteBtn');
const updateNoteBtn = document.getElementById('updateNoteBtn');
const noteModalTitle = document.getElementById('noteModalTitle');
let editingNoteId = null; // Track which note is being edited
const createMediaBtn = document.getElementById('createMediaBtn');
const mediaUpload = document.getElementById('mediaUpload');
const mediaPreview = document.getElementById('mediaPreview');

// welcome page elements
const welcomePage = document.getElementById('welcomePage');
const boardEditor = document.getElementById('boardEditor');
const boardsList = document.getElementById('boardsList');
const createNewBoardBtn = document.getElementById('createNewBoardBtn');
const backToWelcomeBtn = document.getElementById('backToWelcomeBtn');
const logo = document.getElementById('logo');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

let currentMediaFile = null;
let mediaItems = [];

// Helper functions for item management
function getItem(id) {
    return notes.find(n => n.id === id) || mediaItems.find(m => m.id === id);
}

function getItemElement(id) {
    return document.getElementById(`note-${id}`) || document.getElementById(`media-${id}`);
}

function isMediaItem(id) {
    return mediaItems.some(m => m.id === id);
}

function getItemElementId(id) {
    return isMediaItem(id) ? `media-${id}` : `note-${id}`;
}

// initialize canvas
function initCanvas() {
    // set canvas size to match corkboard (fixed size)
    const width = 2000;
    const height = 1500;
    lineCanvas.width = width;
    lineCanvas.height = height;
    lineCanvas.style.width = width + 'px';
    lineCanvas.style.height = height + 'px';
    redrawLines();
}

// zoom and pan functionality
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

function updateZoomTransform() {
    if (!zoomContainer) return;
    const translateX = panX;
    const translateY = panY;
    zoomContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
}

function setZoom(zoom, centerX = null, centerY = null) {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

    if (centerX !== null && centerY !== null && boardContainer) {
        // zoom towards a specific point (mouse cursor position)
        const containerRect = boardContainer.getBoundingClientRect();

        // Get viewport center (where zoom container origin is located)
        const viewportCenterX = containerRect.left + containerRect.width / 2;
        const viewportCenterY = containerRect.top + containerRect.height / 2;

        // Convert mouse position to coordinates relative to viewport center
        const mouseX = centerX - viewportCenterX;
        const mouseY = centerY - viewportCenterY;

        // Calculate the world coordinate (point on the board) that the mouse is pointing to
        // Before zoom: mouseX = worldX * currentZoom + panX
        // Therefore: worldX = (mouseX - panX) / currentZoom
        const worldX = (mouseX - panX) / currentZoom;
        const worldY = (mouseY - panY) / currentZoom;

        // After zoom, adjust pan so the same world point is under the mouse
        // mouseX = worldX * newZoom + newPanX
        // Therefore: newPanX = mouseX - worldX * newZoom
        panX = mouseX - worldX * newZoom;
        panY = mouseY - worldY * newZoom;
    }

    currentZoom = newZoom;
    updateZoomTransform();
}

function resetZoom() {
    if (!boardContainer) return;
    const containerRect = boardContainer.getBoundingClientRect();
    const boardWidth = 2000;
    const boardHeight = 1500;
    const padding = 40; // space between board and browser border

    // calculate available space (viewport minus padding on all sides)
    const availableWidth = containerRect.width - (2 * padding);
    const availableHeight = containerRect.height - (2 * padding);

    // calculate zoom level to fit the entire board with padding
    // use the smaller zoom to ensure the board fits in both dimensions
    const zoomX = availableWidth / boardWidth;
    const zoomY = availableHeight / boardHeight;
    currentZoom = Math.min(zoomX, zoomY, MAX_ZOOM); // don't exceed max zoom
    currentZoom = Math.max(currentZoom, MIN_ZOOM); // don't go below min zoom

    // center the board with padding on all sides
    // the zoom container is positioned at 50% top/left (its origin is at viewport center)
    // to center the board: panX = -boardWidth/2, panY = -boardHeight/2
    // to add padding: shift by padding amount to create space from edges
    panX = -boardWidth / 2 * currentZoom + padding;
    panY = -boardHeight / 2 * currentZoom + padding;
    updateZoomTransform();
}

// convert screen coordinates to board coordinates (accounting for zoom and pan)
function screenToBoard(screenX, screenY) {
    if (!corkboard) return { x: screenX, y: screenY };

    // get the board's current position on screen
    // getBoundingClientRect() already includes the transform effects (pan and zoom)
    const boardRect = corkboard.getBoundingClientRect();

    // convert screen position to position within the transformed board
    // subtract board's screen position, then divide by zoom
    const x = (screenX - boardRect.left) / currentZoom;
    const y = (screenY - boardRect.top) / currentZoom;

    return { x, y };
}

// initialize zoom to center the board
function initZoom() {
    resetZoom();
}

// zoom buttons - zoom toward viewport center
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        if (!boardContainer) return;
        const rect = boardContainer.getBoundingClientRect();
        // Zoom toward the center of the viewport
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        setZoom(currentZoom + ZOOM_STEP, centerX, centerY);
    });
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        if (!boardContainer) return;
        const rect = boardContainer.getBoundingClientRect();
        // Zoom toward the center of the viewport
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        setZoom(currentZoom - ZOOM_STEP, centerX, centerY);
    });
}

if (resetZoomBtn) {
    resetZoomBtn.addEventListener('click', () => {
        resetZoom();
    });
}

// mouse wheel zoom - prevent scrolling, only zoom
if (boardContainer) {
    boardContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom(currentZoom + delta, e.clientX, e.clientY);
    }, { passive: false });

    // also prevent scrolling on the zoom container and corkboard
    if (zoomContainer) {
        zoomContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom(currentZoom + delta, e.clientX, e.clientY);
        }, { passive: false });
    }

    if (corkboard) {
        corkboard.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom(currentZoom + delta, e.clientX, e.clientY);
        }, { passive: false });
    }

    // pan functionality
    boardContainer.addEventListener('mousedown', (e) => {
        // only pan if clicking on the board container itself, not on notes/media
        if (e.target === boardContainer || e.target === zoomContainer || e.target === corkboard || e.target === lineCanvas) {
            isPanning = true;
            panStartX = e.clientX - panX;
            panStartY = e.clientY - panY;
            boardContainer.classList.add('panning');
            e.preventDefault();
        }
    });
}

document.addEventListener('mousemove', (e) => {
    if (isPanning) {
        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
        updateZoomTransform();
    }
});

document.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        if (boardContainer) {
            boardContainer.classList.remove('panning');
        }
    }
});

// resize canvas on window resize
window.addEventListener('resize', () => {
    setTimeout(initCanvas, 100);
});

// initialize on load - removed, now handled by welcome page initialization

// modal functionality
addNoteBtn.addEventListener('click', () => {
    resetModal();
    noteModal.style.display = 'block';
    document.getElementById('noteTitle').focus();
});

closeModal.addEventListener('click', () => {
    noteModal.style.display = 'none';
    resetModal();
});

// reset modal to create mode
function resetModal() {
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteType').value = 'concept';
    document.getElementById('noteColor').value = '#ffeb3b';
    noteModalTitle.textContent = 'Create New Note';
    createNoteBtn.style.display = 'block';
    updateNoteBtn.style.display = 'none';
    editingNoteId = null;
}

window.addEventListener('click', (e) => {
    if (e.target === noteModal) {
        noteModal.style.display = 'none';
        resetModal();
    }
});

createNoteBtn.addEventListener('click', () => {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const type = document.getElementById('noteType').value;
    const color = document.getElementById('noteColor').value;

    // allow creating notes even with empty title and content
    createNote(title, content, type, color,
        Math.random() * (corkboard.offsetWidth - 250) + 25,
        Math.random() * (corkboard.offsetHeight - 200) + 25
    );
    noteModal.style.display = 'none';
    resetModal();
});

updateNoteBtn.addEventListener('click', () => {
    if (!editingNoteId) return;

    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value;
    const type = document.getElementById('noteType').value;
    const color = document.getElementById('noteColor').value;

    // update the note
    const note = notes.find(n => n.id === editingNoteId);
    if (note) {
        note.title = title || 'New Note';
        // convert newlines from textarea back to <br> tags for HTML rendering
        note.content = content.replace(/\n/g, '<br>');
        note.type = type;
        note.color = color;

        // re-render the note with updated properties
        renderNote(note);
        // redraw lines in case connections need updating
        redrawLines();
        saveToStorage();
    }

    // reset editing state and close modal
    editingNoteId = null;
    noteModal.style.display = 'none';
    resetModal();
});

// function to open note modal in edit mode
function openNoteModalForEdit(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    editingNoteId = noteId;

    // populate modal with note data
    document.getElementById('noteTitle').value = note.title || '';
    // convert HTML content to plain text for textarea, preserving line breaks
    let contentText = note.content || '';
    // replace <br> tags with newlines before extracting text
    contentText = contentText.replace(/<br\s*\/?>/gi, '\n');
    // remove other HTML tags and get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentText;
    document.getElementById('noteContent').value = tempDiv.textContent || tempDiv.innerText || '';
    document.getElementById('noteType').value = note.type || 'concept';
    document.getElementById('noteColor').value = note.color || '#ffeb3b';

    // update modal title and button
    if (noteModalTitle) noteModalTitle.textContent = 'Edit Note';
    if (createNoteBtn) createNoteBtn.style.display = 'none';
    if (updateNoteBtn) updateNoteBtn.style.display = 'block';

    // show modal
    noteModal.style.display = 'block';
    document.getElementById('noteTitle').focus();
}

// media modal functionality
addMediaBtn.addEventListener('click', () => {
    mediaModal.style.display = 'block';
});

closeMediaModal.addEventListener('click', () => {
    mediaModal.style.display = 'none';
    resetMediaModal();
});

window.addEventListener('click', (e) => {
    if (e.target === mediaModal) {
        mediaModal.style.display = 'none';
        resetMediaModal();
    }
});

createMediaBtn.addEventListener('click', () => {
    if (currentMediaFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
            createMediaItem(event.target.result,
                Math.random() * (corkboard.offsetWidth - 300) + 25,
                Math.random() * (corkboard.offsetHeight - 300) + 25
            );
            mediaModal.style.display = 'none';
            resetMediaModal();
        };
        reader.readAsDataURL(currentMediaFile);
    }
});

function resetMediaModal() {
    document.getElementById('mediaUpload').value = '';
    mediaPreview.innerHTML = '';
    mediaPreview.classList.add('empty');
    currentMediaFile = null;
}

// create media item
function createMediaItem(mediaDataUrl, x, y) {
    const mediaId = noteIdCounter++;
    const mediaItem = {
        id: mediaId,
        type: 'media',
        mediaDataUrl: mediaDataUrl,
        x: x || 100,
        y: y || 100,
        width: 300, // default width
        height: null, // will be set based on aspect ratio
        aspectRatio: null // will be calculated when image loads
    };

    mediaItems.push(mediaItem);
    renderMediaItem(mediaItem);
    saveToStorage();
    return mediaItem;
}

// render media item
function renderMediaItem(mediaItem) {
    const mediaElement = document.createElement('div');
    mediaElement.className = 'media-item';
    mediaElement.id = `media-${mediaItem.id}`;
    mediaElement.style.left = mediaItem.x + 'px';
    mediaElement.style.top = mediaItem.y + 'px';

    // set width and height if they exist
    if (mediaItem.width) {
        mediaElement.style.width = mediaItem.width + 'px';
    }
    if (mediaItem.height) {
        mediaElement.style.height = mediaItem.height + 'px';
    }

    mediaElement.innerHTML = `
        <div class="thumbtack"></div>
        <div class="connection-point top" data-position="top"></div>
        <div class="connection-point bottom" data-position="bottom"></div>
        <div class="connection-point left" data-position="left"></div>
        <div class="connection-point right" data-position="right"></div>
        <div class="media-image-container" data-media-id="${mediaItem.id}">
            <img src="${mediaItem.mediaDataUrl}" alt="Media" class="media-image">
            <div class="media-actions">
                <button class="connect-media-btn" data-media-id="${mediaItem.id}" title="Connect to another item">🔗</button>
                <button class="delete-media-btn" data-media-id="${mediaItem.id}" title="Delete media">🗑️</button>
            </div>
        </div>
        <div class="resize-handle" data-media-id="${mediaItem.id}" title="Resize media"></div>
    `;

    notesContainer.appendChild(mediaElement);

    // calculate aspect ratio when image loads
    const img = mediaElement.querySelector('.media-image');
    if (img) {
        img.onload = function () {
            if (!mediaItem.aspectRatio) {
                mediaItem.aspectRatio = img.naturalWidth / img.naturalHeight;
                if (!mediaItem.height) {
                    mediaItem.height = mediaItem.width / mediaItem.aspectRatio;
                    mediaElement.style.height = mediaItem.height + 'px';
                }
                saveToStorage();
            }
        };
    }

    attachMediaListeners(mediaElement, mediaItem);
    updateMediaPosition(mediaItem.id);
}

// attach listeners to media item
function attachMediaListeners(mediaElement, mediaItem) {
    // drag functionality
    const mediaContainer = mediaElement.querySelector('.media-image-container');

    mediaContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.media-actions') ||
            e.target.closest('.resize-handle') ||
            e.target.tagName === 'BUTTON') {
            return;
        }
        startDrag(mediaItem.id, e, true);
    });

    // resize handle
    const resizeHandle = mediaElement.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startMediaResize(mediaItem.id, e);
        });
    }

    // connect button - defaults to top edge
    const connectBtn = mediaElement.querySelector('.connect-media-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startConnection(mediaItem.id, true, 'top');
        });
    }

    // delete button
    const deleteBtn = mediaElement.querySelector('.delete-media-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMediaItem(mediaItem.id);
        });
    }

    // connection points
    const connectionPoints = mediaElement.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => {
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // get position from the clicked point
            const position = point.getAttribute('data-position') || point.dataset.position || point.className.match(/\b(top|bottom|left|right)\b/)?.[1] || 'top';
            if (isConnecting && connectionStart && connectionStart.noteId !== mediaItem.id) {
                // complete connection to this media item's edge
                completeConnection(mediaItem.id, position);
            } else if (!isConnecting) {
                // start connection from this media item's edge
                startConnection(mediaItem.id, true, position);
            }
        });
    });
}

function updateMediaPosition(mediaId) {
    const mediaItem = getItem(mediaId);
    if (!mediaItem) return;

    const mediaElement = getItemElement(mediaId);
    if (mediaElement) {
        mediaElement.style.left = mediaItem.x + 'px';
        mediaElement.style.top = mediaItem.y + 'px';
        if (mediaItem.width) {
            mediaElement.style.width = mediaItem.width + 'px';
        }
        if (mediaItem.height) {
            mediaElement.style.height = mediaItem.height + 'px';
        }
    }
}

function deleteMediaItem(mediaId) {
    if (confirm('Are you sure you want to delete this media?')) {
        // remove connections
        connections = connections.filter(conn =>
            conn.from !== mediaId && conn.to !== mediaId
        );

        // remove media item
        mediaItems = mediaItems.filter(m => m.id !== mediaId);

        // remove DOM element
        const mediaElement = getItemElement(mediaId);
        if (mediaElement) {
            mediaElement.remove();
        }

        saveToStorage();
        redrawLines();
    }
}

// handle media upload
mediaUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        currentMediaFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            mediaPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            mediaPreview.classList.remove('empty');
        };
        reader.readAsDataURL(file);
    } else {
        mediaPreview.innerHTML = '';
        mediaPreview.classList.add('empty');
        currentMediaFile = null;
    }
});

// update color picker based on note type
document.getElementById('noteType').addEventListener('change', (e) => {
    const type = e.target.value;
    const defaultColors = {
        concept: '#ffeb3b',
        fact: '#81c784',
        question: '#64b5f6',
        theory: '#ba68c8'
    };
    document.getElementById('noteColor').value = defaultColors[type] || '#ffeb3b';
});

// calculate brightness of a color (0-255)
function getBrightness(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // using relative luminance formula
    return (r * 299 + g * 587 + b * 114) / 1000;
}

// determine if text should be light based on background color
function shouldUseLightText(bgColor) {
    return getBrightness(bgColor) < 128;
}

// create a new note
function createNote(title, content, type, color, x, y) {
    const noteId = noteIdCounter++;
    const note = {
        id: noteId,
        title: title || 'New Note',
        content: content || '',
        type: type || 'concept',
        color: color || '#ffeb3b',
        x: x || 100,
        y: y || 100,
        width: 200,
        height: 150
    };

    notes.push(note);
    renderNote(note);
    saveToStorage();
    return note;
}

// render a note on the board
function renderNote(note) {
    // remove existing note if re-rendering
    const existingNote = getItemElement(note.id);
    if (existingNote) {
        existingNote.remove();
    }

    const noteElement = document.createElement('div');
    noteElement.className = `sticky-note ${note.type}`;
    noteElement.id = `note-${note.id}`;
    noteElement.style.left = note.x + 'px';
    noteElement.style.top = note.y + 'px';
    noteElement.style.width = (note.width || 200) + 'px';
    noteElement.style.height = (note.height || 150) + 'px';

    // apply custom color or default color based on type
    let bgColor;
    if (note.color && note.color !== '#ffeb3b') {
        bgColor = note.color;
        noteElement.style.backgroundColor = bgColor;
    } else {
        // use default colors based on type if no custom color
        const defaultColors = {
            concept: '#ffeb3b',
            fact: '#81c784',
            question: '#64b5f6',
            theory: '#ba68c8'
        };
        bgColor = defaultColors[note.type] || '#ffeb3b';
        noteElement.style.backgroundColor = bgColor;
        // update note.color to match default
        if (!note.color) {
            note.color = bgColor;
        }
    }

    // determine text color based on background brightness
    const useLightText = shouldUseLightText(bgColor);
    const textClass = useLightText ? 'light-text' : '';

    // add class to note element for resize handle styling
    if (useLightText) {
        noteElement.classList.add('has-light-text');
    }

    const typeIcons = {
        concept: '🎯',
        fact: '📋',
        question: '❓',
        theory: '🔬'
    };

    // build the note HTML structure
    noteElement.innerHTML = `
        <div class="thumbtack"></div>
        <span class="note-type">${typeIcons[note.type] || '🎯'}</span>
        <div class="connection-point top" data-position="top"></div>
        <div class="connection-point bottom" data-position="bottom"></div>
        <div class="connection-point left" data-position="left"></div>
        <div class="connection-point right" data-position="right"></div>
        <div class="note-header ${useLightText ? 'light-border' : ''}">
            <input type="text" class="note-title ${textClass}" value="${escapeHtml(note.title)}" data-note-id="${note.id}">
        </div>
        <div class="note-actions">
            <button class="edit-btn" title="Edit note">✏️</button>
            <button class="connect-btn" title="Connect to another note">🔗</button>
            <button class="delete-btn" title="Delete note">🗑️</button>
        </div>
        <div class="resize-handle" data-note-id="${note.id}" title="Resize note"></div>
    `;

    // set content separately to preserve HTML formatting
    const contentDiv = document.createElement('div');
    contentDiv.className = `note-content ${textClass}`;
    contentDiv.setAttribute('data-note-id', note.id);
    contentDiv.setAttribute('contenteditable', 'true');
    contentDiv.setAttribute('placeholder', 'Add your thoughts...');
    contentDiv.innerHTML = note.content || '';
    noteElement.insertBefore(contentDiv, noteElement.querySelector('.note-actions'));

    notesContainer.appendChild(noteElement);
    attachNoteListeners(noteElement, note);
    updateNotePosition(note.id);

    // auto-expand content div (contentDiv is already created above)
    if (contentDiv) {
        contentDiv.style.height = 'auto';
        contentDiv.style.height = contentDiv.scrollHeight + 'px';
    }
}

// escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// attach event listeners to a note
function attachNoteListeners(noteElement, note) {
    // drag functionality - attach to the entire note, but exclude inputs and buttons
    noteElement.addEventListener('mousedown', (e) => {
        // don't start drag if clicking on interactive elements
        const target = e.target;
        if (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'BUTTON' ||
            target.closest('.note-actions') ||
            target.closest('.connection-point') ||
            target.closest('.resize-handle')) {
            return;
        }

        // start drag
        startDrag(note.id, e);
    });


    // edit functionality
    const titleInput = noteElement.querySelector('.note-title');
    titleInput.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // prevent drag when clicking on title
    });
    titleInput.addEventListener('blur', (e) => {
        updateNoteTitle(note.id, e.target.value);
    });

    titleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });

    const contentDiv = noteElement.querySelector('.note-content');
    contentDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // prevent drag when clicking on content
    });

    // handle placeholder for contenteditable div
    function handlePlaceholder() {
        if (contentDiv.textContent.trim() === '') {
            contentDiv.classList.add('empty');
        } else {
            contentDiv.classList.remove('empty');
        }
    }

    // auto-expand content div (respecting note height constraints)
    function autoExpandContent() {
        contentDiv.style.height = 'auto';
        const contentHeight = contentDiv.scrollHeight;

        // calculate available height based on note's current height
        const noteHeight = noteElement.offsetHeight || note.height || 150;
        const paddingTop = 40;
        const paddingBottom = 15;
        const headerHeight = 30;
        const actionsHeight = 40;
        const availableHeight = noteHeight - paddingTop - paddingBottom - headerHeight - actionsHeight;

        // set height to fit content, but not exceed available space
        const contentDivHeight = Math.max(60, Math.min(availableHeight, contentHeight));
        contentDiv.style.height = contentDivHeight + 'px';

        // show scrollbar if content exceeds available space
        if (contentHeight > availableHeight) {
            contentDiv.style.overflowY = 'auto';
        } else {
            contentDiv.style.overflowY = 'hidden';
        }
    }

    // keyboard shortcuts for formatting (Ctrl+B, Ctrl+I, Ctrl+U)
    contentDiv.addEventListener('keydown', (e) => {
        // check for Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                document.execCommand('bold', false, null);
                return false;
            } else if (e.key === 'i' || e.key === 'I') {
                e.preventDefault();
                document.execCommand('italic', false, null);
                return false;
            } else if (e.key === 'u' || e.key === 'U') {
                e.preventDefault();
                document.execCommand('underline', false, null);
                return false;
            }
        }
    });

    contentDiv.addEventListener('input', () => {
        autoExpandContent();
        handlePlaceholder();
    });

    contentDiv.addEventListener('blur', (e) => {
        updateNoteContent(note.id, e.target.innerHTML);
        autoExpandContent();
        handlePlaceholder();
    });

    // initial setup
    handlePlaceholder();
    setTimeout(autoExpandContent, 10);

    // edit button - open modal in edit mode
    const editBtn = noteElement.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openNoteModalForEdit(note.id);
        });
    }

    // delete button
    const deleteBtn = noteElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
    });

    // connect button - defaults to top edge
    const connectBtn = noteElement.querySelector('.connect-btn');
    connectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startConnection(note.id, false, 'top');
    });

    // connection points
    const connectionPoints = noteElement.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => {
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // get position from the clicked point
            const position = point.getAttribute('data-position') || point.dataset.position || point.className.match(/\b(top|bottom|left|right)\b/)?.[1] || 'top';
            if (isConnecting && connectionStart && connectionStart.noteId !== note.id) {
                // complete connection to this note's edge
                completeConnection(note.id, position);
            } else if (!isConnecting) {
                // start connection from this note's edge
                startConnection(note.id, false, position);
            }
        });
    });

    // resize handle
    const resizeHandle = noteElement.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(note.id, e);
        });
    }
}

// drag and drop
function startDrag(itemId, e, isMedia = false) {
    if (isDragging) return; // prevent multiple drags

    isDragging = true;
    currentNote = getItem(itemId);

    if (!currentNote) {
        isDragging = false;
        return;
    }

    const itemElement = getItemElement(itemId);
    if (!itemElement) {
        isDragging = false;
        return;
    }

    itemElement.classList.add('dragging');

    // convert mouse position to board coordinates and calculate offset
    const boardPos = screenToBoard(e.clientX, e.clientY);
    dragOffset.x = boardPos.x - currentNote.x;
    dragOffset.y = boardPos.y - currentNote.y;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
    e.stopPropagation();
}

function onDrag(e) {
    if (!isDragging || !currentNote) return;

    // convert mouse position to board coordinates
    const boardPos = screenToBoard(e.clientX, e.clientY);
    const x = boardPos.x - dragOffset.x;
    const y = boardPos.y - dragOffset.y;

    // constrain to board bounds
    const itemElement = getItemElement(currentNote.id);
    if (!itemElement) return;

    const maxX = corkboard.offsetWidth - itemElement.offsetWidth;
    const maxY = corkboard.offsetHeight - itemElement.offsetHeight;

    currentNote.x = Math.max(0, Math.min(x, maxX));
    currentNote.y = Math.max(0, Math.min(y, maxY));

    // check if it's a media item by looking for mediaDataUrl
    if (currentNote.mediaDataUrl && !currentNote.title) {
        updateMediaPosition(currentNote.id);
    } else {
        updateNotePosition(currentNote.id);
    }
    redrawLines();
}

function stopDrag(e) {
    if (isDragging && currentNote) {
        const itemElement = getItemElement(currentNote.id);
        if (itemElement) {
            itemElement.classList.remove('dragging');
        }
        saveToStorage();
    }
    isDragging = false;
    currentNote = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

function updateNotePosition(noteId) {
    const note = getItem(noteId);
    if (!note) return;

    const noteElement = getItemElement(noteId);
    if (noteElement) {
        noteElement.style.left = note.x + 'px';
        noteElement.style.top = note.y + 'px';
        if (note.width) {
            noteElement.style.width = note.width + 'px';
        }
        if (note.height) {
            noteElement.style.height = note.height + 'px';
        }
    }
}

// resize functionality
let isResizing = false;
let resizeNote = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

function startResize(noteId, e) {
    if (isResizing || isDragging || isConnecting) return;

    isResizing = true;
    resizeNote = getItem(noteId);
    if (!resizeNote) {
        isResizing = false;
        return;
    }

    const noteElement = getItemElement(noteId);
    if (!noteElement) {
        isResizing = false;
        return;
    }

    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = resizeNote.width || 200;
    resizeStartHeight = resizeNote.height || 150;

    noteElement.classList.add('resizing');

    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
    e.stopPropagation();
}

function onResize(e) {
    if (!isResizing || !resizeNote) return;

    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;

    const minWidth = 150;
    const minHeight = 100;
    const maxWidth = 600;
    const maxHeight = 800;

    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartWidth + deltaX));
    const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartHeight + deltaY));

    resizeNote.width = newWidth;
    resizeNote.height = newHeight;

    const noteElement = getItemElement(resizeNote.id);
    if (noteElement) {
        noteElement.style.width = newWidth + 'px';
        noteElement.style.height = newHeight + 'px';

        // calculate available height for textarea (total height - padding - header - actions)
        // padding: 15px top + 15px bottom = 30px, padding-top: 40px (for type icon) = 40px
        // header: ~30px, actions: ~40px
        // total overhead: ~110px
        const paddingTop = 40; // for floating type icon
        const paddingBottom = 15;
        const headerHeight = 30;
        const actionsHeight = 40;
        const availableHeight = newHeight - paddingTop - paddingBottom - headerHeight - actionsHeight;

        // update content div to fit available space
        const contentDiv = noteElement.querySelector('.note-content');
        if (contentDiv) {
            // first, set height to auto to get the actual content height
            contentDiv.style.height = 'auto';
            const contentHeight = contentDiv.scrollHeight;

            // set content div height to fit available space, but allow scrolling if content is larger
            const contentDivHeight = Math.max(60, Math.min(availableHeight, contentHeight));
            contentDiv.style.height = contentDivHeight + 'px';

            // if content is larger than available space, show scrollbar
            if (contentHeight > availableHeight) {
                contentDiv.style.overflowY = 'auto';
            } else {
                contentDiv.style.overflowY = 'hidden';
            }
        }
    }

    // redraw lines to update connection positions
    redrawLines();
}

function stopResize(e) {
    if (isResizing && resizeNote) {
        const noteElement = getItemElement(resizeNote.id);
        if (noteElement) {
            noteElement.classList.remove('resizing');

            // final content div height adjustment to ensure it fits properly
            const contentDiv = noteElement.querySelector('.note-content');
            if (contentDiv) {
                const noteHeight = noteElement.offsetHeight;
                const paddingTop = 40;
                const paddingBottom = 15;
                const headerHeight = 30;
                const actionsHeight = 40;
                const availableHeight = noteHeight - paddingTop - paddingBottom - headerHeight - actionsHeight;

                contentDiv.style.height = 'auto';
                const contentHeight = contentDiv.scrollHeight;
                const contentDivHeight = Math.max(60, Math.min(availableHeight, contentHeight));
                contentDiv.style.height = contentDivHeight + 'px';

                if (contentHeight > availableHeight) {
                    contentDiv.style.overflowY = 'auto';
                } else {
                    contentDiv.style.overflowY = 'hidden';
                }
            }
        }
        saveToStorage();
        redrawLines();
    }
    isResizing = false;
    resizeNote = null;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// media resize functionality (maintains aspect ratio)
let isMediaResizing = false;
let resizeMediaItem = null;
let mediaResizeStartX = 0;
let mediaResizeStartY = 0;
let mediaResizeStartWidth = 0;
let mediaResizeStartHeight = 0;

function startMediaResize(mediaId, e) {
    if (isMediaResizing || isResizing || isDragging || isConnecting) return;

    isMediaResizing = true;
    resizeMediaItem = getItem(mediaId);
    if (!resizeMediaItem) {
        isMediaResizing = false;
        return;
    }

    const mediaElement = getItemElement(mediaId);
    if (!mediaElement) {
        isMediaResizing = false;
        return;
    }

    // calculate aspect ratio if not set
    if (!resizeMediaItem.aspectRatio) {
        const img = mediaElement.querySelector('.media-image');
        if (img && img.naturalWidth && img.naturalHeight) {
            resizeMediaItem.aspectRatio = img.naturalWidth / img.naturalHeight;
        } else {
            // default to 1:1 if we can't determine
            resizeMediaItem.aspectRatio = 1;
        }
    }

    mediaResizeStartX = e.clientX;
    mediaResizeStartY = e.clientY;
    mediaResizeStartWidth = resizeMediaItem.width || 300;
    mediaResizeStartHeight = resizeMediaItem.height || (mediaResizeStartWidth / resizeMediaItem.aspectRatio);

    mediaElement.classList.add('resizing');

    document.addEventListener('mousemove', onMediaResize);
    document.addEventListener('mouseup', stopMediaResize);
    e.preventDefault();
    e.stopPropagation();
}

function onMediaResize(e) {
    if (!isMediaResizing || !resizeMediaItem) return;

    const deltaX = e.clientX - mediaResizeStartX;
    const deltaY = e.clientY - mediaResizeStartY;

    // use the larger delta to maintain aspect ratio
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

    const minWidth = 100;
    const minHeight = 100;
    const maxWidth = 800;
    const maxHeight = 800;

    // calculate new width based on delta
    let newWidth = mediaResizeStartWidth + delta;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    // calculate height to maintain aspect ratio
    let newHeight = newWidth / resizeMediaItem.aspectRatio;
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    // if height would exceed max, recalculate from height
    if (newHeight >= maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * resizeMediaItem.aspectRatio;
    }

    resizeMediaItem.width = newWidth;
    resizeMediaItem.height = newHeight;

    const mediaElement = getItemElement(resizeMediaItem.id);
    if (mediaElement) {
        mediaElement.style.width = newWidth + 'px';
        mediaElement.style.height = newHeight + 'px';

        // update image to maintain aspect ratio
        const img = mediaElement.querySelector('.media-image');
        if (img) {
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
        }
    }

    // redraw lines to update connection positions
    redrawLines();
}

function stopMediaResize(e) {
    if (isMediaResizing && resizeMediaItem) {
        const mediaElement = getItemElement(resizeMediaItem.id);
        if (mediaElement) {
            mediaElement.classList.remove('resizing');
        }
        saveToStorage();
        redrawLines();
    }
    isMediaResizing = false;
    resizeMediaItem = null;
    document.removeEventListener('mousemove', onMediaResize);
    document.removeEventListener('mouseup', stopMediaResize);
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// connection functionality
let previewMouseX = 0;
let previewMouseY = 0;
let previewConnectionHandler = null;
let cancelOnEmptyClickHandler = null;

function startConnection(itemId, isMedia = false, position = 'top') {
    isConnecting = true;
    // ensure position is valid
    const validPositions = ['top', 'bottom', 'left', 'right'];
    const finalPosition = validPositions.includes(position) ? position : 'top';
    connectionStart = { noteId: itemId, isMedia: isMedia, position: finalPosition };

    // show connection points on all notes and media, add click handlers
    connectionHandlers.clear();

    // add handlers for notes
    notes.forEach(note => {
        const noteElement = getItemElement(note.id);
        if (noteElement) {
            noteElement.classList.add('connecting');
            // add click handler to complete connection (skip the source item)
            // only allow connections via connection points, not clicking anywhere on the note
        }
    });

    // add handlers for media items
    mediaItems.forEach(mediaItem => {
        const mediaElement = getItemElement(mediaItem.id);
        if (mediaElement) {
            mediaElement.classList.add('connecting');
            // only allow connections via connection points, not clicking anywhere on the media
        }
    });

    // calculate initial start point for preview
    const startItem = getItem(connectionStart.noteId);

    if (startItem) {
        const startElement = getItemElement(startItem.id);
        if (startElement) {
            // set initial preview position to start point
            if (connectionStart.position === 'top') {
                previewMouseX = startItem.x + startElement.offsetWidth / 2;
                previewMouseY = startItem.y;
            } else if (connectionStart.position === 'bottom') {
                previewMouseX = startItem.x + startElement.offsetWidth / 2;
                previewMouseY = startItem.y + startElement.offsetHeight;
            } else if (connectionStart.position === 'left') {
                previewMouseX = startItem.x;
                previewMouseY = startItem.y + startElement.offsetHeight / 2;
            } else if (connectionStart.position === 'right') {
                previewMouseX = startItem.x + startElement.offsetWidth;
                previewMouseY = startItem.y + startElement.offsetHeight / 2;
            } else {
                previewMouseX = startItem.x + startElement.offsetWidth / 2;
                previewMouseY = startItem.y + startElement.offsetHeight / 2;
            }
        }
    }

    // add mousemove handler to draw preview line
    previewConnectionHandler = (e) => {
        if (!isConnecting || !connectionStart) return;

        // convert mouse position to board coordinates
        const boardPos = screenToBoard(e.clientX, e.clientY);
        previewMouseX = boardPos.x;
        previewMouseY = boardPos.y;

        // redraw lines including preview
        redrawLines();
    };

    document.addEventListener('mousemove', previewConnectionHandler);

    // cancel connection on empty space click
    cancelOnEmptyClickHandler = (e) => {
        if (!isConnecting || !connectionStart) return;

        // check if click is on a connection point or item
        const target = e.target;
        const isConnectionPoint = target.classList.contains('connection-point') ||
            target.closest('.connection-point');
        const isNoteOrMedia = target.closest('.sticky-note') ||
            target.closest('.media-item');
        const isButton = target.tagName === 'BUTTON' || target.closest('button');

        // if clicked on empty space (not a connection point, item, or button), cancel
        if (!isConnectionPoint && !isNoteOrMedia && !isButton) {
            // check if click is within the corkboard (in board coordinates)
            const boardPos = screenToBoard(e.clientX, e.clientY);

            if (boardPos.x >= 0 && boardPos.x <= corkboard.offsetWidth &&
                boardPos.y >= 0 && boardPos.y <= corkboard.offsetHeight) {
                // click is within board, cancel connection
                e.stopPropagation(); // prevent other handlers from running
                isConnecting = false;
                connectionStart = null;
                notes.forEach(note => {
                    const noteElement = getItemElement(note.id);
                    if (noteElement) {
                        noteElement.classList.remove('connecting');
                    }
                });
                mediaItems.forEach(mediaItem => {
                    const mediaElement = getItemElement(mediaItem.id);
                    if (mediaElement) {
                        mediaElement.classList.remove('connecting');
                    }
                });
                cleanupConnectionHandlers();
                if (previewConnectionHandler) {
                    document.removeEventListener('mousemove', previewConnectionHandler);
                    previewConnectionHandler = null;
                }
                if (cancelOnEmptyClickHandler) {
                    document.removeEventListener('click', cancelOnEmptyClickHandler, true);
                    cancelOnEmptyClickHandler = null;
                }
                redrawLines(); // clear preview line
            }
        }
    };

    document.addEventListener('click', cancelOnEmptyClickHandler, true);

    // cancel connection on escape
    const cancelConnection = (e) => {
        if (e.key === 'Escape') {
            isConnecting = false;
            connectionStart = null;
            notes.forEach(note => {
                const noteElement = getItemElement(note.id);
                if (noteElement) {
                    noteElement.classList.remove('connecting');
                }
            });
            mediaItems.forEach(mediaItem => {
                const mediaElement = getItemElement(mediaItem.id);
                if (mediaElement) {
                    mediaElement.classList.remove('connecting');
                }
            });
            cleanupConnectionHandlers();
            if (previewConnectionHandler) {
                document.removeEventListener('mousemove', previewConnectionHandler);
                previewConnectionHandler = null;
            }
            if (cancelOnEmptyClickHandler) {
                document.removeEventListener('click', cancelOnEmptyClickHandler, true);
                cancelOnEmptyClickHandler = null;
            }
            document.removeEventListener('keydown', cancelConnection);
            redrawLines(); // clear preview line
        }
    };

    document.addEventListener('keydown', cancelConnection);
    redrawLines(); // initial draw to show preview
}

function cleanupConnectionHandlers() {
    notes.forEach(note => {
        const noteElement = getItemElement(note.id);
        if (noteElement) {
            const handler = connectionHandlers.get(note.id);
            if (handler) {
                noteElement.removeEventListener('click', handler, true);
            }
        }
    });
    mediaItems.forEach(mediaItem => {
        const mediaElement = getItemElement(mediaItem.id);
        if (mediaElement) {
            const handler = connectionHandlers.get(mediaItem.id);
            if (handler) {
                mediaElement.removeEventListener('click', handler, true);
            }
        }
    });
    connectionHandlers.clear();
}

function completeConnection(endItemId, endPosition) {
    if (!connectionStart) return;

    const startItemId = connectionStart.noteId;

    // don't connect an item to itself
    if (startItemId === endItemId) {
        isConnecting = false;
        connectionStart = null;
        notes.forEach(note => {
            const noteElement = document.getElementById(`note-${note.id}`);
            if (noteElement) {
                noteElement.classList.remove('connecting');
            }
        });
        mediaItems.forEach(mediaItem => {
            const mediaElement = document.getElementById(`media-${mediaItem.id}`);
            if (mediaElement) {
                mediaElement.classList.remove('connecting');
            }
        });
        cleanupConnectionHandlers();
        if (previewConnectionHandler) {
            document.removeEventListener('mousemove', previewConnectionHandler);
            previewConnectionHandler = null;
        }
        redrawLines(); // clear preview line
        return;
    }

    // check if connection already exists
    const exists = connections.some(conn =>
        (conn.from === startItemId && conn.to === endItemId) ||
        (conn.from === endItemId && conn.to === startItemId)
    );

    if (!exists) {
        connections.push({
            from: startItemId,
            to: endItemId,
            fromPos: connectionStart.position,
            toPos: endPosition
        });
        saveToStorage();
    }

    isConnecting = false;
    connectionStart = null;

    // hide connection points and clean up handlers
    notes.forEach(note => {
        const noteElement = document.getElementById(`note-${note.id}`);
        if (noteElement) {
            noteElement.classList.remove('connecting');
        }
    });
    mediaItems.forEach(mediaItem => {
        const mediaElement = document.getElementById(`media-${mediaItem.id}`);
        if (mediaElement) {
            mediaElement.classList.remove('connecting');
        }
    });

    cleanupConnectionHandlers();
    if (previewConnectionHandler) {
        document.removeEventListener('mousemove', previewConnectionHandler);
        previewConnectionHandler = null;
    }
    if (cancelOnEmptyClickHandler) {
        document.removeEventListener('click', cancelOnEmptyClickHandler, true);
        cancelOnEmptyClickHandler = null;
    }
    redrawLines();
}

// draw lines between connected notes
function redrawLines() {
    if (!linesVisible && !isConnecting) {
        ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        return;
    }

    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

    // draw existing connections
    connections.forEach(connection => {
        // find items (could be notes or media)
        const fromItem = getItem(connection.from);
        const toItem = getItem(connection.to);

        if (!fromItem || !toItem) return;

        // get elements using helper functions
        const fromElement = getItemElement(fromItem.id);
        const toElement = getItemElement(toItem.id);

        if (!fromElement || !toElement) return;

        // calculate connection points
        let fromX, fromY, toX, toY;

        // calculate FROM point (only edge positions)
        if (connection.fromPos === 'top') {
            fromX = fromItem.x + fromElement.offsetWidth / 2;
            fromY = fromItem.y;
        } else if (connection.fromPos === 'bottom') {
            fromX = fromItem.x + fromElement.offsetWidth / 2;
            fromY = fromItem.y + fromElement.offsetHeight;
        } else if (connection.fromPos === 'left') {
            fromX = fromItem.x;
            fromY = fromItem.y + fromElement.offsetHeight / 2;
        } else if (connection.fromPos === 'right') {
            fromX = fromItem.x + fromElement.offsetWidth;
            fromY = fromItem.y + fromElement.offsetHeight / 2;
        } else {
            // default to center if position is not recognized
            fromX = fromItem.x + fromElement.offsetWidth / 2;
            fromY = fromItem.y + fromElement.offsetHeight / 2;
        }

        // calculate TO point (only edge positions)
        if (connection.toPos === 'top') {
            toX = toItem.x + toElement.offsetWidth / 2;
            toY = toItem.y;
        } else if (connection.toPos === 'bottom') {
            toX = toItem.x + toElement.offsetWidth / 2;
            toY = toItem.y + toElement.offsetHeight;
        } else if (connection.toPos === 'left') {
            toX = toItem.x;
            toY = toItem.y + toElement.offsetHeight / 2;
        } else if (connection.toPos === 'right') {
            toX = toItem.x + toElement.offsetWidth;
            toY = toItem.y + toElement.offsetHeight / 2;
        } else {
            // default to center if position is not recognized
            toX = toItem.x + toElement.offsetWidth / 2;
            toY = toItem.y + toElement.offsetHeight / 2;
        }

        // draw red string line with a slight curve for realism
        drawRedString(fromX, fromY, toX, toY);
    });

    // draw preview line if connecting
    if (isConnecting && connectionStart) {
        // find the start item
        const startItem = getItem(connectionStart.noteId);

        if (startItem) {
            const startElement = getItemElement(startItem.id);

            if (startElement) {
                // calculate start point
                let startX, startY;
                if (connectionStart.position === 'top') {
                    startX = startItem.x + startElement.offsetWidth / 2;
                    startY = startItem.y;
                } else if (connectionStart.position === 'bottom') {
                    startX = startItem.x + startElement.offsetWidth / 2;
                    startY = startItem.y + startElement.offsetHeight;
                } else if (connectionStart.position === 'left') {
                    startX = startItem.x;
                    startY = startItem.y + startElement.offsetHeight / 2;
                } else if (connectionStart.position === 'right') {
                    startX = startItem.x + startElement.offsetWidth;
                    startY = startItem.y + startElement.offsetHeight / 2;
                } else {
                    startX = startItem.x + startElement.offsetWidth / 2;
                    startY = startItem.y + startElement.offsetHeight / 2;
                }

                // draw preview line to mouse position
                drawRedString(startX, startY, previewMouseX, previewMouseY);
            }
        }
    }
}

function drawRedString(x1, y1, x2, y2) {
    // calculate control point for curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const curveAmount = Math.min(distance * 0.08, 25);

    // deterministic but varied curve based on position (for realism without flickering)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpendicularAngle = angle + Math.PI / 2;
    const curveOffset = Math.sin((x1 + y1 + x2 + y2) * 0.01) * curveAmount;
    const curveX = midX + Math.cos(perpendicularAngle) * curveOffset;
    const curveY = midY + Math.sin(perpendicularAngle) * curveOffset;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(curveX, curveY, x2, y2);

    // red string style
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(198, 40, 40, 0.5)';
    ctx.shadowBlur = 2;
    ctx.stroke();

    // add slight shadow/glow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(curveX, curveY, x2, y2);
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();
}

// update note title
function updateNoteTitle(noteId, title) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.title = title || 'New Note';
        saveToStorage();
    }
}

// update note content
function updateNoteContent(noteId, content) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.content = content;
        saveToStorage();
    }
}

// highlighter functionality
const highlighterState = new Map(); // store highlighter state per note
const highlighterSaveTimeouts = new Map(); // store save timeouts per note

function initializeHighlighter(itemId, isMedia = false) {
    const item = getItem(itemId);

    if (!item || !item.mediaDataUrl) return;

    const itemElement = getItemElement(itemId);
    if (!itemElement) return;

    const mediaContainer = itemElement.querySelector('.note-media-container');
    const canvas = itemElement.querySelector('.note-media-canvas');
    const img = itemElement.querySelector('.note-media-image');

    if (!canvas || !img) return;

    const selector = isMediaItem(itemId) ? `[data-media-id="${itemId}"]` : `[data-note-id="${itemId}"]`;
    const toggleBtn = itemElement.querySelector(`.highlighter-toggle-btn${selector}`);
    const colorInput = itemElement.querySelector(`.highlighter-color${selector}`);
    const sizeInput = itemElement.querySelector(`.highlighter-size${selector}`);
    const clearBtn = itemElement.querySelector(`.highlighter-clear-btn${selector}`);

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let isHighlighting = false;

    // set canvas size to match image
    function resizeCanvas() {
        const imgRect = img.getBoundingClientRect();
        canvas.width = imgRect.width;
        canvas.height = imgRect.height;

    }

    // wait for image to load and redraw highlighter data
    function loadHighlighterData() {
        resizeCanvas();
        // redraw existing highlighter data after canvas is resized
        if (item.highlighterData) {
            setTimeout(() => {
                const imgData = new Image();
                imgData.onload = () => {
                    // use source-over to draw the saved canvas data
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(imgData, 0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'multiply'; // restore for new highlights
                };
                imgData.src = item.highlighterData;
            }, 50);
        }
    }

    if (img.complete) {
        loadHighlighterData();
    } else {
        img.onload = () => {
            loadHighlighterData();
        };
    }

    // update on window resize
    const resizeObserver = new ResizeObserver(() => {
        const oldData = item.highlighterData;
        resizeCanvas();
        // redraw highlighter data after resize
        if (oldData) {
            setTimeout(() => {
                const imgData = new Image();
                imgData.onload = () => {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(imgData, 0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'multiply';
                };
                imgData.src = oldData;
            }, 50);
        }
    });
    resizeObserver.observe(img);

    // toggle highlighter mode
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isHighlighting = !isHighlighting;
        mediaContainer.classList.toggle('highlighting', isHighlighting);
        toggleBtn.textContent = isHighlighting ? '✋' : '🖍️';
        canvas.style.pointerEvents = isHighlighting ? 'all' : 'none';
    });

    // highlighter drawing
    function getHighlighterStyle(color) {
        // convert hex to rgba with transparency
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }

    let lastX = null;
    let lastY = null;

    function drawHighlight(x, y, size, color) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply'; // realistic highlighter effect

        // create gradient for realistic highlighter stroke with soft edges
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // more realistic highlighter: semi-transparent center, fading edges
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.4)`);
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.2)`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;

        // draw smooth connected strokes if we have a previous point
        if (lastX !== null && lastY !== null) {
            // draw a path between points for smooth strokes
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.lineWidth = size * 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
            ctx.stroke();
        }

        // draw the current highlight point
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        lastX = x;
        lastY = y;

        ctx.restore();
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!isHighlighting) return;
        e.stopPropagation();
        isDrawing = true;
        lastX = null;
        lastY = null;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const size = parseInt(sizeInput.value);
        const color = colorInput.value;
        drawHighlight(x, y, size, color);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isHighlighting || !isDrawing) return;
        e.stopPropagation();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const size = parseInt(sizeInput.value);
        const color = colorInput.value;
        drawHighlight(x, y, size, color);
        // throttle saves during drawing for better performance
        if (highlighterSaveTimeouts.has(itemId)) {
            clearTimeout(highlighterSaveTimeouts.get(itemId));
        }
        highlighterSaveTimeouts.set(itemId, setTimeout(() => {
            saveHighlighterData(itemId, isMedia);
            highlighterSaveTimeouts.delete(itemId);
        }, 200));
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isDrawing) {
            isDrawing = false;
            lastX = null;
            lastY = null;
            saveHighlighterData(itemId, isMedia);
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isDrawing) {
            isDrawing = false;
            lastX = null;
            lastY = null;
            saveHighlighterData(itemId, isMedia);
        }
    });

    // clear highlights
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Clear all highlights on this image?')) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                item.highlighterData = null;
                saveHighlighterData(itemId, isMedia);
                saveToStorage();
            }
        });
    }

    // store highlighter state
    highlighterState.set(itemId, {
        ctx,
        canvas,
        img,
        isHighlighting: false,
        isDrawing: false
    });
}

function saveHighlighterData(itemId, isMedia = false) {
    let item;
    if (isMedia) {
        item = mediaItems.find(m => m.id === itemId);
    } else {
        item = notes.find(n => n.id === itemId);
    }
    if (!item) return;

    const elementId = isMedia ? `media-${itemId}` : `note-${itemId}`;
    const itemElement = document.getElementById(elementId);
    if (!itemElement) return;

    const canvas = itemElement.querySelector('.note-media-canvas');
    if (!canvas) return;

    // save canvas data as base64
    item.highlighterData = canvas.toDataURL();
    saveToStorage();
}

function redrawHighlighter(itemId, ctx, width, height, isMedia = false) {
    const item = getItem(itemId);
    if (!item || !item.highlighterData) return;

    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        // draw the highlighter canvas data onto the canvas
        ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = item.highlighterData;
}

// initialize highlighter after note is rendered and image is loaded
function initializeHighlighterAfterLoad(noteId) {
    const note = getItem(noteId);
    if (!note || !note.mediaDataUrl) return;

    const noteElement = getItemElement(noteId);
    if (!noteElement) return;

    const img = noteElement.querySelector('.note-media-image');
    if (!img) return;

    // wait for image to fully load before initializing
    if (img.complete) {
        setTimeout(() => initializeHighlighter(itemId, isMedia), 100);
    } else {
        img.onload = () => {
            setTimeout(() => initializeHighlighter(itemId, isMedia), 100);
        };
    }
}

// Helper function to get board name from currentBoardId
function getBoardName(boardId) {
    if (!boardId) return 'board';

    try {
        const metadata = localStorage.getItem(`deloosional-board-metadata-${boardId}`);
        if (metadata) {
            const meta = JSON.parse(metadata);
            return meta.name || `Board ${boardId}`;
        }
    } catch (e) {
        console.error('Failed to get board name:', e);
    }

    return `Board ${boardId}`;
}

// Case Closed Animation is handled in gavel-animation.js

// screenshot/download functionality
downloadBtn.addEventListener('click', async () => {
    // Trigger the Case Closed animation
    triggerCaseClosedAnimation();

    if (typeof html2canvas === 'undefined') {
        alert('Screenshot functionality is loading. Please try again in a moment.');
        return;
    }

    // Save current transform state
    let savedTransform = '';
    let savedPosition = '';
    let savedTop = '';
    let savedLeft = '';

    try {
        // Wait for fonts to load
        await document.fonts.ready;

        // Wait for all images in the board to load
        const images = corkboard.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if image fails
                setTimeout(resolve, 2000); // Timeout after 2 seconds
            });
        });
        await Promise.all(imagePromises);

        // Ensure lines are drawn
        redrawLines();

        // Additional wait to ensure everything is rendered
        await new Promise(resolve => setTimeout(resolve, 500));

        // Save current transform state before modifying
        if (zoomContainer) {
            savedTransform = zoomContainer.style.transform || '';
            // Get computed styles for position properties (they're in CSS, not inline)
            const computedStyle = window.getComputedStyle(zoomContainer);
            savedPosition = computedStyle.position;
            savedTop = computedStyle.top;
            savedLeft = computedStyle.left;
        }

        // Temporarily remove ALL transforms and reset positioning
        if (zoomContainer) {
            zoomContainer.style.transform = 'none';
            zoomContainer.style.position = 'static';
            zoomContainer.style.top = '0';
            zoomContainer.style.left = '0';
        }

        // Small delay to ensure transform removal is applied
        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture the corkboard at exact dimensions without transforms
        const canvas = await html2canvas(corkboard, {
            backgroundColor: '#d4a574',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            x: 0,
            y: 0,
            width: 2000,
            height: 1500,
            windowWidth: 2000,
            windowHeight: 1500,
            foreignObjectRendering: false,
            imageTimeout: 0,
            removeContainer: true
        });

        // Restore transforms immediately after capture
        if (zoomContainer) {
            zoomContainer.style.transform = savedTransform;
            // Restore position properties - set to empty to let CSS take over
            zoomContainer.style.position = '';
            zoomContainer.style.top = '';
            zoomContainer.style.left = '';
            // Re-apply the transform to ensure zoom state is correct
            updateZoomTransform();
        }

        // Get board name for filename
        const boardName = getBoardName(currentBoardId);
        const sanitizedName = boardName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        // Download as image
        const link = document.createElement('a');
        link.download = `deloosional-${sanitizedName}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        alert('Failed to capture screenshot. Please try again.');

        // Restore transforms on error (critical - must always restore)
        if (zoomContainer) {
            // Restore position properties - set to empty to let CSS take over
            zoomContainer.style.position = '';
            zoomContainer.style.top = '';
            zoomContainer.style.left = '';
            // Restore transform and update zoom state
            zoomContainer.style.transform = savedTransform;
            updateZoomTransform();
        }
    }
});

// download board from welcome page
async function downloadBoard(boardId, boardName) {
    // Trigger the Case Closed animation
    triggerCaseClosedAnimation();

    if (typeof html2canvas === 'undefined') {
        alert('Screenshot functionality is loading. Please try again in a moment.');
        return;
    }

    // Save current state
    const previousBoardId = currentBoardId;
    const wasOnWelcomePage = welcomePage && welcomePage.style.display !== 'none';

    // Save current transform state
    let savedTransform = '';
    let savedPosition = '';
    let savedTop = '';
    let savedLeft = '';

    try {
        // Load the board temporarily
        loadFromStorage(boardId);
        showBoardEditor();

        // Wait for fonts to load
        await document.fonts.ready;

        // Wait for board to render, images to load, and DOM to settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Wait for all images in the board to load
        const images = corkboard.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if image fails
                setTimeout(resolve, 2000); // Timeout after 2 seconds
            });
        });
        await Promise.all(imagePromises);

        // Ensure lines are drawn
        redrawLines();

        // Additional wait to ensure everything is rendered
        await new Promise(resolve => setTimeout(resolve, 500));

        // Save current transform state before modifying
        if (zoomContainer) {
            savedTransform = zoomContainer.style.transform || '';
            // Get computed styles for position properties (they're in CSS, not inline)
            const computedStyle = window.getComputedStyle(zoomContainer);
            savedPosition = computedStyle.position;
            savedTop = computedStyle.top;
            savedLeft = computedStyle.left;
        }

        // Temporarily remove ALL transforms and reset positioning
        if (zoomContainer) {
            zoomContainer.style.transform = 'none';
            zoomContainer.style.position = 'static';
            zoomContainer.style.top = '0';
            zoomContainer.style.left = '0';
        }

        // Small delay to ensure transform removal is applied
        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture the corkboard at exact dimensions without transforms
        const canvas = await html2canvas(corkboard, {
            backgroundColor: '#d4a574',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            x: 0,
            y: 0,
            width: 2000,
            height: 1500,
            windowWidth: 2000,
            windowHeight: 1500,
            foreignObjectRendering: false,
            imageTimeout: 0,
            removeContainer: true
        });

        // Restore transforms immediately after capture
        if (zoomContainer) {
            zoomContainer.style.transform = savedTransform;
            // Restore position properties - set to empty to let CSS take over
            zoomContainer.style.position = '';
            zoomContainer.style.top = '';
            zoomContainer.style.left = '';
            // Re-apply the transform to ensure zoom state is correct
            updateZoomTransform();
        }

        // Download as image
        const link = document.createElement('a');
        const sanitizedName = boardName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        link.download = `deloosional-${sanitizedName}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Restore previous state
        if (wasOnWelcomePage) {
            showWelcomePage();
        } else if (previousBoardId) {
            loadFromStorage(previousBoardId);
            showBoardEditor();
        }
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        alert('Failed to capture screenshot. Please try again.');

        // Restore transforms on error (critical - must always restore)
        if (zoomContainer) {
            // Restore position properties - set to empty to let CSS take over
            zoomContainer.style.position = '';
            zoomContainer.style.top = '';
            zoomContainer.style.left = '';
            // Restore transform and update zoom state
            zoomContainer.style.transform = savedTransform;
            updateZoomTransform();
        }

        // Restore previous state on error
        if (wasOnWelcomePage) {
            showWelcomePage();
        } else if (previousBoardId) {
            loadFromStorage(previousBoardId);
            showBoardEditor();
        }
    }
}

// delete note
function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
        // remove connections
        connections = connections.filter(conn =>
            conn.from !== noteId && conn.to !== noteId
        );

        // remove note
        notes = notes.filter(n => n.id !== noteId);

        // remove DOM element
        const noteElement = getItemElement(noteId);
        if (noteElement) {
            noteElement.remove();
        }

        saveToStorage();
        redrawLines();
    }
}

// clear all
clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all notes and media? This cannot be undone.')) {
        notes = [];
        mediaItems = [];
        connections = [];
        notesContainer.innerHTML = '';
        saveToStorage();
        redrawLines();
    }
});

// toggle string visibility
toggleLinesSwitch.addEventListener('change', () => {
    linesVisible = toggleLinesSwitch.checked;
    redrawLines();
});

// clear all strings
clearStringsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all string connections? This cannot be undone.')) {
        connections = [];
        redrawLines();
        saveToStorage();
    }
});

// save to localStorage (by board ID)
function saveToStorage() {
    if (!currentBoardId) return;

    try {
        const boardData = {
            notes: notes,
            media: mediaItems,
            connections: connections,
            noteIdCounter: noteIdCounter,
            lastModified: new Date().toISOString()
        };

        localStorage.setItem(`deloosional-board-${currentBoardId}`, JSON.stringify(boardData));

        // update board metadata
        updateBoardMetadata(currentBoardId);

        // note: preview generation now happens only when leaving the board (clicking Homepage)
    } catch (e) {
        console.error('Failed to save to storage:', e);
    }
}

// generate board preview - simple version that only captures the current board
function generateBoardPreview(boardId) {
    if (!boardId || !corkboard || typeof html2canvas === 'undefined') {
        console.warn('Cannot generate preview: missing boardId, corkboard, or html2canvas');
        return Promise.resolve();
    }

    // Ensure board is visible and rendered before capturing
    return new Promise((resolve, reject) => {
        // Wait for all images to load before capturing
        const images = corkboard.querySelectorAll('img');
        let imagesToLoad = images.length;
        let imagesLoaded = 0;

        const checkImagesLoaded = () => {
            if (imagesToLoad === 0 || imagesLoaded === imagesToLoad) {
                // All images loaded (or no images), proceed with capture
                setTimeout(() => {
                    try {
                        // Ensure board is still visible
                        if (corkboard && boardEditor && boardEditor.style.display !== 'none') {
                            // use html2canvas to capture the corkboard (just the corkboard, not the black background)
                            html2canvas(corkboard, {
                                backgroundColor: '#d4a574',
                                scale: 0.5, // higher quality scale for preview
                                logging: false,
                                useCORS: true,
                                allowTaint: true,
                                windowWidth: corkboard.scrollWidth,
                                windowHeight: corkboard.scrollHeight,
                                onclone: (clonedDoc) => {
                                    // Ensure all images in the clone are loaded
                                    const clonedImages = clonedDoc.querySelectorAll('img');
                                    clonedImages.forEach(img => {
                                        if (!img.complete) {
                                            // Force load if not complete
                                            img.src = img.src;
                                        }
                                    });
                                }
                            }).then(canvas => {
                                const previewData = canvas.toDataURL('image/png');
                                localStorage.setItem(`deloosional-board-preview-${boardId}`, previewData);
                                // refresh the boards list to show the new preview
                                renderBoardsList();
                                resolve(previewData);
                            }).catch(e => {
                                console.error('Failed to generate preview:', e);
                                reject(e);
                            });
                        } else {
                            console.warn('Board is not visible, cannot generate preview');
                            reject(new Error('Board is not visible'));
                        }
                    } catch (error) {
                        console.error('Error in generateBoardPreview:', error);
                        reject(error);
                    }
                }, 100); // Small delay to ensure DOM is ready after images load
            }
        };

        // Global timeout to avoid infinite wait (max 3 seconds total)
        const maxWaitTime = 3000;
        const timeoutId = setTimeout(() => {
            if (imagesLoaded < imagesToLoad) {
                console.warn('Timeout waiting for images to load, proceeding with preview generation');
                imagesLoaded = imagesToLoad; // Force completion
                checkImagesLoaded();
            }
        }, maxWaitTime);

        if (imagesToLoad === 0) {
            // No images, proceed immediately
            clearTimeout(timeoutId);
            checkImagesLoaded();
        } else {
            // Wait for images to load
            images.forEach(img => {
                if (img.complete) {
                    imagesLoaded++;
                    if (imagesLoaded === imagesToLoad) {
                        clearTimeout(timeoutId);
                    }
                    checkImagesLoaded();
                } else {
                    const onImageLoad = () => {
                        imagesLoaded++;
                        if (imagesLoaded === imagesToLoad) {
                            clearTimeout(timeoutId);
                        }
                        checkImagesLoaded();
                    };
                    img.onload = onImageLoad;
                    img.onerror = onImageLoad; // Count errors as "loaded" to avoid infinite wait
                }
            });
        }
    });
}

// load from localStorage (by board ID)
function loadFromStorage(boardId) {
    if (!boardId) return;

    try {
        // clear current board
        clearBoard();

        const savedData = localStorage.getItem(`deloosional-board-${boardId}`);
        if (!savedData) {
            // new board - initialize with defaults
            notes = [];
            mediaItems = [];
            connections = [];
            noteIdCounter = 0;
            // board size is fixed at 2000x1500
            currentBoardId = boardId;
            setTimeout(() => {
                initCanvas();
                initZoom();
            }, 100);
            return;
        }

        const boardData = JSON.parse(savedData);

        // board size is now fixed at 2000x1500, no need to load dimensions

        if (boardData.notes) {
            notes = boardData.notes;
            notes.forEach(note => {
                // ensure old notes have width and height
                if (!note.width) note.width = 200;
                if (!note.height) note.height = 150;
                renderNote(note);
            });
        }

        if (boardData.media) {
            mediaItems = boardData.media;
            mediaItems.forEach(mediaItem => {
                renderMediaItem(mediaItem);
            });
        }

        if (boardData.connections) {
            connections = boardData.connections;
        }

        if (boardData.noteIdCounter) {
            noteIdCounter = parseInt(boardData.noteIdCounter, 10);
        }

        // set toggle switch state based on linesVisible
        if (toggleLinesSwitch) {
            toggleLinesSwitch.checked = linesVisible;
        }

        currentBoardId = boardId;

        // initialize canvas and zoom after loading
        setTimeout(() => {
            initCanvas();
            initZoom();
            // note: preview generation now happens only when leaving the board
        }, 100);
    } catch (e) {
        console.error('Failed to load from storage:', e);
    }
}

// clear current board (without saving)
function clearBoard() {
    notes = [];
    mediaItems = [];
    connections = [];
    noteIdCounter = 0;
    notesContainer.innerHTML = '';
    redrawLines();
}

// redraw lines when notes are moved or updated
setInterval(() => {
    if (isDragging) {
        redrawLines();
    }
}, 50);

// board management functions
function getAllBoards() {
    const boards = [];
    for (let i = 1; i <= MAX_BOARDS; i++) {
        const boardData = localStorage.getItem(`deloosional-board-${i}`);
        const metadata = localStorage.getItem(`deloosional-board-metadata-${i}`);

        if (boardData || metadata) {
            let boardInfo = {
                id: i,
                name: `Board ${i}`,
                lastModified: null,
                isEmpty: !boardData
            };

            if (metadata) {
                try {
                    const meta = JSON.parse(metadata);
                    boardInfo.name = meta.name || boardInfo.name;
                    boardInfo.lastModified = meta.lastModified || null;
                } catch (e) {
                    console.error('Failed to parse board metadata:', e);
                }
            } else if (boardData) {
                try {
                    const data = JSON.parse(boardData);
                    boardInfo.lastModified = data.lastModified || null;
                } catch (e) {
                    console.error('Failed to parse board data:', e);
                }
            }

            boards.push(boardInfo);
        } else {
            boards.push({
                id: i,
                name: `Board ${i}`,
                lastModified: null,
                isEmpty: true
            });
        }
    }
    return boards;
}

function updateBoardMetadata(boardId) {
    if (!boardId) return;

    try {
        const boardData = localStorage.getItem(`deloosional-board-${boardId}`);
        const existingMetadata = localStorage.getItem(`deloosional-board-metadata-${boardId}`);

        let name = `Board ${boardId}`;
        if (existingMetadata) {
            try {
                const meta = JSON.parse(existingMetadata);
                name = meta.name || name;
            } catch (e) {
                // use default name
            }
        }

        if (boardData) {
            const data = JSON.parse(boardData);
            const metadata = {
                name: name,
                lastModified: data.lastModified || new Date().toISOString()
            };
            localStorage.setItem(`deloosional-board-metadata-${boardId}`, JSON.stringify(metadata));
        }
    } catch (e) {
        console.error('Failed to update board metadata:', e);
    }
}

function renameBoard(boardId, newName) {
    if (!boardId || !newName || newName.trim() === '') return;

    try {
        const existingMetadata = localStorage.getItem(`deloosional-board-metadata-${boardId}`);
        let metadata = {
            name: newName.trim(),
            lastModified: new Date().toISOString()
        };

        if (existingMetadata) {
            try {
                const meta = JSON.parse(existingMetadata);
                metadata.lastModified = meta.lastModified || metadata.lastModified;
            } catch (e) {
                // use new metadata
            }
        }

        localStorage.setItem(`deloosional-board-metadata-${boardId}`, JSON.stringify(metadata));
    } catch (e) {
        console.error('Failed to rename board:', e);
    }
}

function createBoard() {
    // find first empty slot
    for (let i = 1; i <= MAX_BOARDS; i++) {
        const boardData = localStorage.getItem(`deloosional-board-${i}`);
        if (!boardData) {
            // found empty slot
            const boardId = i;
            const metadata = {
                name: `Board ${boardId}`,
                lastModified: new Date().toISOString()
            };
            localStorage.setItem(`deloosional-board-metadata-${boardId}`, JSON.stringify(metadata));
            return boardId;
        }
    }
    // all slots full - use first slot
    return 1;
}

function deleteBoard(boardId) {
    if (!boardId) return;

    try {
        localStorage.removeItem(`deloosional-board-${boardId}`);
        localStorage.removeItem(`deloosional-board-metadata-${boardId}`);
        localStorage.removeItem(`deloosional-board-preview-${boardId}`);
    } catch (e) {
        console.error('Failed to delete board:', e);
    }
}

function startRenamingBoard(boardId, boardCard) {
    const nameElement = boardCard.querySelector('.board-card-name');
    if (!nameElement) return;

    const currentName = nameElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'board-card-name-input';
    input.value = currentName;
    input.maxLength = 50;

    let isFinishing = false;
    const finishRenaming = () => {
        if (isFinishing) return; // Prevent double execution
        isFinishing = true;

        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            renameBoard(boardId, newName);
            renderBoardsList();
        } else {
            // Restore the original name element
            const restoredName = document.createElement('div');
            restoredName.className = 'board-card-name';
            restoredName.setAttribute('data-board-id', boardId);
            restoredName.textContent = currentName;
            input.replaceWith(restoredName);
        }
    };

    input.addEventListener('blur', () => {
        // Only handle blur if we're not already finishing (e.g., from Enter key)
        if (!isFinishing) {
            finishRenaming();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            isFinishing = false; // Reset flag to allow execution
            finishRenaming();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            isFinishing = true; // Prevent blur from firing
            // Restore the original name element
            const restoredName = document.createElement('div');
            restoredName.className = 'board-card-name';
            restoredName.setAttribute('data-board-id', boardId);
            restoredName.textContent = currentName;
            input.replaceWith(restoredName);
        }
    });

    nameElement.replaceWith(input);
    input.focus();
    input.select();
}

function renderBoardsList() {
    if (!boardsList) return;

    boardsList.innerHTML = '';
    const boards = getAllBoards();

    boards.forEach(board => {
        const boardCard = document.createElement('div');
        boardCard.className = `board-card ${board.isEmpty ? 'empty' : ''}`;

        if (board.isEmpty) {
            boardCard.innerHTML = `
                <div class="board-card-name">Empty Slot</div>
            `;
            boardCard.addEventListener('click', () => {
                // Use this slot's ID
                const metadata = {
                    name: `Board ${board.id}`,
                    lastModified: new Date().toISOString()
                };
                localStorage.setItem(`deloosional-board-metadata-${board.id}`, JSON.stringify(metadata));
                openBoard(board.id);
            });
        } else {
            const dateStr = board.lastModified
                ? (() => {
                    const date = new Date(board.lastModified);
                    const day = date.getDate();
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    const month = monthNames[date.getMonth()];
                    const year = date.getFullYear();
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${day} ${month} ${year} at ${hours}:${minutes}`;
                })()
                : 'No date';

            // Get preview if available
            const previewData = localStorage.getItem(`deloosional-board-preview-${board.id}`);
            const previewHtml = previewData
                ? `<div class="board-card-preview"><img src="${previewData}" alt="Board preview"></div>`
                : `<div class="board-card-preview empty">No preview</div>`;

            boardCard.innerHTML = `
                <button class="board-card-rename" data-board-id="${board.id}" title="Rename Board">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                        <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
                        <path d="M16 5l3 3" />
                    </svg>
                </button>
                <button class="board-card-download" data-board-id="${board.id}" title="Download Board">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
                        <path d="M7 11l5 5l5 -5" />
                        <path d="M12 4l0 12" />
                    </svg>
                </button>
                <button class="board-card-delete" data-board-id="${board.id}" title="Delete Board">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-trash"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                </button>
                ${previewHtml}
                <div class="board-card-name" data-board-id="${board.id}">${board.name}</div>
                <div class="board-card-date">Last modified: ${dateStr}</div>
            `;

            boardCard.addEventListener('click', (e) => {
                if (!e.target.closest('.board-card-delete') &&
                    !e.target.closest('.board-card-rename') &&
                    !e.target.closest('.board-card-download') &&
                    !e.target.closest('.board-card-name-input')) {
                    openBoard(board.id);
                }
            });

            const deleteBtn = boardCard.querySelector('.board-card-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${board.name}?`)) {
                        deleteBoard(board.id);
                        renderBoardsList();
                    }
                });
            }

            const renameBtn = boardCard.querySelector('.board-card-rename');
            if (renameBtn) {
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    startRenamingBoard(board.id, boardCard);
                });
            }

            const downloadBtn = boardCard.querySelector('.board-card-download');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await downloadBoard(board.id, board.name);
                });
            }

            const nameElement = boardCard.querySelector('.board-card-name');
            if (nameElement) {
                nameElement.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    startRenamingBoard(board.id, boardCard);
                });
            }
        }

        boardsList.appendChild(boardCard);
    });
}

function showWelcomePage() {
    if (welcomePage) welcomePage.style.display = 'flex';
    if (boardEditor) boardEditor.style.display = 'none';
    renderBoardsList();
    // Replace current state with welcome page state (so back button works correctly)
    if (window.history && window.history.replaceState) {
        window.history.replaceState({ page: 'welcome' }, '', window.location.pathname);
    }
}

function showBoardEditor() {
    if (welcomePage) welcomePage.style.display = 'none';
    if (boardEditor) boardEditor.style.display = 'block';
}

function openBoard(boardId) {
    if (!boardId) return;

    // Save current board before switching
    if (currentBoardId) {
        saveToStorage();
    }

    loadFromStorage(boardId);
    showBoardEditor();

    // Push state to history so browser back button works
    if (window.history && window.history.pushState) {
        window.history.pushState({ page: 'board', boardId: boardId }, '', `#board-${boardId}`);
    }
}

// Event listeners for welcome page
if (createNewBoardBtn) {
    createNewBoardBtn.addEventListener('click', () => {
        const newBoardId = createBoard();
        openBoard(newBoardId);
    });
}

// Unified function to exit board and generate preview
function exitBoardAndGeneratePreview() {
    if (!currentBoardId) {
        showWelcomePage();
        return;
    }

    const boardIdToPreview = currentBoardId; // Store board ID before clearing

    // Save current board state first
    saveToStorage();

    // Wait 500ms to ensure all saves are complete and DOM is ready
    setTimeout(() => {
        // Generate preview while board is still visible
        // Add a timeout to ensure we don't wait forever
        const previewTimeout = setTimeout(() => {
            console.warn('Preview generation timeout, showing welcome page anyway');
            showWelcomePage();
        }, 5000); // Maximum 5 seconds wait time

        generateBoardPreview(boardIdToPreview)
            .then(() => {
                clearTimeout(previewTimeout);
                // Preview generated successfully, now show welcome page
                showWelcomePage();
            })
            .catch((error) => {
                clearTimeout(previewTimeout);
                console.error('Preview generation failed, but showing welcome page anyway:', error);
                // Show welcome page even if preview fails
                showWelcomePage();
            });
    }, 500);
}

if (backToWelcomeBtn) {
    backToWelcomeBtn.addEventListener('click', () => {
        exitBoardAndGeneratePreview();
    });
}

// Logo click to go back to homepage
if (logo) {
    logo.addEventListener('click', () => {
        exitBoardAndGeneratePreview();
    });
    logo.style.cursor = 'pointer';
}

// Sidebar toggle functionality
function toggleSidebar() {
    if (!sidebar || !boardEditor) return;

    sidebar.classList.toggle('collapsed');
    // Update board editor class for CSS targeting
    if (sidebar.classList.contains('collapsed')) {
        boardEditor.classList.add('sidebar-collapsed');
    } else {
        boardEditor.classList.remove('sidebar-collapsed');
    }
    // Save sidebar state to localStorage
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('deloosional-sidebar-collapsed', isCollapsed.toString());
}

if (sidebarToggleBtn && sidebar && boardEditor) {
    // Toggle on button click - use capture phase to ensure it fires
    sidebarToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
    }, true);

    // Also make the entire collapsed header clickable as fallback
    const sidebarHeader = sidebar.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.addEventListener('click', (e) => {
            // Only trigger if sidebar is collapsed
            if (sidebar.classList.contains('collapsed')) {
                // Don't trigger if click was on the button (already handled)
                if (e.target !== sidebarToggleBtn && !sidebarToggleBtn.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSidebar();
                }
            }
        }, true);
    }

    // Keyboard shortcut: Escape key to expand sidebar if collapsed
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('collapsed')) {
            toggleSidebar();
        }
    });

    // Load saved sidebar state
    const savedState = localStorage.getItem('deloosional-sidebar-collapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
        boardEditor.classList.add('sidebar-collapsed');
    }
}

// Track if we're handling navigation manually to avoid recursion
let isHandlingNavigation = false;

// Handle browser back/forward button
window.addEventListener('popstate', (event) => {
    if (isHandlingNavigation) {
        return; // Avoid recursion
    }

    // When user navigates back from a board, exit the board and generate preview
    // Check if we're currently viewing a board (boardEditor is visible)
    if (currentBoardId && boardEditor && boardEditor.style.display !== 'none') {
        // We're navigating away from a board, so exit it and generate preview
        isHandlingNavigation = true;
        exitBoardAndGeneratePreview();
        // Reset flag after a delay to allow navigation to complete
        setTimeout(() => {
            isHandlingNavigation = false;
        }, 1000);
    } else if (event.state && event.state.page === 'board' && event.state.boardId) {
        // If we're navigating to a board from history, open it
        // This handles forward navigation
        isHandlingNavigation = true;
        openBoard(event.state.boardId);
        setTimeout(() => {
            isHandlingNavigation = false;
        }, 100);
    } else {
        // Navigating to welcome page - ensure it's shown
        if (welcomePage && welcomePage.style.display === 'none') {
            showWelcomePage();
        }
    }
});

// Rotating title sentences
const titleSentences = [
    "Where ideas connect like clues.",
    "Every thought's a thread — start untangling.",
    "The board is yours. Start connecting the dots.",
    "Ideas don't exist alone. Find what ties them together.",
    "Step into the investigation of ideas.",
    "Every board hides a story — uncover it.",
    "Trace the red string. Find the pattern.",
    "Nothing is random. Everything connects.",
    "It's not obsession — it's analysis.",
    "Get tangled in your thoughts — deliberately.",
    "Build your conspiracy of concepts.",
    "Connect chaos into meaning.",
    "Trace the red string of ideas."
];

let currentTitleIndex = 0;
let titleScrambleInterval = null;
let usedIndices = []; // Track which quotes have been shown

// Random character generator for scrambling effect (lowercase letters only)
function getRandomChar() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return chars[Math.floor(Math.random() * chars.length)];
}

// Scramble text effect - transitions from current text to target text
function scrambleText(element, targetText, onComplete) {
    const currentText = element.textContent || '';
    const currentLength = currentText.length;
    const targetLength = targetText.length;
    let iterations = 0;
    const maxIterations = 15; // 15 iterations for 1.5 second duration (slower)
    const maxShufflesPerChar = 1; // Each character only shuffles 1 time (slower appearance)

    // Calculate how many iterations to spend on length transition
    const lengthDiff = Math.abs(targetLength - currentLength);
    const lengthTransitionIterations = Math.min(Math.ceil(lengthDiff / 2), 3); // Use up to 3 iterations for length transition
    const shuffleStartIteration = lengthTransitionIterations;
    const effectiveMaxIterations = maxIterations - shuffleStartIteration;

    // Pre-calculate random shuffle start times for each character position
    // This creates the organic effect where random characters start shuffling at different times
    const charShuffleStarts = [];
    for (let i = 0; i < targetLength; i++) {
        // Random start time spread across the shuffle phase
        // Characters will start shuffling at random times between 0 and effectiveMaxIterations
        const randomStart = Math.random() * effectiveMaxIterations;
        charShuffleStarts[i] = Math.floor(randomStart);
    }

    if (titleScrambleInterval) {
        clearInterval(titleScrambleInterval);
    }

    titleScrambleInterval = setInterval(() => {
        // Calculate current target length (gradually transition from current to target)
        let currentTargetLength;
        if (iterations < lengthTransitionIterations) {
            // Gradually transition length
            const progress = iterations / lengthTransitionIterations;
            currentTargetLength = Math.round(currentLength + (targetLength - currentLength) * progress);
        } else {
            currentTargetLength = targetLength;
        }

        let scrambled = '';
        for (let i = 0; i < currentTargetLength; i++) {
            // Preserve spaces and punctuation immediately - no shuffling
            if (i < targetLength && (targetText[i] === ' ' || targetText[i].match(/[.,!?;:—]/))) {
                scrambled += targetText[i];
            } else {
                // Only start shuffling after length transition is complete
                const adjustedIterations = Math.max(0, iterations - shuffleStartIteration);

                // Use pre-calculated random shuffle start time for this character
                const charShuffleStart = i < charShuffleStarts.length ? charShuffleStarts[i] : 0;
                const charRevealStart = charShuffleStart + maxShufflesPerChar;

                if (iterations < shuffleStartIteration || adjustedIterations < charShuffleStart) {
                    // Before shuffle starts (or during length transition), show scrambled character
                    scrambled += getRandomChar();
                } else if (adjustedIterations >= charShuffleStart && adjustedIterations < charRevealStart) {
                    // During shuffle phase, show random characters
                    scrambled += getRandomChar();
                } else if (i < targetLength) {
                    // After shuffle, reveal the actual character from target text
                    scrambled += targetText[i];
                } else {
                    // Extra characters during length transition
                    scrambled += getRandomChar();
                }
            }
        }

        element.textContent = scrambled;
        iterations++;

        if (iterations >= maxIterations) {
            clearInterval(titleScrambleInterval);
            element.textContent = targetText;
            if (onComplete) onComplete();
        }
    }, 100); // 100ms interval for 1.5 second total (15 iterations × 100ms = 1500ms)
}

// Rotate title sentences (random order)
function rotateTitle() {
    const titleElement = document.getElementById('rotatingTitle');
    if (!titleElement) return;

    // If we've shown all quotes, reset the used indices
    if (usedIndices.length >= titleSentences.length) {
        usedIndices = [];
    }

    // Get a random sentence that hasn't been shown recently
    let nextIndex;
    do {
        nextIndex = Math.floor(Math.random() * titleSentences.length);
    } while (usedIndices.includes(nextIndex) && usedIndices.length < titleSentences.length);

    usedIndices.push(nextIndex);
    currentTitleIndex = nextIndex;
    const nextSentence = titleSentences[nextIndex];

    // Apply scramble effect
    scrambleText(titleElement, nextSentence);
}

// Initialize - show welcome page on load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize history state for welcome page
    if (window.history && window.history.replaceState) {
        window.history.replaceState({ page: 'welcome' }, '', window.location.pathname);
    }

    showWelcomePage();

    // Set initial title to first sentence
    const titleElement = document.getElementById('rotatingTitle');
    if (titleElement && titleSentences.length > 0) {
        titleElement.textContent = titleSentences[0];
        currentTitleIndex = 0;
    }

    // Start rotating titles every 10 seconds (double the time)
    setTimeout(() => {
        rotateTitle(); // First rotation after 10 seconds
        setInterval(rotateTitle, 10000); // Then every 10 seconds
    }, 10000);
});

