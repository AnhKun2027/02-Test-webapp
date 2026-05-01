/** B1 Form Workflow — Flow/CongViec handlers, khung toggle, TrangThaiTaoCT */

import { PHAN_TRAM_MAP, TinhDiem } from './b1-form-diem.js';
import { setValidationState } from './b1-form-ui.js';
import { getVal } from './b1-form-utils.js';

// Công việc đặc biệt — không cần khung công trình. Dùng chung cho:
//   • KhiFlowThayDoi (lọc dropdown khi Flow = Not Work)
//   • _applyCongViecLockRules (khóa khung khi chọn các công việc này)
//   • filterCongViecOptions (luôn cho phép kể cả MaCongTy không phải ID/01)
export const CONGVIEC = {
  BAO_GIA: 'Bao Gia',
  OTHER: 'Other',
  KET_THUC: 'Hoan Thanh - Ket Thuc',
  HOAN_THIEN_69: 'Hoan Thien Nha 69 Only',
};
const SPECIAL_CONGVIEC = [CONGVIEC.BAO_GIA, CONGVIEC.OTHER, CONGVIEC.KET_THUC];

// State của TraLoi/GuiBai — dùng chung cho TraLoiThayDoi, GuiBaiThayDoi, _applyCongViecLockRules
export const TRA_LOI = {
  NO: 'No_Reply',
  WAIT: 'Wait_Reply',
  NOW: 'Now_Reply',
  REPLIED: 'REPLIED',
};
export const GUI_BAI = {
  NO: 'No_Send',
  WAIT: 'Wait_Send',
  SENT: 'SENT',
};
export const FLOW = {
  NOT_WORK: 'Not Work',
};

/**
 * Helper: Show/hide options in a select element based on a list
 */
function filterSelectOptions(selectEl, optionNames, showListed) {
  if (!selectEl) return;
  for (let i = 0; i < selectEl.childElementCount; i++) {
    const name = selectEl.children[i].textContent.trim();
    const inList = optionNames.includes(name);
    selectEl.children[i].style.display = (inList === showListed) ? 'unset' : 'none';
  }
}

// =============================================
// FLOW & CONGVIEC HANDLERS
// =============================================

/** Hiện/ẩn khung công trình
 * @param {boolean} visible - true = hiện, false = ẩn */
function setKhungVisible(visible) {
  const khungCongTrinh = document.getElementById("b1_KhungCongTrinh");
  if (khungCongTrinh) khungCongTrinh.style.display = visible ? "" : "none";
}

/** Xử lý khi Flow thay đổi — khóa/mở khung + lọc danh sách công việc */
export function KhiFlowThayDoi() {
  const S_Flow = getVal("b1_O_Flow");
  const list = document.getElementById("b1_O_CongViec");

  const isNotWork = S_Flow === FLOW.NOT_WORK;
  setKhungVisible(!isNotWork);
  filterSelectOptions(list, SPECIAL_CONGVIEC, isNotWork);
}

/** Lọc dropdown CongViec theo MaCongTy — ẩn option không phù hợp */
export function filterCongViecOptions() {
  const S_MaCongTy = getVal("b1_O_MaCongTy");
  const S1_MaCongTy = S_MaCongTy.split("-")[0];

  if (S1_MaCongTy !== "ID" && S1_MaCongTy !== "01") {
    filterSelectOptions(document.getElementById("b1_O_CongViec"), [
      "Goc Nhin - New", "Render Anh", "Them Goc Nhin", "Chinh Goc Nhin",
      "Chinh Anh", "Chinh Anh - Up Vat Lieu", "Chinh Anh - Up Du Lieu",
      "Chinh Anh - Up DL va VL", "Them Du Lieu",
      ...SPECIAL_CONGVIEC,
    ], true);
  }
}

/** Hiện/ẩn khung nhập ID (PJ + KyHieu + TenJP) khi công việc New + mã ID/01 */
export function HienKhungNhapID() {
  const S_MaCongTy = getVal("b1_O_MaCongTy");
  const S1_MaCongTy = S_MaCongTy.split("-")[0];
  const S_CongViec = getVal("b1_O_CongViec");
  const khungNhapID = document.getElementById("b1_KhungNhapID");
  const tenJPEl = document.getElementById("b1_O_TenCTrTiengNhat");

  const isNew = S_CongViec.includes('New');
  const isIdOr01 = (S1_MaCongTy === "ID" || S1_MaCongTy === "01");

  if (khungNhapID) khungNhapID.style.display = (isIdOr01 && isNew) ? "" : "none";
  if (tenJPEl) tenJPEl.readOnly = !(isNew && !isIdOr01);
}

