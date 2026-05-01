
/**
 * B1 Form Core Module
 * Core: loadB1Form, SauKhiGetRow, form rendering, tab switching,
 * validation logic, flow/congviec handlers, folder path calculation
 */

import { generateB1FormHTML } from './b1-form-template.js';
import { setupEmailPreviewListeners } from './b1-form-email.js';
import {
  setValidationState,
  markSaveButtonDirty,
  markDanhBaButtonDirty,
  setupGuiThongBaoListener,
} from './b1-form-ui.js';
import {
  HienKhungNhapID,
  KhiFlowThayDoi, filterCongViecOptions,
  HienKhungTaoCongTrinh,
} from './b1-form-workflow.js';
import { retryUntilReady, getVal } from './b1-form-utils.js';

// Đường dẫn gốc folder công trình — gán 1 lần bởi tinhDuongDanFolder()
let _b1LinkFolderCT = '';

// Delay trước khi focus field invalid — chờ tab switch animation xong (~150ms)
const TAB_SWITCH_FOCUS_DELAY = 150;

// Trạng thái ô DiemDuTinh — value khớp <option> trong template HTML.
// Pending = user chưa xác nhận điểm; Confirmed = đã chốt điểm chính thức.
const DIEM_DU_TINH = {
  PENDING: 'Du Tinh',
  CONFIRMED: 'Chinh Thuc',
};

// Đường dẫn server gốc cho 3 loại folder (mail/CT/gửi). Đổi tên server → sửa 1 chỗ.
const SERVER_PATHS = {
  LINK_DEN: '\\\\Server-pc\\g-everyone\\A-file den',
  LINK_CT: '\\\\server-pc\\10 futagoBIM 注文',
  LINK_DI: '\\\\Server-pc\\g-everyone\\B-file di',
  ID_SUBFOLDER: '02-A\\01-data cong viec',
};

// Controller setup email preview — abort để hủy retry khi loadB1Form chạy lại
let _emailController = null;

/** Lấy đường dẫn folder công trình hiện tại */
export function getB1LinkFolderCT() { return _b1LinkFolderCT; }

// =============================================
// FORM STATE
// =============================================

// Field gắn oninput → tính lại đường dẫn folder. extra: hàm gọi thêm trước tinhDuongDanFolder()
const FOLDER_TRIGGER_FIELDS = [
  { id: 'b1_O_MaCongTy',        extra: HienKhungNhapID },
  { id: 'b1_O_CongTrinhVT' },
  { id: 'b1_O_TenCTrTiengNhat' },
];

/** Khởi tạo state form — ẩn loading, gắn input listeners cho MaCongTy/CongTrinhVT/TenJP */
export function initFormState() {
  const loadingEl = document.getElementById("b1_loading");
  if (loadingEl) loadingEl.style.display = "none";

  FOLDER_TRIGGER_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el) return;
    el.oninput = () => {
      f.extra?.();
      tinhDuongDanFolder();
    };
  });
}

// =============================================
// FOLDER PATH CALCULATION
// =============================================

/** Tính đường dẫn 3 folder (Mail/Server/Send) từ MaCongTy + CongTrinhVT + TenJP */
export function tinhDuongDanFolder() {
  const messageId = getVal("b1_O_MessageID");
  const maCongTy = getVal("b1_O_MaCongTy");
  const congTrinhVT = getVal("b1_O_CongTrinhVT");
  const tenCTrTiengNhat = getVal("b1_O_TenCTrTiengNhat");

  const baseMessageId = messageId.split('_')[0];
  const tenCtddNew = `${congTrinhVT}\u3000${tenCTrTiengNhat}`;

  let linkFolderCongTy;
  const maCongTyPrefix = maCongTy.split('-')[0];

  if (maCongTyPrefix === 'ID') {
    const parts = maCongTy.split('-');
    const part1 = parts[1] || '';
    const part2 = parts[2] || '';
    linkFolderCongTy = `${SERVER_PATHS.LINK_CT}\\${SERVER_PATHS.ID_SUBFOLDER}\\${part1}-${part2}`;
  } else {
    linkFolderCongTy = `${SERVER_PATHS.LINK_CT}\\${maCongTy}`;
  }

  const linkDen = baseMessageId ? `${SERVER_PATHS.LINK_DEN}\\${baseMessageId}` : '';
  const linkCongTrinh = (maCongTy && congTrinhVT && tenCTrTiengNhat) ? `${linkFolderCongTy}\\${tenCtddNew}` : '';
  const linkDi = (congTrinhVT && messageId) ? `${SERVER_PATHS.LINK_DI}\\${congTrinhVT}_${messageId}` : '';

  const folderMailEl = document.getElementById("b1_O_FolderMail");
  const folderServerEl = document.getElementById("b1_O_FolderServer");
  const folderSendEl = document.getElementById("b1_O_FolderSend");

  if (folderMailEl) folderMailEl.value = linkDen;
  if (folderServerEl) folderServerEl.value = linkCongTrinh;
  if (folderSendEl) folderSendEl.value = linkDi;

  _b1LinkFolderCT = linkCongTrinh;
}

