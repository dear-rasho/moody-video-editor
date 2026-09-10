export function initHomeController({ onNewProject }) {
  document.querySelector('#new-project-btn')?.addEventListener('click', onNewProject);
}
