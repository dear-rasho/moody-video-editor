// ================================================================
//  js/workspace/headerBar.js
// ================================================================

export function initHeaderBar({ exportButton }) {
  if (!exportButton) return;

  // Ensure the button has proper state
  exportButton.textContent = 'Export';
  exportButton.setAttribute('aria-label', 'Export project');

  // Actual handler is attached in app.js (openExportPanel)
}