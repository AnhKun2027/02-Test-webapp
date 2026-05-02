
/**
 * B1 Form Employees — Employee selection + date/time handlers
 */

import { setValidationState } from './b1-form-ui.js';
import { tinhNhanNgay } from './b1-form-core.js';
import { getVal } from './b1-form-utils.js';

// =============================================
// DATE/TIME FUNCTIONS
// =============================================

const THU_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const THU_JP = ['日', '月', '火', '水', '木', '金', '土'];

// Map nhãn "Before X hours/days" → số giờ thực tế
const SO_GIO_MAP = {
  "Before 0 hours": 0,
  "Before 2 hours": 2,
  "Before 4 hours": 4,
  "Before 1 day":   24,
  "Before 2 days":  48,
  "Before 3 days":  72,
};

/** Helper: validate ngày (T7/CN = nghỉ) + set feedback message phù hợp */
function _validateNgayLamViec(ngayEl, dayOfWeek, ngayStr) {
  if (!ngayEl) return;
  const feedbackEl = document.getElementById("b1_NgayFeedback");
  const invalidEl = ngayEl.parentElement?.querySelector('.invalid-feedback');
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  if (isWeekend) {
    const tenThu = dayOfWeek === 0 ? 'Chủ Nhật' : 'Thứ 7';
    setValidationState(ngayEl, 'invalid');
    if (invalidEl) invalidEl.textContent = `Trúng ${tenThu} — ngày nghỉ`;
  } else {
    setValidationState(ngayEl, 'valid');
    if (feedbackEl) feedbackEl.textContent = tinhNhanNgay(ngayStr);
    if (invalidEl) invalidEl.textContent = 'Chưa chọn ngày';
  }
}

/** Helper: ghi nhãn thứ VN/JP vào 2 ô tương ứng */
function _setThuLabels(dayOfWeek) {
  const thuEl = document.getElementById("b1_O_Thu");
  if (thuEl) thuEl.value = THU_VN[dayOfWeek];

  const thuJPEl = document.getElementById("b1_O_ThuJP");
  if (thuJPEl) thuJPEl.value = THU_JP[dayOfWeek];
}

/** Helper: set default cho GioGui, ChonSoGioTruoc, TraLoi, GuiBai (chỉ khi ô trống) */
function _applyDateDefaults() {
  const gioGuiEl = document.getElementById("b1_O_GioGui");
  if (gioGuiEl && !gioGuiEl.value) gioGuiEl.value = "19:00";

  const chonSoGioEl = document.getElementById("b1_O_ChonSoGioTruoc");
  if (chonSoGioEl && !chonSoGioEl.value) {
    chonSoGioEl.value = "Before 0 hours";
    SoGioTruocThayDoi();
  }

  const traLoiEl = document.getElementById("b1_O_TraLoi");
  if (traLoiEl && !traLoiEl.value) {
    traLoiEl.value = "Now_Reply";
    setValidationState(traLoiEl, 'valid');
  }

  const guiBaiEl = document.getElementById("b1_O_GuiBai");
  if (guiBaiEl && !guiBaiEl.value) {
    guiBaiEl.value = "Wait_Send";
    setValidationState(guiBaiEl, 'valid');
  }
}

/** Xử lý khi NgayHoanThanh thay đổi — tính thứ, set giờ gửi, validate ngày nghỉ */
export function ChangeThuMay() {
  const ngayEl = document.getElementById("b1_O_NgayHoanThanh");
  const S_NgayHoanThanh = ngayEl?.value || '';

  if (!S_NgayHoanThanh) {
    setValidationState(ngayEl, 'invalid');
    const feedbackEl = document.getElementById("b1_NgayFeedback");
    if (feedbackEl) feedbackEl.textContent = 'Ngày đã chọn';
    return;
  }

  const dayOfWeek = new Date(S_NgayHoanThanh).getDay();
  _validateNgayLamViec(ngayEl, dayOfWeek, S_NgayHoanThanh);
  _setThuLabels(dayOfWeek);
  _applyDateDefaults();
}

/** Chuyển đổi "Before X hours/days" sang số giờ cụ thể */
export function SoGioTruocThayDoi() {
  const S_ChonSoGioTruoc = getVal("b1_O_ChonSoGioTruoc");
  const soGioTruocEl = document.getElementById("b1_O_SoGioTruoc");
  if (!soGioTruocEl) return;

  if (SO_GIO_MAP[S_ChonSoGioTruoc] !== undefined) {
    soGioTruocEl.value = SO_GIO_MAP[S_ChonSoGioTruoc];
  }
}

// =============================================
// NHAN VIEN VALIDATION
// =============================================

/** Validate khi chọn nhân viên — đánh dấu valid/invalid */
export function NhanVienThayDoi() {
  const nhanVienEl = document.getElementById("b1_O_NhanVien");
  if (!nhanVienEl) return;
  const value = nhanVienEl.value;
  const isChosen = value && value !== 'Chua chon NV ...';
  setValidationState(nhanVienEl, isChosen ? 'valid' : 'invalid');
}

// =============================================
// COMBINE TEN CONG TRINH ID
// =============================================

/** Helper: chuẩn hoá ô SoPJ — bỏ prefix PJ-/pj-, strip leading zeros nếu là số.
 * Vd: "012" → "PJ-12", "pj-007" → "PJ-7", "abc" → "abc" (giữ nguyên).
 * @param {string} raw - giá trị thô từ input
 * @returns {string} giá trị đã format */
function _formatSoPJ(raw) {
  const v = raw.trim();
  if (!v) return v;
  const m = v.match(/^[Pp][Jj]-(.*)$/);
  const body = m ? m[1] : v;
  if (/^\d+$/.test(body)) return 'PJ-' + (body.replace(/^0+/, '') || '0');
  return m ? 'PJ-' + body : v;
}

/** Ghép SoPJ + KyHieuTiem + NhapTenTiengNhat → TenCTrTiengNhat */
export function NhapTenCongTrinhID() {
  const soPJInput = document.getElementById("b1_O_SoPJ");
  if (soPJInput) soPJInput.value = _formatSoPJ(soPJInput.value);

  const S_SoPJ = soPJInput?.value || '';
  const S_KyHieuTiem = getVal("b1_O_KyHieuTiem");
  const S_NhapTenTiengNhat = getVal("b1_O_NhapTenTiengNhat");

  const tenCTrEl = document.getElementById("b1_O_TenCTrTiengNhat");
  if (tenCTrEl) {
    tenCTrEl.value = S_SoPJ + S_KyHieuTiem + S_NhapTenTiengNhat;
  }
}
