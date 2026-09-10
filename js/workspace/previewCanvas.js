export function initPreviewCanvas({ canvas, video, empty }) {
  const resize = () => { const r = canvas.getBoundingClientRect(); const dpr = devicePixelRatio || 1; canvas.width = Math.max(1, Math.floor(r.width*dpr)); canvas.height = Math.max(1, Math.floor(r.height*dpr)); };
  new ResizeObserver(resize).observe(canvas.parentElement); resize();
  video.addEventListener('loadeddata', () => empty.hidden = true);
  video.addEventListener('emptied', () => { empty.hidden = false; });

  function setMedia(item) {
    if (item.type.startsWith('video/')) {
      canvas.hidden = false;
      video.classList.remove('is-hidden');
      video.src = item.url;
      video.load();
      return;
    }

    if (item.type.startsWith('image/')) {
      const image = new Image();
      image.onload = () => {
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        canvas.hidden = false;
        video.classList.add('is-hidden');
        empty.hidden = true;
      };
      image.src = item.url;
      return;
    }

    video.classList.add('is-hidden');
    empty.hidden = false;
  }

  function clear() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    video.classList.add('is-hidden');
    empty.hidden = false;
  }

  function setVisible(visible) {
    canvas.hidden = !visible;
    video.classList.toggle('is-hidden', !visible);
  }

  return { setMedia, clear, setVisible };
}
