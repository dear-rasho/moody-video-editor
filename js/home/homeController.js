// ================================================================
//  js/home/homeController.js
// ================================================================

export function initHomeController({ onNewProject }) {
  const btn = document.querySelector('#new-project-btn');
  if (btn && typeof onNewProject === 'function') {
    btn.addEventListener('click', onNewProject);
  }
}