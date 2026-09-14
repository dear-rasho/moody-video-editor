// ================================================================
//  js/workspace/playbackControls.js
//  Play / pause / delete. Undo/redo handled by historyManager.
// ================================================================

export function initPlaybackControls({ play, undo, redo, deleteButton, engine }) {
  if (!play) return;

  const updateButton = () => {
    const isPlaying = engine && engine.isPlaying ? engine.isPlaying() : false;
    play.textContent = isPlaying ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  };

  play.addEventListener('click', (e) => {
    e.preventDefault();
    if (!engine) return;
    if (engine.isPlaying()) engine.pause();
    else engine.play();
    updateButton();
  });

  // Reflect engine state changes (auto-stop at end, etc.)
  document.addEventListener('playback:state', updateButton);

  if (deleteButton) {
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('editor:delete-selected'));
    });
  }

  updateButton();
}