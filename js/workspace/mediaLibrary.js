export function initMediaLibrary({ button, input, onMedia }) {
  button?.addEventListener('click', () => input.click());
  input?.addEventListener('change', () => {
    const files = [...input.files].map(file => ({ file, url: URL.createObjectURL(file), type: file.type }));
    onMedia(files); input.value = '';
  });
}
