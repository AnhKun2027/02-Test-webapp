/**
 * DOM Utils — helpers chung cho thao tác DOM, dùng cross-folder
 * (email-composer, firebase-sync, ...) để tránh duplicate.
 */

/**
 * Trigger autosave bằng dispatch 'input' event lên element.
 * Dùng khi code gán `el.value = ...` thủ công và muốn các listener autosave/highlight
 * (vd vn-highlight, debounce save) fire như khi user gõ.
 * @param {HTMLElement|null} el
 */
export function triggerAutosave(el) {
  if (!el) return;
  el.dispatchEvent(new Event('input'));
}

window.triggerAutosave = triggerAutosave;
