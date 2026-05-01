
/**
 * B1 Form Actions Module
 * Actions: ClickButton* handlers, API calls, save form/danh ba
 */

import {
  setValidationState,
  markSaveButtonClean,
  markSaveButtonDirty,
  markDanhBaButtonClean,
  markDanhBaButtonDirty,
  markButtonSaving,
  showToast,
} from './b1-form-ui.js';
import {
  validateForm,
  collectFormData,
  updateLinksAndValidate,
} from './b1-form-core.js';
import {
  applyTrangThaiTaoCTStyle,
  setTrangThaiTaoCT,
  TraLoiThayDoi,
  GuiBaiThayDoi,
} from './b1-form-workflow.js';
import { taoFolderCongTrinh } from './b1-form-folders.js';
import { getVal } from './b1-form-utils.js';

// Field danh bạ phải kiểm tra không chứa dấu phẩy trước khi save
const COMMA_CHECK_FIELDS = [
  { id: 'b1_O_DanhBaWebsite',  label: 'Website' },
  { id: 'b1_O_DanhBaCongTy',   label: 'Cong ty' },
  { id: 'b1_O_DanhBaChiNhanh', label: 'Chi nhanh' },
  { id: 'b1_O_DanhBaHo',       label: 'Ho' },
  { id: 'b1_O_DanhBaTen',      label: 'Ten' },
  { id: 'b1_O_DanhBaSoPhone',  label: 'So Phone' },
  { id: 'b1_O_DanhBaSoMobile', label: 'So Mobile' },
];

// Map JS payload key → DOM element ID. Lưu ý: messageId cộng vào payload sau loop.
const DANHBA_FIELD_MAP = {
  danhBaWebsite:     'b1_O_DanhBaWebsite',
  danhBaCongTy:      'b1_O_DanhBaCongTy',
  danhBaChiNhanh:    'b1_O_DanhBaChiNhanh',
  danhBaHo:          'b1_O_DanhBaHo',
  danhBaTen:         'b1_O_DanhBaTen',
  danhBaSoPhone:     'b1_O_DanhBaSoPhone',
  danhBaSoMobile:    'b1_O_DanhBaSoMobile',
  danhBaMaCongTy:    'b1_O_MaCongTy',
  danhBaMotNhieu:    'b1_O_DanhBaMotNhieu',
  danhBaCachGuiFile: 'b1_O_DanhBaCachGuiFile',
  danhBaEmail:       'b1_O_EmailKhachHang',
  danhBaEmailCC:     'b1_O_EmailCC',
  danhBaToEmail:     'b1_O_ToEmail',
  danhBaKyHieuTiem:  'b1_O_KyHieuTiem',
};

// =============================================
// API CALL FUNCTIONS
// =============================================

/**
 * Tìm/sinh mã khách hàng MỚI tiếp theo
 */
export async function ClickButtonCheckKhachHangNew() {
  const maCongTyEl = document.getElementById("b1_O_MaCongTy");
  const congTrinhVTEl = document.getElementById("b1_O_CongTrinhVT");

  if (!maCongTyEl) return;

  const maKhachMax = maCongTyEl.value.trim();
  if (!maKhachMax) return;

  maCongTyEl.placeholder = "Đang tạo mã KH mới...";
  setValidationState(maCongTyEl, 'reset');

  try {
    const result = await window.ApiClient.checkKhachHangNew(maKhachMax);

    if (result.found) {
      maCongTyEl.value = result.ma_khach_moi;
      setValidationState(maCongTyEl, 'valid', 'Mã khách hàng mới hợp lệ');

      if (congTrinhVTEl) {
        congTrinhVTEl.value = result.cong_trinh_vt;
        setValidationState(congTrinhVTEl, 'valid', 'Đã tạo công trình mới');
      }

      const tenJPEl = document.getElementById("b1_O_TenCTrTiengNhat");
      if (tenJPEl) {
        tenJPEl.focus();
        setValidationState(tenJPEl, 'invalid', 'Nhập tên tiếng Nhật bên trên');
      }
    } else {
      setValidationState(maCongTyEl, 'invalid', 'Mã khách hàng tồn tại');
      maCongTyEl.placeholder = "Ma da ton tai hoac khong hop le";
    }
  } catch (error) {
    console.error('[B1Form] ClickButtonCheckKhachHangNew error:', error);
    setValidationState(maCongTyEl, 'invalid', 'Lỗi kết nối, thử lại');
    maCongTyEl.placeholder = "Loi ket noi, thu lai sau";
  }
}

/**
 * Tìm mã công trình MỚI tiếp theo
 */
