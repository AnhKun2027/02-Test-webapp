/** Email Generator — Sinh nội dung email từ template + dữ liệu form */

import { EMAIL_TEMPLATES } from './templates-data.js';

// VN giờ → JP giờ (giả định cùng ngày, không xử lý DST/edge case 25:00 vì gioGui là HH:MM 24h từ form)
const JP_TIMEZONE_OFFSET_HOURS = 2;

/**
 * Helper chung cho formatNgayNop / formatNgayNopVN — tính diffDays giữa today và target date.
 * Trả về { diffDays, day, month, targetDate } để 2 hàm format dùng chung.
 */
function _calcDayDiff(ngay) {
  const targetDate = new Date(ngay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDateOnly = new Date(targetDate);
  targetDateOnly.setHours(0, 0, 0, 0);
  const diffDays = Math.round((targetDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { diffDays, day: targetDate.getDate(), month: targetDate.getMonth() + 1, targetDate };
}

// =============================================
// HELPER: FORMAT NGÀY NỘP (JP)
// =============================================

/**
 * Format date cho email JP (NGAYNOP placeholder)
 * Input: "2025-12-20", "金", "19:00"
 * Output: "明日、12月20日（金）21:00 "
 * @param {string} ngayHoanThanh - Date "YYYY-MM-DD"
 * @param {string} thuJP - Thu JP ("月", "火", "水"...)
 * @param {string} gioGui - Time "HH:MM"
 * @returns {string} Formatted JP date
 */
function formatNgayNop(ngayHoanThanh, thuJP, gioGui) {
  if (!ngayHoanThanh) return '';

  try {
    const { diffDays, day, month } = _calcDayDiff(ngayHoanThanh);

    let datePrefix = '';
    if (diffDays === 0) {
      datePrefix = '本日、';
    } else if (diffDays === 1) {
      datePrefix = '明日、';
    } else if (diffDays === 2) {
      datePrefix = '明後日、';
    }

    let result = datePrefix + month + '月' + day + '日';

    if (thuJP && gioGui) {
      const timeParts = gioGui.split(':');
      if (timeParts.length === 2) {
        const hourJP = parseInt(timeParts[0], 10) + JP_TIMEZONE_OFFSET_HOURS;
        const minute = timeParts[1];
        result += '（' + thuJP + '）' + hourJP + ':' + minute + ' ';
      } else {
        result += '（' + thuJP + '）';
      }
    } else if (thuJP) {
      result += '（' + thuJP + '）';
    }

    return result;
  } catch (error) {
    console.error('[EmailTemplates] Error formatting date:', error);
    return ngayHoanThanh;
  }
}

// =============================================
// HELPER: FORMAT NGÀY NỘP (VN)
// =============================================

/**
 * Format date cho email VN
 * Input: "2025-12-20", "19:00"
 * Output: "ngày mai ngày 20/12 (19:00)"
 * @param {string} ngayHoanThanh - Date "YYYY-MM-DD"
 * @param {string} gioGui - Time "HH:MM"
 * @returns {string} Formatted VN date
 */
function formatNgayNopVN(ngayHoanThanh, gioGui) {
  if (!ngayHoanThanh) return '';

  try {
    const { diffDays, day, month } = _calcDayDiff(ngayHoanThanh);

    let datePrefix = '';
    if (diffDays === 0) {
      datePrefix = 'hôm nay ';
    } else if (diffDays === 1) {
      datePrefix = 'ngày mai ';
    } else if (diffDays === 2) {
      datePrefix = 'ngày kia ';
    }

    let result = datePrefix + 'ngày ' + day + '/' + month;

    if (gioGui) {
      result += ' (' + gioGui + ')';
    }

    return result;
  } catch (error) {
    console.error('[EmailTemplates] Error formatting VN date:', error);
    return ngayHoanThanh;
  }
}

// =============================================
// MAIN: GENERATE EMAIL CONTENT
// =============================================

/**
 * Sinh noi dung email bang cach thay placeholder trong template
 * @param {string} congViec - Loai cong viec ("Goc Nhin - New", "Chinh Anh"...)
 * @param {Object} data - Du lieu form (congTrinhVT, tenCTrTiengNhat, danhBaCongTy...)
 * @returns {Object} { traLoi, nopBai, traLoiVN, nopBaiVN, subjectTraLoiJP, ... }
 */
export function generateEmailContent(congViec, data) {
  const template = EMAIL_TEMPLATES[congViec];

  if (!template) {
    console.warn('[EmailTemplates] No template found for congViec:', congViec);
    return { traLoi: '', nopBai: '', traLoiVN: '', nopBaiVN: '', subjectTraLoiJP: '', subjectTraLoiVN: '', subjectNopBaiJP: '', subjectNopBaiVN: '' };
  }

  // Ten cong trinh day du: "PP-18　山田邸"
  const tenDayDu = (data.congTrinhVT || '') + '\u3000' + (data.tenCTrTiengNhat || '');

  // Auto-format NGAYNOP JP
  let ngayNop = data.ngayNop || '';
  if (!ngayNop && data.ngayHoanThanh) {
    ngayNop = formatNgayNop(data.ngayHoanThanh, data.thuJP, data.gioGui);
  }

  // Auto-format NGAYNOP VN
  let ngayNopVN = '';
  if (data.ngayHoanThanh) {
    ngayNopVN = formatNgayNopVN(data.ngayHoanThanh, data.gioGui);
  }

  // Auto-format NGAYNOPCU (chi dung cho "Hen Tre")
  let ngayNopCu = data.ngayNopCu || '';
  if (!ngayNopCu && data.ngayHoanThanhCu) {
    ngayNopCu = formatNgayNop(data.ngayHoanThanhCu, data.thuJPCu, data.gioGuiCu);
  }

  let ngayNopCuVN = '';
  if (data.ngayHoanThanhCu) {
    ngayNopCuVN = formatNgayNopVN(data.ngayHoanThanhCu, data.gioGuiCu);
  }

  // Dynamic header — bo dong CHINHANH khi rong
  const buildHeader = () => {
    const parts = [];
    if (data.danhBaCongTy) parts.push(data.danhBaCongTy);
    if (data.danhBaChiNhanh) parts.push(data.danhBaChiNhanh);
    if (data.danhBaHo) parts.push(data.danhBaHo + '様');
    return parts.join('\n');
  };

  const header = buildHeader();

  const buildHeaderVN = () => {
    const parts = [];
    if (data.danhBaCongTy) parts.push('Công ty ' + data.danhBaCongTy);
    if (data.danhBaChiNhanh) parts.push('Chi nhánh ' + data.danhBaChiNhanh);
    if (data.danhBaHo) parts.push('Gửi: ' + data.danhBaHo + '様');
    return parts.join('\n');
  };

  const headerVN = buildHeaderVN();

  // Single-pass replace: tránh recursive replace nếu giá trị data chứa string giống token khác
  // (vd: danhBaHo = "NGAYNOP cũ" sẽ KHÔNG bị thay lại ở step NGAYNOP).
  // Sort keys by length DESC để regex match token dài nhất trước (NGAYNOPCU trước NGAYNOP).
  const _buildReplacer = (map) => {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    const re = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    return (text) => text ? text.replace(re, m => map[m]) : '';
  };

  const replacePlaceholders = _buildReplacer({
    'CONGTY\nCHINHANH\nHO様': header,
    'TENCONGTRINHDAYDU': tenDayDu,
    'NGAYNOPCU': ngayNopCu,
    'NGAYNOP': ngayNop,
  });

  const replacePlaceholdersVN = _buildReplacer({
    'Công ty CONGTY\nChi nhánh CHINHANH\nGửi: HO様': headerVN,
    'TENCONGTRINHDAYDU': tenDayDu,
    'NGAYNOPCU': ngayNopCuVN || ngayNopCu,
    'NGAYNOP': ngayNopVN || ngayNop,
  });

  const replaceSubjectPlaceholders = (text) => {
    if (!text) return '';
    return text.replace(/TENCONGTRINHDAYDU/g, tenDayDu);
  };

  return {
    traLoi: replacePlaceholders(template.traLoi),
    nopBai: replacePlaceholders(template.nopBai),
    traLoiVN: replacePlaceholdersVN(template.traLoiVN),
    nopBaiVN: replacePlaceholdersVN(template.nopBaiVN),
    subjectTraLoiJP: replaceSubjectPlaceholders(template.subjectTraLoiJP),
    subjectTraLoiVN: replaceSubjectPlaceholders(template.subjectTraLoiVN),
    subjectNopBaiJP: replaceSubjectPlaceholders(template.subjectNopBaiJP),
    subjectNopBaiVN: replaceSubjectPlaceholders(template.subjectNopBaiVN)
  };
}
