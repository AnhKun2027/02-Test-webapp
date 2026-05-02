/**
 * Tag System — Shared State
 *
 * Dùng object wrapper (tagState) để chia sẻ state giữa các file con.
 * Lý do chọn object thay vì `let` export: re-assign property không phá vỡ
 * reference, và dễ đọc/ghi cross-file mà không cần getter/setter riêng lẻ.
 */

export const tagState = {
  // Các tag đang được lọc (AND logic khi multi-select)
  activeTagFilters: [],

  // Danh sách combo presets — ví dụ: ["_1", "_2", "_3", "CHECK", "SEND"]
  tagFilterCombos: [],

  // AbortController cho listener "click outside" của dropdown
  dropdownController: null,

  // Lưu combo trước khi thay đổi — dùng bởi combo-presets.js và app-toolbar.js
  previousCombos: []
};

/**
 * Sync window.tagFilterCombos với tagState.tagFilterCombos
 * Gọi sau mỗi lần re-assign tagState.tagFilterCombos
 * (vì window.* giữ reference mảng cũ khi ta gán array mới)
 */
export function syncWindowCombos() {
  window.tagFilterCombos = tagState.tagFilterCombos;
}

/**
 * Sync window.activeTagFilters với tagState.activeTagFilters
 */
export function syncWindowActiveFilters() {
  window.activeTagFilters = tagState.activeTagFilters;
}

// Init window bindings lần đầu
syncWindowCombos();
syncWindowActiveFilters();
