export function initHeaderBar({ exportButton }) {
  exportButton?.addEventListener('click', () => {
    exportButton.textContent = 'Export';
    exportButton.setAttribute('aria-label', 'Export project');
  });
}
