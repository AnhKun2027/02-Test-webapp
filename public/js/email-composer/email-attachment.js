/**
 * Email Attachment Manager — upload, xóa, render file đính kèm per-tab
 */

// Email attachment manager — per-tab, persisted to Firebase Storage + RTDB
export const emailAttachmentManager = {
  attachmentsByTab: {},
  _loadedTabs: {},

  TAB_TO_KEY: {
    tab1: 'email_customer',
    tab2: 'email_reply',
    tab3: 'email_send',
    tab4: 'email_ai'
  },

  _getActiveTabKey() {
    const activeTab = document.querySelector('.email-tab-pane.active');
    if (!activeTab) return null;
    return this.TAB_TO_KEY[activeTab.id] || activeTab.id;
  },

  _getAttachments(tabKey) {
    const key = tabKey || this._getActiveTabKey();
    if (!key) return [];
    if (!this.attachmentsByTab[key]) this.attachmentsByTab[key] = [];
    return this.attachmentsByTab[key];
  },

  async add(fileObj) {
    const tabKey = this._getActiveTabKey();
    if (!tabKey) return;

    if (!this.attachmentsByTab[tabKey]) this.attachmentsByTab[tabKey] = [];

    try {
      if (window.FirebaseSync && window.FirebaseSync.sessionId) {
        const metadata = await window.FirebaseSync.uploadEmailAttachmentToStorage(tabKey, fileObj);
        metadata.data = fileObj.data;
        this.attachmentsByTab[tabKey].push(metadata);
      } else {
        this.attachmentsByTab[tabKey].push(fileObj);
      }
    } catch (error) {
      console.error('[Email] Upload attachment failed:', error);
      // Đánh dấu fail để UI hiển thị + caller (sendEmail) filter ra trước khi gửi.
      // Trước đây silent push fail object → user gửi email thiếu file mà không biết.
      this.attachmentsByTab[tabKey].push({ ...fileObj, _uploadFailed: true, _uploadError: error.message });
      alert(`Lỗi upload file đính kèm "${fileObj.name}":\n${error.message}\n\nFile sẽ KHÔNG được gửi cùng email.`);
    }

    this.render();
  },

  remove(index) {
    const tabKey = this._getActiveTabKey();
    if (!tabKey) return;
    const attachments = this._getAttachments(tabKey);
    if (index < 0 || index >= attachments.length) return;

    const removed = attachments.splice(index, 1)[0];
    if (removed.storage_path) {
      if (!window.pendingEmailAttachmentDeletes) window.pendingEmailAttachmentDeletes = [];
      window.pendingEmailAttachmentDeletes.push({
        name: removed.name,
        storagePath: removed.storage_path
      });
    }

    this.render();
  },

  clear() {
    const tabKey = this._getActiveTabKey();
    if (!tabKey) return;
    const attachments = this._getAttachments(tabKey);

    if (!window.pendingEmailAttachmentDeletes) window.pendingEmailAttachmentDeletes = [];
    for (const att of attachments) {
      if (att.storage_path) {
        window.pendingEmailAttachmentDeletes.push({
          name: att.name,
          storagePath: att.storage_path
        });
      }
    }

    this.attachmentsByTab[tabKey] = [];
    this.render();
  },

  getAll() {
    return this._getAttachments();
  },

  async loadFromRTDB(tabId) {
    if (!tabId || this._loadedTabs[tabId]) return;
    if (!window.FirebaseSync || !window.FirebaseSync.sessionId) return;

    try {
      const attachments = await window.FirebaseSync.loadEmailAttachments(tabId);
      if (attachments.length > 0) {
        this.attachmentsByTab[tabId] = attachments;
      }
    } catch (error) {
      console.error('[Email] Load attachments failed:', error);
    }

    this._loadedTabs[tabId] = true;
  },

  _getFileIcon(type, name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (type.startsWith('application/pdf') || ext === 'pdf') return '📄';
    if (type.startsWith('text/')) return '📝';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
    if (type.includes('word') || ext === 'doc' || ext === 'docx') return '📃';
    if (type.includes('excel') || type.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx') return '📊';
    return '📎';
  },

  _formatSize(size) {
    let bytes = size;
    if (typeof size === 'string') {
      const base64 = size.split(',')[1];
      if (!base64) return '';
      bytes = Math.round(base64.length * 3 / 4);
    }
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  _getFormat(type, name) {
    const ext = (name || '').split('.').pop().toUpperCase();
    if (ext && ext.length <= 5) return ext;
    if (type.startsWith('image/')) return type.split('/')[1].toUpperCase();
    if (type.includes('pdf')) return 'PDF';
    return '';
  },

  render() {
    const tabKey = this._getActiveTabKey();
    const activeTab = document.querySelector('.email-tab-pane.active');
    const container = activeTab ? activeTab.querySelector('.gmail-image-preview-container') : null;
    if (!container) return;

    const attachments = this._getAttachments(tabKey);
    container.replaceChildren();

    if (attachments.length === 0) {
      container.innerHTML = '<div class="empty-state">Chưa có file đính kèm</div>';
    } else {
      attachments.forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'attachment-item';

        const imgSrc = file.data || file.url;

        if (file.isImage) {
          const img = document.createElement('img');
          img.src = imgSrc;
          img.className = 'attachment-thumb';
          wrapper.appendChild(img);
        } else {
          const icon = document.createElement('div');
          icon.className = 'attachment-icon';
          icon.textContent = this._getFileIcon(file.type, file.name);
          wrapper.appendChild(icon);
        }

        const infoEl = document.createElement('div');
        infoEl.className = 'attachment-info';

        const nameEl = document.createElement('span');
        nameEl.className = 'attachment-name';
        nameEl.textContent = file.name;
        nameEl.title = file.name;
        infoEl.appendChild(nameEl);

        const metaEl = document.createElement('span');
        metaEl.className = 'attachment-meta';
        const sizeStr = this._formatSize(file.size || file.data);
        const format = this._getFormat(file.type, file.name);
        metaEl.textContent = [sizeStr, format].filter(Boolean).join(' - ');
        infoEl.appendChild(metaEl);

        wrapper.appendChild(infoEl);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'attachment-remove';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => this.remove(index);

        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
      });
    }

    if (typeof updateImagePreviewSection === 'function') {
      updateImagePreviewSection();
    }
  }
};