/** Tính lại đường dẫn folder + validate 3 ô MaCongTy/CongTrinhVT/TenJP */
export function updateLinksAndValidate() {
  tinhDuongDanFolder();

  const maCongTy = getVal("b1_O_MaCongTy");
  const congTrinhVT = getVal("b1_O_CongTrinhVT");
  const tenCTrTiengNhat = getVal("b1_O_TenCTrTiengNhat");

  if (maCongTy && congTrinhVT && tenCTrTiengNhat) {
    setValidationState(document.getElementById("b1_O_MaCongTy"), 'valid');
    setValidationState(document.getElementById("b1_O_CongTrinhVT"), 'valid');
    setValidationState(document.getElementById("b1_O_TenCTrTiengNhat"), 'valid');
  }
}

// =============================================
// VALIDATION
// =============================================

/** Validate toàn bộ form, chuyển tab + focus vào field lỗi đầu tiên
 * @returns {boolean} true nếu form hợp lệ */
export function validateForm() {
  const fieldsToValidate = document.querySelectorAll("#b1_userform input[required], #b1_userform select[required], #b1_userform textarea[required]");

  let isValid = true;
  let firstInvalid = null;
  fieldsToValidate.forEach((el) => {
    if (el.checkValidity()) {
      setValidationState(el, 'valid');
    } else {
      setValidationState(el, 'invalid');
      if (!firstInvalid) firstInvalid = el;
      isValid = false;
    }
  });

  const diemDuTinhEl = document.getElementById("b1_O_DiemDuTinh");
  if (diemDuTinhEl && diemDuTinhEl.value === DIEM_DU_TINH.PENDING) {
    setValidationState(diemDuTinhEl, 'invalid', `Chưa xác nhận điểm — chọn ${DIEM_DU_TINH.CONFIRMED}`);
    if (!firstInvalid) firstInvalid = diemDuTinhEl;
    isValid = false;
  } else if (diemDuTinhEl) {
    setValidationState(diemDuTinhEl, 'valid');
  }

  if (firstInvalid) {
    const tabPane = firstInvalid.closest('.tab-pane');
    if (tabPane) {
      const tabId = tabPane.id;
      const tabLink = document.querySelector(`[href="#${tabId}"]`) || document.querySelector(`[data-target="#${tabId}"]`);
      if (tabLink) tabLink.click();
    }
    setTimeout(() => firstInvalid.focus(), TAB_SWITCH_FOCUS_DELAY);
  }

  return isValid;
}

// Map JS key (payload) → DOM element ID. Thứ tự giữ nguyên cho payload backend.
const FORM_FIELD_MAP = {
  messageID:       'b1_O_MessageID',
  maCongTy:        'b1_O_MaCongTy',
  dinhKemTraLoi:   'b1_O_DinhKemTraLoi',
  traLoi:          'b1_O_TraLoi',
  guiBai:          'b1_O_GuiBai',
  congTrinhVT:     'b1_O_CongTrinhVT',
  tenCTrTiengNhat: 'b1_O_TenCTrTiengNhat',
  congViec:        'b1_O_CongViec',
  soGioTruoc:      'b1_O_SoGioTruoc',
  ngayHoanThanh:   'b1_O_NgayHoanThanh',
  thu:             'b1_O_Thu',
  thuJP:           'b1_O_ThuJP',
  gioGui:          'b1_O_GioGui',
  flow:            'b1_O_Flow',
  folderMail:      'b1_O_FolderMail',
  folderServer:    'b1_O_FolderServer',
  folderSend:      'b1_O_FolderSend',
  nhanVien:        'b1_O_NhanVien',
  soNha:           'b1_O_SoNha',
  soView:          'b1_O_SoView',
  diemGoc:         'b1_O_DiemGoc',
  phanTramDiem:    'b1_O_PhanTramDiem',
  heSo:            'b1_O_HeSo',
  tongDiem:        'b1_O_TongDiem',
  diemDuTinh:      'b1_O_DiemDuTinh',
  soLoi:           'b1_O_SoLoi',
  danhGia:         'b1_O_DanhGia',
};

/** Thu thập tất cả giá trị form B1 thành object để gửi API
 * @returns {Object} formData */
export function collectFormData() {
  const data = {};
  for (const [key, id] of Object.entries(FORM_FIELD_MAP)) {
    data[key] = getVal(id);
  }
  // Field đặc biệt — default 'No' nếu rỗng (giữ nguyên hành vi cũ)
  data.ghiChuCongViec = document.getElementById('b1_O_GhiChuCongViec')?.value || 'No';
  // Caller (ClickButtonSaveRowPhienDich) gán mailTraLoi/mailNopBai sau collect
  data.mailTraLoi = '';
  data.mailNopBai = '';
  return data;
}

// =============================================
// DATE HELPER (used by ChangeThuMay in employees)
// =============================================

