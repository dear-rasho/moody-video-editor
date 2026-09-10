export function initRecentProjects(container) {
  if (!container) return;
  const projects = JSON.parse(localStorage.getItem('offline-editor-projects') || '[]');
  const source = projects.length ? projects : [{ name: 'Example Project', date: 'Ready' }, { name: 'Untitled', date: 'Ready' }];
  container.replaceChildren(...source.map(project => {
    const card = document.createElement('article'); card.className = 'project-card';
    card.innerHTML = `<div class="project-thumb">▶</div><div class="project-meta"><p class="project-name">${project.name}</p><p class="project-date">${project.date || ''}</p></div>`; return card;
  }));
}
