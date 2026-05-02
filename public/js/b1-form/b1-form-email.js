/**
 * B1 Form Email Preview — Tự động cập nhật email khi thay đổi form
 */

import { debounce } from '../core-utils.js';
import { getVal } from './b1-form-utils.js';

/**
 * Fields that affect email content
 * When any of these fields change, email preview will be regenerated
 */
export const EMAIL_RELATED_FIELDS = [
  'b1_O_CongViec',        // Loại công việc → quyết định template
  'b1_O_CongTrinhVT',     // Tên công trình VT → TENCONGTRINHDAYDU
  'b1_O_NhapTenTiengNhat', // Ô nhập tên tiếng Nhật → copy sang TenCTrTiengNhat
  'b1_O_TenCTrTiengNhat', // Tên tiếng Nhật (readonly) → TENCONGTRINHDAYDU
  'b1_O_DanhBaCongTy',    // Công ty → CONGTY
  'b1_O_DanhBaChiNhanh',  // Chi nhánh → CHINHANH
  'b1_O_DanhBaHo',        // Họ → HO
  'b1_O_NgayHoanThanh',   // Ngày hẹn khách → NGAYNOP (date part)
  'b1_O_ThuJP',           // Thứ tiếng Nhật → NGAYNOP (day of week part)
  'b1_O_GioGui'           // Giờ gửi → NGAYNOP (time part)
];

/**
 * Update email preview based on current form values
 * Called when any EMAIL_RELATED_FIELDS change
 */
export function updateEmailPreview() {
  // Check if generateEmailContent is available
  if (!window.generateEmailContent) {
    console.warn('[B1Form] generateEmailContent not available');
    return;
  }

  const congViec = getVal('b1_O_CongViec');

  // Skip if no CongViec selected
  if (!congViec) return;

  // Collect data for email generation
  const data = {
    congTrinhVT: getVal('b1_O_CongTrinhVT'),
    tenCTrTiengNhat: getVal('b1_O_TenCTrTiengNhat'),
    danhBaCongTy: getVal('b1_O_DanhBaCongTy'),
    danhBaChiNhanh: getVal('b1_O_DanhBaChiNhanh'),
    danhBaHo: getVal('b1_O_DanhBaHo'),
    // Date/Time fields for NGAYNOP auto-formatting
    // Format: "明日、12月17日（火）21:00 "
    ngayHoanThanh: getVal('b1_O_NgayHoanThanh'),
    thuJP: getVal('b1_O_ThuJP'),
    gioGui: getVal('b1_O_GioGui'),
    linkSend: getVal('b1_O_FolderSend')
  };

  // Generate email content
  const emailContent = window.generateEmailContent(congViec, data);

  // Update email textareas (Tab 2 & Tab 3 - both JP and VN). syncHighlight=true → dispatch
  // event để highlight layer đồng bộ với value mới (chỉ cần cho VN textarea).
  const TEXTAREA_MAP = [
    ['email_reply_jp', 'traLoi',   false],
    ['email_send_jp',  'nopBai',   false],
    ['email_reply_vn', 'traLoiVN', true],
    ['email_send_vn',  'nopBaiVN', true],
  ];
  TEXTAREA_MAP.forEach(([id, key, syncHighlight]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = emailContent[key] ?? '';
    if (syncHighlight) el.dispatchEvent(new Event('input'));
  });

  // Update subject cho Tab 2 (Reply) + Tab 3 (Submit) — JP/VN
  const SUBJECT_MAP = [
    ['subject_email_reply_jp', 'subjectTraLoiJP'],
    ['subject_email_reply_vn', 'subjectTraLoiVN'],
    ['subject_email_send_jp',  'subjectNopBaiJP'],
    ['subject_email_send_vn',  'subjectNopBaiVN'],
  ];
  SUBJECT_MAP.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = emailContent[key] || '';
  });
}

// Debounced version - 300ms delay for text input fields
const debouncedUpdateEmailPreview = debounce(updateEmailPreview, 300);

// Controller cho cleanup listeners — gọi setupEmailPreviewListeners lần 2 sẽ abort lần 1
let _listenerController = null;

/**
 * Setup event listeners for realtime email preview update
 */
export function setupEmailPreviewListeners() {
  _listenerController?.abort();
  _listenerController = new AbortController();
  const { signal } = _listenerController;

  EMAIL_RELATED_FIELDS.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (!element) {
      console.warn(`[B1Form] Email field not found: ${fieldId}`);
      return;
    }

    const tagName = element.tagName.toLowerCase();
    if (tagName === 'select') {
      element.addEventListener('change', updateEmailPreview, { signal });
    } else if (tagName === 'input' || tagName === 'textarea') {
      element.addEventListener('input', debouncedUpdateEmailPreview, { signal });
      element.addEventListener('blur', updateEmailPreview, { signal });
    }
  });
}

/** Cleanup email preview listeners */
export function destroyEmailPreviewListeners() {
  _listenerController?.abort();
  _listenerController = null;
}
