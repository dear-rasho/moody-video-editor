// ================================================================
//  js/home/templatesShelf.js
// ================================================================

export function initTemplatesShelf(container) {
  if (!container) return;

  const templates = ['Cinematic', 'Travel', 'Social', 'Product', 'Minimal', 'Vlog', 'Shorts', 'Story'];

  container.replaceChildren();

  templates.forEach(name => {
    const item = document.createElement('article');
    item.className = 'template-card';
    item.setAttribute('role', 'listitem');

    const thumb = document.createElement('div');
    thumb.className = 'project-thumb';
    thumb.textContent = name;

    item.appendChild(thumb);
    container.appendChild(item);
  });
}