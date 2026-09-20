// ================================================================
//  js/workspace/timelineEngine.js
//  Unlimited-layer timeline with strict no-overlap per track.
//  + Track reorder (ripple) with linked audio mirror.
//  + Linked clips behave as one unit (delete + select highlight).
// ================================================================

import {
  injectLayerStyles,
  ensureMinLayers,
  insertEmptyLayer,
  clipRange,
  DEFAULT_VISUAL_LAYERS,
  DEFAULT_AUDIO_LAYERS
} from '../layers/layersManager.js';

import {
  initTimelineScaler,
  setDuration as setTimelineDuration,
  getDuration as getScalerDuration,   // 🆕 auto-fit ke liye
  setZoom     as setTimelineZoom,     // 🆕 auto-fit ke liye
  getMetrics   as getScaleMetrics,
  computeClipRect,
  getRulerStep,
  formatRulerTime
} from './timelineScaler.js';

import { attachTrimHandles } from './trimHandles.js';

const LINKED_CSS_ID = 'timeline-linked-clip-styles';

function injectLinkedStyles() {
  if (document.getElementById(LINKED_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = LINKED_CSS_ID;
  s.textContent = `
    .clip.linked-selected {
      border-color: #4f9dff !important;
      box-shadow:
        0 0 0 1px #4f9dff,
        0 0 10px rgba(79,157,255,0.5) !important;
      outline: 1.5px solid #4f9dff;
      outline-offset: -1.5px;
    }
  `;
  document.head.appendChild(s);
}

export function initTimelineEngine(config) {
  injectLayerStyles();
  injectLinkedStyles();

  const visual      = config.visual;
  const audio       = config.audio;
  const state       = config.state;
  const onVisualVisibility = config.onVisualVisibility;
  const onAudioMute        = config.onAudioMute;
  const onDeleteSelected   = config.onDeleteSelected;
  const zoomSlider         = config.zoomSlider;
  const getPlayheadTime    = config.getPlayheadTime || function () { return 0; };

  let selected = null;
  let _rendering = false;

  const DEFAULT_CLIP_SEC = 3;

  ensureMinLayers(state.visual, DEFAULT_VISUAL_LAYERS);
  ensureMinLayers(state.audio,  DEFAULT_AUDIO_LAYERS);

  const viewport = document.querySelector('#timeline-viewport');
  const matrix   = document.querySelector('#timeline-matrix');

  const rulerContainer = document.createElement('div');
  rulerContainer.className = 'timeline-ruler';
  matrix.prepend(rulerContainer);

  // ─── SCALER INIT ───────────────────────────────────────────
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

  // ─── Click empty area → deselect ──────────────────────────
  if (viewport) {
    viewport.addEventListener('pointerdown', function (e) {
      if (e.target.closest && (
           e.target.closest('.clip') ||
           e.target.closest('.trim-handle') ||
           e.target.closest('.kf-marker') ||
           e.target.closest('.transition-marker') ||
           e.target.closest('.track-label'))) {
        return;
      }
      if (selected) {
        selected = null;
        document.querySelectorAll('.clip.selected').forEach(function (el) {
          el.classList.remove('selected');
        });
        document.querySelectorAll('.clip.linked-selected').forEach(function (el) {
          el.classList.remove('linked-selected');
        });
        document.dispatchEvent(new CustomEvent('editor:clip-deselected'));
      }
    });
  }

  document.addEventListener('editor:clip-deselected', function () {
    document.dispatchEvent(new CustomEvent('editor:clip-selected'));
  });

  // ═══════════════════════════════════════════════════════════
  //  🆕 FIX: Timeline minimum 40 minutes
  //
  //  Pehle: Ruler sirf content tak extend hota tha → drag-drop
  //         karte waqt ruler shrink/expand hota → jhatka lagta
  //
  //  Ab:    40 min minimum → ruler stable, drag-drop smooth
  //         Agar content 40 min se zyada ho, to expand karega
  // ═══════════════════════════════════════════════════════════
  const MIN_TIMELINE_DURATION_SEC = 40 * 60; // 40 minutes = 2400 sec

  function computeDuration() {
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

    // Agar content nahi hai, video duration check karo
    if (furthestEnd === 0) {
      const video = document.querySelector('#preview-video');
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        furthestEnd = video.duration;
      }
    }

    // 🆕 Minimum 40 minute — ruler stable rahega
    if (furthestEnd < MIN_TIMELINE_DURATION_SEC) {
      return MIN_TIMELINE_DURATION_SEC;
    }

    return furthestEnd;
  }

  function rangesOverlap(aS, aE, bS, bE) {
    return aS < bE && bS < aE;
  }

  function trackHasOverlap(track, start, end, excludeClip) {
    if (!Array.isArray(track)) return false;
    for (let i = 0; i < track.length; i++) {
      const clip = track[i];
      if (clip === excludeClip) continue;
      const r = clipRange(clip);
      if (rangesOverlap(start, end, r.start, r.end)) return true;
    }
    return false;
  }

  function findFreeTrackIndex(list, start, end, excludeClip) {
    for (let i = 0; i < list.length; i++) {
      if (!trackHasOverlap(list[i], start, end, excludeClip)) return i;
    }
    list.push([]);
    return list.length - 1;
  }

  function getSelectedLinkedId() {
    if (!selected) return null;
    const trackIdx = Number(selected.track.slice(1)) - 1;
    const track = state[selected.type][trackIdx];
    if (!Array.isArray(track)) return null;
    const clip = track[selected.clipIndex];
    return clip ? clip.__linkedId : null;
  }

  // ═══════════════════════════════════════════════════════════
  //  🆕 RIPPLE REORDER — with linked audio mirror
  // ═══════════════════════════════════════════════════════════
  function reorderTrack(group, fromIdx, toIdx) {
    const list = state[group];
    if (!Array.isArray(list)) return;
    if (fromIdx < 0 || fromIdx >= list.length) return;
    if (toIdx < 0 || toIdx >= list.length) return;
    if (fromIdx === toIdx) return;

    // Collect linked IDs from the moved track
    const sourceTrack = list[fromIdx];
    const linkedIds = new Set();
    if (Array.isArray(sourceTrack)) {
      sourceTrack.forEach(function (clip) {
        if (clip && clip.__linkedId) linkedIds.add(clip.__linkedId);
      });
    }

    // Find corresponding track in the OTHER group
    let otherGroup = null;
    let otherIdx = -1;
    if (linkedIds.size > 0) {
      otherGroup = (group === 'visual') ? 'audio' : 'visual';
      const otherList = state[otherGroup] || [];
      for (let oi = 0; oi < otherList.length; oi++) {
        const oTrack = otherList[oi];
        if (!Array.isArray(oTrack)) continue;
        for (let oc = 0; oc < oTrack.length; oc++) {
          const oClip = oTrack[oc];
          if (oClip && linkedIds.has(oClip.__linkedId)) {
            otherIdx = oi;
            break;
          }
        }
        if (otherIdx >= 0) break;
      }
    }

    // Reorder this group
    const movedThis = list.splice(fromIdx, 1)[0];
    list.splice(toIdx, 0, movedThis);

    // Reorder the other group (mirror shift)
    if (otherGroup && otherIdx >= 0 && Array.isArray(state[otherGroup])) {
      const otherList = state[otherGroup];
      const movedOther = otherList.splice(otherIdx, 1)[0];
      const targetOther = Math.min(toIdx, otherList.length);
      otherList.splice(targetOther, 0, movedOther);
    }

    selected = null;
    render();
    notifyChanged();

    showToast('Track reordered' + (otherIdx >= 0 ? ' (linked audio mirrored)' : ''));
  }

  // Listen for reorder events from layerDrag
  document.addEventListener('editor:reorder-track', function (e) {
    const d = e.detail || {};
    if (!Number.isFinite(d.from) || !Number.isFinite(d.to)) return;
    if (d.group !== 'visual' && d.group !== 'audio') return;
    reorderTrack(d.group, d.from, d.to);
  });

  // ─── Track builder ────────────────────────────────────────
  function buildTrack(label, clips, trackIndex, group, selectedLinkedId) {
    const track = document.createElement('div');
    track.className = 'track';
    track.dataset.group = group;
    track.dataset.trackIndex = String(trackIndex);

    const name = document.createElement('div');
    name.className = 'track-label';
    const labelText = document.createElement('span');
    labelText.textContent = label;

    if (group === 'visual') {
      const hiddenSet = state.hiddenVisualTracks || new Set();
      const isHidden = hiddenSet.has(trackIndex);
      if (isHidden) track.classList.add('layer-hidden');

      const vis = document.createElement('button');
      vis.className = 'layer-toggle';
      vis.type = 'button';
      vis.textContent = isHidden ? '\u25CB' : '\u25C9';
      vis.addEventListener('click', function (e) {
        e.stopPropagation();
        const nowHidden = track.classList.toggle('layer-hidden');
        vis.textContent = nowHidden ? '\u25CB' : '\u25C9';
        if (onVisualVisibility) onVisualVisibility(label, !nowHidden);
      });
      name.appendChild(labelText);
      name.appendChild(vis);
    } else {
      const mutedSet = state.mutedAudioTracks || new Set();
      const isMuted = mutedSet.has(trackIndex);
      if (isMuted) track.classList.add('layer-muted');

      const mute = document.createElement('button');
      mute.type = 'button';
      mute.className = 'layer-toggle';
      mute.textContent = isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
      mute.addEventListener('click', function (e) {
        e.stopPropagation();
        const nowMuted = track.classList.toggle('layer-muted');
        mute.textContent = nowMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
        if (onAudioMute) onAudioMute(label, nowMuted);
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

      const isPrimary = selected && selected.track === label && selected.clipIndex === ci;
      if (isPrimary) el.classList.add('selected');
      else if (selectedLinkedId && clip.__linkedId === selectedLinkedId) {
        el.classList.add('linked-selected');
      }

      attachTrimHandles(el, clip);

      (function (capturedIndex) {
        el.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          if (e.target && e.target.classList &&
              (e.target.classList.contains('trim-handle') ||
               e.target.classList.contains('kf-marker') ||
               e.target.classList.contains('transition-marker'))) {
            return;
          }
          e.stopPropagation();

          selected = {
            type: label[0] === 'A' ? 'audio' : 'visual',
            track: label,
            clipIndex: capturedIndex
          };

          document.querySelectorAll('.clip.selected').forEach(function (n) {
            n.classList.remove('selected');
          });
          document.querySelectorAll('.clip.linked-selected').forEach(function (n) {
            n.classList.remove('linked-selected');
          });
          el.classList.add('selected');

          const linkedId = clip.__linkedId;
          if (linkedId) {
            state.visual.forEach(function (track, ti) {
              if (!Array.isArray(track)) return;
              track.forEach(function (c, ci2) {
                if (c && c !== clip && c.__linkedId === linkedId) {
                  const node = document.querySelector(
                    '.clip[data-track="V' + (ti + 1) + '"][data-clip="' + ci2 + '"]'
                  );
                  if (node) node.classList.add('linked-selected');
                }
              });
            });
            state.audio.forEach(function (track, ti) {
              if (!Array.isArray(track)) return;
              track.forEach(function (c, ci2) {
                if (c && c !== clip && c.__linkedId === linkedId) {
                  const node = document.querySelector(
                    '.clip[data-track="A' + (ti + 1) + '"][data-clip="' + ci2 + '"]'
                  );
                  if (node) node.classList.add('linked-selected');
                }
              });
            });
          }
          document.dispatchEvent(new CustomEvent('editor:clip-selected'));
          e.preventDefault();
        });
      })(ci);

      content.appendChild(el);
    }

    track.appendChild(name);
    track.appendChild(content);
    return track;
  }

  // ─── Ruler ────────────────────────────────────────────────
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

  // ─── Main render ──────────────────────────────────────────
  function render() {
    if (_rendering) return;
    _rendering = true;
    try {
      setTimelineDuration(computeDuration());

      const m = getScaleMetrics();
      matrix.style.minWidth = m.totalWidth + 'px';

      const linkedId = getSelectedLinkedId();

      // Visual tracks — reversed for display (V1 at bottom of stack)
      const visualNodes = [];
      for (let i = state.visual.length - 1; i >= 0; i--) {
        visualNodes.push(buildTrack('V' + (i + 1), state.visual[i] || [], i, 'visual', linkedId));
      }
      visual.replaceChildren.apply(visual, visualNodes);

      const audioNodes = [];
      for (let i = 0; i < state.audio.length; i++) {
        audioNodes.push(buildTrack('A' + (i + 1), state.audio[i] || [], i, 'audio', linkedId));
      }
      audio.replaceChildren.apply(audio, audioNodes);

      renderRuler();
    } finally {
      _rendering = false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  🆕 AUTO-FIT IMPORTED CONTENT
  //
  //  Import ke baad zoom aisi set karo ke naya clip poori
  //  visible timeline area mein fit ho jaye.
  //
  //  Formula: viewportWidth / timelineDuration × zoom = viewportWidth / clipDuration
  //        ⇒  zoom = timelineDuration / clipDuration
  // ═══════════════════════════════════════════════════════════
  function autoFitImportedContent(items) {
    if (!items || !items.length) return;

    // Longest imported item dhundo (visual ko priority)
    let maxVisualDur = 0;
    let maxAnyDur = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it) continue;

      const d = (Number.isFinite(it.duration) && it.duration > 0)
        ? it.duration
        : DEFAULT_CLIP_SEC;

      const t = it.type || '';
      const isAudio = t.indexOf('audio/') === 0;

      if (!isAudio && d > maxVisualDur) maxVisualDur = d;
      if (d > maxAnyDur) maxAnyDur = d;
    }

    const fitDur = maxVisualDur > 0 ? maxVisualDur : maxAnyDur;
    if (fitDur <= 0) return;

    const timelineDur = getScalerDuration();
    if (timelineDur <= 0) return;

    // Desired zoom so imported clip fills the viewport
    const desiredZoom = timelineDur / fitDur;
    setTimelineZoom(desiredZoom);
  }
    // ═══════════════════════════════════════════════════════════
  //  🆕 Auto-fit to any duration (used by codebase prompt)
  // ═══════════════════════════════════════════════════════════
  function autoFitToDuration(durSec) {
    const d = Number(durSec);
    if (!Number.isFinite(d) || d <= 0) return;
    const timelineDur = getScalerDuration();
    if (timelineDur <= 0) return;
    setTimelineZoom(timelineDur / d);
  }

  // 🆕 Expose globally so codebaseEngine can trigger it
  window.__autofitTimelineToDuration = autoFitToDuration;

  // ─── Add media ────────────────────────────────────────────
  function addMedia(items) {
    const atTime = Number(getPlayheadTime()) || 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isAudio = item.type.indexOf('audio/') === 0;
      const isVideo = item.type.indexOf('video/') === 0;
      const isImage = item.type.indexOf('image/') === 0;

      const realDur = (Number.isFinite(item.duration) && item.duration > 0)
        ? item.duration
        : (isImage ? 3 : DEFAULT_CLIP_SEC);

      const trackType = isAudio ? 'audio' : 'visual';
      const list = state[trackType];
      ensureMinLayers(list,
        trackType === 'visual' ? DEFAULT_VISUAL_LAYERS : DEFAULT_AUDIO_LAYERS);

      const linkedId = isVideo
        ? 'lk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
        : null;

      if (isVideo) {
        ensureMinLayers(state.audio, DEFAULT_AUDIO_LAYERS);
        const audioAuto = {
          name: (item.name || 'video').replace(/\.[^.]+$/, '') + ' audio',
          url: item.url,
          type: 'audio/mpeg',
          autoGenerated: true,
          duration: realDur,
          sourceIn: 0,
          __sourceTotalDuration: realDur,
          __linkedId: linkedId
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
        if (!already) {
          const end = atTime + realDur;
          const freeIdx = findFreeTrackIndex(state.audio, atTime, end, null);
          while (state.audio.length <= freeIdx) state.audio.push([]);
          state.audio[freeIdx].push(Object.assign({}, audioAuto, {
            startTime: atTime,
            duration: realDur
          }));
        }
      }

      const end = atTime + realDur;
      const freeIdx = findFreeTrackIndex(list, atTime, end, null);
      while (list.length <= freeIdx) list.push([]);

      // 🆕 Image ko unlimited duration — user jitna chhota/bada kare
      const isImageItem = item.type.indexOf('image/') === 0;

      const clipEntry = {
        name: item.name || 'Media',
        url: item.url,
        type: item.type,
        duration: realDur,
        startTime: atTime,
        sourceIn: 0,
        __linkedId: linkedId
      };

      // Images: __sourceTotalDuration mat set karo
      // → trimHandles mein "Infinity" default ho jayega
      // → user kisi bhi lambai tak extend kar sakta hai
      if (!isImageItem) {
        clipEntry.__sourceTotalDuration = realDur;
      }

      list[freeIdx].push(clipEntry);
    }

    render();
    autoFitImportedContent(items);   // 🆕 auto-fit after import
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

  // ─── Metadata sync ────────────────────────────────────────
  const previewVideoEl = document.querySelector('#preview-video');
  if (previewVideoEl) {
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
          if (!clip || clip.url !== src) continue;
          clip.__sourceTotalDuration = real;
          const hasSourceIn = Number.isFinite(clip.sourceIn) && clip.sourceIn > 0.01;
          const hasTrimFlag = clip.__trimmed === true;
          if (!hasSourceIn && !hasTrimFlag &&
              Math.abs((clip.duration || 0) - real) > 0.05) {
            clip.duration = real;
            changed = true;
          }
        }
      }
      for (let t = 0; t < state.audio.length; t++) {
        const track = state.audio[t];
        if (!Array.isArray(track)) continue;
        for (let c = 0; c < track.length; c++) {
          const clip = track[c];
          if (!clip || clip.url !== src || !clip.autoGenerated) continue;
          clip.__sourceTotalDuration = real;
          const hasSourceIn = Number.isFinite(clip.sourceIn) && clip.sourceIn > 0.01;
          if (!hasSourceIn && Math.abs((clip.duration || 0) - real) > 0.05) {
            clip.duration = real;
            changed = true;
          }
        }
      }
      if (changed) { render(); notifyChanged(); }
    });
    previewVideoEl.addEventListener('durationchange', render);
    previewVideoEl.addEventListener('loadedmetadata', render);
  }

  render();

  // ─── DELETE — removes linked clips too ────────────────────
  function deleteSelected() {
    // 🆕 MULTI-SELECT DELETE
    const multi = window.__multiSelect;
    const multiClips = [];
    if (multi && typeof multi.forEachSelectedClip === 'function') {
      multi.forEachSelectedClip(function (c) { multiClips.push(c); });
    }

    if (multiClips.length > 1) {
      const toRemove = [];
      for (let i = 0; i < multiClips.length; i++) {
        const clip = multiClips[i];
        // Find location
        let locType = null;
        ['visual', 'audio'].forEach(function (tt) {
          if (locType) return;
          const tracks = state[tt];
          for (let t = 0; t < tracks.length; t++) {
            if (Array.isArray(tracks[t]) && tracks[t].indexOf(clip) >= 0) {
              locType = tt;
              break;
            }
          }
        });
        if (locType) toRemove.push({ clip: clip, type: locType });

        // Also include linked clips
        const linkedId = clip.__linkedId;
        if (linkedId) {
          ['visual', 'audio'].forEach(function (type) {
            state[type].forEach(function (t) {
              if (!Array.isArray(t)) return;
              t.forEach(function (c) {
                if (c && c !== clip && c.__linkedId === linkedId) {
                  // Avoid duplicates
                  let exists = false;
                  for (let k = 0; k < toRemove.length; k++) {
                    if (toRemove[k].clip === c) { exists = true; break; }
                  }
                  if (!exists) toRemove.push({ clip: c, type: type });
                }
              });
            });
          });
        }
      }

      // Remove all
      for (let i = 0; i < toRemove.length; i++) {
        const entry = toRemove[i];
        if (onDeleteSelected) onDeleteSelected(entry.clip, entry.type);
        ['visual', 'audio'].forEach(function (tt) {
          const tracks = state[tt];
          for (let t = 0; t < tracks.length; t++) {
            const tr = tracks[t];
            if (!Array.isArray(tr)) continue;
            const idx = tr.indexOf(entry.clip);
            if (idx >= 0) { tr.splice(idx, 1); break; }
          }
        });
      }

      // Clear multi + single selection
      document.querySelectorAll('.clip.multi-selected').forEach(function (el) {
        el.classList.remove('multi-selected');
      });
      selected = null;
      render();
      notifyChanged();

      showToast('Removed ' + toRemove.length + ' clips');
      return;
    }

    // ─── SINGLE DELETE (existing) ────────────────────────────
    if (!selected) return;

    const trackIdx = Number(selected.track.slice(1)) - 1;
    const track = state[selected.type][trackIdx];
    if (!Array.isArray(track)) return;
    const clip = track[selected.clipIndex];
    if (!clip) return;

    const linkedId = clip.__linkedId;

    const toRemove = [{ clip: clip, type: selected.type }];
    if (linkedId) {
      ['visual', 'audio'].forEach(function (type) {
        state[type].forEach(function (t) {
          if (!Array.isArray(t)) return;
          t.forEach(function (c) {
            if (c && c !== clip && c.__linkedId === linkedId) {
              toRemove.push({ clip: c, type: type });
            }
          });
        });
      });
    }

    toRemove.forEach(function (entry) {
      if (onDeleteSelected) onDeleteSelected(entry.clip, entry.type);
      ['visual', 'audio'].forEach(function (tt) {
        const tracks = state[tt];
        for (let t = 0; t < tracks.length; t++) {
          const tr = tracks[t];
          if (!Array.isArray(tr)) continue;
          const idx = tr.indexOf(entry.clip);
          if (idx >= 0) { tr.splice(idx, 1); break; }
        }
      });
    });

    selected = null;
    render();
    notifyChanged();

    if (toRemove.length > 1) {
      showToast('Removed ' + toRemove.length + ' linked clips');
    }
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
    addAudioLayer: addAudioLayer,
    reorderTrack: reorderTrack    // 🆕 expose
  };
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed','bottom:110px','left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,0,0,0.9)','color:#fff',
    'padding:8px 18px','border-radius:20px',
    'font-size:12px','font-weight:600','z-index:9999',
    'pointer-events:none','font-family:inherit',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
    'opacity:0','transition:opacity 0.15s ease'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 1400);
}