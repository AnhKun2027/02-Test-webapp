/**
 * Tag System — Combo Preset management
 *
 * Xử lý việc tạo/sort/apply/switch combo presets (_1, _2, _3 + CHECK, SEND, ...).
 * Tương tác với rowCountInput (số dòng) và comboSelect (dropdown).
 *
 * Liên quan đến B1 Form: seed/xoá cache khi tạo/xoá combo, switch RTDB path
 * khi user chọn combo khác.
 */

import { tagState, syncWindowCombos } from './tag-state.js';
import { filterByTags } from './tag-filter.js';

/** Nhận biết combo dạng số: _1, _2, _10... */
const NUMERIC_COMBO_RE = /^_\d+$/;
const isNumericCombo = c => NUMERIC_COMBO_RE.test(c);

/** Lấy value từ combo (hỗ trợ cả string và object {value}) */
const _comboValue = c => (typeof c === 'string' ? c : c.value);

/** Phân loại combos thành numeric vs non-numeric, giữ thứ tự gốc trong mỗi nhóm */
function _partitionCombos(combos) {
  const numeric = [];
  const nonNumeric = [];
  for (const c of combos) {
    if (isNumericCombo(_comboValue(c))) numeric.push(c);
    else nonNumeric.push(c);
  }
  return { numeric, nonNumeric };
}

/**
 * Sort combos in-place:
 * - Numeric (_1, _2, _3...) lên trước, sort theo số tự nhiên (_2 trước _10)
 * - Non-numeric (CHECK, SEND...) giữ nguyên thứ tự, xuống cuối
 *
 * Giữ in-place (mutate mảng gốc) để caller không phải gán lại.
 */
function sortCombos(combos) {
  const { numeric, nonNumeric } = _partitionCombos(combos);
  numeric.sort((a, b) => parseInt(_comboValue(a).slice(1), 10) - parseInt(_comboValue(b).slice(1), 10));
  // In-place: xoá sạch combos rồi push lại theo thứ tự mới
  combos.length = 0;
  combos.push(...numeric, ...nonNumeric);
  return combos;
}

/**
 * Load saved combos — dữ liệu thực tế từ Firebase listener
 * Hàm này chỉ init empty array + populate dropdown
 */
export function loadSavedCombos() {
  _commitCombos(tagState.tagFilterCombos || []);
}

/**
 * Cập nhật combo list trong RAM (chờ Ctrl+S để lưu RTDB)
 */
export function setCombos(combos) {
  tagState.tagFilterCombos = combos || [];
  syncWindowCombos();
}

/**
 * Single source of truth khi update combos: set + sync window + snapshot previousCombos.
 * Tách ra để 4 caller (loadSavedCombos, applyRemotePresets, addComboPreset, app-toolbar) khỏi
 * lệch nhau (trước đây 1 nơi quên set previousCombos → seed cache _b1FormCache lệch).
 * @param {Array} newCombos
 * @param {Object} [opts]
 * @param {boolean} [opts.populateUI=true] - gọi populateComboSelect sau khi set
 */
export function _commitCombos(newCombos, { populateUI = true } = {}) {
  tagState.tagFilterCombos = newCombos || [];
  syncWindowCombos();
  tagState.previousCombos = [...tagState.tagFilterCombos];
  if (populateUI) populateComboSelect();
}

/**
 * Apply presets from Firebase (called by listener)
 * @param {Array} presets - Array of preset strings from RTDB
 */
export function applyRemotePresets(presets) {
  const sorted = sortCombos(Array.isArray(presets) ? [...presets] : []);
  _commitCombos(sorted);

  // Luôn cập nhật rowCountInput kể cả khi rỗng → tránh UI lệch
  const rowCountInput = document.getElementById('rowCountInput');
  const numericCombos = tagState.tagFilterCombos.filter(isNumericCombo);
  if (rowCountInput) {
    rowCountInput.value = numericCombos.length > 0 ? numericCombos.length : '';
  }
}

/**
 * Populate #comboSelect dropdown với combo đang có
 * Thứ tự: _N combos trước, non-numeric (CHECK, SEND...) sau
 */