export async function ClickButtonSearchNew() {
  const maCongTy = getVal("b1_O_MaCongTy");
  const congTrinhVTEl = document.getElementById("b1_O_CongTrinhVT");

  if (!maCongTy || !congTrinhVTEl) return;

  congTrinhVTEl.value = "";
  congTrinhVTEl.placeholder = "Đang tạo mã mới...";
  setValidationState(congTrinhVTEl, 'reset');

  try {
    const result = await window.ApiClient.searchNewProject(maCongTy);

    if (result.found) {
      congTrinhVTEl.value = result.ten_viet_tat_moi;
      setValidationState(congTrinhVTEl, 'valid', 'Đã tạo công trình mới');

      const tenJPEl = document.getElementById("b1_O_TenCTrTiengNhat");
      if (tenJPEl) {
        tenJPEl.focus();
        tenJPEl.placeholder = "Nhap ten cong trinh tieng Nhat";
        setValidationState(tenJPEl, 'invalid', 'Nhập tên tiếng Nhật bên trên');
      }

    } else {
      congTrinhVTEl.value = "";
      congTrinhVTEl.placeholder = "Công ty chưa có trong Tổng Hợp Báo Giá";
      setValidationState(congTrinhVTEl, 'invalid', 'Công ty chưa có trong Báo Giá');
    }
  } catch (error) {
    console.error('[B1Form] ClickButtonSearchNew error:', error);
    congTrinhVTEl.value = "";
    congTrinhVTEl.placeholder = "Lỗi tìm kiếm, thử lại sau";
    setValidationState(congTrinhVTEl, 'invalid', 'Lỗi tìm kiếm, thử lại');
  }
}

function setNotFoundState(congTrinhVTEl, tenJPEl, nhapString) {
  congTrinhVTEl.value = nhapString;
  setValidationState(congTrinhVTEl, 'invalid', 'Không tìm thấy trong TỔNG HỢP');
  if (tenJPEl) {
    tenJPEl.value = '';
    setValidationState(tenJPEl, 'invalid', 'Không tìm thấy trong TỔNG HỢP');
  }
}

/**
 * Tìm công trình CŨ đã tồn tại
 */
export async function ClickButtonKiemTraCongTrinhCoDangTonTai() {
  const congTrinhVTEl = document.getElementById("b1_O_CongTrinhVT");
  const tenJPEl = document.getElementById("b1_O_TenCTrTiengNhat");
  const maCongTy = getVal("b1_O_MaCongTy");

  if (!congTrinhVTEl || !maCongTy) return;

  const nhapString = congTrinhVTEl.value;
  if (!nhapString) return;

  congTrinhVTEl.value = "Dang tim kiem...";
  setValidationState(congTrinhVTEl, 'reset');
  setValidationState(tenJPEl, 'reset');

  try {
    const result = await window.ApiClient.searchOldProject(nhapString, maCongTy);

    if (result.found) {
      congTrinhVTEl.value = result.ten_viet_tat;
      setValidationState(congTrinhVTEl, 'valid', 'Tìm thấy trong TỔNG HỢP');

      if (tenJPEl) {
        tenJPEl.value = result.ten_tieng_nhat;
        setValidationState(tenJPEl, 'valid', 'Tìm thấy trong TỔNG HỢP');
      }

      updateLinksAndValidate();
    } else {
      setNotFoundState(congTrinhVTEl, tenJPEl, nhapString);
    }
  } catch (error) {
    console.error('[B1Form] ClickButtonKiemTraCongTrinhCoDangTonTai error:', error);
    setNotFoundState(congTrinhVTEl, tenJPEl, nhapString);
  }
}

/**
 * Tạo công trình mới vào sheet TONG HOP
 */
export async function ClickButtonTaoCongTrinhMoi() {
  const messageId = getVal("b1_O_MessageID");
  const maCongTy = getVal("b1_O_MaCongTy");
  const congTrinhVT = getVal("b1_O_CongTrinhVT");
  const tenCTrTiengNhat = getVal("b1_O_TenCTrTiengNhat");
  const toEmail = getVal("b1_O_ToEmail");
  const soPJ = document.getElementById("b1_O_SoPJ")?.value || null;

  if (!maCongTy || !congTrinhVT || !tenCTrTiengNhat) {
    return;
  }

  const tenJPEl = document.getElementById("b1_O_TenCTrTiengNhat");
  const statusEl = document.getElementById("b1_O_TrangThaiTaoCT");
  const projectParams = { messageId, maCongTy, congTrinhVT, tenCTrTiengNhat, toEmail, soPJ };

  function onCreateSuccess() {
    setValidationState(tenJPEl, 'valid', 'Đã ghi vào TỔNG HỢP');
    setTrangThaiTaoCT(true);
    updateLinksAndValidate();
  }

  function onCreateFail() {
    setTrangThaiTaoCT(false);
    setValidationState(tenJPEl, 'invalid', 'Tạo công trình thất bại');
  }

  if (statusEl) statusEl.value = 'Creating';
  applyTrangThaiTaoCTStyle();

  try {
    let result = await window.ApiClient.createProject({ ...projectParams, force: false });

    if (result.duplicate_warning) {
      if (!confirm(result.duplicate_warning + "\n\nBan co muon tiep tuc tao cong trinh?")) {
        onCreateFail();
        return;
      }
      result = await window.ApiClient.createProject({ ...projectParams, force: true });
    }

    result.success ? onCreateSuccess() : onCreateFail();
  } catch (error) {
    console.error('[B1Form] ClickButtonTaoCongTrinhMoi error:', error);
    onCreateFail();
  }
}

