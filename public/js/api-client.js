/**
 * API Client — Cloud Functions API
 * Gọi Firebase Cloud Functions cho tất cả backend operations
 */

export const ApiClient = {
  /**
   * Gửi email qua Gmail API (Cloud Functions)
   * @param {object} payload - { to, subject, body, cc, mode, sessionId, attachments, toEmail, forceDriveLink, tabKey }
   *   - to: email người nhận
   *   - subject: tiêu đề
   *   - body: nội dung
   *   - cc: CC (optional)
   *   - mode: "reply" | "new"
   *   - sessionId: = Gmail messageId (cho reply mode)
   */
  async sendEmailViaGmail(payload) {
    return this.callCloudFunction('gmailSendEmail', payload);
  },

  // ==================== CLOUD FUNCTIONS API ====================

  /**
   * Base URL cho Cloud Functions
   * Local emulator: http://127.0.0.1:5001/checkcongviec-webapp/asia-southeast1
   * Production: https://asia-southeast1-checkcongviec-webapp.cloudfunctions.net
   */
  get cloudFunctionsUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:5001/checkcongviec-webapp/asia-southeast1';
    }
    return 'https://asia-southeast1-checkcongviec-webapp.cloudfunctions.net';
  },

  /**
   * Gọi Cloud Function
   * @param {string} functionName - Tên function (ví dụ: 'projectApi', 'translateText')
   * @param {object} body - Request body
   * @returns {Promise} - API response
   */
  async callCloudFunction(functionName, body = {}, { timeout = 30000 } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${this.cloudFunctionsUrl}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`[CF] ${functionName} timeout after ${timeout}ms`);
      }
      console.error(`[CF] Error calling ${functionName}:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  // ----- PROJECT SEARCH OPERATIONS -----

  /**
   * Tìm mã công trình MỚI tiếp theo (ví dụ: PP-18 → PP-19)
   * @param {string} maCongTy - Mã công ty (ví dụ: "105-PP")
   * @returns {Promise<{found: boolean, ten_viet_tat_moi: string, ma_cong_ty: string}>}
   */
  async searchNewProject(maCongTy) {
    return this.callCloudFunction('projectApi', { action: 'search-new', maCongTy });
  },

  /**
   * Tìm công trình CŨ đã tồn tại
   * @param {string} nhapString - Chuỗi tìm kiếm (tên viết tắt hoặc tên tiếng Nhật)
   * @param {string} maCongTy - Mã công ty
   * @returns {Promise<{found: boolean, ten_tieng_nhat: string, ten_viet_tat: string}>}
   */
  async searchOldProject(nhapString, maCongTy) {
    return this.callCloudFunction('projectApi', { action: 'search-old', nhapString, maCongTy });
  },

  /**
   * Lấy Windows Server folder paths
   * @param {string} messageId - Message ID
   * @param {string} maCongTy - Mã công ty
   * @param {string} congTrinhVT - Tên viết tắt
   * @param {string} tenCTrTiengNhat - Tên tiếng Nhật
   * @returns {Promise<{link_den: string, link_cong_trinh: string, link_di: string, ten_folder: string}>}
   */
  async getProjectLinks(messageId, maCongTy, congTrinhVT, tenCTrTiengNhat) {
    return this.callCloudFunction('projectApi', {
      action: 'get-links',
      messageId,
      maCongTy,
      congTrinhVT,
      tenCTrTiengNhat
    });
  },

  // ----- PROJECT CREATE OPERATIONS -----

  /**
   * Tạo công trình mới vào TONG HOP
   */
  async createProject(projectData) {
    return this.callCloudFunction('projectApi', {
      action: 'create',
      messageId: projectData.messageId,
      maCongTy: projectData.maCongTy,
      congTrinhVT: projectData.congTrinhVT,
      tenCTrTiengNhat: projectData.tenCTrTiengNhat,
      toEmail: projectData.toEmail,
      soPJ: projectData.soPJ,
      force: projectData.force || false
    });
  },

  // ----- FORM B1 OPERATIONS (Cloud Functions) -----

  /**
   * Lưu form B1 vào Google Sheets
   * @param {object} formData - Form data object
   * @returns {Promise<{success: boolean, message: string, row: number}>}
   */
  async saveFormDataCloudRun(formData) {
    return this.callCloudFunction('projectApi', { action: 'save-form', ...formData });
  },

  /**
   * Tìm/sinh mã khách hàng MỚI tiếp theo trong TONG HOP
   * @param {string} maKhachMax - Prefix mã khách (ví dụ: "JK", "HE", "ID")
   */
  async checkKhachHangNew(maKhachMax) {
    return this.callCloudFunction('projectApi', { action: 'check-khach-hang-new', maKhachMax });
  },

  /**
   * Lưu thông tin danh bạ vào sheet CHECK
   */
  async saveDanhBa(danhBaData) {
    return this.callCloudFunction('projectApi', {
      action: 'save-danh-ba',
      messageId: danhBaData.messageId,
      danhBaWebsite: danhBaData.danhBaWebsite || '',
      danhBaCongTy: danhBaData.danhBaCongTy || '',
      danhBaChiNhanh: danhBaData.danhBaChiNhanh || '',
      danhBaHo: danhBaData.danhBaHo || '',
      danhBaTen: danhBaData.danhBaTen || '',
      danhBaSoPhone: danhBaData.danhBaSoPhone || '',
      danhBaSoMobile: danhBaData.danhBaSoMobile || '',
      danhBaMaCongTy: danhBaData.danhBaMaCongTy || '',
      danhBaMotNhieu: danhBaData.danhBaMotNhieu || '',
      danhBaCachGuiFile: danhBaData.danhBaCachGuiFile || '',
      danhBaEmail: danhBaData.danhBaEmail || '',
      danhBaEmailCC: danhBaData.danhBaEmailCC || '',
      danhBaToEmail: danhBaData.danhBaToEmail || '',
      danhBaKyHieuTiem: danhBaData.danhBaKyHieuTiem || ''
    });
  },

  /**
   * Thêm dòng mới vào sheet CHECK
   * @param {string} messageId - MessageID đầy đủ (ví dụ: "19cd2dfa86bfb9dd#3.2")
   */
  async addRow(messageId) {
    return this.callCloudFunction('projectApi', { action: 'add-row', messageId });
  }
};

// Make available globally
window.ApiClient = ApiClient;

console.log('[ApiClient] Module loaded (POST mode)');
