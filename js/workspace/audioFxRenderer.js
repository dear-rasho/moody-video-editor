// ================================================================
//  js/workspace/audioFxRenderer.js
//  Watches playback → applies ALL active FX layers (chained).
// ================================================================

import { getActiveAudioFxListAt } from './audioEffectLayer.js';
import { setGlobalEffect, warmUp } from './audioFxEngine.js';

let currentKeyStr = '';
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

    const activeList = getActiveAudioFxListAt(pendingTime);
    const keys = activeList.map(a => a.key);
    const keyStr = keys.join('+');

    if (keyStr === currentKeyStr) return;
    currentKeyStr = keyStr;

    setGlobalEffect(keys);   // [] = no fx, [a, b] = chain
  });
}