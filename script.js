// Global state
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
const resizeBoardBtn = document.getElementById('resizeBoardBtn');
const boardWidthInput = document.getElementById('boardWidth');
const boardHeightInput = document.getElementById('boardHeight');
const noteModal = document.getElementById('noteModal');
const mediaModal = document.getElementById('mediaModal');
const closeModal = document.querySelector('.close');
const closeMediaModal = document.querySelector('.close-media');
const createNoteBtn = document.getElementById('createNoteBtn');
const createMediaBtn = document.getElementById('createMediaBtn');
const mediaUpload = document.getElementById('mediaUpload');
const mediaPreview = document.getElementById('mediaPreview');

let currentMediaFile = null;
let mediaItems = [];

// Initialize canvas
function initCanvas() {
    // Set canvas size to match corkboard
    const width = parseInt(corkboard.style.width) || corkboard.offsetWidth || 2000;
    const height = parseInt(corkboard.style.height) || corkboard.offsetHeight || 1500;
    lineCanvas.width = width;
    lineCanvas.height = height;
    lineCanvas.style.width = width + 'px';
    lineCanvas.style.height = height + 'px';
    redrawLines();
}

// Resize board
resizeBoardBtn.addEventListener('click', () => {
    const newWidth = parseInt(boardWidthInput.value) || 2000;
    const newHeight = parseInt(boardHeightInput.value) || 1500;

    if (newWidth < 1000 || newWidth > 5000 || newHeight < 1000 || newHeight > 5000) {
        alert('Board size must be between 1000px and 5000px');
        return;
    }

    corkboard.style.width = newWidth + 'px';
    corkboard.style.height = newHeight + 'px';

    // Update canvas
    setTimeout(() => {
        initCanvas();
    }, 100);

    saveToStorage();
});

// Resize canvas on window resize
window.addEventListener('resize', () => {
    setTimeout(initCanvas, 100);
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for styles to apply
    setTimeout(() => {
        initCanvas();
        loadFromStorage();
    }, 100);
});

// Modal functionality
addNoteBtn.addEventListener('click', () => {
    noteModal.style.display = 'block';
    document.getElementById('noteTitle').focus();
});

closeModal.addEventListener('click', () => {
    noteModal.style.display = 'none';
    resetModal();
});

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

    if (title) {
        createNote(title, content, type, color,
            Math.random() * (corkboard.offsetWidth - 250) + 25,
            Math.random() * (corkboard.offsetHeight - 200) + 25
        );
        noteModal.style.display = 'none';
        resetModal();
    }
});

// Media modal functionality
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

function resetModal() {
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteType').value = 'concept';
    document.getElementById('noteColor').value = '#ffeb3b';
    currentMediaFile = null;
}

// Create media item
function createMediaItem(mediaDataUrl, x, y) {
    const mediaId = noteIdCounter++;
    const mediaItem = {
        id: mediaId,
        type: 'media',
        mediaDataUrl: mediaDataUrl,
        x: x || 100,
        y: y || 100
    };

    mediaItems.push(mediaItem);
    renderMediaItem(mediaItem);
    saveToStorage();
    return mediaItem;
}

