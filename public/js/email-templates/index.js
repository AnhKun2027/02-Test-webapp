/** Email Templates — Entry point: re-export + window bindings */

import { EMAIL_TEMPLATES } from './templates-data.js';
import { generateEmailContent } from './generator.js';

// =============================================
// RE-EXPORT
// =============================================

export { EMAIL_TEMPLATES, generateEmailContent };

// =============================================
// WINDOW BINDINGS
// =============================================

window.EMAIL_TEMPLATES = EMAIL_TEMPLATES;
window.generateEmailContent = generateEmailContent;

console.log('[EmailTemplates] Module loaded');
