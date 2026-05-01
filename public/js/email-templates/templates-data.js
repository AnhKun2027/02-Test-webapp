/**
 * Email Templates Data — Barrel file
 *
 * Merges templates from sub-modules into single EMAIL_TEMPLATES object.
 * Consumers import EMAIL_TEMPLATES from this file (unchanged API).
 *
 * Sub-modules:
 *   templates-new.js      — New work, Render, Additional (Them)
 *   templates-revision.js — Revision work (Chinh)
 *   templates-special.js  — Special types + Other/Generic
 */

import { TEMPLATES_NEW } from './templates-new.js';
import { TEMPLATES_REVISION } from './templates-revision.js';
import { TEMPLATES_SPECIAL } from './templates-special.js';

export const EMAIL_TEMPLATES = {
  ...TEMPLATES_NEW,
  ...TEMPLATES_REVISION,
  ...TEMPLATES_SPECIAL
};
