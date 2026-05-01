/**
 * B1 Form Utils — Helper dùng chung cho các module b1-form
 */

/** Lấy value của input/select theo id, trả '' nếu element không tồn tại */
export const getVal = (id) => document.getElementById(id)?.value || '';

/**
 * Lặp gọi fn() khi isReady() = true. Nếu max retries vẫn chưa ready → warn và bỏ.
 * Trả về AbortController để caller có thể cancel giữa chừng (vd: loadB1Form gọi lại).
 *
 * @param {Function} fn - hàm chạy khi resource ready
 * @param {Function} isReady - kiểm tra resource đã sẵn sàng chưa
 * @param {string} label - nhãn cho warn message
 * @param {number} [max=10] - số lần retry tối đa
 * @param {number} [interval=1000] - khoảng cách giữa 2 lần retry (ms)
 * @returns {AbortController} controller — gọi .abort() để hủy
 */
export function retryUntilReady(fn, isReady, label, max = 10, interval = 1000) {
  const controller = new AbortController();

  (async () => {
    for (let i = 0; i < max; i++) {
      if (controller.signal.aborted) return;
      if (isReady()) {
        if (!controller.signal.aborted) fn();
        return;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    if (!controller.signal.aborted) {
      console.warn(`[B1Form] ${label} not ready after ${max} retries`);
    }
  })();

  return controller;
}
