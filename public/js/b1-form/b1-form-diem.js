/**
 * B1 Form Diem — Tính điểm công trình
 */

import { setValidationState } from './b1-form-ui.js';
import { getVal } from './b1-form-utils.js';

// Bảng phần trăm điểm theo loại công việc — nguồn duy nhất, core.js import dùng chung
export const PHAN_TRAM_MAP = {
  "Them Goc Nhin": 30, "Chinh Goc Nhin": 30,
  "Chinh Anh": 30, "Chinh Anh - Up Vat Lieu": 30,
  "Chinh MBTT": 50,
  "Chinh Goc Nhin Va MBTT": 40,
  "Chinh Anh - Up Du Lieu": 120,
  "Chinh Anh - Up DL va VL": 130,
  "Hoan Thien Nha 69 Only": 10,
  "Them Du Lieu": 0, "Hoan Thanh - Ket Thuc": 0, "Bao Gia": 0, "Other": 0
};

// Công thức tính DiemGoc theo loại công việc — chỉ áp dụng khi MaCongTy bắt đầu bằng ID/01
// calc(SoNha) → DiemGoc | viewEditable: SoView có cho user sửa được không
const _diemGoc_GocNhin = n => 50 + (n - 1) * 40;
const _diemGoc_MBTT    = n => 10 + (n - 1) * 5;
const DIEM_GOC_RULES = {
  "Goc Nhin Va MBTT - New":  { calc: n => _diemGoc_GocNhin(n) + _diemGoc_MBTT(n), viewEditable: false },
  "Chinh Goc Nhin Va MBTT":  { calc: n => _diemGoc_GocNhin(n) + _diemGoc_MBTT(n), viewEditable: false },
  "Goc Nhin - New":          { calc: _diemGoc_GocNhin, viewEditable: false },
  "Them Goc Nhin":           { calc: _diemGoc_GocNhin, viewEditable: false },
  "Chinh Goc Nhin":          { calc: _diemGoc_GocNhin, viewEditable: false },
  "MBTT - New":              { calc: _diemGoc_MBTT, viewEditable: false },
  "Chinh MBTT":              { calc: _diemGoc_MBTT, viewEditable: false },
  "Render Anh":              { calc: _diemGoc_GocNhin, viewEditable: true },
  "Chinh Anh":               { calc: _diemGoc_GocNhin, viewEditable: true },
  "Chinh Anh - Up Vat Lieu": { calc: _diemGoc_GocNhin, viewEditable: true },
  "Chinh Anh - Up Du Lieu":  { calc: _diemGoc_GocNhin, viewEditable: true },
  "Chinh Anh - Up DL va VL": { calc: _diemGoc_GocNhin, viewEditable: true },
};

/**
 * Enable editing on double-click for disabled fields
 * Double-click on wrapper div → enable input → edit → blur → disable again
 * @param {string} elementId - The ID of the input/select element
 */
export function enableEditOnDblClick(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Remove disabled attribute to enable editing
  element.disabled = false;
  element.style.pointerEvents = 'auto';  // Enable pointer events
  element.focus();

  // Select all text for easy replacement (only for input elements)
  if (element.tagName.toLowerCase() === 'input') {
    element.select();
  }

  // Add visual feedback - highlight border
  element.style.borderColor = '#ffc107';
  element.style.boxShadow = '0 0 0 0.2rem rgba(255, 193, 7, 0.25)';

  // Re-disable on blur (when user clicks away)
  element.onblur = () => {
    element.disabled = true;
    element.style.pointerEvents = 'none';  // Disable pointer events again
    element.style.borderColor = '';
    element.style.boxShadow = '';
    element.onblur = null;

    // Tính lại điểm khi giá trị thay đổi
    TinhDiem();
  };
}

/** Tính DiemGoc + TongDiem dựa trên SoNha, SoView, CongViec, PhanTram, HeSo */
export function TinhDiem() {
  const S_MaCongTy = getVal("b1_O_MaCongTy");
  const S_CongViec = getVal("b1_O_CongViec");
  const parseNum = (id, fallback) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? fallback : v; };
  const S_SoNha = parseNum("b1_O_SoNha", 0);
  let S_SoView = parseNum("b1_O_SoView", 0);
  const S_DiemGoc = parseNum("b1_O_DiemGoc", 0);
  let S_PhanTramDiem = parseNum("b1_O_PhanTramDiem", 100);
  const S_HeSo = parseNum("b1_O_HeSo", 1);

  let DiemGoc = S_DiemGoc;
  const S1_MaCongTy = S_MaCongTy.split("-")[0];
  const soViewEl = document.getElementById("b1_O_SoView");

  if (S1_MaCongTy === "ID" || S1_MaCongTy === "01") {
    if (soViewEl) soViewEl.readOnly = true;

    const rule = DIEM_GOC_RULES[S_CongViec];
    if (rule) {
      DiemGoc = rule.calc(S_SoNha);
      if (!rule.viewEditable) S_SoView = 0;
      if (soViewEl) soViewEl.readOnly = !rule.viewEditable;
    }

    // Thiết lập phần trăm theo loại công việc (dùng chung PHAN_TRAM_MAP)
    if (PHAN_TRAM_MAP[S_CongViec] !== undefined) {
      S_PhanTramDiem = PHAN_TRAM_MAP[S_CongViec];
    }
  }

  let TongDiem;
  if (S_SoView === 0) {
    TongDiem = DiemGoc * S_HeSo * (S_PhanTramDiem / 100);
  } else {
    TongDiem = (1 + 0.4 * (S_SoView - 1)) * DiemGoc * S_HeSo * (S_PhanTramDiem / 100);
  }

  TongDiem = Math.round(TongDiem);

  const phanTramDiemEl = document.getElementById("b1_O_PhanTramDiem");
  if (phanTramDiemEl) phanTramDiemEl.value = S_PhanTramDiem;

  if (soViewEl) soViewEl.value = S_SoView;

  const diemGocEl = document.getElementById("b1_O_DiemGoc");
  if (diemGocEl) diemGocEl.value = DiemGoc;

  const tongDiemEl = document.getElementById("b1_O_TongDiem");
  if (tongDiemEl) tongDiemEl.value = TongDiem;

  // Validation: Đánh dấu các ô điểm đã được tính
  setValidationState(document.getElementById("b1_O_SoNha"), S_SoNha > 0 ? 'valid' : 'reset');
  setValidationState(soViewEl, 'valid');
  setValidationState(diemGocEl, DiemGoc > 0 ? 'valid' : 'reset');
  setValidationState(phanTramDiemEl, 'valid');
  setValidationState(tongDiemEl, TongDiem > 0 ? 'valid' : 'reset');
}