export function populateComboSelect() {
  const select = document.getElementById('comboSelect');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = '<option value="">ALL</option>';
  const { numeric, nonNumeric } = _partitionCombos(tagState.tagFilterCombos);
  [...numeric, ...nonNumeric].forEach(combo => {
    const value = _comboValue(combo);
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  // Restore selected value nếu vẫn còn
  if (currentValue && tagState.tagFilterCombos.includes(currentValue)) {
    select.value = currentValue;
  }
}

/**
 * Generate combo presets từ rowCountInput — chỉ lưu RAM, chờ Ctrl+S
 * Input: 3 → tagFilterCombos = ["_1", "_2", "_3"]
 *
 * Select chỉ có options "-", 2, 3, ..., 9 → n không thể = 1 từ UI,
 * nên không cần kiểm tra n === 1.
 */
const MAX_COMBO_COUNT = 9;

export function addComboPreset() {
  const rowCountInput = document.getElementById('rowCountInput');
  const n = Math.min(parseInt(rowCountInput?.value, 10) || 0, MAX_COMBO_COUNT);

  const oldCombos = tagState.previousCombos || [];

  // Giữ lại combo non-numeric (CHECK, SEND, OK...) đã có
  const nonNumeric = oldCombos.filter(c => !isNumericCombo(c));

  if (n <= 0) {
    tagState.tagFilterCombos = [...nonNumeric];
  } else {
    tagState.tagFilterCombos = [];
    for (let i = 1; i <= n; i++) {
      tagState.tagFilterCombos.push('_' + i);
    }
    tagState.tagFilterCombos.push(...nonNumeric);
  }
  populateComboSelect();

  // So sánh combo cũ/mới để seed/remove cache
  const newCombos = [...tagState.tagFilterCombos];
  const toAdd = newCombos.filter(c => !oldCombos.includes(c));
  const toRemove = oldCombos.filter(c => !newCombos.includes(c));

  // Seed cache cho combo mới (để switchB1FormCombo có data đúng)
  if (toAdd.length > 0 && window.FirebaseSync) {
    const baseData = window.FirebaseSync._b1FormCache[''] || {};
    const baseId = window.FirebaseSync.sessionId || '';
    toAdd.forEach(combo => {
      if (!window.FirebaseSync._b1FormCache[combo]) {
        window.FirebaseSync._b1FormCache[combo] = {
          ...baseData,
          messageID: baseId + combo
        };
      }
    });
  }

  // Xoá cache combo bị xoá
  if (toRemove.length > 0 && window.FirebaseSync) {
    toRemove.forEach(combo => {
      delete window.FirebaseSync._b1FormCache[combo];
    });
  }

  // Cập nhật RAM (đã populateComboSelect ở dòng 145 phía trên — skip để khỏi lặp)
  _commitCombos(tagState.tagFilterCombos, { populateUI: false });
}

/**
 * Load and apply selected combo preset
 * Switches B1 Form RTDB path to match the selected combo
 */
export function loadComboPreset() {
  const select = document.getElementById('comboSelect');
  if (!select) return;

  const combo = select.value || '';

  // Determine new active combo (null cho ALL, "_N" cho combo số)
  const newCombo = (combo && combo !== '--') ? combo : null;
  const comboIsNumeric = newCombo && isNumericCombo(newCombo);

  // Non-_N tags (CHECK, OK...): chỉ filter, không switch B1 Form
  if (newCombo && !comboIsNumeric) {
    filterByTags([combo]);
    return;
  }

  // Switch B1 Form RTDB path (_N format only)
  // NOTE: KHÔNG update messageID trước switchB1FormCombo — nó save old form trước,
  // sửa UI trước khi switch sẽ ghi đè messageID của combo cũ.
  // applyB1FormData() sẽ set messageID đúng từ RTDB data.
  if (window.FirebaseSync && window.FirebaseSync.sessionId) {
    window.FirebaseSync.switchB1FormCombo(newCombo, (data) => {
      if (data) {
        window.FirebaseSync.applyB1FormData(data);
        if (typeof window.applyTrangThaiTaoCTStyle === 'function') window.applyTrangThaiTaoCTStyle();
      } else {
        // Chưa có data ở path mới (vd. switching sang ALL/base lần đầu)
        // → tự update messageID thủ công
        const messageIdInput = document.getElementById('b1_O_MessageID');
        if (messageIdInput) {
          let baseId = messageIdInput.value;
          const idx = baseId.indexOf('_');
          if (idx !== -1) baseId = baseId.substring(0, idx);
          messageIdInput.value = newCombo ? baseId + newCombo : baseId;
        }
      }
    });
  }

  // Apply filter — single exit point: ALL → [], _N → [combo]
  filterByTags(newCombo ? [combo] : []);
}
