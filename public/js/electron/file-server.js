/**
 * ELECTRON-FILE-SERVER.JS — Đọc file từ Server LAN
 *
 * Khi chạy trong Electron, kiểm tra file có sẵn trên server LAN không.
 * Nếu có → đọc từ server (nhanh, qua LAN).
 * Nếu không → return null → fallback về Firebase Storage.
 *
 * Browser mode: window.ServerFile = null → bỏ qua hoàn toàn.
 *
 * Sử dụng: window.ServerFile.tryLoadBinary(messageId, fileName)
 *          window.ServerFile.tryLoadText(messageId, fileName)
 */

export const ServerFile = (function () {
  // Không có electronAPI → browser mode, bỏ qua
  if (!window.electronAPI) return null;

  // Đường dẫn gốc trên server LAN (Google Drive sync từ hệ thống GAS cũ)
  const SERVER_BASE = '\\\\Server-pc\\g-everyone\\A-file den';

  // Flag: server có sẵn sàng không? Kiểm tra 1 lần duy nhất khi app mở.
  // null = chưa kiểm tra, true = OK, false = server không truy cập được
  let serverAvailable = null;

  /**
   * Kiểm tra server có truy cập được không (chạy 1 lần duy nhất)
   * Nếu không → tắt toàn bộ ServerFile, không thử lại
   */
  async function checkServer() {
    if (serverAvailable !== null) return serverAvailable;
    try {
      const check = await window.electronAPI.exists(SERVER_BASE);
      serverAvailable = check.exists;
      if (serverAvailable) {
        console.log('[ServerFile] Server LAN sẵn sàng:', SERVER_BASE);
      } else {
        console.warn('[ServerFile] Server LAN không tìm thấy:', SERVER_BASE);
      }
    } catch {
      serverAvailable = false;
      console.warn('[ServerFile] Không thể kết nối server LAN');
    }
    return serverAvailable;
  }

  /**
   * Tạo đường dẫn đầy đủ đến file trên server
   * VD: \\Server-pc\g-everyone\A-file den\19cd2dfa86bfb9dd\banve.pdf
   */
  function getFilePath(messageId, fileName) {
    return `${SERVER_BASE}\\${messageId}\\${fileName}`;
  }

  /**
   * Đọc file binary từ server LAN
   * @param {string} messageId - Session ID (tên folder trên server)
   * @param {string} fileName - Tên file gốc (giống tên trong RTDB)
   * @returns {{ base64: string, size: number } | null} - base64 data hoặc null nếu không có
   */
  async function tryLoadBinary(messageId, fileName) {
    try {
      if (!await checkServer()) return null;
      const filePath = getFilePath(messageId, fileName);

      // Kiểm tra file tồn tại trước
      const check = await window.electronAPI.exists(filePath);
      if (!check.exists) return null;

      // Đọc file binary → trả về base64
      const result = await window.electronAPI.readFileBinary(filePath);
      if (!result.success) {
        console.warn('[ServerFile] Đọc file thất bại:', filePath, result.error);
        return null;
      }

      return { base64: result.data, size: result.size };
    } catch (err) {
      // Server tắt, mất mạng LAN, permission denied... → fallback
      console.warn('[ServerFile] Lỗi truy cập server:', err.message);
      return null;
    }
  }

  /**
   * Đọc file text (UTF-8) từ server LAN
   * @param {string} messageId - Session ID
   * @param {string} fileName - Tên file gốc
   * @returns {string | null} - Nội dung text hoặc null nếu không có
   */
  async function tryLoadText(messageId, fileName) {
    try {
      if (!await checkServer()) return null;
      const filePath = getFilePath(messageId, fileName);

      const check = await window.electronAPI.exists(filePath);
      if (!check.exists) return null;

      const result = await window.electronAPI.readFile(filePath, 'utf-8');
      if (!result.success) {
        console.warn('[ServerFile] Đọc text thất bại:', filePath, result.error);
        return null;
      }

      return result.data;
    } catch (err) {
      console.warn('[ServerFile] Lỗi truy cập server:', err.message);
      return null;
    }
  }

  /**
   * Kiểm tra folder session có tồn tại trên server không
   * @param {string} messageId - Session ID
   * @returns {boolean}
   */
  async function sessionExists(messageId) {
    try {
      if (!await checkServer()) return false;
      const folderPath = `${SERVER_BASE}\\${messageId}`;
      const check = await window.electronAPI.exists(folderPath);
      return check.exists;
    } catch {
      return false;
    }
  }

  console.log('[ServerFile] Module loaded — server base:', SERVER_BASE);

  return {
    tryLoadBinary,
    tryLoadText,
    sessionExists,
    SERVER_BASE
  };
})();
window.ServerFile = ServerFile;