/** Đếm số ngày làm việc (bỏ T7/CN) giữa 2 ngày
 * @param {Date} from - Ngày bắt đầu
 * @param {Date} to - Ngày kết thúc
 * @returns {number} Số ngày làm việc */
export function demNgayLamViec(from, to) {
  let count = 0;
  const step = from < to ? 1 : -1;
  const d = new Date(from);
  d.setDate(d.getDate() + step);
  while (step > 0 ? d <= to : d >= to) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + step);
  }
  return count;
}

/** Tính nhãn ngày so với hôm nay ("Hôm nay" / "Còn X ngày" / "Quá hạn X ngày")
 * @param {string} dateStr - Ngày dạng YYYY-MM-DD
 * @returns {string} Nhãn ngày */
export function tinhNhanNgay(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return "Hôm nay";

  const soNgay = demNgayLamViec(today, target);
  if (target > today) return `Còn ${soNgay} ngày`;
  return `Quá hạn ${soNgay} ngày`;
}

// =============================================
// POST-LOAD PROCESSING
// =============================================

/** Xử lý sau khi GetRow — validate DanhBa, lọc CongViec, tính folder path */
export function SauKhiGetRow() {
  KhiFlowThayDoi();

  ["b1_O_DanhBaCongTy", "b1_O_DanhBaHo", "b1_O_DanhBaCachGuiFile"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value === "") setValidationState(el, 'invalid');
  });

  filterCongViecOptions();
  HienKhungNhapID();
  HienKhungTaoCongTrinh();
  tinhDuongDanFolder();
}

// =============================================
// LOAD B1 FORM (main entry point)
// =============================================

/** Helper: Gắn sự kiện click cho tab switching (vanilla JS thay Bootstrap) */
function _setupTabSwitching() {
  document.querySelectorAll('#b1_pills-tab a[data-toggle="pill"]').forEach(tabLink => {
    tabLink.onclick = (e) => {
      e.preventDefault();
      document.querySelectorAll('#b1_pills-tab a').forEach(a => a.classList.remove('active'));
      document.querySelectorAll('#b1_pills-tabContent .tab-pane').forEach(p => {
        p.classList.remove('show', 'active');
      });
      tabLink.classList.add('active');
      const target = document.querySelector(tabLink.getAttribute('href'));
      if (target) target.classList.add('show', 'active');
    };
  });
}

/** Helper: Gắn change/input listeners để đánh dấu unsaved changes (form + danh bạ) */
function _setupChangeListeners() {
  const danhBaFieldIds = [
    'b1_O_DanhBaWebsite', 'b1_O_DanhBaCongTy', 'b1_O_DanhBaChiNhanh',
    'b1_O_DanhBaHo', 'b1_O_DanhBaTen', 'b1_O_DanhBaSoPhone',
    'b1_O_DanhBaSoMobile',
    'b1_O_DanhBaMotNhieu', 'b1_O_DanhBaCachGuiFile'
  ];
  const danhBaFieldSet = new Set(danhBaFieldIds);

  // Form-level listeners — đánh dấu Save dirty (trừ danh bạ fields)
  const form = document.getElementById('b1_userform');
  if (form) {
    const onFormDirty = (e) => {
      if (!window.FirebaseSync?.isB1FormSyncing && !danhBaFieldSet.has(e.target.id)) markSaveButtonDirty();
    };
    // Chỉ 'input' — đã bao gồm change của select/checkbox; tránh fire 2 lần.
    form.addEventListener('input', onFormDirty);
  }

  // Danh bạ field listeners — đánh dấu DanhBa dirty riêng
  const onDanhBaDirty = () => {
    if (!window.FirebaseSync?.isB1FormSyncing) markDanhBaButtonDirty();
  };
  danhBaFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = onDanhBaDirty;
    el.oninput  = onDanhBaDirty;
  });
}

// loadB1Form chỉ được gọi 1 lần khi initAll() — gọi lại sẽ duplicate listener.
export async function loadB1Form() {
  const container = document.getElementById('b1FormContainer');
  if (!container) return;

  // Reset đường dẫn gốc
  _b1LinkFolderCT = '';

  try {
    container.innerHTML = generateB1FormHTML();

    _setupTabSwitching();
    _setupChangeListeners();

    // Hiện button "Tạo Folder Mới" nếu đang chạy trong Electron
    if (window.electronAPI) {
      const row = document.getElementById('b1_row_TaoFolder');
      if (row) row.style.display = '';
    }

    setupGuiThongBaoListener();
    initFormState();

    // Setup realtime email preview listeners — cancel retry của loadB1Form lần trước
    _emailController?.abort();
    _emailController = retryUntilReady(
      setupEmailPreviewListeners,
      () => !!window.generateEmailContent,
      'generateEmailContent', 5, 200,
    );

    // loadEmployeesDropdown + initB1FormSync called from index.js (avoid circular dep)

  } catch (error) {
    console.error('[B1Form] Error loading form:', error);
    container.innerHTML = '<div class="alert alert-danger">Error loading form</div>';
  }
}
