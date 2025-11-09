// Case Closed Animation Functions
// Handles gavel banging animation and sound effects

function playGavelSound() {
    try {
        const audio = new Audio('audios/gavel-bang.mp3');
        audio.volume = 0.7;
        audio.play().catch(error => {
            // Silently fail if audio cannot be played
            // This can happen due to browser autoplay policies
            console.log('Audio playback prevented:', error);
        });
    } catch (error) {
        // Silently fail if audio is not available
        console.log('Audio file not available');
    }
}

function triggerCaseClosedAnimation() {
    const overlay = document.getElementById('caseClosedOverlay');
    if (!overlay) return;

    // Remove active class to reset animation state
    overlay.classList.remove('active', 'fading-out');
    
    // Reset gavel and stamp to initial state
    const gavelContainer = overlay.querySelector('.gavel-container');
    const stamp = overlay.querySelector('.case-closed-stamp');
    if (gavelContainer) {
        gavelContainer.style.animation = 'none';
        gavelContainer.style.transform = 'translateX(calc(-50% + 103px)) rotate(-140deg)';
    }
    if (stamp) {
        stamp.style.animation = 'none';
        stamp.style.transform = 'scale(0) rotate(-5deg)';
        stamp.style.opacity = '0';
    }

    // Force reflow to reset animations
    void overlay.offsetWidth;
    if (gavelContainer) {
        void gavelContainer.offsetWidth;
    }
    if (stamp) {
        void stamp.offsetWidth;
    }

    // Small delay to ensure overlay is ready, then trigger animation
    setTimeout(() => {
        // Remove inline styles to allow CSS animations to work
        if (gavelContainer) {
            gavelContainer.style.animation = '';
            gavelContainer.style.transform = '';
        }
        if (stamp) {
            stamp.style.animation = '';
            stamp.style.transform = '';
            stamp.style.opacity = '';
        }
        
        // Add active class to trigger animations
        overlay.classList.add('active');

        // Play sound effect at the moment of impact (42% through 0.55s animation = 231ms)
        setTimeout(() => {
            playGavelSound();
        }, 231);

        // Hide overlay after ~2 seconds
        setTimeout(() => {
            overlay.classList.add('fading-out');
            setTimeout(() => {
                overlay.classList.remove('active', 'fading-out');
            }, 300); // Match CSS transition duration
        }, 2000);
    }, 10);
}

