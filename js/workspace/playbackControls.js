// ================================================================
//  js/workspace/playbackControls.js
//  Play / pause / delete. Undo/redo handled by historyManager.js.
// ================================================================

// ================================================================
//  js/workspace/playbackControls.js
//  Play/pause now driven by the playbackEngine (master clock).
// ================================================================

export function initPlaybackControls({ play, undo, redo, deleteButton, engine }) {
  const updateButton = () => {
    const isPlaying = engine && engine.isPlaying ? engine.isPlaying() : false;
    play.textContent = isPlaying ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  };

  play?.addEventListener('click', () => {
    if (!engine) return;
    if (engine.isPlaying()) engine.pause();
    else engine.play();
    updateButton();
  });

  // Reflect engine state changes (e.g. auto-stop at end)
  document.addEventListener('playback:state', updateButton);

  deleteButton?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('editor:delete-selected'));
  });

  // Initial button state
  updateButton();
}