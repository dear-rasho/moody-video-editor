// ================================================================
//  js/home/recentProjects.js
//  Renders recent projects grid from localStorage.
// ================================================================

const STORAGE_KEY = 'offline-editor-projects';

export function initRecentProjects(container) {
  if (!container) return;

  let projects = [];
  try {
    projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (_) { projects = []; }

  const source = projects.length
    ? projects
    : [
        { name: 'Example Project', date: 'Ready' },
        { name: 'Untitled', date: 'Ready' }
      ];

  container.replaceChildren();

  source.forEach(project => {
    const card = document.createElement('article');
    card.className = 'project-card';

    const thumb = document.createElement('div');
    thumb.className = 'project-thumb';
    thumb.textContent = '▶';

    const meta = document.createElement('div');
    meta.className = 'project-meta';

    const name = document.createElement('p');
    name.className = 'project-name';
    name.textContent = project.name || 'Untitled';

    const date = document.createElement('p');
    date.className = 'project-date';
    date.textContent = project.date || '';

    meta.append(name, date);
    card.append(thumb, meta);
    container.appendChild(card);
  });
}