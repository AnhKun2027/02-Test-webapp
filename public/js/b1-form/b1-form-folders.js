
/**
 * B1 Form Folders — Copy folder paths + folder creation (Electron)
 */

import { showToast } from './b1-form-ui.js';
import { getB1LinkFolderCT } from './b1-form-core.js';

// =============================================
// COPY FOLDER FUNCTIONS
// =============================================

/** Copy đường dẫn folder vào clipboard, hoặc mở folder trong Electron
 * @param {string} elementId - ID của input chứa đường dẫn */
export function CopyFolder(elementId) {
  const copyText = document.getElementById(elementId);
  if (!copyText || !copyText.value) return;
  if (window.electronAPI) {
    window.electronAPI.showInFolder(copyText.value);
  } else {
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value)
      .catch(err => console.error('[B1Form] Copy failed:', err));
  }
}

function showCopiedFeedback(buttonId, originalText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.innerHTML = window.electronAPI ? 'Opened' : 'Copied';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }, 2000);
}

// Map 3 loại folder → input id + button id + label
const FOLDER_BUTTONS = {
  Mail:   { input: 'b1_O_FolderMail',   btn: 'b1_N_FolderMail',   label: 'Mail' },
  Server: { input: 'b1_O_FolderServer', btn: 'b1_N_FolderServer', label: 'CT' },
  Send:   { input: 'b1_O_FolderSend',   btn: 'b1_N_FolderSend',   label: 'Gui' },
};

function _copyAndFlash(kind) {
  const cfg = FOLDER_BUTTONS[kind];
  CopyFolder(cfg.input);
  showCopiedFeedback(cfg.btn, cfg.label);
}

/** Copy/mở folder Mail */
export function CopyFolderMail()   { _copyAndFlash('Mail'); }
/** Copy/mở folder Server (công trình) */
export function CopyFolderServer() { _copyAndFlash('Server'); }
/** Copy/mở folder Send (gửi bài) */
export function CopyFolderSend()   { _copyAndFlash('Send'); }

// =============================================
// FOLDER CREATION (Electron only)
// =============================================

/** Helper: lấy đường dẫn folder công trình (đã trim) + folder 1-Data tương ứng.
 * @returns {{ct: string, data: string} | null} null nếu chưa có đường dẫn CT */
function _resolveFolderData() {
  const ct = getB1LinkFolderCT().replace(/\\+$/, '');
  if (!ct) return null;
  return { ct, data: `${ct}\\1-Data` };
}

/** Đọc số folder lớn nhất trong thư mục Data (Electron only)
 * @param {string} folderData - Đường dẫn folder 1-Data
 * @returns {Promise<number>} Số folder lớn nhất (0 nếu rỗng) */
export async function docMaxSoFolder(folderData) {
  let maxSo = 0;
  const readResult = await window.electronAPI.readDir(folderData);
  if (readResult.success) {
    readResult.data.forEach(entry => {
      if (entry.isDirectory && /^\d{1,3}$/.test(entry.name)) {
        const so = parseInt(entry.name, 10);
        if (so > maxSo) maxSo = so;
      }
    });
  }
  return maxSo;
}

/** Tạo folder công trình + folder Data/01 trên server (Electron only) */
export async function taoFolderCongTrinh() {
  if (!window.electronAPI) return;

  const paths = _resolveFolderData();
  if (!paths) return;
  const { ct: folderCongTrinh, data: folderData } = paths;

  const lastSlash = folderCongTrinh.lastIndexOf('\\');
  const folderCongTy = folderCongTrinh.substring(0, lastSlash);

  try {
    await window.electronAPI.mkdir(folderCongTy);
    await window.electronAPI.mkdir(folderCongTrinh);
    await window.electronAPI.mkdir(folderData);

    const maxSo = await docMaxSoFolder(folderData);

    if (maxSo > 0) {
      const folderMoiNhat = `${folderData}\\${String(maxSo).padStart(2, '0')}`;
      await window.electronAPI.showInFolder(folderMoiNhat);
      showToast('success', 'Da mo folder hien co');
      return;
    }

    const folderSoMoi = `${folderData}\\01`;
    await window.electronAPI.mkdir(folderSoMoi);
    await window.electronAPI.showInFolder(folderSoMoi);
    showToast('success', 'Da tao folder 01');

  } catch (err) {
    console.error('[B1Form] Loi tao folder:', err);
    showToast('error', 'Loi tao folder: ' + err.message);
  }
}

/** Tạo folder Data mới (số tiếp theo) trong công trình — Electron only */
export async function ClickButtonTaoFolderMoi() {
  if (!window.electronAPI) return;

  const paths = _resolveFolderData();
  if (!paths) {
    showToast('error', 'Chua co duong dan cong trinh. Vui long nhap du thong tin.');
    return;
  }
  const { data: folderData } = paths;
  const btn = document.getElementById('b1_N_TaoFolder');

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo...'; }

    await window.electronAPI.mkdir(folderData);

    const maxSo = await docMaxSoFolder(folderData);
    const soMoi = String(maxSo + 1).padStart(2, '0');
    const folderSoMoi = `${folderData}\\${soMoi}`;
    await window.electronAPI.mkdir(folderSoMoi);
    await window.electronAPI.showInFolder(folderSoMoi);
    showToast('success', `Da tao folder ${soMoi}`);

  } catch (err) {
    console.error('[B1Form] Loi tao folder moi:', err);
    showToast('error', 'Loi tao folder: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ Tạo Folder Mới'; }
  }
}