/** Hiện/ẩn khung "Tạo Công Trình Mới" khi công việc chứa "New" */
export function HienKhungTaoCongTrinh() {
  const isNew = getVal("b1_O_CongViec").includes('New');
  const btnTaoCT = document.getElementById("b1_N_TaoCongTrinh");
  const khungTaoCT = document.getElementById("b1_KhungTaoCongTrinh");
  const statusEl = document.getElementById("b1_O_TrangThaiTaoCT");

  if (khungTaoCT) khungTaoCT.style.display = isNew ? '' : 'none';
  if (btnTaoCT) btnTaoCT.classList.toggle('b1-btn-highlight', isNew);
  if (!statusEl) return;

  if (isNew) {
    // Init status nếu chưa từng được tạo (giữ 'Created' nếu đã có)
    if (statusEl.value !== 'Created') statusEl.value = 'Not yet';
    applyTrangThaiTaoCTStyle();
  } else {
    statusEl.value = '';
  }
}

/** Helper: Khóa/mở khung + chuyển tab khi công việc thuộc nhóm đặc biệt */
function _applyCongViecLockRules(S_CongViec, S_Flow) {
  const shouldLock = SPECIAL_CONGVIEC.includes(S_CongViec) || S_Flow === FLOW.NOT_WORK;

  if (shouldLock) {
    setKhungVisible(false);
    if (S_CongViec === CONGVIEC.BAO_GIA || S_CongViec === CONGVIEC.OTHER) {
      const emailTypeEl = document.getElementById("email_ai_type");
      if (emailTypeEl) {
        const opt = emailTypeEl.querySelector('option[value="' + S_CongViec + '"]');
        if (opt) opt.hidden = false;
        emailTypeEl.value = S_CongViec;
      }
      if (typeof window.switchToTab === 'function') window.switchToTab('tab4');
    }
    if (S_CongViec === CONGVIEC.KET_THUC) {
      const guiBaiEl = document.getElementById("b1_O_GuiBai");
      if (guiBaiEl) guiBaiEl.value = GUI_BAI.NO;
      const traLoiEl = document.getElementById("b1_O_TraLoi");
      if (traLoiEl) traLoiEl.value = TRA_LOI.NOW;
      TraLoiThayDoi();
      GuiBaiThayDoi();
    }
  } else {
    setKhungVisible(true);
  }
}

/** Helper: Focus field tiếp theo dựa vào loại công việc (New vs Old) */
function _focusNextField(S_CongViec, S_MaCongTy) {
  if (S_CongViec.indexOf('New') > -1) {
    if (S_MaCongTy === '') {
      const maCongTyEl = document.getElementById("b1_O_MaCongTy");
      if (maCongTyEl) {
        maCongTyEl.focus();
        maCongTyEl.placeholder = "JK,HE,KE,...";
        setValidationState(maCongTyEl, 'invalid');
      }
    } else {
      setValidationState(document.getElementById("b1_O_MaCongTy"), 'valid');
      if (window.ClickButtonSearchNew) window.ClickButtonSearchNew();
    }
  } else {
    const congTrinhVTEl = document.getElementById("b1_O_CongTrinhVT");
    if (congTrinhVTEl) {
      congTrinhVTEl.focus();
      congTrinhVTEl.placeholder = "Nhập mã công trình hoặc số PJ";
    }
    setValidationState(document.getElementById("b1_O_MaCongTy"), S_MaCongTy ? 'valid' : 'reset');
  }
}

/** Helper: Set giá trị mặc định SoView, PhanTram, TraLoi theo loại công việc */
function _applyCongViecDefaults(S_CongViec) {
  const soViewEl = document.getElementById("b1_O_SoView");
  if (soViewEl) {
    soViewEl.value = S_CongViec.includes("Anh") ? 1 : 0;
    setValidationState(soViewEl, 'valid');
  }

  const phanTramEl = document.getElementById("b1_O_PhanTramDiem");
  if (phanTramEl) {
    phanTramEl.value = PHAN_TRAM_MAP[S_CongViec] ?? 100;
    setValidationState(phanTramEl, 'valid');
  }

  if (S_CongViec === CONGVIEC.HOAN_THIEN_69) {
    const traLoiEl = document.getElementById("b1_O_TraLoi");
    if (traLoiEl) traLoiEl.value = TRA_LOI.NO;
    TraLoiThayDoi();
  }
}

/**
 * Xử lý khi giá trị Công Việc thay đổi — validate, khóa/mở khung, set defaults
 */
