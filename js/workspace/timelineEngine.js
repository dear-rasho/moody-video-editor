// ================================================================
//  js/workspace/timelineEngine.js
//  Ruler has a STICKY spacer (80px) exactly like track-labels.
//  It sticks to viewport's left edge during scroll, so playhead
//  and ruler markers can NEVER show inside the label column.
// ================================================================

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

  const LABEL_WIDTH = 80;
  const BASE_PPS = 100;
  const DEFAULT_CLIP_SEC = 3;

  const viewport = document.querySelector('#timeline-viewport');
  const matrix = document.querySelector('#timeline-matrix');

  // ─── Inject CSS once (ruler + spacer override) ────────────
  (function injectTimelineCSS() {
    if (document.getElementById('tle-inline-css')) return;
    const s = document.createElement('style');
    s.id = 'tle-inline-css';
    s.textContent = `
      /* Ruler becomes a flex row; margin-left removed */
      #timeline-matrix .timeline-ruler {
        display: flex !important;
        align-items: stretch;
        position: relative;
        height: 24px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
        margin-left: 0 !important;
        overflow: visible;
      }
      /* Sticky spacer — sits on top of playhead (z=4) in the label area */
      #timeline-matrix .timeline-ruler-spacer {
        position: sticky !important;
        left: 0 !important;
        top: 0;
        display: block;
        width: ${LABEL_WIDTH}px;
        min-width: ${LABEL_WIDTH}px;
        max-width: ${LABEL_WIDTH}px;
        height: 100%;
        background: var(--surface-2);
        border-right: 1px solid var(--border);
        box-sizing: border-box;
        z-index: 5;            /* above playhead (4), below labels (6) */
        pointer-events: none;
        flex-shrink: 0;
      }
      /* Playhead stays below the spacer */
      #timeline-matrix .timeline-playhead {
        z-index: 4;
      }
    `;
    document.head.appendChild(s);
  })();

  // ─── Ruler container ──────────────────────────────────────
  const rulerContainer = document.createElement('div');
  rulerContainer.className = 'timeline-ruler';
  matrix.prepend(rulerContainer);

  // ─── Scroll block ─────────────────────────────────────────
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

  // ─── Zoom slider ──────────────────────────────────────────
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      zoomFactor = val / 100;
      const zoomDisplay = document.querySelector('#zoom-value');
      if (zoomDisplay) zoomDisplay.textContent = val + '%';
      render();
    });
  }

  // ─── Metrics ──────────────────────────────────────────────
  function getVideoDuration() {
    const video = document.querySelector('#preview-video');
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      return video.duration;
    }
    return 0;
  }

  function getTimelineMetrics() {
    const pxPerSecond = BASE_PPS * zoomFactor;
    let durationSeconds = getVideoDuration();

    if (durationSeconds === 0) {
      let maxClips = 0;
      [...state.visual, ...state.audio].forEach(track => {
        if (track && track.length > maxClips) maxClips = track.length;
      });
      durationSeconds = Math.max(1, maxClips);
    }

    return {
      duration: durationSeconds,
      pxPerSecond,
      contentWidth: durationSeconds * pxPerSecond,
      totalWidth: LABEL_WIDTH + durationSeconds * pxPerSecond,
      labelWidth: LABEL_WIDTH
    };
  }

  function getClipDuration(clip) {
    const type = clip?.type || '';
    const videoDur = getVideoDuration();
    if (type.startsWith('video/') || type.startsWith('audio/')) {
      return videoDur > 0 ? videoDur : DEFAULT_CLIP_SEC;
    }
    return DEFAULT_CLIP_SEC;
  }

  function formatRulerTime(sec) {
    const s = Math.round(sec * 10) / 10;
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    if (m > 0) {
      const secStr = (rem < 10 ? '0' : '') + (Math.round(rem * 10) / 10);
      return `${m}:${secStr}`;
    }
    return (Number.isInteger(s) ? s : s.toFixed(1)) + 's';
  }

  // ─── Track builder ────────────────────────────────────────
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
        const fromIdx = parseInt(fromIndex, 10);
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
        const fromIdx = parseInt(fromTrackIdx, 10);
        const toIdx = trackIndex;
        const clipIndex = parseInt(clipIdx, 10);
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

    // ─── Label ───
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

    // ─── Content ───
    const content = document.createElement('div');
    content.className = 'track-content';

    const metrics = getTimelineMetrics();

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

      const dur = getClipDuration(clip);
      const width = Math.max(40, dur * metrics.pxPerSecond);
      el.style.width = width + 'px';
      el.style.flex = '0 0 auto';

      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        selected = {
          type: label[0] === 'A' ? 'audio' : 'visual',
          track: label,
          clipIndex
        };
        document.querySelectorAll('.clip.selected')
          .forEach(x => x.classList.remove('selected'));
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

  // ─── Ruler ────────────────────────────────────────────────
  function renderRuler() {
    rulerContainer.innerHTML = '';
    const m = getTimelineMetrics();

    // Sticky spacer at the very start
    const spacer = document.createElement('div');
    spacer.className = 'timeline-ruler-spacer';
    rulerContainer.appendChild(spacer);

    const totalWidth = m.labelWidth + m.contentWidth;
    rulerContainer.style.width = totalWidth + 'px';
    rulerContainer.style.minWidth = totalWidth + 'px';

    // Marker step
    let step = 1;
    if (m.duration > 60) step = 5;
    if (m.duration > 180) step = 10;
    if (m.duration > 600) step = 30;
    if (m.pxPerSecond * step < 40) {
      step = Math.ceil(40 / m.pxPerSecond);
    }

    const count = Math.floor(m.duration / step);
    for (let i = 0; i <= count; i++) {
      const t = i * step;
      const marker = document.createElement('div');
      marker.className = 'ruler-marker';
      // Offset by label width so first marker starts after the spacer
      marker.style.left = (m.labelWidth + t * m.pxPerSecond) + 'px';
      const label = document.createElement('span');
      label.textContent = formatRulerTime(t);
      marker.appendChild(label);
      rulerContainer.appendChild(marker);
    }
  }

  // ─── Render ───────────────────────────────────────────────
  function render() {
    const m = getTimelineMetrics();
    matrix.style.minWidth = m.totalWidth + 'px';

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

  // ─── Add media ────────────────────────────────────────────
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
      tracks[0].push({
        name: item.file?.name ?? item.name ?? 'Media',
        url: item.url,
        type: item.type
      });
    }
    render();
  }

  // ─── Video metadata → re-render ───────────────────────────
  const previewVideo = document.querySelector('#preview-video');
  if (previewVideo) {
    previewVideo.addEventListener('loadedmetadata', render);
    previewVideo.addEventListener('durationchange', render);
  }

  render();

  // ─── Delete selected ──────────────────────────────────────
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