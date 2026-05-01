/**
 * Email Send — toggle composer, send email, paste/attach handlers
 */

import { emailAttachmentManager } from './email-attachment.js';

/**
 * Toggle email composer visibility (show/hide)
 */
export function toggleEmailComposer() {
  const emailComposer = document.getElementById('emailComposerView');
  const pdfWrapper = document.getElementById('pdfWrapper');
  const pagesSidebar = document.getElementById('pagesSidebar');

  if (!emailComposer) return;

  const isComposerVisible = emailComposer.style.display !== 'none';
  const emailBtn = document.getElementById('emailComposerFixed');

  if (isComposerVisible) {
    emailComposer.style.display = 'none';
    emailAttachmentManager._loadedTabs = {};
    if (appState.currentFile && pdfWrapper) {
      pdfWrapper.style.display = 'block';
    }
    if (pagesSidebar && appState.currentFile && appState.currentFile.numPages > 1) {
      pagesSidebar.style.display = 'block';
    }
    if (emailBtn) emailBtn.classList.remove('active');
    const fileItems = document.querySelectorAll('.file-item-horizontal');
    if (fileItems[appState.currentFileIndex]) {
      fileItems[appState.currentFileIndex].classList.add('active');
    }
  } else {
    emailComposer.style.display = 'block';
    if (pdfWrapper) pdfWrapper.style.display = 'none';
    if (pagesSidebar) pagesSidebar.style.display = 'none';
    document.querySelectorAll('.file-item-horizontal.active').forEach(el => el.classList.remove('active'));
    if (emailBtn) emailBtn.classList.add('active');
  }
}

/**
 * Handle paste image in email composer
 */
