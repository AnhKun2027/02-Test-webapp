/**
 * Email Tabs — tab switching, khởi tạo composer, auto-fill templates
 */

import { emailAttachmentManager } from './email-attachment.js';
import {
  toggleEmailComposer, handlePasteImage,
  clickButtonSendEmail, clickButtonAttachFile, tinhNgayTre,
} from './email-send.js';
import { EMAIL_TEXTAREA_IDS } from './email-constants.js';
import { triggerAutosave } from '../dom-utils.js';

/**
 * Switch to a specific tab by tabId
 */
export async function switchToTab(tabId) {
  document.querySelectorAll('[data-tab]').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.email-tab-pane').forEach(pane => pane.classList.remove('active'));

  const activeEl = document.querySelector('[data-tab="' + tabId + '"]');
  if (activeEl) activeEl.classList.add('active');

  const pane = document.getElementById(tabId);
  if (pane) pane.classList.add('active');

  try {
    const tabKey = emailAttachmentManager.TAB_TO_KEY[tabId] || tabId;
    await emailAttachmentManager.loadFromRTDB(tabKey);
    emailAttachmentManager.render();
  } catch (err) {
    console.error('[Email] Load tab failed:', err);
  }
}

/** Thu thập 5 field khách hàng từ B1 form — dùng cho mọi auto-fill template */
function _collectKhachHangData() {
  return {
    congTrinhVT:    document.getElementById('b1_O_CongTrinhVT')?.value || '',
    tenCTrTiengNhat:document.getElementById('b1_O_TenCTrTiengNhat')?.value || '',
    danhBaCongTy:   document.getElementById('b1_O_DanhBaCongTy')?.value || '',
    danhBaChiNhanh: document.getElementById('b1_O_DanhBaChiNhanh')?.value || '',
    danhBaHo:       document.getElementById('b1_O_DanhBaHo')?.value || '',
  };
}

/** Đẩy emailContent vào tab AI (jp + vn), trigger autosave bằng dispatch input */
function _fillAiTab(emailContent) {
  const aiJp = document.getElementById('email_ai_jp');
  const aiVn = document.getElementById('email_ai_vn');
  if (aiJp) aiJp.value = emailContent.traLoi;
  if (aiVn) {
    aiVn.value = emailContent.traLoiVN;
    triggerAutosave(aiVn);
  }
}

/** Helper: auto-fill template "Hẹn Trễ" — hỏi số giờ trễ rồi generate email */
function _handleHenTreAutoFill() {
  if (!window.generateEmailContent) return;

  const soGio = prompt('Nhập số giờ trễ (ví dụ: 24):');
  if (!soGio || isNaN(soGio) || Number(soGio) <= 0) return;
  const soGioNum = Number(soGio);

  const soGioTruocEl = document.getElementById('b1_O_SoGioTruoc');
  if (soGioTruocEl) {
    soGioTruocEl.value = -soGioNum;
    triggerAutosave(soGioTruocEl);
  }

  const ngayCu = document.getElementById('b1_O_NgayHoanThanh')?.value || '';
  const gioCu = document.getElementById('b1_O_GioGui')?.value || '18:00';
  let thuJPCu = document.getElementById('b1_O_ThuJP')?.value || '';
  if (!thuJPCu && ngayCu) {
    const jpDays = ['日','月','火','水','木','金','土'];
    thuJPCu = jpDays[new Date(ngayCu).getDay()];
  }

  const newDateTime = tinhNgayTre(ngayCu, gioCu, soGioNum);

  const data = {
    ..._collectKhachHangData(),
    ngayHoanThanhCu: ngayCu,
    thuJPCu: thuJPCu,
    gioGuiCu: gioCu,
    ngayHoanThanh: newDateTime.ngayHoanThanh,
    thuJP: newDateTime.thuJP,
    gioGui: newDateTime.gioGui,
  };

  _fillAiTab(window.generateEmailContent('Hen Tre', data));
}

/** Helper: auto-fill template "Hỏi Khách" — generate email hỏi khách */
function _handleHoiKhachAutoFill() {
  if (!window.generateEmailContent) return;
  _fillAiTab(window.generateEmailContent('Hoi Khach', _collectKhachHangData()));
}

export function initEmailTabs() {
  const tabButtons = document.querySelectorAll('.email-tab-btn');

  if (tabButtons.length === 0) {
    console.warn('[Email] No tab buttons found');
    return;
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      switchToTab(this.dataset.tab);
    });
  });

  const aiTypeSelect = document.getElementById('email_ai_type');
  const aiTypeWrapper = document.querySelector('.email-ai-type-wrapper[data-tab="tab4"]');

  if (aiTypeSelect) {
    aiTypeSelect.addEventListener('change', function() {
      if (this.value) switchToTab('tab4');

      if (this.value === 'Hen Tre') _handleHenTreAutoFill();
      if (this.value === 'Hoi Khach') _handleHoiKhachAutoFill();
    });
  }

  if (aiTypeWrapper) {
    aiTypeWrapper.addEventListener('click', (e) => {
      if (e.target === aiTypeWrapper || e.target.classList.contains('tab-icon')) {
        switchToTab('tab4');
        if (aiTypeSelect) aiTypeSelect.focus();
      }
    });
  }
}

/**
 * Update Image Preview Section collapsible state
 */
export function updateImagePreviewSection() {
  const activeTab = document.querySelector('.email-tab-pane.active');
  if (!activeTab) return;

  const imagePreviewSection = activeTab.querySelector('.gmail-attachments-area');
  const imageContainer = activeTab.querySelector('.gmail-image-preview-container');

  if (!imagePreviewSection || !imageContainer) return;

  const images = imageContainer.querySelectorAll('img');
  const hasImages = images.length > 0;

  if (hasImages) {
    imagePreviewSection.classList.remove('collapsed');
  } else {
    imagePreviewSection.classList.add('collapsed');
  }
}

/**
 * Initialize email composer event listeners
 */
export async function initEmailComposer() {
  const emailBtn = document.getElementById('emailComposerFixed');
  if (emailBtn) {
    emailBtn.addEventListener('click', toggleEmailComposer);
  }

  EMAIL_TEXTAREA_IDS.PASTE_TARGETS.forEach(id => {
    const textarea = document.getElementById(id);
    if (textarea && !textarea.hasAttribute('data-paste-initialized')) {
      textarea.addEventListener('paste', handlePasteImage);
      textarea.setAttribute('data-paste-initialized', 'true');
    }
  });

  initEmailTabs();

  document.querySelectorAll('.email-tab-pane .gmail-bottom-bar').forEach(bar => {
    const uploadBtn = bar.querySelector('[data-action="upload-image"]');
    if (uploadBtn && !uploadBtn.hasAttribute('data-action-initialized')) {
      uploadBtn.addEventListener('click', clickButtonAttachFile);
      uploadBtn.setAttribute('data-action-initialized', 'true');
    }
  });

  ['btn_email_reply', 'btn_email_send', 'btn_email_ai'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn && !btn.hasAttribute('data-action-initialized')) {
      btn.addEventListener('click', () => clickButtonSendEmail(btnId));
      btn.setAttribute('data-action-initialized', 'true');
    }
  });

  try {
    const initialTabKey = emailAttachmentManager._getActiveTabKey();
    if (initialTabKey) {
      await emailAttachmentManager.loadFromRTDB(initialTabKey);
      emailAttachmentManager.render();
    }
  } catch (err) {
    console.error('[Email] Init load failed:', err);
  }
}