// Render media item
function renderMediaItem(mediaItem) {
    const mediaElement = document.createElement('div');
    mediaElement.className = 'media-item';
    mediaElement.id = `media-${mediaItem.id}`;
    mediaElement.style.left = mediaItem.x + 'px';
    mediaElement.style.top = mediaItem.y + 'px';

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
    `;

    notesContainer.appendChild(mediaElement);
    attachMediaListeners(mediaElement, mediaItem);
    updateMediaPosition(mediaItem.id);
}

// Attach listeners to media item
function attachMediaListeners(mediaElement, mediaItem) {
    // Drag functionality
    const mediaContainer = mediaElement.querySelector('.media-image-container');

    mediaContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.media-actions') ||
            e.target.tagName === 'BUTTON') {
            return;
        }
        startDrag(mediaItem.id, e, true);
    });

    // Connect button - defaults to top edge
    const connectBtn = mediaElement.querySelector('.connect-media-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startConnection(mediaItem.id, true, 'top');
        });
    }

    // Delete button
    const deleteBtn = mediaElement.querySelector('.delete-media-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMediaItem(mediaItem.id);
        });
    }

    // Connection points
    const connectionPoints = mediaElement.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => {
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Get position from the clicked point
            const position = point.getAttribute('data-position') || point.dataset.position || point.className.match(/\b(top|bottom|left|right)\b/)?.[1] || 'top';
            if (isConnecting && connectionStart && connectionStart.noteId !== mediaItem.id) {
                // Complete connection to this media item's edge
                completeConnection(mediaItem.id, position);
            } else if (!isConnecting) {
                // Start connection from this media item's edge
                startConnection(mediaItem.id, true, position);
            }
        });
    });
}

function updateMediaPosition(mediaId) {
    const mediaItem = mediaItems.find(m => m.id === mediaId);
    if (!mediaItem) return;

    const mediaElement = document.getElementById(`media-${mediaId}`);
    if (mediaElement) {
        mediaElement.style.left = mediaItem.x + 'px';
        mediaElement.style.top = mediaItem.y + 'px';
    }
}

function deleteMediaItem(mediaId) {
    if (confirm('Are you sure you want to delete this media?')) {
        // Remove connections
        connections = connections.filter(conn =>
            conn.from !== mediaId && conn.to !== mediaId
        );

        // Remove media item
        mediaItems = mediaItems.filter(m => m.id !== mediaId);

        // Remove DOM element
        const mediaElement = document.getElementById(`media-${mediaId}`);
        if (mediaElement) {
            mediaElement.remove();
        }

        saveToStorage();
        redrawLines();
    }
}

// Handle media upload
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

// Update color picker based on note type
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

// Calculate brightness of a color (0-255)
function getBrightness(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Using relative luminance formula
    return (r * 299 + g * 587 + b * 114) / 1000;
}

// Determine if text should be light based on background color
function shouldUseLightText(bgColor) {
    return getBrightness(bgColor) < 128;
}

// Create a new note
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

// Render a note on the board
function renderNote(note) {
    // Remove existing note if re-rendering
    const existingNote = document.getElementById(`note-${note.id}`);
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

    // Apply custom color or default color based on type
    let bgColor;
    if (note.color && note.color !== '#ffeb3b') {
        bgColor = note.color;
        noteElement.style.backgroundColor = bgColor;
    } else {
        // Use default colors based on type if no custom color
        const defaultColors = {
            concept: '#ffeb3b',
            fact: '#81c784',
            question: '#64b5f6',
            theory: '#ba68c8'
        };
        bgColor = defaultColors[note.type] || '#ffeb3b';
        noteElement.style.backgroundColor = bgColor;
        // Update note.color to match default
        if (!note.color) {
            note.color = bgColor;
        }
    }

    // Determine text color based on background brightness
    const useLightText = shouldUseLightText(bgColor);
    const textClass = useLightText ? 'light-text' : '';

    const typeIcons = {
        concept: '🎯',
        fact: '📋',
        question: '❓',
        theory: '🔬'
    };

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
        <textarea class="note-content ${textClass}" data-note-id="${note.id}" placeholder="Add your thoughts...">${escapeHtml(note.content)}</textarea>
        <div class="note-actions">
            <button class="connect-btn" title="Connect to another note">🔗</button>
            <button class="delete-btn" title="Delete note">🗑️</button>
        </div>
        <div class="resize-handle" data-note-id="${note.id}" title="Resize note"></div>
    `;

    notesContainer.appendChild(noteElement);
    attachNoteListeners(noteElement, note);
    updateNotePosition(note.id);

    // Auto-expand textarea
    const textarea = noteElement.querySelector('.note-content');
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Attach event listeners to a note
function attachNoteListeners(noteElement, note) {
    // Drag functionality - attach to the entire note, but exclude inputs and buttons
    noteElement.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking on interactive elements
        const target = e.target;
        if (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'BUTTON' ||
            target.closest('.note-actions') ||
            target.closest('.connection-point') ||
            target.closest('.resize-handle')) {
            return;
        }

        // Start drag
        startDrag(note.id, e);
    });

    // Edit functionality
    const titleInput = noteElement.querySelector('.note-title');
    titleInput.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent drag when clicking on title
    });
    titleInput.addEventListener('blur', (e) => {
        updateNoteTitle(note.id, e.target.value);
    });

    titleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });

    const contentTextarea = noteElement.querySelector('.note-content');
    contentTextarea.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent drag when clicking on content
    });

    // Auto-expand textarea (respecting note height constraints)
    function autoExpandTextarea() {
        contentTextarea.style.height = 'auto';
        const contentHeight = contentTextarea.scrollHeight;

        // Calculate available height based on note's current height
        const noteHeight = noteElement.offsetHeight || note.height || 150;
        const paddingTop = 40;
        const paddingBottom = 15;
        const headerHeight = 30;
        const actionsHeight = 40;
        const availableHeight = noteHeight - paddingTop - paddingBottom - headerHeight - actionsHeight;

        // Set height to fit content, but not exceed available space
        const textareaHeight = Math.max(60, Math.min(availableHeight, contentHeight));
        contentTextarea.style.height = textareaHeight + 'px';

        // Show scrollbar if content exceeds available space
        if (contentHeight > availableHeight) {
            contentTextarea.style.overflowY = 'auto';
        } else {
            contentTextarea.style.overflowY = 'hidden';
        }
    }

    contentTextarea.addEventListener('input', autoExpandTextarea);
    contentTextarea.addEventListener('blur', (e) => {
        updateNoteContent(note.id, e.target.value);
        autoExpandTextarea();
    });

    // Initial expansion
    setTimeout(autoExpandTextarea, 10);

    // Delete button
    const deleteBtn = noteElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(note.id);
    });

    // Connect button - defaults to top edge
    const connectBtn = noteElement.querySelector('.connect-btn');
    connectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startConnection(note.id, false, 'top');
    });

    // Connection points
    const connectionPoints = noteElement.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => {
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Get position from the clicked point
            const position = point.getAttribute('data-position') || point.dataset.position || point.className.match(/\b(top|bottom|left|right)\b/)?.[1] || 'top';
            if (isConnecting && connectionStart && connectionStart.noteId !== note.id) {
                // Complete connection to this note's edge
                completeConnection(note.id, position);
            } else if (!isConnecting) {
                // Start connection from this note's edge
                startConnection(note.id, false, position);
            }
        });
    });

    // Resize handle
    const resizeHandle = noteElement.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(note.id, e);
        });
    }
}

