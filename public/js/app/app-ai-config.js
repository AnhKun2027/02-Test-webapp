/**
 * App AI Config — UI đổi model AI không cần deploy
 *
 * Đọc/ghi RTDB path `07_aiConfig/` — Cloud Functions đọc config này
 * (xem functions/src/shared/ai-config.ts, cache 5 phút).
 *
 * Flow:
 *   Trang load  → loadAiModelConfig()   → điền 4 input từ RTDB
 *   Bấm Save    → saveAiModelConfig()   → ghi RTDB
 */

// 4 task AI với model mặc định (= DEFAULTS bên Cloud Functions)
const AI_MODEL_FIELDS = [
  { inputId: 'aiModelTranslate',  rtdbKey: 'translate',  defaultModel: 'gemini-2.5-flash' },
  { inputId: 'aiModelClassifier', rtdbKey: 'classifier', defaultModel: 'gemini-2.5-pro'  },
  { inputId: 'aiModelCombinedAi', rtdbKey: 'combinedAi', defaultModel: 'gemini-2.5-pro'  },
  { inputId: 'aiModelChatbot',    rtdbKey: 'chatbot',    defaultModel: 'gemini-2.5-flash' },
];

const RTDB_PATH = '07_aiConfig';

/**
 * Đọc RTDB `07_aiConfig/` → điền giá trị vào 4 input trong hamburger dropdown
 * Nếu RTDB rỗng → input để trống, placeholder hiển thị default
 */
async function loadAiModelConfig() {
  if (!window.firebaseDb || !window.firebaseRef || !window.firebaseGet) {
    console.warn('[AiConfig] Firebase helpers chưa sẵn sàng');
    return;
  }
  try {
    const configRef = window.firebaseRef(window.firebaseDb, RTDB_PATH);
    const snap = await window.firebaseGet(configRef);
    const val = snap.val();
    if (!val) return;

    for (const { inputId, rtdbKey } of AI_MODEL_FIELDS) {
      const model = val[rtdbKey]?.model;
      if (model) {
        const el = document.getElementById(inputId);
        if (el) el.value = model;
      }
    }
  } catch (e) {
    console.warn('[AiConfig] Không đọc được 07_aiConfig:', e);
  }
}

/**
 * Ghi giá trị 4 input → RTDB `07_aiConfig/`
 * Ô nào để trống → dùng default model của ô đó
 * combinedAi luôn ghi kèm location="global" (Gemini 2.5 Pro yêu cầu)
 */
async function saveAiModelConfig() {
  const btn = document.getElementById('aiModelSaveBtn');
  if (!btn) return;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const config = {};
    for (const { inputId, rtdbKey, defaultModel } of AI_MODEL_FIELDS) {
      const model = document.getElementById(inputId)?.value.trim() || defaultModel;
      config[rtdbKey] = { model };
      if (rtdbKey === 'combinedAi') {
        config[rtdbKey].location = 'global';
      }
    }

    const configRef = window.firebaseRef(window.firebaseDb, RTDB_PATH);
    await window.firebaseSet(configRef, config);
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = origText; }, 2000);
  } catch (e) {
    console.error('[AiConfig] Lỗi khi save:', e);
    btn.textContent = 'Error!';
    setTimeout(() => { btn.textContent = origText; }, 2000);
  } finally {
    btn.disabled = false;
  }
}

/**
 * Gắn handler cho nút Save + load giá trị ban đầu từ RTDB
 * Được gọi 1 lần trong initApp() (app-init.js)
 */
export function initAiModelConfig() {
  const saveBtn = document.getElementById('aiModelSaveBtn');
  if (!saveBtn) {
    console.warn('[AiConfig] Không tìm thấy #aiModelSaveBtn — UI có thể chưa được thêm vào webapp.html');
    return;
  }

  saveBtn.addEventListener('click', saveAiModelConfig);
  loadAiModelConfig();
}

console.log('[AppAiConfig] Module loaded');