export function handlePasteImage(e) {
  const items = e.clipboardData?.items;
  if (!items) return;

  const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
  if (imageItems.length === 0) return;

  e.preventDefault();
  imageItems.forEach((item, idx) => {
    const blob = item.getAsFile();
    if (!blob) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      emailAttachmentManager.add({
        data: event.target.result,
        name: blob.name || `paste_${Date.now()}_${idx}.png`,
        type: blob.type || 'image/png',
        isImage: true,
      });
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Click handler for send email button
 */
/** Helper: thu thập dữ liệu email từ form fields */
function _buildEmailPayload(tabKey) {
  const to = document.getElementById('b1_O_EmailKhachHang')?.value?.trim() || '';
  const subject = document.getElementById('subject_' + tabKey + '_jp')?.value?.trim() || '';
  const body = document.getElementById(tabKey + '_jp')?.value?.trim() || '';
  const sessionId = appState.messageId || '';
  const toEmail = document.getElementById('b1_O_ToEmail')?.value?.trim() || '';

  const ccFromB1 = document.getElementById('b1_O_EmailCC')?.value?.trim() || '';
  const ccFromTab = document.getElementById('cc_' + tabKey)?.value?.trim() || '';
  const ccSet = new Set(
    [ccFromB1, ccFromTab]
      .join(',')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e !== to.toLowerCase())
  );
  const cc = [...ccSet].join(',');

  const allAttachments = emailAttachmentManager.getAll();
  const attachments = allAttachments
    .filter(a => a.storage_path)
    .map(a => ({ storage_path: a.storage_path, name: a.name, type: a.type || a.mimeType }));

  return { to, subject, body, cc, sessionId, toEmail, attachments };
}

/** Helper: xử lý kết quả sau khi gửi email thành công */
function _handleSendResult(result, btnId, tabKey, label) {
  if (!result.success) {
    alert('Lỗi khi gửi email: ' + (result.error || 'Unknown error'));
    return;
  }

  let successMsg = 'Đã gửi email thành công!';
  if (result.sendMethod === 'drive_link') {
    successMsg += '\n\n📁 File đã được upload lên Google Drive.\nLink đã được chèn vào email.';
  } else if (result.attachmentCount > 0) {
    successMsg += `\n📎 ${result.attachmentCount} file đính kèm.`;
  }
  alert(successMsg);
  console.log('[Email] Sent successfully:', { btnId, sendMethod: result.sendMethod });

  if (result.messageId) {
    const msgidEl = document.getElementById('msgid_' + tabKey);
    if (msgidEl) msgidEl.value = result.messageId;
  }

  const sendBtn = document.getElementById(btnId);
  if (btnId === 'btn_email_reply') {
    const traLoiEl = document.getElementById('b1_O_TraLoi');
    if (traLoiEl) traLoiEl.value = 'REPLIED';
    window.TraLoiThayDoi();
  } else if (btnId === 'btn_email_send') {
    const guiBaiEl = document.getElementById('b1_O_GuiBai');
    if (guiBaiEl) guiBaiEl.value = 'SENT';
    window.GuiBaiThayDoi();
  } else if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '✓ Đã gửi';
    setTimeout(() => {
      sendBtn.disabled = false;
      sendBtn.textContent = label;
    }, 3000);
  }

  if (typeof window.saveAndSyncAll === 'function') void window.saveAndSyncAll().catch(err => console.error('[Email] Save failed:', err));
}

let _isSending = false;
export async function clickButtonSendEmail(btnId) {
  if (_isSending) return;

  const BTN_CONFIG = {
    btn_email_reply: { tabKey: 'email_reply', mode: 'reply', label: 'Reply' },
    btn_email_send:  { tabKey: 'email_send',  mode: 'reply', label: 'Submit' },
    btn_email_ai:    { tabKey: 'email_ai',    mode: 'reply', label: 'Send' }
  };

  const config = BTN_CONFIG[btnId];
  if (!config) {
    alert('Button không hợp lệ: ' + btnId);
    return;
  }

  const { tabKey, mode, label } = config;
  const modeLabel = (mode === 'reply') ? 'Reply' : 'New Email';

  const { to, subject, body, cc, sessionId, toEmail, attachments } = _buildEmailPayload(tabKey);

  if (!to) {
    alert('Chưa có email người nhận.\nKiểm tra ô "Email Khach Hang" trong B1 Form.');
    return;
  }
  if (!body) {
    alert('Chưa có nội dung email (ô JP trống).');
    return;
  }
  if (!subject && mode !== 'reply') {
    alert('Chưa có tiêu đề email (件名 trống).');
    return;
  }

  const attachInfo = attachments.length > 0 ? `\n📎 ${attachments.length} file đính kèm` : '';
  const subjectInfo = subject ? `\n\nTiêu đề: ${subject}` : (mode === 'reply' ? '\n\n(Tiêu đề: giữ nguyên từ email gốc)' : '');
  const confirmMsg = `Gửi ${modeLabel} đến: ${to}` +
    (cc ? `\nCC: ${cc}` : '') +
    subjectInfo +
    attachInfo +
    `\n\nXác nhận gửi?`;
  if (!confirm(confirmMsg)) return;

  _isSending = true;
  showLoading(attachments.length > 0 ? 'Đang gửi email + đính kèm file...' : 'Đang gửi email...');

  const guiBaiValue = (btnId === 'btn_email_send') ? (document.getElementById('b1_O_GuiBai')?.value || '') : '';
  const forceDriveLink = (guiBaiValue === 'Link_Send');

  try {
    const result = await ApiClient.sendEmailViaGmail({
      to, subject, body, cc, mode, sessionId, attachments, toEmail, forceDriveLink, tabKey,
    });
    _handleSendResult(result, btnId, tabKey, label);
  } catch (error) {
    console.error('[Email] Send error:', error);
    alert('Lỗi khi gửi email: ' + error.message);
  } finally {
    hideLoading();
    _isSending = false;
  }
}

/**
 * Click handler for attach file button
 */
export function clickButtonAttachFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;

  input.onchange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        emailAttachmentManager.add({
          data: event.target.result,
          name: file.name,
          type: file.type,
          isImage: file.type.startsWith('image/')
        });
      };
      reader.readAsDataURL(file);
    });
  };

  input.click();
}

/**
 * Tính ngày trễ: ngày cũ + số giờ = ngày mới
 */
export function tinhNgayTre(ngayHoanThanh, gioGui, soGioTre) {
  const oldDate = new Date(ngayHoanThanh + 'T' + (gioGui || '18:00') + ':00');
  const newDate = new Date(oldDate.getTime() + soGioTre * 60 * 60 * 1000);

  const year = newDate.getFullYear();
  const month = String(newDate.getMonth() + 1).padStart(2, '0');
  const day = String(newDate.getDate()).padStart(2, '0');
  const hour = String(newDate.getHours()).padStart(2, '0');
  const minute = String(newDate.getMinutes()).padStart(2, '0');

  const jpDays = ['日','月','火','水','木','金','土'];

  return {
    ngayHoanThanh: `${year}-${month}-${day}`,
    thuJP: jpDays[newDate.getDay()],
    gioGui: `${hour}:${minute}`
  };
}
