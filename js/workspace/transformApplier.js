// ================================================================
//  js/workspace/transformApplier.js
// ================================================================

export function getDefaultTransform() {
  return {
    x: 50, y: 50, scale: 100, rotation: 0,
    anchorX: 50, anchorY: 50,
    cropL: 0, cropR: 0, cropT: 0, cropB: 0
  };
}

export function isIdentity(t) {
  if (!t) return true;
  const EPS = 0.01;
  const x  = t.x  != null ? t.x  : 50;
  const y  = t.y  != null ? t.y  : 50;
  const s  = t.scale != null ? t.scale : 100;
  const r  = t.rotation != null ? t.rotation : 0;
  const ax = t.anchorX != null ? t.anchorX : 50;
  const ay = t.anchorY != null ? t.anchorY : 50;
  const cl = t.cropL != null ? t.cropL : 0;
  const cr = t.cropR != null ? t.cropR : 0;
  const ct = t.cropT != null ? t.cropT : 0;
  const cb = t.cropB != null ? t.cropB : 0;

  return (
    Math.abs(x - 50) < EPS &&
    Math.abs(y - 50) < EPS &&
    Math.abs(s - 100) < EPS &&
    Math.abs(r) < EPS &&
    Math.abs(ax - 50) < EPS &&
    Math.abs(ay - 50) < EPS &&
    Math.abs(cl) < EPS &&
    Math.abs(cr) < EPS &&
    Math.abs(ct) < EPS &&
    Math.abs(cb) < EPS
  );
}

export function buildCssTransform(t, canvasW, canvasH) {
  if (!t) return { transform: '', clipPath: '', transformOrigin: 'center center' };
  const parts = [];
  const dx = (t.x - 50) / 100 * canvasW;
  const dy = (t.y - 50) / 100 * canvasH;
  if (dx !== 0 || dy !== 0) {
    parts.push('translate(' + dx.toFixed(2) + 'px, ' + dy.toFixed(2) + 'px)');
  }
  if (t.rotation) parts.push('rotate(' + t.rotation + 'deg)');
  const transformOrigin = t.anchorX + '% ' + t.anchorY + '%';
  let clipPath = '';
  if (t.cropL || t.cropR || t.cropT || t.cropB) {
    clipPath = 'inset(' + t.cropT + '% ' + t.cropR + '% ' + t.cropB + '% ' + t.cropL + '%)';
  }
  return { transform: parts.join(' '), transformOrigin, clipPath };
}

export function applyCssTransformToElement(el, t, canvasW, canvasH) {
  if (!el) return;
  if (!t || isIdentity(t)) {
    el.style.removeProperty('transform');
    el.style.removeProperty('transform-origin');
    el.style.removeProperty('clip-path');
    return;
  }
  const css = buildCssTransform(t, canvasW, canvasH);
  if (css.transform) {
    el.style.setProperty('transform', css.transform, 'important');
    el.style.setProperty('transform-origin', css.transformOrigin, 'important');
  } else {
    el.style.removeProperty('transform');
    el.style.removeProperty('transform-origin');
  }
  if (css.clipPath) el.style.setProperty('clip-path', css.clipPath, 'important');
  else el.style.removeProperty('clip-path');
}

export function drawTransformed(ctx, source, W, H, transform) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (!source) { ctx.restore(); return; }

  const srcW = source.displayWidth || source.videoWidth || source.naturalWidth || source.width;
  const srcH = source.displayHeight || source.videoHeight || source.naturalHeight || source.height;
  if (!srcW || !srcH) { ctx.restore(); return; }

  const t = transform || getDefaultTransform();
  const sx = srcW * (t.cropL / 100);
  const sy = srcH * (t.cropT / 100);
  const sw = srcW * (1 - (t.cropL + t.cropR) / 100);
  const sh = srcH * (1 - (t.cropT + t.cropB) / 100);
  if (sw <= 0 || sh <= 0) { ctx.restore(); return; }

  const croppedAR = sw / sh;
  const canvasAR = W / H;
  let dw, dh;
  if (croppedAR > canvasAR) { dw = W; dh = W / croppedAR; }
  else { dh = H; dw = H * croppedAR; }
  const dx0 = (W - dw) / 2;
  const dy0 = (H - dh) / 2;

  const originX = W * (t.anchorX / 100);
  const originY = H * (t.anchorY / 100);
  const offsetX = (t.x - 50) / 100 * W;
  const offsetY = (t.y - 50) / 100 * H;

  ctx.translate(originX + offsetX, originY + offsetY);
  if (t.rotation) ctx.rotate(t.rotation * Math.PI / 180);
  const sc = (t.scale != null ? t.scale : 100) / 100;
  if (sc !== 1) ctx.scale(sc, sc);
  ctx.translate(-originX, -originY);

  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  try { ctx.drawImage(source, sx, sy, sw, sh, dx0, dy0, dw, dh); } catch (_) {}
  ctx.restore();
}