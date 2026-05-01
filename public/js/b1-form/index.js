/**
 * B1 Form Index — Window bindings + DOM-ready init
 * KHÔNG re-export. Module ngoài import trực tiếp từ file con nếu cần.
 */

import { TinhDiem, enableEditOnDblClick } from './b1-form-diem.js';
import { loadB1Form, SauKhiGetRow } from './b1-form-core.js';
import {
  KhiFlowThayDoi, KhiGiaTriCongViecThayDoi,
  applyTrangThaiTaoCTStyle, TraLoiThayDoi, GuiBaiThayDoi,
} from './b1-form-workflow.js';
import {
  ClickButtonSaveRowPhienDich, ClickButtonSaveDanhBa,
  ClickButtonGuiTinNhanDenNhanVien, ClickButtonCheckKhachHangNew,
  ClickButtonSearchNew, ClickButtonKiemTraCongTrinhCoDangTonTai,
  ClickButtonTaoCongTrinhMoi, hamchayAI,
} from './b1-form-actions.js';
import {
  CopyFolderMail, CopyFolderServer, CopyFolderSend,
  ClickButtonTaoFolderMoi,
} from './b1-form-folders.js';
import {
  ChangeThuMay, SoGioTruocThayDoi, NhanVienThayDoi, NhapTenCongTrinhID,
} from './b1-form-employees.js';
import { loadEmployeesDropdown, initB1FormSync } from './b1-form-sync.js';

// =============================================
// Window bindings (HTML inline onclick/onchange + cross-folder callers)
// =============================================
window.TinhDiem = TinhDiem;
window.enableEditOnDblClick = enableEditOnDblClick;
window.SauKhiGetRow = SauKhiGetRow;
window.KhiFlowThayDoi = KhiFlowThayDoi;
window.KhiGiaTriCongViecThayDoi = KhiGiaTriCongViecThayDoi;
window.applyTrangThaiTaoCTStyle = applyTrangThaiTaoCTStyle;
window.TraLoiThayDoi = TraLoiThayDoi;
window.GuiBaiThayDoi = GuiBaiThayDoi;
window.ClickButtonSaveRowPhienDich = ClickButtonSaveRowPhienDich;
window.ClickButtonSaveDanhBa = ClickButtonSaveDanhBa;
window.ClickButtonGuiTinNhanDenNhanVien = ClickButtonGuiTinNhanDenNhanVien;
window.ClickButtonCheckKhachHangNew = ClickButtonCheckKhachHangNew;
window.ClickButtonSearchNew = ClickButtonSearchNew;
window.ClickButtonKiemTraCongTrinhCoDangTonTai = ClickButtonKiemTraCongTrinhCoDangTonTai;
window.ClickButtonTaoCongTrinhMoi = ClickButtonTaoCongTrinhMoi;
window.hamchayAI = hamchayAI;
window.CopyFolderMail = CopyFolderMail;
window.CopyFolderServer = CopyFolderServer;
window.CopyFolderSend = CopyFolderSend;
window.ClickButtonTaoFolderMoi = ClickButtonTaoFolderMoi;
window.ChangeThuMay = ChangeThuMay;
window.SoGioTruocThayDoi = SoGioTruocThayDoi;
window.NhanVienThayDoi = NhanVienThayDoi;
window.NhapTenCongTrinhID = NhapTenCongTrinhID;

// =============================================
// Initialize when DOM ready
// =============================================
function initAll() {
  loadB1Form();
  loadEmployeesDropdown();
  initB1FormSync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
