// ================================================================
//  js/workspace/timelineEngine.js
//  Unlimited-layer timeline.
//    • 3 visual + 3 audio layers default
//    • Clip width = duration × pxPerSecond (exact ruler match)
//    • Media placed at playhead time, auto-escalates to new layer
//    • Listens for 'editor:timeline-changed' to re-render on
//      external feature additions (text, stickers, etc.)
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
  let zoomFactor = 1.0;

  const LABEL_WIDTH = 80;
  const BASE_PPS = 100;
  const DEFAULT_CLIP_SEC = 3;

  ensureMinLayers(state.visual, DEFAULT_VISUAL_LAYERS);
  ensureMinLayers(state.audio,  DEFAULT_AUDIO_LAYERS);

  const viewport = document.querySelector('#timeline-viewport');
  const matrix   = document.querySelector('#timeline-matrix');

  const rulerContainer = document.createElement('div');
  rulerContainer.className = 'timeline-ruler';
  matrix.prepend(rulerContainer);

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
    viewport.addEventListener('drop', function (e) { e.preventDefault(); });
  }

  if (zoomSlider) {
    zoomSlider.addEventListener('input', function (e) {
      const val = parseInt(e.target.value, 10);
      zoomFactor = val / 100;
      const zoomDisplay = document.querySelector('#zoom-value');
      if (zoomDisplay) zoomDisplay.textContent = val + '%';
      render();
    });
  }

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

    return {
      duration: durationSeconds,
      pxPerSecond: pxPerSecond,
      contentWidth: durationSeconds * pxPerSecond,
      totalWidth: LABEL_WIDTH + durationSeconds * pxPerSecond,
      labelWidth: LABEL_WIDTH
    };
  }

  function formatRulerTime(sec) {
    const s = Math.round(sec * 10) / 10;
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    if (m > 0) {
      const secStr = (rem < 10 ? '0' : '') + (Math.round(rem * 10) / 10);
      return m + ':' + secStr;
    }
    return (Number.isInteger(s) ? s : s.toFixed(1)) + 's';
  }

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

    // ─── Content — explicit width matches ruler's contentWidth exactly ───
    const content = document.createElement('div');
    content.className = 'track-content';

    const metrics = getTimelineMetrics();
    content.style.width    = metrics.contentWidth + 'px';
    content.style.flex     = '0 0 ' + metrics.contentWidth + 'px';
    content.style.minWidth = metrics.contentWidth + 'px';

    for (let ci = 0; ci < clips.length; ci++) {
      const clip = clips[ci];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'clip clip-absolute';
      el.textContent = clip.name || 'Empty';
      el.dataset.track = label;
      el.dataset.clip = ci;
      el.dataset.clipType = clip.type || '';

      const r = clipRange(clip);
      // Exact width = duration × pxPerSecond  (ruler uses same formula)
      el.style.left  = (r.start * metrics.pxPerSecond) + 'px';
      el.style.width = (r.duration * metrics.pxPerSecond) + 'px';

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

  function renderRuler() {
    rulerContainer.innerHTML = '';
    const m = getTimelineMetrics();

    const spacer = document.createElement('div');
    spacer.className = 'timeline-ruler-spacer';
    rulerContainer.appendChild(spacer);

    const totalWidth = m.labelWidth + m.contentWidth;
    rulerContainer.style.width = totalWidth + 'px';
    rulerContainer.style.minWidth = totalWidth + 'px';

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
      marker.style.left = (m.labelWidth + t * m.pxPerSecond) + 'px';
      const lbl = document.createElement('span');
      lbl.textContent = formatRulerTime(t);
      marker.appendChild(lbl);
      rulerContainer.appendChild(marker);
    }
  }

  function render() {
    const m = getTimelineMetrics();
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
  }

  function addMedia(items) {
    const atTime = Number(getPlayheadTime()) || 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isAudio = item.type.indexOf('audio/') === 0;
      const isVideo = item.type.indexOf('video/') === 0;

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
  }

  function addVisualLayer() {
    ensureMinLayers(state.visual, DEFAULT_VISUAL_LAYERS);
    insertEmptyLayer(state.visual, state.visual.length);
    render();
  }

  function addAudioLayer() {
    ensureMinLayers(state.audio, DEFAULT_AUDIO_LAYERS);
    insertEmptyLayer(state.audio, state.audio.length);
    render();
  }

  const previewVideoEl = document.querySelector('#preview-video');
  if (previewVideoEl) {
    previewVideoEl.addEventListener('loadedmetadata', render);
    previewVideoEl.addEventListener('durationchange', render);
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
  }

  document.addEventListener('editor:delete-selected', deleteSelected);

  // 🆕 Re-render when external features (text, stickers, etc.) change the timeline
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