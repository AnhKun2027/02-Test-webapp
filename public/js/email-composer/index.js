/**
 * Email Composer — Entry point
 *
 * Re-export tất cả + window.* bindings + DOM ready init.
 * Load từ webapp.html qua <script type="module" src="js/email-composer/index.js">.
 */

// ============================================
// IMPORTS
// ============================================

import { emailAttachmentManager } from './email-attachment.js';
import {
  toggleEmailComposer, handlePasteImage,
  clickButtonSendEmail, clickButtonAttachFile,
  tinhNgayTre,
} from './email-send.js';
import {
  switchToTab, initEmailTabs,
  updateImagePreviewSection, initEmailComposer,
} from './email-tabs.js';
import {
  translateEmailWithAI, applyInstructionsOnly,
  initVnHighlight, initLanguageToggle,
  initReadonlyDoubleClick, destroyVnHighlight,
} from './email-translate.js';

// ============================================
// RE-EXPORT
// ============================================

export {
  emailAttachmentManager,
  toggleEmailComposer,
  handlePasteImage,
  clickButtonSendEmail,
  clickButtonAttachFile,
  tinhNgayTre,
  switchToTab,
  initEmailTabs,
  updateImagePreviewSection,
  initEmailComposer,
  translateEmailWithAI,
  applyInstructionsOnly,
  initVnHighlight,
  initLanguageToggle,
  initReadonlyDoubleClick,
};

// ============================================
// WINDOW BINDINGS
// ============================================

window.emailAttachmentManager = emailAttachmentManager;
window.toggleEmailComposer = toggleEmailComposer;
window.handlePasteImage = handlePasteImage;
window.clickButtonSendEmail = clickButtonSendEmail;
window.clickButtonAttachFile = clickButtonAttachFile;
window.initEmailTabs = initEmailTabs;
window.switchToTab = switchToTab;
window.initEmailComposer = initEmailComposer;
window.translateEmailWithAI = translateEmailWithAI;
window.initLanguageToggle = initLanguageToggle;
window.initVnHighlight = initVnHighlight;
window.updateImagePreviewSection = updateImagePreviewSection;

// ============================================
// DOM READY INITIALIZATION
// ============================================

function _initEmailModule() {
  initEmailComposer();
  initLanguageToggle();
  initReadonlyDoubleClick();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initEmailModule);
} else {
  _initEmailModule();
}

/** Cleanup tất cả email composer listeners + observers */
export function destroyEmailModule() {
  destroyVnHighlight();
}
window.destroyEmailModule = destroyEmailModule;

console.log('[EmailComposer] Initialized');
