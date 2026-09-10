// ================================================================
//  js/features/colorWheel.js
//  3 Color Wheels Panel (Shadows / Midtones / Highlights) + HDR.
//  Contain-fit preserved via window.__previewContainRect.
// ================================================================

export const featureKey = 'colorWheel';

const state = {
  tones: {
    shadows:    { h: 0, s: 0, intensity: 0 },
    midtones:   { h: 0, s: 0, intensity: 0 },
    highlights: { h: 0, s: 0, intensity: 0 }
  },
  hdrWhite: 100
};

let wheelRefs = {};
let hdrSlider, hdrDisplay;
let resizeObserver;

// ─── Contain-fit draw helper ───────────────────────────────────
function drawVideoContained(ctx, video, canvas) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rectFn = window.__previewContainRect;
  const r = rectFn
    ? rectFn(video.videoWidth, video.videoHeight, canvas.width, canvas.height)
    : { x: 0, y: 0, w: canvas.width, h: canvas.height };
  try {
    ctx.drawImage(video, r.x, r.y, r.w, r.h);
  } catch (_) {}
}

export function open({ router, item }) {
  router.openLevel('colorWheel', [], {
    title: 'Color Wheels',
    level: 2,
    renderMode: 'colorwheel'
  });
}

export function renderTo(container, titleElement) {
  container.replaceChildren();
  container.style.cssText =
    'display:flex;flex-direction:column;gap:12px;padding:6px 4px 12px;overflow-y:auto;max-height:72vh;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'display:flex;flex-direction:column;gap:14px;align-items:center;width:100%;max-width:600px;margin:0 auto;';

  const grid = document.createElement('div');
  grid.style.cssText =
    'display:flex;flex-wrap:wrap;gap:14px;justify-content:center;width:100%;';

  const toneKeys = ['shadows', 'midtones', 'highlights'];
  const toneLabels = ['Shadows', 'Midtones', 'Highlights'];

  toneKeys.forEach((key, idx) => {
    const item = document.createElement('div');
    item.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:4px;flex:1 0 130px;max-width:170px;min-width:110px;';

    const topRow = document.createElement('div');
    topRow.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;width:100%;padding:0 4px;';
    const label = document.createElement('span');
    label.textContent = toneLabels[idx];
    label.style.cssText =
      'font-size:11px;font-weight:600;color:var(--muted);letter-spacing:0.05em;text-transform:uppercase;';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺';
    resetBtn.type = 'button';
    resetBtn.style.cssText =
      'background:transparent;border:0;color:var(--muted);font-size:14px;cursor:pointer;padding:0 4px;opacity:0.5;';
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tone = state.tones[key];
      tone.h = 0; tone.s = 0; tone.intensity = 0;
      const ref = wheelRefs[key];
      if (ref) {
        ref.intSlider.value = 0;
        ref.intDisplay.textContent = '0%';
        updatePuck(key, 0, 0);
      }
      applyColorWheels();
    });
    topRow.append(label, resetBtn);

    const wheelWrap = document.createElement('div');
    wheelWrap.style.cssText = `
      width: 130px; height: 130px; border-radius: 50%; position: relative;
      cursor: crosshair; touch-action: none;
      background: radial-gradient(circle, #ffffff 0%, transparent 75%),
                  conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
      box-shadow: inset 0 0 8px rgba(0,0,0,0.25), 0 3px 10px rgba(0,0,0,0.15);
      flex-shrink: 0; user-select: none;
    `;

    const puck = document.createElement('div');
    puck.style.cssText = `
      width: 14px; height: 14px; border: 2px solid #ffffff; background: transparent;
      border-radius: 50%; position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.5);
      pointer-events: none; z-index: 2;
    `;
    const dot = document.createElement('span');
    dot.style.cssText =
      'display:block;width:3px;height:3px;background:#fff;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
    puck.appendChild(dot);
    wheelWrap.appendChild(puck);

    const intRow = document.createElement('div');
    intRow.style.cssText =
      'display:flex;align-items:center;gap:6px;width:100%;padding:2px 0;';
    const intSlider = document.createElement('input');
    intSlider.type = 'range';
    intSlider.min = 0; intSlider.max = 100; intSlider.value = 0;
    intSlider.style.cssText =
      'flex:1;accent-color:var(--accent);height:3px;cursor:pointer;background:var(--border);border-radius:4px;';
    const intDisplay = document.createElement('span');
    intDisplay.textContent = '0%';
    intDisplay.style.cssText =
      'font-size:11px;font-weight:600;min-width:32px;text-align:right;color:var(--text);font-variant-numeric:tabular-nums;';
    intRow.append(intSlider, intDisplay);

    item.append(topRow, wheelWrap, intRow);
    grid.appendChild(item);

    wheelRefs[key] = { wheel: wheelWrap, puck, intSlider, intDisplay };

    function getCoords(e) {
      const rect = wheelWrap.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cx - rect.left, y: cy - rect.top, w: rect.width, h: rect.height };
    }

    function handlePick(e) {
      e.preventDefault();
      const { x, y, w, h } = getCoords(e);
      const cx = w / 2, cy = h / 2;
      const dx = x - cx, dy = y - cy;
      const radius = Math.min(w, h) / 2;
      let dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, radius);
      const sat = Math.round((clampedDist / radius) * 100);
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      const hue = Math.round(angle);

      state.tones[key].h = hue;
      state.tones[key].s = sat;
      updatePuck(key, hue, sat);
      applyColorWheels();
    }

    wheelWrap.addEventListener('mousedown', (e) => {
      handlePick(e);
      const onMove = (ev) => handlePick(ev);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    wheelWrap.addEventListener('touchstart', (e) => {
      handlePick(e);
      const onMove = (ev) => { ev.preventDefault(); handlePick(ev); };
      const onUp = () => {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }, { passive: false });

    intSlider.addEventListener('input', () => {
      const val = parseFloat(intSlider.value);
      intDisplay.textContent = Math.round(val) + '%';
      state.tones[key].intensity = val;
      applyColorWheels();
    });
  });

  wrapper.appendChild(grid);

  const hdrRow = document.createElement('div');
  hdrRow.style.cssText =
    'display:flex;align-items:center;gap:10px;width:100%;max-width:400px;padding:6px 0 2px;border-top:1px solid var(--border);margin-top:2px;';
  const hdrLabel = document.createElement('span');
  hdrLabel.textContent = 'HDR White';
  hdrLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--muted);min-width:80px;';
  hdrSlider = document.createElement('input');
  hdrSlider.type = 'range';
  hdrSlider.min = 0;
  hdrSlider.max = 200;
  hdrSlider.value = state.hdrWhite;
  hdrSlider.style.cssText = 'flex:1;accent-color:var(--accent);height:4px;cursor:pointer;';
  hdrDisplay = document.createElement('span');
  hdrDisplay.textContent = Math.round(state.hdrWhite);
  hdrDisplay.style.cssText = 'font-size:14px;font-weight:600;min-width:36px;text-align:right;';
  hdrRow.append(hdrLabel, hdrSlider, hdrDisplay);
  wrapper.appendChild(hdrRow);

  container.appendChild(wrapper);

  hdrSlider.addEventListener('input', () => {
    state.hdrWhite = parseFloat(hdrSlider.value);
    hdrDisplay.textContent = Math.round(state.hdrWhite);
    applyColorWheels();
  });

  function updateAllPucks() {
    toneKeys.forEach(k => {
      const t = state.tones[k];
      updatePuck(k, t.h, t.s);
    });
  }
  resizeObserver = new ResizeObserver(updateAllPucks);
  setTimeout(() => {
    Object.values(wheelRefs).forEach(ref => {
      if (ref.wheel) resizeObserver.observe(ref.wheel);
    });
  }, 100);

  toneKeys.forEach(k => {
    const t = state.tones[k];
    updatePuck(k, t.h, t.s);
    const ref = wheelRefs[k];
    if (ref) {
      ref.intSlider.value = t.intensity;
      ref.intDisplay.textContent = Math.round(t.intensity) + '%';
    }
  });
  applyColorWheels();

  function updatePuck(toneKey, hue, sat) {
    const ref = wheelRefs[toneKey];
    if (!ref) return;
    const w = ref.wheel.getBoundingClientRect().width || 130;
    const radius = w / 2;
    const angleRad = (hue / 360) * 2 * Math.PI;
    const dist = (sat / 100) * radius;
    const x = radius + Math.cos(angleRad) * dist;
    const y = radius + Math.sin(angleRad) * dist;
    const pctX = (x / w) * 100;
    const pctY = (y / w) * 100;
    ref.puck.style.left = pctX + '%';
    ref.puck.style.top = pctY + '%';
    ref.puck.style.transform = 'translate(-50%, -50%)';
  }

  function applyColorWheels() {
    const canvas = document.querySelector('#preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const video = document.querySelector('#preview-video');
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d', { willReadFrequently: true });
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      drawVideoContained(tCtx, video, canvas);
    } else {
      tCtx.drawImage(canvas, 0, 0);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);

    const hdr = state.hdrWhite / 100;
    if (hdr !== 1.0) {
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = (hdr - 1) * 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3 / 255;

      const sT = state.tones.shadows;
      if (sT.intensity > 0 && !(sT.h === 0 && sT.s === 0)) {
        const w = Math.max(0, 1 - brightness * 2);
        if (w > 0) {
          const [tr, tg, tb] = hslToRgb(sT.h, sT.s, 50);
          const blend = w * (sT.intensity / 100) * 0.5;
          r += (tr - r) * blend;
          g += (tg - g) * blend;
          b += (tb - b) * blend;
        }
      }
      const mT = state.tones.midtones;
      if (mT.intensity > 0 && !(mT.h === 0 && mT.s === 0)) {
        const w = 1 - Math.abs(brightness - 0.5) * 2;
        if (w > 0) {
          const [tr, tg, tb] = hslToRgb(mT.h, mT.s, 50);
          const blend = w * (mT.intensity / 100) * 0.5;
          r += (tr - r) * blend;
          g += (tg - g) * blend;
          b += (tb - b) * blend;
        }
      }
      const hT = state.tones.highlights;
      if (hT.intensity > 0 && !(hT.h === 0 && hT.s === 0)) {
        const w = Math.max(0, brightness * 2 - 1);
        if (w > 0) {
          const [tr, tg, tb] = hslToRgb(hT.h, hT.s, 50);
          const blend = w * (hT.intensity / 100) * 0.5;
          r += (tr - r) * blend;
          g += (tg - g) * blend;
          b += (tb - b) * blend;
        }
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  return () => { if (resizeObserver) resizeObserver.disconnect(); };
}