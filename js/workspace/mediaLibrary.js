// ================================================================
//  js/workspace/mediaLibrary.js
//  Picks files, probes duration. Images get a default duration.
// ================================================================

const DEFAULT_IMAGE_DURATION = 3;

export function initMediaLibrary({ button, input, onMedia }) {
  button?.addEventListener('click', () => input.click());

  input?.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';

    const items = await Promise.all(
      files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const isImage = file.type.indexOf('image/') === 0;
        let duration;

        if (isImage) {
          duration = DEFAULT_IMAGE_DURATION;
          // 🆕 Preload image to force browser to cache it
          try {
            const img = new Image();
            img.src = url;
            await new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 3000);
            });
          } catch (_) {}
        } else {
          duration = await probeDuration(url, file.type);
        }
        return { file, url, type: file.type, duration, name: file.name };
      })
    );

    onMedia(items);
  });
}

function probeDuration(url, type) {
  return new Promise((resolve) => {
    let el = null;
    if (type && type.indexOf('video/') === 0)      el = document.createElement('video');
    else if (type && type.indexOf('audio/') === 0) el = document.createElement('audio');
    else { resolve(0); return; }

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
    setTimeout(() => finish(el.duration), 6000);

    document.body.appendChild(el);
  });
}