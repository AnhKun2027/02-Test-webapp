/**
 * Email Composer — Constants chung
 *
 * Tập trung danh sách textarea ID dùng ở nhiều file (email-tabs, email-translate)
 * để thêm/bớt tab thì sửa 1 chỗ.
 */

export const EMAIL_TEXTAREA_IDS = Object.freeze({
  // Textarea JP nhận paste image (init paste handler)
  PASTE_TARGETS: Object.freeze([
    'email_customer_jp',
    'email_reply_jp',
    'email_send_jp',
    'email_ai_jp',
  ]),

  // Textarea VN có syntax highlight overlay
  VN_HIGHLIGHT: Object.freeze([
    'email_reply_vn',
    'email_send_vn',
    'email_ai_vn',
  ]),

  // Textarea readonly cho phép double-click để edit
  READONLY_EDITABLE: Object.freeze([
    'email_customer_vn',
    'email_reply_jp',
    'email_reply_vn',
    'email_send_jp',
    'email_send_vn',
  ]),
});