// Drag and drop
function startDrag(itemId, e, isMedia = false) {
    if (isDragging) return; // Prevent multiple drags

    isDragging = true;
    if (isMedia) {
        currentNote = mediaItems.find(m => m.id === itemId);
    } else {
        currentNote = notes.find(n => n.id === itemId);
    }

    if (!currentNote) {
        isDragging = false;
        return;
    }

    const elementId = isMedia ? `media-${itemId}` : `note-${itemId}`;
    const itemElement = document.getElementById(elementId);
    if (!itemElement) {
        isDragging = false;
        return;
    }

    itemElement.classList.add('dragging');

    const rect = itemElement.getBoundingClientRect();
    const boardRect = corkboard.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
    e.stopPropagation();
}

function onDrag(e) {
    if (!isDragging || !currentNote) return;

    const boardRect = corkboard.getBoundingClientRect();
    const x = e.clientX - boardRect.left - dragOffset.x;
    const y = e.clientY - boardRect.top - dragOffset.y;

    // Constrain to board bounds
    const elementId = currentNote.type === 'media' ? `media-${currentNote.id}` : `note-${currentNote.id}`;
    const itemElement = document.getElementById(elementId);
    if (!itemElement) return;

    const maxX = corkboard.offsetWidth - itemElement.offsetWidth;
    const maxY = corkboard.offsetHeight - itemElement.offsetHeight;

    currentNote.x = Math.max(0, Math.min(x, maxX));
    currentNote.y = Math.max(0, Math.min(y, maxY));

    // Check if it's a media item by looking for mediaDataUrl
    if (currentNote.mediaDataUrl && !currentNote.title) {
        updateMediaPosition(currentNote.id);
    } else {
        updateNotePosition(currentNote.id);
    }
    redrawLines();
}

