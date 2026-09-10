export function initTimelineEngine({
  visual,
  audio,
  state,
  onVisualVisibility,
  onAudioMute,
  onDeleteSelected,
  zoomSlider
}) {
  let selected = null;
  let draggedTrack = null;
  let draggedClip = null;
  let zoomFactor = 1.0;

  const viewport = document.querySelector('#timeline-viewport');
  const matrix = document.querySelector('#timeline-matrix');

  // Ruler container
  const rulerContainer = document.createElement('div');
  rulerContainer.className = 'timeline-ruler';
  matrix.prepend(rulerContainer);

  // Scroll block
  function blockScroll(block) {
    if (!viewport) return;
    if (block) {
      viewport.style.overflow = 'hidden';
      viewport.style.overscrollBehavior = 'none';
      viewport.style.pointerEvents = 'none';
    } else {
      viewport.style.overflow = 'auto';
      viewport.style.overscrollBehavior = 'contain';
      viewport.style.pointerEvents = 'auto';
    }
  }

  if (viewport) {
    viewport.addEventListener('dragover', (e) => e.preventDefault());
    viewport.addEventListener('drop', (e) => e.preventDefault());
  }

  // Zoom slider
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      zoomFactor = val / 100;
      const zoomDisplay = document.querySelector('#zoom-value');
      if (zoomDisplay) zoomDisplay.textContent = val + '%';
      render();
    });
  }

  const buildTrack = (label, clips = [], trackIndex, group) => {
    const track = document.createElement('div');
    track.className = 'track';
    track.dataset.group = group;
    track.dataset.trackIndex = String(trackIndex);
    track.draggable = true;

    track.addEventListener('dragstart', (event) => {
      draggedTrack = { group, index: trackIndex };
      event.dataTransfer?.setData('text/plain', `track:${group}:${trackIndex}`);
      event.dataTransfer.effectAllowed = 'move';
      blockScroll(true);
    });

    track.addEventListener('dragend', () => {
      draggedTrack = null;
      blockScroll(false);
    });

    track.addEventListener('dragover', (event) => {
      if (!draggedTrack && !draggedClip) return;
      event.preventDefault();
      track.classList.add('drag-over');
    });

    track.addEventListener('dragleave', () => track.classList.remove('drag-over'));

    track.addEventListener('drop', (event) => {
      event.preventDefault();
      track.classList.remove('drag-over');
      const data = event.dataTransfer?.getData('text/plain');
      if (!data) return;

      if (data.startsWith('track:')) {
        const [, fromGroup, fromIndex] = data.split(':');
        if (fromGroup !== group) return;
        const fromIdx = parseInt(fromIndex);
        const toIdx = trackIndex;
        if (fromIdx === toIdx) return;
        const list = group === 'visual' ? state.visual : state.audio;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        draggedTrack = null;
        render();
        return;
      }

      if (data.startsWith('clip:')) {
        const [, fromGroup, fromTrackIdx, clipIdx] = data.split(':');
        if (fromGroup !== group) return;
        const fromIdx = parseInt(fromTrackIdx);
        const toIdx = trackIndex;
        const clipIndex = parseInt(clipIdx);
        if (fromIdx === toIdx) return;

        const list = group === 'visual' ? state.visual : state.audio;
        const fromTrack = list[fromIdx];
        const toTrack = list[toIdx];
        if (!fromTrack || !toTrack) return;
        if (clipIndex >= fromTrack.length) return;

        const [movedClip] = fromTrack.splice(clipIndex, 1);
        toTrack.push(movedClip);
        draggedClip = null;
        render();
      }
    });

    // Label
    const name = document.createElement('div');
    name.className = 'track-label';
    const labelText = document.createElement('span');
    labelText.textContent = label;
    const visibility = document.createElement('button');
    visibility.className = 'layer-toggle';
    visibility.type = 'button';
    visibility.textContent = '◉';
    visibility.setAttribute('aria-label', `Toggle ${label} visibility`);
    visibility.addEventListener('click', () => {
      const hidden = track.classList.toggle('layer-hidden');
      visibility.textContent = hidden ? '○' : '◉';
      onVisualVisibility?.(label, !hidden);
    });
    name.append(labelText, visibility);

    // Content
    const content = document.createElement('div');
    content.className = 'track-content';

    for (const [clipIndex, clip] of clips.entries()) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'clip';
      el.textContent = clip.name || 'Empty';
      el.dataset.track = label;
      el.dataset.clip = clipIndex;
      if (selected?.track === label && selected?.clipIndex === clipIndex) {
        el.classList.add('selected');
      }

      // Width based on zoom
      const baseWidth = 100;
      const width = baseWidth * zoomFactor;
      el.style.width = width + 'px';
      el.style.flex = '0 0 auto';

      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        selected = { type: label[0] === 'A' ? 'audio' : 'visual', track: label, clipIndex };
        document.querySelectorAll('.clip.selected').forEach(el => el.classList.remove('selected'));
        el.classList.add('selected');
        e.preventDefault();
      });

      el.draggable = true;
      el.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', `clip:${group}:${trackIndex}:${clipIndex}`);
        event.dataTransfer.effectAllowed = 'move';
        draggedClip = { group, fromTrack: trackIndex, clipIndex };
        blockScroll(true);
      });

      el.addEventListener('dragend', () => {
        draggedClip = null;
        blockScroll(false);
      });

      content.append(el);
    }

    if (label[0] === 'A') {
      const mute = document.createElement('button');
      mute.type = 'button';
      mute.className = 'layer-toggle';
      mute.textContent = '🔊';
      mute.setAttribute('aria-label', `Mute ${label}`);
      mute.addEventListener('click', () => {
        const muted = track.classList.toggle('layer-muted');
        mute.textContent = muted ? '🔇' : '🔊';
        onAudioMute?.(label, muted);
      });
      name.append(mute);
    }

    track.append(name, content);
    return track;
  };

  function renderRuler() {
    rulerContainer.innerHTML = '';
    let maxClips = 0;
    [...state.visual, ...state.audio].forEach(track => {
      if (track && track.length > maxClips) maxClips = track.length;
    });
    const totalSeconds = Math.max(1, maxClips);
    const totalPixels = totalSeconds * 100 * zoomFactor;
    rulerContainer.style.width = totalPixels + 'px';
    rulerContainer.style.minWidth = totalPixels + 'px';

    for (let i = 0; i <= totalSeconds; i++) {
      const marker = document.createElement('div');
      marker.className = 'ruler-marker';
      marker.style.left = (i * 100 * zoomFactor) + 'px';
      const label = document.createElement('span');
      label.textContent = i + 's';
      marker.appendChild(label);
      rulerContainer.appendChild(marker);
    }
  }

  function render() {
    let maxClips = 0;
    [...state.visual, ...state.audio].forEach(track => {
      if (track && track.length > maxClips) maxClips = track.length;
    });
    const totalSeconds = Math.max(1, maxClips);
    const totalPixels = totalSeconds * 100 * zoomFactor + 80;
    matrix.style.minWidth = totalPixels + 'px';

    const visualIndices = [3, 2, 1, 0];
    visual.replaceChildren(
      ...visualIndices.map((i) =>
        buildTrack(`V${i + 1}`, state.visual[i] || [], i, 'visual')
      )
    );

    const audioIndices = [0, 1, 2, 3];
    audio.replaceChildren(
      ...audioIndices.map((i) =>
        buildTrack(`A${i + 1}`, state.audio[i] || [], i, 'audio')
      )
    );

    renderRuler();
  }

  function addMedia(items) {
    for (const item of items) {
      const trackType = item.type.startsWith('audio/') ? 'audio' : 'visual';
      const tracks = state[trackType];
      if (!tracks[0]) tracks[0] = [];
      if (item.type.startsWith('video/')) {
        if (!state.audio[0]) state.audio[0] = [];
        const audioAuto = {
          name: `${(item.file?.name ?? item.name ?? 'video').replace(/\.[^.]+$/, '')} audio`,
          url: item.url,
          type: 'audio/mpeg',
          autoGenerated: true
        };
        if (!state.audio[0].some(entry => entry.url === item.url && entry.autoGenerated)) {
          state.audio[0].push(audioAuto);
        }
      }
      tracks[0].push({ name: item.file?.name ?? item.name ?? 'Media', url: item.url, type: item.type });
    }
    render();
  }

  render();

  function deleteSelected() {
    if (!selected) return;
    const clips = state[selected.type][Number(selected.track.slice(1)) - 1];
    const clip = clips?.[selected.clipIndex];
    if (clip) onDeleteSelected?.(clip, selected.type);
    clips?.splice(selected.clipIndex, 1);
    selected = null;
    render();
  }

  document.addEventListener('editor:delete-selected', deleteSelected);

  return { render, addMedia, deleteSelected };
}