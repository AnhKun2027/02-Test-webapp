/**
 * Main Application Entry Point - CheckCongViec Webapp
 * Window bindings + DOMContentLoaded -> initApp()
 *
 * Chi la "cong vao" — khong chua logic, chi noi day cac module lai
 * Logic nam trong: app-core.js, app-save.js, app-init.js, app-toolbar.js
 */

import { appState, showLoading, hideLoading, loadText } from './app-core.js';
import { saveAndSyncAll } from './app-save.js';
import { exitSelectMode } from './app-toolbar.js';
import { initApp } from './app-init.js';

// === Window assignments — chi cac ham thuc su goi qua window tu module khac ===
window.appState = appState;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.loadText = loadText;          // Goi tu file-manager/file-loader.js (cross-folder)
window.saveAndSyncAll = saveAndSyncAll;
window.exitSelectMode = exitSelectMode;

// === Initialize on DOM ready ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

console.log('[App] Module loaded');
