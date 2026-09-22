// ================================================================
//  js/workspace/overlayRenderer.js
//  Visual overlays drawn on top of the canvas:
//    particles (rain, snow, sparks), atmosphere (fog, smoke),
//    textures (noise, grain, scanlines), light (flare, leak),
//    flicker, tone washes, edges.
//  All deterministic (same frame = same pattern) so preview
//  and export match perfectly.
// ================================================================

function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hexToRgb(hex) {
  if (!hex) return { r: 255, g: 255, b: 255 };
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════
export function drawOverlay(ctx, W, H, time, overlay) {
  if (!overlay || !overlay.type) return;
  const t = overlay.type;
  const I = (overlay.intensity != null ? overlay.intensity : 100) / 100;
  const color = overlay.color || '#ffffff';

  switch (t) {
    // ─── Particles ───────────────────────────────────
    case 'rain':       drawRain(ctx, W, H, time, I, color); break;
    case 'snow':       drawSnow(ctx, W, H, time, I, color); break;
    case 'dust':       drawDust(ctx, W, H, time, I, color); break;
    case 'sparks':     drawSparks(ctx, W, H, time, I, color); break;
    case 'embers':     drawEmbers(ctx, W, H, time, I); break;
    case 'stars':      drawStars(ctx, W, H, time, I, color); break;
    case 'bokeh':      drawBokeh(ctx, W, H, time, I, color); break;
    case 'fireFlies':  drawFireFlies(ctx, W, H, time, I); break;

    // ─── Atmosphere ──────────────────────────────────
    case 'fog':        drawFog(ctx, W, H, time, I, color); break;
    case 'smoke':      drawSmoke(ctx, W, H, time, I); break;
    case 'haze':       drawHaze(ctx, W, H, I, color); break;
    case 'mist':       drawMist(ctx, W, H, time, I, color); break;

    // ─── Noise / Texture ─────────────────────────────
    case 'noise':      drawNoise(ctx, W, H, time, I, false); break;
    case 'filmGrain':  drawNoise(ctx, W, H, time, I * 0.6, false); break;
    case 'blackNoise': drawNoise(ctx, W, H, time, I, true); break;
    case 'whiteNoise': drawWhiteNoise(ctx, W, H, time, I); break;
    case 'scanlines':  drawScanlines(ctx, W, H, I); break;
    case 'staticTV':   drawStaticTV(ctx, W, H, time, I); break;

    // ─── Light ───────────────────────────────────────
    case 'lightLeak':  drawLightLeak(ctx, W, H, time, I); break;
    case 'lensFlare':  drawLensFlare(ctx, W, H, I, color); break;
    case 'bloom':      drawBloom(ctx, W, H, I, color); break;
    case 'sunburst':   drawSunburst(ctx, W, H, time, I); break;
    case 'godRays':    drawGodRays(ctx, W, H, time, I); break;

    // ─── Flicker ─────────────────────────────────────
    case 'flicker':    drawFlicker(ctx, W, H, time, I, 0.5, 15); break;
    case 'strobe':     drawFlicker(ctx, W, H, time, I, 0.85, 8); break;
    case 'pulseFx':    drawPulseFx(ctx, W, H, time, I); break;
    case 'blink':      drawFlicker(ctx, W, H, time, I, 0.95, 4); break;

    // ─── Tone Washes ─────────────────────────────────
    case 'blueLake':   drawToneWash(ctx, W, H, I, '#0a4a8a', 0.55); break;
    case 'warmWash':   drawToneWash(ctx, W, H, I, '#ff8a3a', 0.35); break;
    case 'coolWash':   drawToneWash(ctx, W, H, I, '#3a8aff', 0.35); break;
    case 'tealWash':   drawToneWash(ctx, W, H, I, '#00d4a0', 0.4); break;
    case 'roseWash':   drawToneWash(ctx, W, H, I, '#ff3a80', 0.4); break;

    // ─── Edges ───────────────────────────────────────
    case 'sharpenEdges': drawSharpenEdges(ctx, W, H, I); break;
    case 'edgeGlow':     drawEdgeGlow(ctx, W, H, I, color); break;

    // ─── Misc ────────────────────────────────────────
    case 'vignette':   drawVignette(ctx, W, H, I); break;
    case 'blackBars':  drawBlackBars(ctx, W, H, I); break;
    case 'vhsLines':   drawVhsLines(ctx, W, H, time, I); break;
    case 'glitchBars': drawGlitchBars(ctx, W, H, time, I); break;
  }
}

// ═══════════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════════
function drawRain(ctx, W, H, time, I, color) {
  const count = Math.floor(180 * I);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < count; i++) {
    const a = hash(i);
    const b = hash(i + 101);
    const x = (a * W + time * 180) % W;
    const y = (b * H + time * 850 + i * 37) % H;
    const len = 12 + b * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnow(ctx, W, H, time, I, color) {
  const count = Math.floor(140 * I);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = hash(i);
    const b = hash(i + 202);
    const c = hash(i + 303);
    const size = 1.5 + a * 2.5;
    const drift = Math.sin(time * 0.8 + i) * 20;
    const x = (b * W + drift + W) % W;
    const y = (c * H + time * (60 + a * 40) + i * 13) % H;
    ctx.globalAlpha = 0.55 + a * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDust(ctx, W, H, time, I, color) {
  const count = Math.floor(120 * I);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = hash(i + 500);
    const b = hash(i + 600);
    const c = hash(i + 700);
    const drift = Math.sin(time * 1.2 + i * 0.3) * 25;
    const driftY = Math.cos(time * 0.9 + i * 0.5) * 15;
    const x = (a * W + drift + W) % W;
    const y = (b * H + driftY + H) % H;
    const size = 0.6 + c * 1.4;
    ctx.globalAlpha = 0.35 + c * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparks(ctx, W, H, time, I, color) {
  const count = Math.floor(70 * I);
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  for (let i = 0; i < count; i++) {
    const a = hash(i + 800);
    const b = hash(i + 900);
    const speed = 200 + a * 400;
    const x = a * W;
    const y = (b * H - time * speed) % H;
    if (y < -20) continue;
    const size = 1 + a * 2;
    ctx.globalAlpha = 0.6 + b * 0.4;
    ctx.beginPath();
    ctx.arc(x, (y + H) % H, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEmbers(ctx, W, H, time, I) {
  const count = Math.floor(80 * I);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const a = hash(i + 1100);
    const b = hash(i + 1200);
    const speed = 40 + a * 80;
    const x = a * W + Math.sin(time * 2 + i) * 20;
    const y = H - ((b * H + time * speed) % H);
    const size = 1 + b * 2;
    ctx.globalAlpha = 0.5 + a * 0.4;
    ctx.fillStyle = a > 0.5 ? '#ff6b1a' : '#ffcc00';
    ctx.shadowColor = '#ff8a00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStars(ctx, W, H, time, I, color) {
  const count = Math.floor(200 * I);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = hash(i + 1300);
    const b = hash(i + 1400);
    const c = hash(i + 1500);
    const twinkle = 0.5 + Math.abs(Math.sin(time * 3 + i * 0.7)) * 0.5;
    const x = a * W;
    const y = b * H;
    const size = 0.5 + c * 1.5;
    ctx.globalAlpha = twinkle * (0.4 + c * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBokeh(ctx, W, H, time, I, color) {
  const count = Math.floor(30 * I);
  const rgb = hexToRgb(color);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const a = hash(i + 1600);
    const b = hash(i + 1700);
    const c = hash(i + 1800);
    const drift = Math.sin(time * 0.4 + i * 0.8) * 40;
    const x = (a * W + drift + W) % W;
    const y = (b * H + Math.cos(time * 0.3 + i) * 30 + H) % H;
    const size = 15 + c * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
    grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.55)');
    grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFireFlies(ctx, W, H, time, I) {
  const count = Math.floor(25 * I);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const a = hash(i + 1900);
    const b = hash(i + 2000);
    const c = hash(i + 2100);
    const drift = Math.sin(time * 1.5 + i * 1.3) * 60;
    const driftY = Math.cos(time * 1.2 + i * 0.9) * 40;
    const x = (a * W + drift + W) % W;
    const y = (b * H + driftY + H) % H;
    const size = 2 + c * 3;
    const pulse = 0.4 + Math.abs(Math.sin(time * 4 + i)) * 0.6;
    ctx.shadowColor = '#ffee66';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(255,240,120,' + (pulse * 0.9) + ')';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  ATMOSPHERE
// ═══════════════════════════════════════════════════════════════
function drawFog(ctx, W, H, time, I, color) {
  const rgb = hexToRgb(color);
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const a = hash(i + 3000);
    const b = hash(i + 3100);
    const c = hash(i + 3200);
    const drift = (time * (5 + a * 15) + i * 200) % (W + 400) - 200;
    const y = b * H;
    const size = 200 + c * 300;
    const grad = ctx.createRadialGradient(drift, y, 0, drift, y, size);
    grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.15 * I) + ')');
    grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(drift, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSmoke(ctx, W, H, time, I) {
  ctx.save();
  for (let i = 0; i < 10; i++) {
    const a = hash(i + 3300);
    const b = hash(i + 3400);
    const drift = (time * (3 + a * 8) + i * 150) % (W + 300) - 150;
    const y = H - ((time * (10 + b * 30) + i * 100) % (H + 200));
    const size = 120 + a * 200;
    const grad = ctx.createRadialGradient(drift, y, 0, drift, y, size);
    grad.addColorStop(0, 'rgba(200,200,210,' + (0.12 * I) + ')');
    grad.addColorStop(1, 'rgba(200,200,210,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(drift, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHaze(ctx, W, H, I, color) {
  const rgb = hexToRgb(color);
  ctx.save();
  ctx.globalAlpha = 0.35 * I;
  ctx.fillStyle = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawMist(ctx, W, H, time, I, color) {
  const rgb = hexToRgb(color);
  ctx.save();
  ctx.globalAlpha = 0.2 * I;
  for (let i = 0; i < 5; i++) {
    const a = hash(i + 3500);
    const drift = (time * (8 + a * 10) + i * 300) % (W + 400) - 200;
    const size = 250 + a * 200;
    const grad = ctx.createRadialGradient(drift, H * 0.7, 0, drift, H * 0.7, size);
    grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.3 * I) + ')');
    grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(drift, H * 0.7, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  NOISE / TEXTURE
// ═══════════════════════════════════════════════════════════════
function drawNoise(ctx, W, H, time, I, blackOnly) {
  const seed = Math.floor(time * 24);   // 24fps noise
  ctx.save();
  const step = 3;
  ctx.globalAlpha = 0.55 * I;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const n = hash((x * 12.9898 + y * 78.233 + seed * 17.13));
      if (n < 0.55) continue;
      const v = blackOnly ? 0 : Math.floor(n * 255);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}

function drawWhiteNoise(ctx, W, H, time, I) {
  const seed = Math.floor(time * 30);
  ctx.save();
  ctx.globalAlpha = 0.45 * I;
  for (let i = 0; i < 400 * I; i++) {
    const x = hash(i + seed * 3.13) * W;
    const y = hash(i + seed * 7.77) * H;
    const size = 1 + hash(i + seed) * 3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawScanlines(ctx, W, H, I) {
  ctx.save();
  ctx.globalAlpha = 0.28 * I;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1.5);
  }
  ctx.restore();
}

function drawStaticTV(ctx, W, H, time, I) {
  const seed = Math.floor(time * 20);
  ctx.save();
  ctx.globalAlpha = 0.4 * I;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.55 * I;
  for (let i = 0; i < 500 * I; i++) {
    const x = hash(i + seed * 5.7) * W;
    const y = hash(i + seed * 11.3) * H;
    const v = Math.floor(hash(i + seed * 3.1) * 255);
    ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  LIGHT
// ═══════════════════════════════════════════════════════════════
function drawLightLeak(ctx, W, H, time, I) {
  const x = W * (0.5 + Math.sin(time * 0.6) * 0.4);
  const size = Math.max(W, H) * 0.9;
  const grad = ctx.createRadialGradient(x, H * 0.3, 0, x, H * 0.3, size);
  grad.addColorStop(0, 'rgba(255,160,80,' + (0.55 * I) + ')');
  grad.addColorStop(0.4, 'rgba(255,80,150,' + (0.25 * I) + ')');
  grad.addColorStop(1, 'rgba(255,0,100,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawLensFlare(ctx, W, H, I, color) {
  const cx = W * 0.7, cy = H * 0.3;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
  grad.addColorStop(0, 'rgba(255,255,255,' + (0.8 * I) + ')');
  grad.addColorStop(0.1, 'rgba(180,220,255,' + (0.4 * I) + ')');
  grad.addColorStop(1, 'rgba(180,220,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawBloom(ctx, W, H, I, color) {
  const rgb = hexToRgb(color);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.35 * I;
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.6)');
  grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawSunburst(ctx, W, H, time, I) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(W / 2, H / 2);
  ctx.rotate(time * 0.4);
  const rays = 16;
  const len = Math.max(W, H) * 1.2;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,220,150,' + (0.35 * I) + ')');
    grad.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, -30);
    ctx.lineTo(len, 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawGodRays(ctx, W, H, time, I) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const srcX = W * 0.3 + Math.sin(time * 0.3) * 40;
  const srcY = -H * 0.2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 0.8 - Math.PI * 0.4 + Math.PI * 0.5;
    ctx.save();
    ctx.translate(srcX, srcY);
    ctx.rotate(a);
    const grad = ctx.createLinearGradient(0, 0, 0, H * 1.5);
    grad.addColorStop(0, 'rgba(255,240,200,' + (0.28 * I) + ')');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.lineTo(60, H * 1.5);
    ctx.lineTo(-60, H * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  FLICKER
// ═══════════════════════════════════════════════════════════════
function drawFlicker(ctx, W, H, time, I, amount, hz) {
  const phase = Math.sin(time * hz * Math.PI * 2);
  const v = phase > 0 ? amount * I : 0;
  if (v <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = v;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawPulseFx(ctx, W, H, time, I) {
  const v = Math.abs(Math.sin(time * 2.5)) * 0.4 * I;
  ctx.save();
  ctx.globalAlpha = v;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  TONE WASH
// ═══════════════════════════════════════════════════════════════
function drawToneWash(ctx, W, H, I, color, baseAlpha) {
  const rgb = hexToRgb(color);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = baseAlpha * I;
  ctx.fillStyle = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  EDGES
// ═══════════════════════════════════════════════════════════════
function drawSharpenEdges(ctx, W, H, I) {
  let imgData;
  try { imgData = ctx.getImageData(0, 0, W, H); } catch (_) { return; }
  const data = imgData.data;
  const src = new Uint8ClampedArray(data);
  const amount = I * 1.4;

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = src[i + c] * (1 + 4 * amount);
        const up = src[i - W * 4 + c];
        const dn = src[i + W * 4 + c];
        const lf = src[i - 4 + c];
        const rt = src[i + 4 + c];
        const v = center - amount * (up + dn + lf + rt);
        data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
  try { ctx.putImageData(imgData, 0, 0); } catch (_) {}
}

function drawEdgeGlow(ctx, W, H, I, color) {
  let imgData;
  try { imgData = ctx.getImageData(0, 0, W, H); } catch (_) { return; }
  const data = imgData.data;
  const src = new Uint8ClampedArray(data);
  const rgb = hexToRgb(color);
  const thresh = 45;
  const mix = I * 0.75;

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;

      const lum = (j) => 0.299 * src[j] + 0.587 * src[j + 1] + 0.114 * src[j + 2];
      const gx =
        lum(i - W * 4 - 4) + 2 * lum(i - W * 4) + lum(i - W * 4 + 4) -
        lum(i + W * 4 - 4) - 2 * lum(i + W * 4) - lum(i + W * 4 + 4);
      const gy =
        lum(i - W * 4 - 4) + 2 * lum(i - 4) + lum(i + W * 4 - 4) -
        lum(i - W * 4 + 4) - 2 * lum(i + 4) - lum(i + W * 4 + 4);
      const mag = Math.sqrt(gx * gx + gy * gy);

      if (mag > thresh) {
        const k = Math.min(1, (mag - thresh) / 120) * mix;
        data[i]     = data[i]     * (1 - k) + rgb.r * k;
        data[i + 1] = data[i + 1] * (1 - k) + rgb.g * k;
        data[i + 2] = data[i + 2] * (1 - k) + rgb.b * k;
      }
    }
  }
  try { ctx.putImageData(imgData, 0, 0); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  MISC
// ═══════════════════════════════════════════════════════════════
function drawVignette(ctx, W, H, I) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(0,0,0,' + (0.85 * I) + ')');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawBlackBars(ctx, W, H, I) {
  const barH = H * (0.06 + 0.06 * I);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, barH);
  ctx.fillRect(0, H - barH, W, barH);
  ctx.restore();
}

function drawVhsLines(ctx, W, H, time, I) {
  ctx.save();
  ctx.globalAlpha = 0.35 * I;
  for (let i = 0; i < 6; i++) {
    const y = (hash(i + Math.floor(time * 3)) * H);
    ctx.fillStyle = i % 2 ? '#fff' : '#000';
    ctx.fillRect(0, y, W, 2 + I * 4);
  }
  // horizontal tear
  const tearY = (time * 300) % H;
  ctx.globalAlpha = 0.4 * I;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, tearY, W, 3);
  ctx.restore();
}

function drawGlitchBars(ctx, W, H, time, I) {
  const seed = Math.floor(time * 20);
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const y = hash(i + seed * 3.7) * H;
    const h = 4 + hash(i + seed * 5.1) * 20;
    const off = (hash(i + seed * 7.3) - 0.5) * 60 * I;
    ctx.globalAlpha = 0.45 * I;
    try {
      const slice = ctx.getImageData(0, y, W, h);
      ctx.putImageData(slice, off, y);
    } catch (_) {}
  }
  ctx.restore();
}