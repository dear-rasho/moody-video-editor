export function initTemplatesShelf(container) {
  if (!container) return;
  const templates = ['Cinematic', 'Travel', 'Social', 'Product', 'Minimal', 'Vlog', 'Shorts', 'Story'];
  container.replaceChildren(...templates.map(name => {
    const item = document.createElement('article'); item.className = 'template-card'; item.setAttribute('role','listitem');
    item.innerHTML = `<div class="project-thumb">${name}</div>`; return item;
  }));
}