// =============================================
// SAVE DANH BA
// =============================================

export async function ClickButtonSaveDanhBa() {
  const messageId = getVal("b1_O_MessageID");
  if (!messageId) {
    alert('Chua co Message ID. Vui long bam Get Row truoc.');
    return;
  }

  const invalidFields = COMMA_CHECK_FIELDS.filter(f => getVal(f.id).includes(','));
  if (invalidFields.length > 0) {
    alert('Cac truong sau chua dau phay (,), vui long kiem tra lai:\n' + invalidFields.map(f => '- ' + f.label).join('\n'));
    return;
  }

  markButtonSaving('b1_N_SaveDanhBa');

  const payload = { messageId };
  for (const [key, id] of Object.entries(DANHBA_FIELD_MAP)) {
    payload[key] = getVal(id);
  }

  try {
    const result = await window.ApiClient.saveDanhBa(payload);

    if (result.success) {
      markDanhBaButtonClean();
    } else {
      console.error('[B1Form] Save danh ba failed:', result.message || result.error);
      alert('Loi: ' + (result.message || result.error));
      markDanhBaButtonDirty();
    }
  } catch (err) {
    console.error('[B1Form] Save danh ba error:', err);
    alert('Loi ket noi: ' + err.message);
    markDanhBaButtonDirty();
  }
}

// =============================================
// GUI THONG BAO
// =============================================

export async function ClickButtonGuiTinNhanDenNhanVien() {
  const S_NhanVien = getVal("b1_O_NhanVien");
  const S_CongTrinhVT = getVal("b1_O_CongTrinhVT");
  const btn = document.getElementById("b1_N_ButtonGuiThongBao");

  if (!S_NhanVien || S_NhanVien === "Chua chon NV ..." || S_NhanVien === "Other") {
    alert("Chua chon nhan vien !");
    return;
  }

  if (!S_CongTrinhVT) {
    alert("Chua co ten cong trinh !");
    return;
  }

  if (!window.NotificationSystem) {
    alert("Notification system chua san sang !");
    return;
  }

  const sessionId = window.FirebaseSync?.sessionId || '';
  const note = getVal("b1_O_GhiChuGuiNV");
  const extraFields = {
    congTy: getVal("b1_O_DanhBaCongTy"),
    chiNhanh: getVal("b1_O_DanhBaChiNhanh"),
    hoKhach: getVal("b1_O_DanhBaHo"),
  };
  try {
    const success = await window.NotificationSystem.sendNotification(S_NhanVien, S_CongTrinhVT, sessionId, note, extraFields);

    if (!success) {
      alert("Loi khi gui thong bao. Vui long thu lai.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '✓ Đã gửi';
      setTimeout(() => { btn.textContent = 'Gửi Thông Báo'; }, 2000);
    }
  } catch (err) {
    console.error('[B1Form] Gui thong bao error:', err);
    alert('Loi gui thong bao: ' + err.message);
  }
}

// =============================================
// SAVE FORM DATA
// =============================================

/** Lưu toàn bộ form B1 — validate, gọi API, tạo folder, cập nhật trạng thái */
export async function ClickButtonSaveRowPhienDich() {
  const S_Flow = getVal("b1_O_Flow");
  const skipValidation = ["Not Work", "Pay", "Delete Mail"].includes(S_Flow);

  if (!skipValidation && !validateForm()) {
    showToast('error', 'Con o trong');
    return;
  }

  markButtonSaving('b1_N_ButtonSaveRowPhienDich');

  const formData = collectFormData();
  formData.mailTraLoi = getVal('email_reply_jp');
  formData.mailNopBai = getVal('email_send_jp');

  try {
    const result = await window.ApiClient.saveFormDataCloudRun(formData);

    if (!result.success) {
      throw new Error(result.error || 'Failed to save');
    }

    showToast('success', '✓ Đã lưu thành công');
    markSaveButtonClean();
    TraLoiThayDoi();
    GuiBaiThayDoi();
    await taoFolderCongTrinh();
  } catch (error) {
    console.error('[B1Form] Error saving form:', error);
    showToast('error', 'Loi luu du lieu: ' + error.message);
    markSaveButtonDirty();
  }
}

// =============================================
// AI (placeholder)
// =============================================

/** Placeholder — chức năng AI đang phát triển */
// TODO: implement AI feature
export function hamchayAI() {
  alert('Chuc nang AI dang duoc phat trien');
}
