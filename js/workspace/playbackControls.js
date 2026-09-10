export function initPlaybackControls({ play, undo, redo, deleteButton, video, audio, onTimeUpdate }) {
  const media = [video, audio].filter(Boolean);
  const sync = action => media.forEach(item => action(item));
  const updateButton = () => {
    const isPlaying = media.some(item => !item.paused);
    play.textContent = isPlaying ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  };
  play?.addEventListener('click', () => {
    if (media.some(item => !item.paused)) sync(item => item.pause());
    else sync(item => item.play().catch(() => {}));
    updateButton();
  });
  video?.addEventListener('timeupdate', () => {
  if (
    audio &&
    Math.abs(audio.currentTime - video.currentTime) > 0.15
  ) {
    audio.currentTime = video.currentTime;
  }

  onTimeUpdate?.(
    video.currentTime,
    video.duration
  );
});

video?.addEventListener('loadedmetadata', () => {
  onTimeUpdate?.(
    video.currentTime,
    video.duration
  );
});
  media.forEach(item => {
    item.addEventListener('play', updateButton);
    item.addEventListener('pause', updateButton);
    item.addEventListener('ended', updateButton);
  });
  undo?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('editor:undo')));
  redo?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('editor:redo')));
  deleteButton?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('editor:delete-selected')));
}
