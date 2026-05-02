/**
 * AI Processing Module
 * Handles Vision API + Vertex AI Gemini processing for OCR and translation
 *
 * Flow: Frontend gửi sessionId → Cloud Functions xử lý → ghi RTDB → Frontend reload
 */

// Cloud Functions API URL - lazy eval để tránh crash nếu ApiClient chưa sẵn sàng
function getAiCloudRunUrl() {
  return window.ApiClient?.cloudFunctionsUrl || '';
}

/**
 * Process selections with Combined AI (Vision + Gemini)
 * Gọi Cloud Run endpoint và để Firebase realtime sync cập nhật UI
 */
export async function processWithAI() {
  try {
    // Kiểm tra sessionId
    const sessionId = appState.messageId;
    if (!sessionId) {
      alert('ERROR: Không tìm thấy sessionId. Vui lòng mở lại từ link hợp lệ.');
      return;
    }

    // [Fix #5] Kiểm tra selections — guard cả trường hợp không phải Array
    if (!Array.isArray(window.selections) || window.selections.length === 0) {
      alert('ERROR: Không có vùng chọn nào. Hãy tạo vùng chọn trước khi xử lý AI.');
      return;
    }

    // [Fix #2] Kiểm tra API URL trước khi showLoading — tránh lock màn hình nếu ApiClient chưa ready
    const aiUrl = getAiCloudRunUrl();
    if (!aiUrl) {
      alert('ERROR: API URL chưa được khởi tạo. Vui lòng tải lại trang.');
      return;
    }

    // [Fix #4] Auto-save trước — kiểm tra pending selections sau khi save
    if (typeof saveAndSyncAll === 'function') {
      await saveAndSyncAll();
    }
    if (typeof window.hasPendingSelections === 'function' && window.hasPendingSelections()) {
      alert('ERROR: Vẫn còn selections chưa lưu được. Vui lòng thử lại.');
      return;
    }

    // Khóa màn hình riêng cho phần gọi AI (sau khi save xong)
    showLoading('Đang xử lý AI (OCR + Dịch)...');

    // Gọi Cloud Run endpoint (timeout 3 phút — Gemini có thể xử lý lâu với nhiều selections)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONSTANTS.AI.PROCESSING_TIMEOUT);

    try {
      const response = await fetch(`${aiUrl}/processCombinedAi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal
      });

      // [Fix #3] Kiểm tra HTTP status trước khi parse JSON
      if (!response.ok) {
        throw new Error(`Server error: HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log('[AI] Response:', result);

      // Xử lý kết quả — UI được cập nhật tự động qua listenAll() realtime listener
      if (result.success) {
        if (result.errors && result.errors.length > 0) {
          console.warn('[AI] Partial errors:', result.errors);
          alert(`Xử lý AI hoàn tất, nhưng ${result.errors.length} vùng chọn bị lỗi:\n${result.errors.join('\n')}`);
        }

      } else {
        const errorMsg = result.errors?.join('\n') || result.error || 'Unknown error';
        alert(`ERROR: Lỗi xử lý AI:\n${errorMsg}`);
        console.error('[AI] Processing failed:', result);
      }

    } finally {
      // [Fix #1] clearTimeout luôn chạy — kể cả khi response.json() throw
      clearTimeout(timeoutId);
      hideLoading();
    }

  } catch (error) {
    // Đảm bảo hideLoading kể cả khi exception xảy ra TRƯỚC inner try
    hideLoading();

    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout
      ? 'Server không phản hồi trong 3 phút. Có thể đang xử lý quá nhiều selections.'
      : error.message;

    alert(`ERROR: ${errorMsg}`);
    console.error('[AI] Connection error:', error);
  }
}

// Export functions globally
window.processWithAI = processWithAI;

console.log('[AI-Processing] Module loaded (Cloud Run mode)');