export function KhiGiaTriCongViecThayDoi() {
  HienKhungNhapID();
  const S_Flow = getVal("b1_O_Flow");
  const S_CongViec = getVal("b1_O_CongViec");
  const S_MaCongTy = getVal("b1_O_MaCongTy");

  setValidationState(document.getElementById("b1_O_CongViec"), S_CongViec ? 'valid' : 'invalid');
  _applyCongViecLockRules(S_CongViec, S_Flow);

  const ngayEl = document.getElementById("b1_O_NgayHoanThanh");
  setValidationState(ngayEl, ngayEl?.value ? 'valid' : 'invalid');
  HienKhungTaoCongTrinh();

  _focusNextField(S_CongViec, S_MaCongTy);
  _applyCongViecDefaults(S_CongViec);

  // Tính lại DiemGoc và TongDiem khi CongViec thay đổi
  TinhDiem();
}

// =============================================
// TRA LOI / GUI BAI HANDLERS (đã chuyển từ core.js — phá circular dependency)
// =============================================

/** Helper: cập nhật trạng thái 1 cặp button + tab button dựa theo value của select.
 * @param {Object} cfg
 * @param {HTMLElement} cfg.selectEl - select chứa state (TraLoi hoặc GuiBai)
 * @param {string} cfg.btnId - ID button chính (vd btn_email_reply)
 * @param {string} cfg.tabBtnId - ID button tab (vd btn_tab_email_reply)
 * @param {string[]} cfg.disableStates - state làm button chính disabled (luôn kèm '')
 * @param {string} cfg.tabHideState - state làm tab button disabled */
function _applyButtonState({ selectEl, btnId, tabBtnId, disableStates, tabHideState }) {
  const value = selectEl?.value || '';
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.name = value;
    btn.textContent = value || "...";
    btn.disabled = value === '' || disableStates.includes(value);
  }
  const tabBtn = document.getElementById(tabBtnId);
  if (tabBtn) {
    tabBtn.disabled = (value === tabHideState);
  }
  setValidationState(selectEl, value ? 'valid' : 'invalid');
}

/** Xử lý khi TraLoi thay đổi — validate + enable/disable button reply */
export function TraLoiThayDoi() {
  const traLoiEl = document.getElementById("b1_O_TraLoi");
  const S_NgayHoanThanh = getVal("b1_O_NgayHoanThanh");
  const S_TraLoi = traLoiEl?.value || '';

  // Edge case riêng cho TraLoi: chọn Now_Reply mà chưa có ngày → cảnh báo + revert
  if (S_TraLoi === TRA_LOI.NOW && S_NgayHoanThanh === "") {
    alert('Ban chua dien thong tin nay NGAY GUI !');
    if (traLoiEl) traLoiEl.value = TRA_LOI.WAIT;
  }

  _applyButtonState({
    selectEl: traLoiEl,
    btnId: 'btn_email_reply',
    tabBtnId: 'btn_tab_email_reply',
    disableStates: [TRA_LOI.NO, TRA_LOI.REPLIED, TRA_LOI.WAIT],
    tabHideState: TRA_LOI.NO,
  });
}

/** Xử lý khi GuiBai thay đổi — validate + enable/disable button send */
export function GuiBaiThayDoi() {
  _applyButtonState({
    selectEl: document.getElementById("b1_O_GuiBai"),
    btnId: 'btn_email_send',
    tabBtnId: 'btn_tab_email_submit',
    disableStates: [GUI_BAI.NO, GUI_BAI.SENT, GUI_BAI.WAIT],
    tabHideState: GUI_BAI.NO,
  });
}

// =============================================
// TRANG THAI TAO CONG TRINH
// =============================================

/** Áp dụng màu nền cho ô trạng thái tạo công trình (Created/Creating/Not yet) */
export function applyTrangThaiTaoCTStyle() {
  const statusEl = document.getElementById('b1_O_TrangThaiTaoCT');
  const btnEl = document.getElementById('b1_N_TaoCongTrinh');
  if (!statusEl) return;

  const val = statusEl.value;
  if (val === 'Created') {
    statusEl.style.background = '#d4edda';
    statusEl.style.color = '#155724';
    if (btnEl) btnEl.disabled = true;
  } else if (val === 'Creating') {
    statusEl.style.background = '#cce5ff';
    statusEl.style.color = '#004085';
    if (btnEl) btnEl.disabled = true;
  } else {
    statusEl.style.background = '#fff3cd';
    statusEl.style.color = '#856404';
    if (btnEl) btnEl.disabled = false;
  }
}

/** @param {boolean} created - true = Created, false = Not yet */
export function setTrangThaiTaoCT(created) {
  const statusEl = document.getElementById('b1_O_TrangThaiTaoCT');
  if (statusEl) {
    statusEl.value = created ? 'Created' : 'Not yet';
  }
  applyTrangThaiTaoCTStyle();
}
