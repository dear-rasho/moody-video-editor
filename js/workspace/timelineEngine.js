// ================================================================
//  js/workspace/timelineEngine.js
//  Unlimited-layer timeline. Fires 'editor:timeline-changed' on
//  every mutation so historyManager can snapshot.
//
//  Uses timelineScaler.js for ALL sizing / zoom / ruler math.
// ================================================================

import {
  injectLayerStyles,
  ensureMinLayers,
  placeClipAtTime,
  insertEmptyLayer,
  clipRange,
  DEFAULT_VISUAL_LAYERS,
  DEFAULT_AUDIO_LAYERS
} from '../layers/layersManager.js';

import {
  initTimelineScaler,
  setDuration as setTimelineDuration,
  getMetrics   as getScaleMetrics,
  computeClipRect,
  getRulerStep,
  formatRulerTime,
  LABEL_WIDTH
} from './timelineScaler.js';

export function initTimelineEngine(config) {
  injectLayerStyles();

  const visual      = config.visual;
  const audio       = config.audio;
  const state       = config.state;
  const onVisualVisibility = config.onVisualVisibility;
  const onAudioMute        = config.onAudioMute;
  const onDeleteSelected   = config.onDeleteSelected;
  const zoomSlider         = config.zoomSlider;
  const getPlayheadTime    = config.getPlayheadTime || function () { return 0; };

  let selected = null;
  let draggedTrack = null;
  let draggedClip = null;
  let _rendering = false;              // re-entry guard

  const DEFAULT_CLIP_SEC = 3;

  ensureMinLayers(state.visual, DEFAULT_VISUAL_LAYERS);
  ensureMinLayers(state.audio,  DEFAULT_AUDIO_LAYERS);

  const viewport = document.querySelector('#timeline-viewport');
  const matrix   = document.querySelector('#timeline-matrix');

  const rulerContainer = document.createElement('div');
  rulerContainer.className = 'timeline-ruler';
  matrix.prepend(rulerContainer);

  // ─── SCALER INIT ───────────────────────────────────────────────
  initTimelineScaler({
    viewport:   viewport,
    slider:     zoomSlider,
    valueLabel: document.querySelector('#zoom-value')
  });

  document.addEventListener('timeline:scale-changed', function () {
    if (!_rendering) render();
  });

  function notifyChanged() {
    document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  }

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
    viewport.addEventListener('dragover', function (e) { e.preventDefault(); });
    viewport.addEventListener('drop',     function (e) { e.preventDefault(); });
  }

  function getVideoDuration() {
    const video = document.querySelector('#preview-video');
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      return video.duration;
    }
    return 0;
  }

  // Duration = max(video duration, furthest clip end), min 1s.
  function computeDuration() {
    let durationSeconds = getVideoDuration();
    let furthestEnd = 0;

    const allTracks = state.visual.concat(state.audio);
    for (let t = 0; t < allTracks.length; t++) {
      const track = allTracks[t];
      if (!Array.isArray(track)) continue;
      for (let c = 0; c < track.length; c++) {
        const r = clipRange(track[c]);
        if (r.end > furthestEnd) furthestEnd = r.end;
      }
    }
    if (furthestEnd > durationSeconds) durationSeconds = furthestEnd;
    if (durationSeconds === 0) durationSeconds = 1;
    return durationSeconds;
  }

  // ─── Track builder ────────────────────────────────────────────
  function buildTrack(label, clips, trackIndex, group) {
    const track = document.createElement('div');
    track.className = 'track';
    track.dataset.group = group;
    track.dataset.trackIndex = String(trackIndex);
    track.draggable = true;

    track.addEventListener('dragstart', function (event) {
      draggedTrack = { group: group, index: trackIndex };
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', 'track:' + group + ':' + trackIndex);
        event.dataTransfer.effectAllowed = 'move';
      }
      blockScroll(true);
    });
    track.addEventListener('dragend', function () {
      draggedTrack = null;
      blockScroll(false);
    });
    track.addEventListener('dragover', function (event) {
      if (!draggedTrack && !draggedClip) return;
      event.preventDefault();
      track.classList.add('drag-over');
    });
    track.addEventListener('dragleave', function () {
      track.classList.remove('drag-over');
    });
    track.addEventListener('drop', function (event) {
      event.preventDefault();
      track.classList.remove('drag-over');
      if (!event.dataTransfer) return;
      const data = event.dataTransfer.getData('text/plain');
      if (!data) return;

      if (data.indexOf('track:') === 0) {
        const parts = data.split(':');
        const fromGroup = parts[1];
        const fromIdx = parseInt(parts[2], 10);
        if (fromGroup !== group) return;
        if (fromIdx === trackIndex) return;
        const list = group === 'visual' ? state.visual : state.audio;
        const moved = list.splice(fromIdx, 1)[0];
        list.splice(trackIndex, 0, moved);
        draggedTrack = null;
        render();
        notifyChanged();
        return;
      }

      if (data.indexOf('clip:') === 0) {
        const parts = data.split(':');
        const fromGroup = parts[1];
        const fromIdx = parseInt(parts[2], 10);
        const clipIndex = parseInt(parts[3], 10);
        if (fromGroup !== group) return;
        if (fromIdx === trackIndex) return;
        const list = group === 'visual' ? state.visual : state.audio;
        const fromTrack = list[fromIdx];
        const toTrack = list[trackIndex];
        if (!fromTrack || !toTrack) return;
        if (clipIndex >= fromTrack.length) return;
        const movedClip = fromTrack.splice(clipIndex, 1)[0];
        toTrack.push(movedClip);
        draggedClip = null;
        render();
        notifyChanged();
      }
    });

    const name = document.createElement('div');
    name.className = 'track-label';
    const labelText = document.createElement('span');
    labelText.textContent = label;

    if (group === 'visual') {
      const vis = document.createElement('button');
      vis.className = 'layer-toggle';
      vis.type = 'button';
      vis.textContent = '\u25C9';
      vis.setAttribute('aria-label', 'Toggle ' + label + ' visibility');
      vis.addEventListener('click', function () {
        const hidden = track.classList.toggle('layer-hidden');
        vis.textContent = hidden ? '\u25CB' : '\u25C9';
        if (onVisualVisibility) onVisualVisibility(label, !hidden);
      });
      name.appendChild(labelText);
      name.appendChild(vis);
    } else {
      const mute = document.createElement('button');
      mute.type = 'button';
      mute.className = 'layer-toggle';
      mute.textContent = '\uD83D\uDD0A';
      mute.setAttribute('aria-label', 'Mute ' + label);
      mute.addEventListener('click', function () {
        const muted = track.classList.toggle('layer-muted');
        mute.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
        if (onAudioMute) onAudioMute(label, muted);
      });
      name.appendChild(labelText);
      name.appendChild(mute);
    }

    const content = document.createElement('div');
    content.className = 'track-content';

    const m = getScaleMetrics();
    content.style.width    = m.contentWidth + 'px';
    content.style.flex     = '0 0 ' + m.contentWidth + 'px';
    content.style.minWidth = m.contentWidth + 'px';

    for (let ci = 0; ci < clips.length; ci++) {
      const clip = clips[ci];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'clip clip-absolute';
      el.textContent = clip.name || 'Empty';
      el.dataset.track = label;
      el.dataset.clip = ci;
      el.dataset.clipType = clip.type || '';

      const rect = computeClipRect(clip);
      el.style.left     = rect.left + 'px';
      el.style.width    = rect.width + 'px';
      el.style.minWidth = '20px';

      if (selected && selected.track === label && selected.clipIndex === ci) {
        el.classList.add('selected');
      }

      (function (capturedIndex) {
        el.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          selected = {
            type: label[0] === 'A' ? 'audio' : 'visual',
            track: label,
            clipIndex: capturedIndex
          };
          const all = document.querySelectorAll('.clip.selected');
          for (let i = 0; i < all.length; i++) all[i].classList.remove('selected');
          el.classList.add('selected');
          e.preventDefault();
        });
      })(ci);

      el.draggable = true;
      (function (capturedIndex) {
        el.addEventListener('dragstart', function (event) {
          if (event.dataTransfer) {
            event.dataTransfer.setData(
              'text/plain',
              'clip:' + group + ':' + trackIndex + ':' + capturedIndex
            );
            event.dataTransfer.effectAllowed = 'move';
          }
          draggedClip = { group: group, fromTrack: trackIndex, clipIndex: capturedIndex };
          blockScroll(true);
        });
      })(ci);
      el.addEventListener('dragend', function () {
        draggedClip = null;
        blockScroll(false);
      });

      content.appendChild(el);
    }

    track.appendChild(name);
    track.appendChild(content);
    return track;
  }

  // ─── Ruler ────────────────────────────────────────────────────
  function renderRuler() {
    rulerContainer.innerHTML = '';
    const m = getScaleMetrics();
    const step = getRulerStep();

    const spacer = document.createElement('div');
    spacer.className = 'timeline-ruler-spacer';
    rulerContainer.appendChild(spacer);

    rulerContainer.style.width    = m.totalWidth + 'px';
    rulerContainer.style.minWidth = m.totalWidth + 'px';

    const count = Math.floor(m.duration / step);
    for (let i = 0; i <= count; i++) {
      const t = i * step;
      const marker = document.createElement('div');
      marker.className = 'ruler-marker';
      marker.style.left = (m.labelWidth + t * m.pxPerSecond) + 'px';
      const lbl = document.createElement('span');
      lbl.textContent = formatRulerTime(t, step);
      marker.appendChild(lbl);
      rulerContainer.appendChild(marker);
    }

    // Always mark exact timeline end.
    if (count * step < m.duration - 1e-6) {
      const marker = document.createElement('div');
      marker.className = 'ruler-marker ruler-marker-end';
      marker.style.left = (m.labelWidth + m.duration * m.pxPerSecond) + 'px';
      const lbl = document.createElement('span');
      lbl.textContent = formatRulerTime(m.duration, step);
      marker.appendChild(lbl);
      rulerContainer.appendChild(marker);
    }
  }

  // ─── Main render ──────────────────────────────────────────────
  function render() {
    if (_rendering) return;
    _rendering = true;
    try {
      setTimelineDuration(computeDuration());

      const m = getScaleMetrics();
      matrix.style.minWidth = m.totalWidth + 'px';

      const visualNodes = [];
      for (let i = state.visual.length - 1; i >= 0; i--) {
        visualNodes.push(buildTrack('V' + (i + 1), state.visual[i] || [], i, 'visual'));
      }
      visual.replaceChildren.apply(visual, visualNodes);

      const audioNodes = [];
      for (let i = 0; i < state.audio.length; i++) {
        audioNodes.push(buildTrack('A' + (i + 1), state.audio[i] || [], i, 'audio'));
      }
      audio.replaceChildren.apply(audio, audioNodes);

      renderRuler();
    } finally {
      _rendering = false;
    }
  }

  // ─── addMedia ────────────────────────────────────────────────
  function addMedia(items) {
    const atTime = Number(getPlayheadTime()) || 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isAudio = item.type.indexOf('audio/') === 0;
      const isVideo = item.type.indexOf('video/') === 0;

      // Use probed duration; fallback to DEFAULT_CLIP_SEC only if missing.
      const realDur = (Number.isFinite(item.duration) && item.duration > 0)
        ? item.duration
        : DEFAULT_CLIP_SEC;

      const trackType = isAudio ? 'audio' : 'visual';
      const list = state[trackType];
      ensureMinLayers(list,
        trackType === 'visual' ? DEFAULT_VISUAL_LAYERS : DEFAULT_AUDIO_LAYERS);

      if (isVideo) {
        ensureMinLayers(state.audio, DEFAULT_AUDIO_LAYERS);
        const audioAuto = {
          name: (item.name || 'video').replace(/\.[^.]+$/, '') + ' audio',
          url: item.url,
          type: 'audio/mpeg',
          autoGenerated: true,
          duration: realDur
        };
        let already = false;
        for (let t = 0; t < state.audio.length; t++) {
          const tr = state.audio[t];
          if (!Array.isArray(tr)) continue;
          for (let c = 0; c < tr.length; c++) {
            if (tr[c].url === item.url && tr[c].autoGenerated) {
              already = true;
              break;
            }
          }
          if (already) break;
        }
        if (!already) placeClipAtTime(state.audio, audioAuto, atTime);
      }

      placeClipAtTime(list, {
        name: item.name || 'Media',
        url: item.url,
        type: item.type,
        duration: realDur
      }, atTime);
    }
    render();
    notifyChanged();
  }

  function addVisualLayer() {
    ensureMinLayers(state.visual, DEFAULT_VISUAL_LAYERS);
    insertEmptyLayer(state.visual, state.visual.length);
    render();
    notifyChanged();
  }

  function addAudioLayer() {
    ensureMinLayers(state.audio, DEFAULT_AUDIO_LAYERS);
    insertEmptyLayer(state.audio, state.audio.length);
    render();
    notifyChanged();
  }

  const previewVideoEl = document.querySelector('#preview-video');
  if (previewVideoEl) {
    previewVideoEl.addEventListener('loadedmetadata', render);
    previewVideoEl.addEventListener('durationchange', render);

    // Auto-patch clip durations when the preview video loads metadata.
    previewVideoEl.addEventListener('loadedmetadata', function () {
      const real = previewVideoEl.duration;
      if (!Number.isFinite(real) || real <= 0) return;

      const src = previewVideoEl.currentSrc || previewVideoEl.src || '';
      if (!src) return;

      let changed = false;

      for (let t = 0; t < state.visual.length; t++) {
        const track = state.visual[t];
        if (!Array.isArray(track)) continue;
        for (let c = 0; c < track.length; c++) {
          const clip = track[c];
          if (clip && clip.url === src &&
              Math.abs((clip.duration || 0) - real) > 0.05) {
            clip.duration = real;
            if (Number.isFinite(clip.startTime)) {
              clip.endTime = clip.startTime + real;
            }
            changed = true;
          }
        }
      }

      for (let t = 0; t < state.audio.length; t++) {
        const track = state.audio[t];
        if (!Array.isArray(track)) continue;
        for (let c = 0; c < track.length; c++) {
          const clip = track[c];
          if (clip && clip.url === src && clip.autoGenerated &&
              Math.abs((clip.duration || 0) - real) > 0.05) {
            clip.duration = real;
            changed = true;
          }
        }
      }

      if (changed) {
        render();
        notifyChanged();
      }
    });
  }

  render();

  function deleteSelected() {
    if (!selected) return;
    const clips = state[selected.type][Number(selected.track.slice(1)) - 1];
    if (!clips) return;
    const clip = clips[selected.clipIndex];
    if (clip && onDeleteSelected) onDeleteSelected(clip, selected.type);
    clips.splice(selected.clipIndex, 1);
    selected = null;
    render();
    notifyChanged();
  }

  document.addEventListener('editor:delete-selected', deleteSelected);

  document.addEventListener('editor:timeline-changed', function () {
    render();
  });

  return {
    render: render,
    addMedia: addMedia,
    deleteSelected: deleteSelected,
    addVisualLayer: addVisualLayer,
    addAudioLayer: addAudioLayer
  };
}