// ================================================================
//  js/workspace/mediaLibrary.js
//  Picks files, probes their real duration, then forwards items
//  with { file, url, type, duration } to onMedia.
// ================================================================

export function initMediaLibrary({ button, input, onMedia }) {
  button?.addEventListener('click', () => input.click());

  input?.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';        // reset early so user can re-pick same file

    const items = await Promise.all(
      files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const duration = await probeDuration(url, file.type);
        return { file, url, type: file.type, duration };
      })
    );

    onMedia(items);
  });
}

// ─── Probe the real media duration ─────────────────────────────
function probeDuration(url, type) {
  return new Promise((resolve) => {
    let el = null;
    if (type && type.indexOf('video/') === 0)      el = document.createElement('video');
    else if (type && type.indexOf('audio/') === 0) el = document.createElement('audio');
    else { resolve(0); return; }   // images → duration 0

    el.preload = 'metadata';
    el.muted = true;
    el.src = url;
    el.style.cssText =
      'position:absolute;width:1px;height:1px;opacity:0;' +
      'pointer-events:none;left:-9999px;top:-9999px;';

    let done = false;
    const finish = (dur) => {
      if (done) return;
      done = true;
      try { el.remove(); } catch (_) {}
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };

    el.addEventListener('loadedmetadata', () => finish(el.duration), { once: true });
    el.addEventListener('error',          () => finish(0),           { once: true });

    // Safety net (some browsers stall on exotic codecs)
    setTimeout(() => finish(el.duration), 6000);

    document.body.appendChild(el);
  });
}