function stopDrag(e) {
    if (isDragging && currentNote) {
        const elementId = currentNote.type === 'media' ? `media-${currentNote.id}` : `note-${currentNote.id}`;
        const itemElement = document.getElementById(elementId);
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
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const noteElement = document.getElementById(`note-${noteId}`);
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

// Resize functionality
let isResizing = false;
let resizeNote = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

function startResize(noteId, e) {
    if (isResizing || isDragging || isConnecting) return;

    isResizing = true;
    resizeNote = notes.find(n => n.id === noteId);
    if (!resizeNote) {
        isResizing = false;
        return;
    }

    const noteElement = document.getElementById(`note-${noteId}`);
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

    const noteElement = document.getElementById(`note-${resizeNote.id}`);
    if (noteElement) {
        noteElement.style.width = newWidth + 'px';
        noteElement.style.height = newHeight + 'px';

        // Calculate available height for textarea (total height - padding - header - actions)
        // Padding: 15px top + 15px bottom = 30px, padding-top: 40px (for type icon) = 40px
        // Header: ~30px, Actions: ~40px
        // Total overhead: ~110px
        const paddingTop = 40; // For floating type icon
        const paddingBottom = 15;
        const headerHeight = 30;
        const actionsHeight = 40;
        const availableHeight = newHeight - paddingTop - paddingBottom - headerHeight - actionsHeight;

        // Update textarea to fit available space
        const textarea = noteElement.querySelector('.note-content');
        if (textarea) {
            // First, set height to auto to get the actual content height
            textarea.style.height = 'auto';
            const contentHeight = textarea.scrollHeight;

            // Set textarea height to fit available space, but allow scrolling if content is larger
            const textareaHeight = Math.max(60, Math.min(availableHeight, contentHeight));
            textarea.style.height = textareaHeight + 'px';

            // If content is larger than available space, show scrollbar
            if (contentHeight > availableHeight) {
                textarea.style.overflowY = 'auto';
            } else {
                textarea.style.overflowY = 'hidden';
            }
        }
    }

    // Redraw lines to update connection positions
    redrawLines();
}

function stopResize(e) {
    if (isResizing && resizeNote) {
        const noteElement = document.getElementById(`note-${resizeNote.id}`);
        if (noteElement) {
            noteElement.classList.remove('resizing');

            // Final textarea height adjustment to ensure it fits properly
            const textarea = noteElement.querySelector('.note-content');
            if (textarea) {
                const noteHeight = noteElement.offsetHeight;
                const paddingTop = 40;
                const paddingBottom = 15;
                const headerHeight = 30;
                const actionsHeight = 40;
                const availableHeight = noteHeight - paddingTop - paddingBottom - headerHeight - actionsHeight;

                textarea.style.height = 'auto';
                const contentHeight = textarea.scrollHeight;
                const textareaHeight = Math.max(60, Math.min(availableHeight, contentHeight));
                textarea.style.height = textareaHeight + 'px';

                if (contentHeight > availableHeight) {
                    textarea.style.overflowY = 'auto';
                } else {
                    textarea.style.overflowY = 'hidden';
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

// Connection functionality
function startConnection(itemId, isMedia = false, position = 'top') {
    isConnecting = true;
    // Ensure position is valid
    const validPositions = ['top', 'bottom', 'left', 'right'];
    const finalPosition = validPositions.includes(position) ? position : 'top';
    connectionStart = { noteId: itemId, isMedia: isMedia, position: finalPosition };

    // Show connection points on all notes and media, add click handlers
    connectionHandlers.clear();

    // Add handlers for notes
    notes.forEach(note => {
        const noteElement = document.getElementById(`note-${note.id}`);
        if (noteElement) {
            noteElement.classList.add('connecting');
            // Add click handler to complete connection (skip the source item)
            // Only allow connections via connection points, not clicking anywhere on the note
        }
    });

    // Add handlers for media items
    mediaItems.forEach(mediaItem => {
        const mediaElement = document.getElementById(`media-${mediaItem.id}`);
        if (mediaElement) {
            mediaElement.classList.add('connecting');
            // Only allow connections via connection points, not clicking anywhere on the media
        }
    });

    // Cancel connection on escape
    const cancelConnection = (e) => {
        if (e.key === 'Escape') {
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
            document.removeEventListener('keydown', cancelConnection);
        }
    };

    document.addEventListener('keydown', cancelConnection);
}

function cleanupConnectionHandlers() {
    notes.forEach(note => {
        const noteElement = document.getElementById(`note-${note.id}`);
        if (noteElement) {
            const handler = connectionHandlers.get(note.id);
            if (handler) {
                noteElement.removeEventListener('click', handler, true);
            }
        }
    });
    mediaItems.forEach(mediaItem => {
        const mediaElement = document.getElementById(`media-${mediaItem.id}`);
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

    // Don't connect an item to itself
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
        return;
    }

    // Check if connection already exists
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

    // Hide connection points and clean up handlers
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
    redrawLines();
}

// Draw lines between connected notes
function redrawLines() {
    if (!linesVisible) {
        ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        return;
    }

    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

    connections.forEach(connection => {
        // Find items (could be notes or media)
        let fromItem = notes.find(n => n.id === connection.from);
        let toItem = notes.find(n => n.id === connection.to);

        if (!fromItem) {
            fromItem = mediaItems.find(m => m.id === connection.from);
        }
        if (!toItem) {
            toItem = mediaItems.find(m => m.id === connection.to);
        }

        if (!fromItem || !toItem) return;

        // Determine if items are media by checking if they're in mediaItems array
        const fromIsMedia = mediaItems.some(m => m.id === connection.from);
        const toIsMedia = mediaItems.some(m => m.id === connection.to);
        const fromElementId = fromIsMedia ? `media-${fromItem.id}` : `note-${fromItem.id}`;
        const toElementId = toIsMedia ? `media-${toItem.id}` : `note-${toItem.id}`;
        const fromElement = document.getElementById(fromElementId);
        const toElement = document.getElementById(toElementId);

        if (!fromElement || !toElement) return;

        // Calculate connection points
        let fromX, fromY, toX, toY;

        // Calculate FROM point (only edge positions)
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
            // Default to center if position is not recognized
            fromX = fromItem.x + fromElement.offsetWidth / 2;
            fromY = fromItem.y + fromElement.offsetHeight / 2;
        }

        // Calculate TO point (only edge positions)
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
            // Default to center if position is not recognized
            toX = toItem.x + toElement.offsetWidth / 2;
            toY = toItem.y + toElement.offsetHeight / 2;
        }

        // Draw red string line with a slight curve for realism
        drawRedString(fromX, fromY, toX, toY);
    });
}

function drawRedString(x1, y1, x2, y2) {
    // Calculate control point for curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const curveAmount = Math.min(distance * 0.08, 25);

    // Deterministic but varied curve based on position (for realism without flickering)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpendicularAngle = angle + Math.PI / 2;
    const curveOffset = Math.sin((x1 + y1 + x2 + y2) * 0.01) * curveAmount;
    const curveX = midX + Math.cos(perpendicularAngle) * curveOffset;
    const curveY = midY + Math.sin(perpendicularAngle) * curveOffset;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(curveX, curveY, x2, y2);

    // Red string style
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(198, 40, 40, 0.5)';
    ctx.shadowBlur = 2;
    ctx.stroke();

    // Add slight shadow/glow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(curveX, curveY, x2, y2);
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();
}

// Update note title
function updateNoteTitle(noteId, title) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.title = title || 'New Note';
        saveToStorage();
    }
}

// Update note content
function updateNoteContent(noteId, content) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.content = content;
        saveToStorage();
    }
}

// Highlighter functionality
const highlighterState = new Map(); // Store highlighter state per note
const highlighterSaveTimeouts = new Map(); // Store save timeouts per note

function initializeHighlighter(itemId, isMedia = false) {
    let item;
    if (isMedia) {
        item = mediaItems.find(m => m.id === itemId);
    } else {
        item = notes.find(n => n.id === itemId);
    }

    if (!item || !item.mediaDataUrl) return;

    const elementId = isMedia ? `media-${itemId}` : `note-${itemId}`;
    const itemElement = document.getElementById(elementId);
    if (!itemElement) return;

    const mediaContainer = itemElement.querySelector('.note-media-container');
    const canvas = itemElement.querySelector('.note-media-canvas');
    const img = itemElement.querySelector('.note-media-image');

    if (!canvas || !img) return;

    const selector = isMedia ? `[data-media-id="${itemId}"]` : `[data-note-id="${itemId}"]`;
    const toggleBtn = itemElement.querySelector(`.highlighter-toggle-btn${selector}`);
    const colorInput = itemElement.querySelector(`.highlighter-color${selector}`);
    const sizeInput = itemElement.querySelector(`.highlighter-size${selector}`);
    const clearBtn = itemElement.querySelector(`.highlighter-clear-btn${selector}`);

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let isHighlighting = false;

    // Set canvas size to match image
    function resizeCanvas() {
        const imgRect = img.getBoundingClientRect();
        canvas.width = imgRect.width;
        canvas.height = imgRect.height;

    }

    // Wait for image to load and redraw highlighter data
    function loadHighlighterData() {
        resizeCanvas();
        // Redraw existing highlighter data after canvas is resized
        if (item.highlighterData) {
            setTimeout(() => {
                const imgData = new Image();
                imgData.onload = () => {
                    // Use source-over to draw the saved canvas data
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(imgData, 0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'multiply'; // Restore for new highlights
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

    // Update on window resize
    const resizeObserver = new ResizeObserver(() => {
        const oldData = item.highlighterData;
        resizeCanvas();
        // Redraw highlighter data after resize
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

    // Toggle highlighter mode
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isHighlighting = !isHighlighting;
        mediaContainer.classList.toggle('highlighting', isHighlighting);
        toggleBtn.textContent = isHighlighting ? '✋' : '🖍️';
        canvas.style.pointerEvents = isHighlighting ? 'all' : 'none';
    });

    // Highlighter drawing
    function getHighlighterStyle(color) {
        // Convert hex to rgba with transparency
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }

    let lastX = null;
    let lastY = null;

    function drawHighlight(x, y, size, color) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply'; // Realistic highlighter effect

        // Create gradient for realistic highlighter stroke with soft edges
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // More realistic highlighter: semi-transparent center, fading edges
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.4)`);
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.2)`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;

        // Draw smooth connected strokes if we have a previous point
        if (lastX !== null && lastY !== null) {
            // Draw a path between points for smooth strokes
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.lineWidth = size * 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
            ctx.stroke();
        }

        // Draw the current highlight point
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
        // Throttle saves during drawing for better performance
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

    // Clear highlights
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

    // Store highlighter state
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

    // Save canvas data as base64
    item.highlighterData = canvas.toDataURL();
    saveToStorage();
}

function redrawHighlighter(itemId, ctx, width, height, isMedia = false) {
    let item;
    if (isMedia) {
        item = mediaItems.find(m => m.id === itemId);
    } else {
        item = notes.find(n => n.id === itemId);
    }
    if (!item || !item.highlighterData) return;

    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        // Draw the highlighter canvas data onto the canvas
        ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = item.highlighterData;
}

// Initialize highlighter after note is rendered and image is loaded
function initializeHighlighterAfterLoad(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.mediaDataUrl) return;

    const noteElement = document.getElementById(`note-${note.id}`);
    if (!noteElement) return;

    const img = noteElement.querySelector('.note-media-image');
    if (!img) return;

    // Wait for image to fully load before initializing
    if (img.complete) {
        setTimeout(() => initializeHighlighter(itemId, isMedia), 100);
    } else {
        img.onload = () => {
            setTimeout(() => initializeHighlighter(itemId, isMedia), 100);
        };
    }
}

// Screenshot/Download functionality
downloadBtn.addEventListener('click', async () => {
    if (typeof html2canvas === 'undefined') {
        alert('Screenshot functionality is loading. Please try again in a moment.');
        return;
    }

    try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '📸 Capturing...';

        // Capture the corkboard
        const canvas = await html2canvas(corkboard, {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            windowWidth: corkboard.scrollWidth,
            windowHeight: corkboard.scrollHeight
        });

        // Download as image
        const link = document.createElement('a');
        link.download = `deloosional-board-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        downloadBtn.disabled = false;
        downloadBtn.textContent = '📸 Download Board';
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        alert('Failed to capture screenshot. Please try again.');
        downloadBtn.disabled = false;
        downloadBtn.textContent = '📸 Download Board';
    }
});

// Delete note
function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
        // Remove connections
        connections = connections.filter(conn =>
            conn.from !== noteId && conn.to !== noteId
        );

        // Remove note
        notes = notes.filter(n => n.id !== noteId);

        // Remove DOM element
        const noteElement = document.getElementById(`note-${noteId}`);
        if (noteElement) {
            noteElement.remove();
        }

        saveToStorage();
        redrawLines();
    }
}

// Clear all
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

// Toggle string visibility
toggleLinesSwitch.addEventListener('change', () => {
    linesVisible = toggleLinesSwitch.checked;
    redrawLines();
});

// Clear all strings
clearStringsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all string connections? This cannot be undone.')) {
        connections = [];
        redrawLines();
        saveToStorage();
    }
});

// Save to localStorage
function saveToStorage() {
    try {
        localStorage.setItem('deloosional-notes', JSON.stringify(notes));
        localStorage.setItem('deloosional-media', JSON.stringify(mediaItems));
        localStorage.setItem('deloosional-connections', JSON.stringify(connections));
        localStorage.setItem('deloosional-noteIdCounter', noteIdCounter.toString());
        // Save board size
        const boardWidth = parseInt(corkboard.style.width) || parseInt(getComputedStyle(corkboard).width) || 2000;
        const boardHeight = parseInt(corkboard.style.height) || parseInt(getComputedStyle(corkboard).height) || 1500;
        localStorage.setItem('deloosional-boardWidth', boardWidth.toString());
        localStorage.setItem('deloosional-boardHeight', boardHeight.toString());
    } catch (e) {
        console.error('Failed to save to storage:', e);
    }
}

// Load from localStorage
function loadFromStorage() {
    try {
        const savedNotes = localStorage.getItem('deloosional-notes');
        const savedMedia = localStorage.getItem('deloosional-media');
        const savedConnections = localStorage.getItem('deloosional-connections');
        const savedCounter = localStorage.getItem('deloosional-noteIdCounter');
        const savedBoardWidth = localStorage.getItem('deloosional-boardWidth');
        const savedBoardHeight = localStorage.getItem('deloosional-boardHeight');

        // Load board size
        if (savedBoardWidth && savedBoardHeight) {
            const width = parseInt(savedBoardWidth, 10);
            const height = parseInt(savedBoardHeight, 10);
            if (width >= 1000 && width <= 5000 && height >= 1000 && height <= 5000) {
                corkboard.style.width = width + 'px';
                corkboard.style.height = height + 'px';
                boardWidthInput.value = width;
                boardHeightInput.value = height;
            }
        }

        if (savedNotes) {
            notes = JSON.parse(savedNotes);
            notes.forEach(note => {
                // Ensure old notes have width and height
                if (!note.width) note.width = 200;
                if (!note.height) note.height = 150;
                renderNote(note);
            });
        }

        if (savedMedia) {
            mediaItems = JSON.parse(savedMedia);
            mediaItems.forEach(mediaItem => {
                renderMediaItem(mediaItem);
            });
        }

        if (savedConnections) {
            connections = JSON.parse(savedConnections);
        }

        if (savedCounter) {
            noteIdCounter = parseInt(savedCounter, 10);
        }

        // Set toggle switch state based on linesVisible
        if (toggleLinesSwitch) {
            toggleLinesSwitch.checked = linesVisible;
        }

        // Initialize canvas after loading
        setTimeout(() => {
            initCanvas();
        }, 100);
    } catch (e) {
        console.error('Failed to load from storage:', e);
    }
}

// Redraw lines when notes are moved or updated
setInterval(() => {
    if (isDragging) {
        redrawLines();
    }
}, 50);

