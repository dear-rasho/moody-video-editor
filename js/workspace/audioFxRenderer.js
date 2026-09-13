// ================================================================
//  js/workspace/audioFxRenderer.js
//  Watches playback → applies the active FX layer's effect in
//  real-time via audioFxEngine.
// ================================================================

import { getActiveAudioFxAt } from './audioEffectLayer.js';
import { setGlobalEffect, warmUp } from './audioFxEngine.js';

let currentKey = null;
let rafPending = false;
let pendingTime = 0;

export function initAudioFxRenderer() {
  warmUp();
  document.addEventListener('playback:tick', (e) => {
    const t = (e.detail && Number(e.detail.time)) || 0;
    schedule(t);
  });
  document.addEventListener('playback:state', (e) => {
    if (e.detail && e.detail.playing) {
      const eng = window.__playbackEngine;
      schedule(eng ? eng.getTime() : 0);
    }
  });
  document.addEventListener('editor:timeline-changed', () => {
    const eng = window.__playbackEngine;
    schedule(eng ? eng.getTime() : 0);
  });

  const eng = window.__playbackEngine;
  schedule(eng ? eng.getTime() : 0);
}

function schedule(time) {
  pendingTime = time;
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const active = getActiveAudioFxAt(pendingTime);
    const key = active ? active.__audioFxKey : null;
    if (key === currentKey) return;
    currentKey = key;
    setGlobalEffect(key);
  });
}