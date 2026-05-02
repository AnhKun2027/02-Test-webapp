/**
 * Tag System — Constants chung
 *
 * Tập trung magic strings (CSS classes, reserved tag names, messages)
 * để đổi tên thì sửa 1 chỗ thay vì search-replace nhiều file.
 */

export const TAG_CONSTANTS = Object.freeze({
  // Tag dành riêng — không phải combo số (_1, _2...)
  RESERVED: Object.freeze({
    CHECK: 'CHECK',
    SEND:  'SEND',
  }),

  // CSS class names dùng cho pill, dropdown, button
  CSS: Object.freeze({
    PILL:           'tag-pill',
    PILL_CHECK:     'tag-pill-CHECK',
    PILL_SEND:      'tag-pill-SEND',
    DROPDOWN:       'tag-dropdown',
    DROPDOWN_EMPTY: 'tag-dropdown-empty',
    DROPDOWN_ITEM:  'tag-dropdown-item',
    ADD_TAG_BTN:    'add-tag-btn',
  }),

  // Thông báo người dùng
  MSG: Object.freeze({
    NO_PRESET: 'Chưa có preset. Nhập số dòng vào ô Filter.',
  }),
});
