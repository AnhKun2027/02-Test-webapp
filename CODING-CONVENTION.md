# Coding Convention — Frontend JS

> Áp dụng cho code MỚI. Code legacy (b1-form PascalCase, chatbot.js `var`) sẽ refactor dần.
> Tóm tắt: xem **CLAUDE.md** (root) section "Coding Convention"
> Cập nhật: 2026-04-18 — tổng hợp best practices 2024-2026 từ Google, Airbnb, MDN, ESLint, Atlassian.

---

## 1. Naming (đặt tên)

```
Tên file           →  kebab-case.js           (core-utils.js, file-upload.js)
Tên hàm export     →  camelCase               (loadFile, syncAllTextareaValues)
Tên hàm            →  BẮT ĐẦU bằng ĐỘNG TỪ   (loadFile, sendEmail, renderList)
Constants          →  UPPER_SNAKE_CASE         (FILE_TYPES, APP_CONSTANTS, CLOUD_STORAGE_BUCKET)
Constant objects   →  UPPER_SNAKE tên, camelCase keys:  const CSS_CLASS = { hideTags: 'hide-tags' };
Mutable state      →  camelCase               (appState, tagState, pendingFileDeletes)
Boolean            →  prefix is/has/can/should (isAdmin, hasPermission, canEdit, shouldRetry)
Private method     →  _camelCase prefix        (_setupBellClick, _renderList, _isAdmin)
Namespace object   →  PascalCase              (ApiClient, ChatbotSystem, NotificationSystem)
DOM element IDs    →  camelCase               (pdfWrapper, notificationBell, chatbotInput)
Console log        →  [ModuleName] message     ([App], [FileManager], [Notification])
CSS classes        →  kebab-case              (.hamburger-menu, .toolbar-inner)
TS types/interfaces →  PascalCase             (KhachHang, FileMetadata, SendEmailRequest)
RTDB keys          →  snake_case              (storage_path, page_count, created_at)
In-memory fields   →  camelCase               (storagePath, pageCount, createdAt)
```

**KHÔNG:**
- Đặt tên hàm bằng tiếng Việt (`TinhDiem`, `KhoaKhung`) — dùng English camelCase
- Đặt tên hàm PascalCase (`ClickButtonSave`) — PascalCase chỉ cho namespace object
- Dùng `_prefix` trên `export function` — `_` chỉ cho method nội bộ trong namespace object
- Tên 1 ký tự (`x`, `e`, `d`) — trừ `i`, `j` trong loop iterator
- Boolean không có prefix (`admin`, `visible`) — phải là `isAdmin`, `isVisible`
- Hàm không bắt đầu bằng động từ (`file()`, `email()`) — phải là `loadFile()`, `sendEmail()`

---

## 2. Function (cách viết hàm)

```javascript
// ĐÚNG — function declaration cho export
export function loadFile(file) { ... }

// ĐÚNG — method shorthand trong namespace object
export const MyModule = {
  init() { ... },
  _helper() { ... }
};

// ĐÚNG — arrow chỉ cho callback
items.forEach(item => processItem(item));
btn.onclick = () => handleClick();

// SAI — KHÔNG dùng arrow cho export
export const loadFile = (file) => { ... };
```

**Async:**
- `async/await` + `try/catch` — MẶC ĐỊNH cho mọi hàm async
- `.then()` CHỈ dùng khi: fire-and-forget (kèm `.catch(console.error)`), hoặc callback không thể async
- KHÔNG dùng `.then().catch()` chains dài (3+ then)

```javascript
// Async song song — dùng Promise.all cho tasks độc lập
const [result1, result2] = await Promise.all([fetchA(), fetchB()]);

// Song song cho phép fail — dùng Promise.allSettled
const results = await Promise.allSettled([fetchA(), fetchB()]);
const failed = results.filter(r => r.status === 'rejected');

// Tuần tự — khi cần kết quả bước trước
const a = await fetchA();
const b = await processA(a);
```

**KHÔNG forEach + async** (forEach KHÔNG đợi await, promise trôi tự do):
```javascript
// SAI — forEach không đợi async
users.forEach(async (user) => {
  await updateProfile(user);   // forEach bỏ qua await này!
});

// ĐÚNG — tuần tự
for (const user of users) {
  await updateProfile(user);
}

// ĐÚNG — song song
await Promise.all(users.map(u => updateProfile(u)));
```

**Floating promise** — PHẢI await hoặc void:
```javascript
// SAI — promise trôi, lỗi im lặng
sendEmail(user);

// ĐÚNG — đợi kết quả
await sendEmail(user);

// ĐÚNG — fire-and-forget CÓ Ý THỨC (PHẢI có .catch)
void sendEmail(user).catch(err => console.error('[Email] Send failed:', err));
```

**Error handling:**
- `throw Error`: khi caller CÓ try/catch sẵn (vd: load file thất bại)
- `return` / `return null`: guard clause khi thiếu input không nghiêm trọng (vd: DOM element null)
- `console.error` + `alert`: khi user cần biết (vd: API lỗi)
- KHÔNG nuốt lỗi im lặng (catch trống mà không log)
- `Error.cause` (ES2022): chain lỗi giữ nguyên stack trace gốc

**try/catch — CHỈ wrap thao tác rủi ro:**
```javascript
// SAI — wrap quá rộng, nuốt bug của pure function
try {
  const data = await fetch(url);    // risky (network)
  validate(data);                    // pure — lỗi = bug code, PHẢI crash để sửa
  await save(data);                  // risky (network)
} catch (error) {
  console.error(error);
}

// ĐÚNG — wrap chỉ network/DB/file parse
let data;
try {
  data = await fetch(url);
} catch (error) {
  throw new Error(`Fetch failed: ${error.message}`, { cause: error });
}
validate(data);                       // KHÔNG wrap — lỗi = bug, crash sớm để phát hiện
try {
  await save(data);
} catch (error) {
  throw new Error(`Save failed: ${error.message}`, { cause: error });
}
```

**Catch block — PHẢI có ít nhất 1 hành động:**
```javascript
// Cấp 1: Log + re-throw (lỗi nghiêm trọng, caller cần biết)
catch (error) {
  console.error('[Module] Critical:', error);
  throw error;
}

// Cấp 2: Log + return default (lỗi không nghiêm trọng, có fallback)
catch (error) {
  console.warn('[Module] Non-critical, using fallback:', error.message);
  return defaultValue;
}

// Cấp 3: Log + thông báo user
catch (error) {
  console.error('[Module] Failed:', error);
  alert('Thao tác thất bại: ' + error.message);
}

// Cấp 4: Ignore CÓ Ý THỨC (CHỈ khi cleanup/cancel)
catch (_error) {
  // Intentionally ignored: cancelling previous render is expected to throw
}
```

**Strict equality:**
```javascript
// SAI — == gây type coercion bất ngờ
if (count == 0)       // '' == 0 là true!
if (value != null)    // OK duy nhất: check cả null và undefined

// ĐÚNG — === luôn luôn
if (count === 0)
if (value !== null && value !== undefined)
// HOẶC: if (value != null) ← CHỈ trường hợp này OK
```

**Nullish coalescing (??) thay || cho default value:**
```javascript
// SAI — || bỏ qua giá trị falsy (0, '', false)
const count = data.count || 'Chưa có';   // count = 0 → trả 'Chưa có' (BUG!)

// ĐÚNG — ?? chỉ trigger khi null/undefined
const count = data.count ?? 'Chưa có';   // count = 0 → trả 0 (đúng!)

// QUY TẮC: || cho boolean logic. ?? cho default value.
```

**Quy tắc khác:**
- Guard clause / early return — KHÔNG nested if
- ES6 default params: `function foo(param = defaultValue)`
- `const` mặc định. `let` chỉ khi biến THỰC SỰ bị reassign (`=`). KHÔNG `var`
- Log levels: `console.log` debug/info | `console.warn` degraded nhưng chưa lỗi | `console.error` lỗi thực sự
- Comment: tiếng Việt cho business logic, tiếng Anh cho kỹ thuật
- GIỚI HẠN: dưới 50 dòng/hàm. 50-80 dòng → xem xét tách. Trên 80 dòng → PHẢI tách

---

## 3. File layout (thứ tự trong file)

```
1. JSDoc header         /** Module Name — mô tả ngắn */
2. Imports              import { foo } from './bar.js';
3. Constants            const MAX_SIZE = 100;
4. Private helpers      function _helperFn() { ... }
5. Export functions     export function mainFn() { ... }
6. Window bindings      window.mainFn = mainFn;
7. Init (nếu có)        if (readyState === 'loading') ... else initFn();
```

**JSDoc format:**
```javascript
// File header — bắt buộc
/** Module Name — mô tả ngắn (1 dòng) */

// Hàm export — bắt buộc @param + @returns
/**
 * Mô tả hàm
 * @param {string} fileId - ID của file
 * @param {Object} [options] - Tùy chọn (optional thì dùng [])
 * @returns {boolean} true nếu thành công
 */

// Hàm private — chỉ cần 1 dòng comment
/** Helper: tính điểm gốc */
function _calcScore() { ... }
```

---

## 4. Module organization (tổ chức module)

**Export pattern — chọn 1 trong 2:**

| Khi nào | Pattern | Ví dụ |
|---------|---------|-------|
| Module có state + init | `export const ObjName = { ... }` | ApiClient, ChatbotSystem, NotificationSystem |
| Module chỉ có pure functions | `export function foo() { ... }` | core-utils, tag-crud, capture-functions |

**Ưu tiên Named exports** (không dùng default export):
```javascript
// SAI — default export: typo không bị bắt
export default function calc() { ... }
import calculat from './calc';     // Typo! KHÔNG báo lỗi!

// ĐÚNG — named export: typo bị bắt ngay
export function calc() { ... }
import { calculat } from './calc'; // ERROR ngay lập tức!
```

**index.js:** CHỈ làm barrel — import → re-export → window bindings → init. **KHÔNG chứa logic.**

**Window bindings — chọn 1 cách:**
- Namespace object → `window.ModuleName = ModuleName` (1 dòng)
- Pure functions → `window.foo = foo; window.bar = bar;` (từng dòng)
- **KHÔNG làm cả hai** (namespace + bare) cho cùng 1 tập hàm

**Cross-module calls:**
```javascript
// Cùng folder → import trực tiếp
import { foo } from './bar.js';

// Khác folder → qua window binding (tránh circular dependency)
if (typeof window.foo === 'function') window.foo();
```

**Dependency direction — CHỈ chảy 1 chiều:**
```
app/ ───→ file-manager/ ───→ core-utils.js
               │
               └───→ file-constants.js

Tầng cao → Tầng thấp: OK
Tầng thấp → Tầng cao: CẤM (circular dependency)
Tool kiểm tra: madge --circular --extensions js public/js/
```

**Section separator — 1 kiểu duy nhất (3 dòng):**
```javascript
// =============================================
// SECTION TITLE
// =============================================
```

**DOM ready init — 1 pattern duy nhất:**
```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFn);
} else {
  initFn();
}
```
> KHÔNG chỉ dùng `addEventListener('DOMContentLoaded', fn)` mà không check readyState — nếu module load sau khi DOM ready, listener sẽ không bao giờ chạy.

**File size:**
- LÝ TƯỞNG: dưới 300 dòng/file. 300-400 → chấp nhận nếu gắn kết cao. Trên 400 → xem xét tách. Trên 800 → PHẢI tách
- Tách folder khi module có >= 3 file con hoặc có shared state
- Import limit: dưới 10 module khác nhau / file (quá nhiều = module đang làm quá nhiều việc)

**Circular dependency:**
- PHẢI tách shared code ra file riêng (`*-constants.js`, `*-shared.js`)
- CHỈ dùng `window.*` lazy reference khi tách file tạo thêm circular mới
- 2 module cần nhau → tách phần chung ra module thứ 3

---

## 5. DOM & Event (thao tác giao diện)

```javascript
// Query
document.getElementById('myId')              // Cho ID (nhanh nhất)
document.querySelector('.my-class')          // Cho CSS selector
document.querySelectorAll('.items')          // Cho nhiều elements

// Null check — guard clause cho 2+ elements
const bell = document.getElementById('bell');
const dropdown = document.getElementById('dropdown');
if (!bell || !dropdown) return;

// Null check — optional chaining cho single element
document.getElementById('btn')?.click();
```

**Cache DOM reference — KHÔNG query trong loop/handler:**
```javascript
// SAI — query mỗi lần mousemove
function handleMouseMove(e) {
  const canvas = document.getElementById('pdfCanvas');  // query mỗi lần!
}

// ĐÚNG — cache reference
const canvas = document.getElementById('pdfCanvas');    // cache 1 lần
function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
}
```

**Event binding — 3 cách, chọn theo ngữ cảnh:**
```javascript
// 1. JS template (generateB1FormHTML...) → ƯU TIÊN inline onclick/onchange
//    Nhìn HTML biết ngay hàm nào được gọi, inspect element thấy liền
`<button onclick="handleClick()">Click</button>`
`<select onchange="onFlowChange()">`

// 2. Element động (createElement) → gán onclick/onchange trực tiếp
const btn = document.createElement('button');
btn.onclick = () => handleClick();

// 3. addEventListener — CHỈ dùng khi bắt buộc:
//    - Event trên document/window (không có element để gắn inline)
//    - Event delegation (1 listener bắt nhiều child)
//    - Cần cleanup bằng AbortController
//    - Element tĩnh trong file .html (webapp.html) — KHÔNG inline trong .html
document.addEventListener('keydown', handleShortcut);
form.addEventListener('change', (e) => markDirty(e.target));
el.addEventListener('click', handler, { signal: controller.signal });
```

**Event delegation — cho list động (file list, thumbnails, notifications):**
```javascript
// SAI — N listeners cho N items (memory leak khi add/remove)
files.forEach(file => {
  el.addEventListener('click', () => openFile(file));   // N closures!
});

// ĐÚNG — 1 listener trên parent
list.addEventListener('click', (e) => {
  const item = e.target.closest('[data-file-id]');
  if (!item) return;
  openFile(item.dataset.fileId);                        // 1 closure, 0 leak
});

// Dùng delegation khi: list động (add/remove items)
// KHÔNG cần delegation khi: button toolbar tĩnh (singleton element)
```

**Show/hide:**
```javascript
// Dropdown — class 'show' (mặc định)
dropdown.classList.toggle('show');
dropdown.classList.remove('show');
// Ngoại lệ: hamburgerDropdown dùng class 'open' (do CSS riêng)

// Element khác — style.display
el.style.display = 'none';                   // Ẩn
el.style.display = '';                        // Hiện (reset về CSS default)

// Dropdown close — click outside
document.addEventListener('click', (e) => {
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});
```

**Listener cleanup khi thay thế DOM:**
```javascript
// Listener trên child elements → tự GC khi remove DOM (không cần cleanup)
// Listener trên document/window → PHẢI cleanup thủ công
// Pattern: dùng AbortController (xem ví dụ ở Event binding mục 3)
```

**destroy() checklist — PHẢI cleanup TẤT CẢ:**
```javascript
destroy() {
  // 1. Event listeners — abort tất cả cùng lúc
  if (this._controller) { this._controller.abort(); this._controller = null; }

  // 2. Timers
  clearTimeout(this._timer);
  clearInterval(this._interval);

  // 3. Firebase listeners
  this._listeners.forEach(unsub => unsub());
  this._listeners = [];

  // 4. Observers
  if (this._mutationObserver) this._mutationObserver.disconnect();
  if (this._intersectionObserver) this._intersectionObserver.disconnect();

  // 5. DOM references (tránh detached node leak)
  this._container = null;
  this._elements = null;

  // 6. Reset state
  this._initialized = false;
}
```

**DOM generation:**
```javascript
// User data vào DOM:
el.textContent = userData;                              // AN TOÀN — tự escape
el.innerHTML = `<div>${escapeHTML(userData)}</div>`;     // CẦN escapeHTML()
// KHÔNG BAO GIỜ:
el.innerHTML = `<div>${userData}</div>`;                 // XSS risk

// Clear container — dùng replaceChildren()
container.replaceChildren();                             // Nhanh, không parse HTML
// KHÔNG: container.innerHTML = '';                      // Chậm, phải parse

// Batch insert — dùng DocumentFragment (1 reflow thay vì N)
const frag = document.createDocumentFragment();
items.forEach(item => {
  const el = document.createElement('div');
  el.textContent = item.name;
  frag.appendChild(el);                                  // không reflow
});
container.appendChild(frag);                             // 1 reflow duy nhất
```

**Loading state:**
```javascript
// LUÔN đặt hideLoading() trong finally — tránh lock màn hình khi lỗi
try {
  showLoading('Đang xử lý...');
  await doWork();
} catch (err) {
  console.error('[Module] Lỗi:', err);
  alert('Lỗi: ' + err.message);
} finally {
  hideLoading();   // BẮT BUỘC
}
```

**setTimeout/setInterval:**
```javascript
// PHẢI lưu reference nếu có thể bị gọi lại — tránh timer leak
clearTimeout(state.timer);
state.timer = setTimeout(fn, 300);
```

**Keyboard shortcuts:**
- Guard: kiểm tra `e.target.tagName` — KHÔNG xử lý khi user đang gõ trong input/textarea (trừ Escape)
- Registry hiện tại: Ctrl+S (app-toolbar), Escape (app-toolbar + overlay-system), Delete/Ctrl+C/Ctrl+V (overlay-system)

---

## 6. Firebase & API

```javascript
// Firebase qua window wrapper — KHÔNG import trực tiếp từ SDK
const ref = window.firebaseRef(window.firebaseDb, `/sessions/${id}`);
const snap = await window.firebaseGet(ref);

// API qua ApiClient — KHÔNG gọi fetch() trực tiếp
const result = await ApiClient.callCloudFunction('functionName', { data });

// Ngoại lệ: khi cần AbortController, vẫn lấy URL từ ApiClient:
const res = await fetch(`${ApiClient.cloudFunctionsUrl}/functionName`, {
  signal: controller.signal, ...
});
```

**Firebase path — dùng template literal:**
```javascript
`05_notifications/${emailKey}`
`sessions/${sessionId}/files`
```

**update() vs set():**
```javascript
// set() — chỉ khi TẠO MỚI node (ghi đè toàn bộ)
await window.firebaseSet(ref, newData);

// update() — khi SỬA node (chỉ ghi field có trong object, giữ nguyên field khác)
await window.firebaseUpdate(ref, { updatedBy: email, updatedAt: now });
// QUAN TRỌNG: set() sẽ xóa field mà Cloud Functions đã ghi (vd: aiClassification)
```

**Đọc snapshot — dùng ?? thay ||:**
```javascript
// Khi cần phân biệt "không có node" vs "node có nhưng value = null/0/false":
if (!snapshot.exists()) return null;
const data = snapshot.val();

// Khi chỉ cần data — dùng ?? (không dùng ||)
const data = snapshot.val() ?? defaultValue;
// || sẽ bỏ qua 0, '', false — ?? chỉ trigger khi null/undefined
```

**Auth check:**
```javascript
window.firebaseAuth?.currentUser?.email
```

**Listener cleanup — BẮT BUỘC có destroy():**
```javascript
// Pattern A: Module có destroy() — dùng mảng listeners
state.listeners.push(window.firebaseOnValue(ref, callback));
// Trong destroy():
state.listeners.forEach(unsub => unsub());

// Pattern B: Module singleton (NotificationSystem, EmployeeProjects)
this._unsubscribe = window.firebaseOnValue(ref, callback);
// PHẢI có destroy():
destroy() {
  if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  this._initialized = false;
}
```

**API timeout — BẮT BUỘC có timeout:**
```javascript
// KHÔNG có timeout = fetch treo vĩnh viễn = UI lock
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
try {
  const res = await fetch(url, { signal: controller.signal, ... });
  return await res.json();
} finally {
  clearTimeout(timeoutId);
}
```

**Double-click guard cho save operations:**
```javascript
// Tránh user nhấn Ctrl+S 2 lần nhanh → 2 save chạy song song → race condition
let _isSaving = false;
export async function saveAndSyncAll() {
  if (_isSaving) return;
  _isSaving = true;
  try {
    // ... save logic
  } finally {
    _isSaving = false;
  }
}
```

**Double-check state sau mỗi await:**
```javascript
// Tránh render data cũ lên UI file mới (user switch file nhanh)
async function loadAndRender() {
  const fileId = appState.currentFile.id;
  const pdf = await loadPdf(url);              // 2-3 giây
  if (appState.currentFile?.id !== fileId)      // file đã đổi?
    return;                                     // → abort
  renderPdf(pdf);
}
```

**Global error handler:**
```javascript
// Bắt lỗi async không ai catch — tránh crash im lặng
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection:', event.reason);
});
```

---

## 7. Performance & Memory

**Cache DOM reference:**
```javascript
// SAI — query mỗi lần handler chạy (60fps = 60 query/giây)
function handleMouseMove(e) {
  document.getElementById('canvas').style.left = e.x + 'px';
}

// ĐÚNG — cache 1 lần
const canvas = document.getElementById('canvas');
function handleMouseMove(e) {
  canvas.style.left = e.x + 'px';
}
```

**Batch DOM read trước, write sau:**
```javascript
// SAI — read/write xen kẽ = N layout recalculation
elements.forEach(el => {
  const h = el.offsetHeight;         // READ → force layout
  el.style.height = h * 2 + 'px';   // WRITE → invalidate layout
});

// ĐÚNG — đọc hết trước, ghi hết sau = 1 recalculation
const heights = elements.map(el => el.offsetHeight);    // ALL READS
elements.forEach((el, i) => {
  el.style.height = heights[i] * 2 + 'px';             // ALL WRITES
});
```

**IntersectionObserver thay scroll listener (lazy load):**
```javascript
// SAI — scroll event 60fps, getBoundingClientRect() force layout
window.addEventListener('scroll', () => {
  elements.forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight) loadImage(el);
  });
});

// ĐÚNG — off main thread, zero jank
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadImage(entry.target);
      observer.unobserve(entry.target);       // cleanup sau khi load
    }
  });
}, { rootMargin: '200px' });                  // preload trước 200px

// QUAN TRỌNG: disconnect khi module destroy
observer.disconnect();
```

**requestAnimationFrame cho visual update:**
```javascript
// Gom nhiều update vào 1 paint cycle
let scheduled = false;
function scheduleUpdate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    doExpensiveUpdate();
    scheduled = false;
  });
}
```

**Debounce vs Throttle — chọn đúng loại:**
```
Debounce: chờ user DỪNG rồi mới chạy
  → Dùng cho: search input, autosave, window resize
  → ────▶ ────▶ ────▶ ───[chạy]

Throttle: chạy tối đa N lần/giây
  → Dùng cho: scroll handler, mousemove, drag
  → ─[chạy]─────[chạy]─────[chạy]─
```

**Memory leak prevention:**
```javascript
// 1. Closure — extract giá trị cần, KHÔNG giữ large object
function setup() {
  const largeData = fetchHugeArray();       // 10MB
  const name = largeData[0].name;           // extract
  btn.onclick = () => console.log(name);    // closure chỉ giữ name (string)
  // largeData sẽ bị GC sau khi setup() return
}

// 2. WeakRef cho cache DOM element (tự GC khi element bị remove)
const cache = new Map();
cache.set(fileId, new WeakRef(domElement));
function getCached(id) {
  const ref = cache.get(id);
  const el = ref?.deref();                  // null nếu đã bị GC
  if (!el) cache.delete(id);
  return el;
}

// 3. Detached DOM node — clear mảng tham chiếu trước khi re-render
const items = [];
function render() {
  items.length = 0;                          // clear ref cũ
  container.replaceChildren();               // clear DOM
  data.forEach(d => {
    const el = createElement('div');
    items.push(el);
    container.appendChild(el);
  });
}
```

**Full rebuild vs diff-based render — quyết định thiết kế:**
```
Project có data nhỏ (vd file list ~10-50 item/session):
  ĐƯỢC PHÉP full rebuild (`replaceChildren()` + forEach):
    - Đơn giản, không cần track diff
    - <10ms cho N=50, không cảm nhận được
  YÊU CẦU: caller gom nhiều thay đổi rồi gọi 1 LẦN cuối
    (vd: vòng lặp upload nhiều file → 1 render cuối, KHÔNG render mỗi vòng)

KHI NÀO mới đổi sang diff-based (chỉ remove/add element thay đổi):
  - N item > 200 thường xuyên
  - Render >50ms gây giật
  - User báo lag khi scroll/switch

Ví dụ trong project: `displayLocalFileList()` (file-manager/file-core.js)
  → Có JSDoc giải thích trade-off, KHÔNG đề xuất tối ưu trừ khi đạt threshold.
```

---

## 8. ESLint Rules (tự động bắt bug)

> Dự án hiện chưa có ESLint config cho frontend. Danh sách rules cần thiết nhất:

**Ưu tiên CAO — ngăn bug runtime:**

| Rule | Tác dụng |
|------|----------|
| `eqeqeq` | Cấm `==`/`!=`, bắt buộc `===`/`!==` — tránh type coercion |
| `prefer-const` | Auto-fix `let` → `const` khi không reassign |
| `no-var` | Cấm `var`, bắt buộc `let`/`const` |
| `no-unused-vars` | Phát hiện biến khai báo nhưng không dùng |
| `no-shadow` | Cấm biến trùng tên với outer scope |
| `consistent-return` | Mọi code path phải return hoặc không return |
| `curly` | Bắt buộc `{}` cho mọi if/else/for — tránh bug khi thêm dòng |

**Ưu tiên TRUNG BÌNH — code quality:**

| Rule | Tác dụng |
|------|----------|
| `prefer-nullish-coalescing` | `??` thay `\|\|` cho default value |
| `prefer-optional-chain` | `?.` thay `&& chain` |
| `no-param-reassign` | Cấm reassign function parameter |
| `no-throw-literal` | `throw new Error()`, không `throw 'msg'` — giữ stack trace |
| `no-loop-func` | Cấm closure trong loop — capture biến sai |
| `default-param-last` | Default parameter phải ở cuối |
| `no-magic-numbers` | Bắt buộc đặt tên cho số "ma thuật" |

---

## 9. Backend TypeScript (functions/src/)

**Config:**
- TypeScript strict mode: `strict: true`, `target: es2022`, `module: commonjs`
- Types centralized trong `functions/src/types.ts` (KhachHang, FileMetadata, SendEmailRequest...)

**Cloud Functions pattern — `createPostHandler()` factory:**
```typescript
// functions/src/index.ts — factory tự wrap onRequest + error handling
export const functionName = createPostHandler(
  "functionName",
  async (body) => {
    // business logic
    return result;
  }
);
```

**Response format chuẩn (BẮT BUỘC):**
```typescript
try {
  const result = await handler(req.body);
  res.status(200).json({ success: true, data: result });
} catch (e) {
  console.error(`[functionName] Error:`, e);
  res.status(500).json({ success: false, error: String(e) });
}
```

**AI model config — KHÔNG hardcode tên model:**
```typescript
// SAI — hardcode
const model = "gemini-2.5-flash";

// ĐÚNG — dùng helper từ shared/ai-config.ts
import { getChatbotModel } from "../shared/ai-config";
const model = `vertexai/${await getChatbotModel()}`;
// Helper khác: getTranslateModel(), getClassifierModel(), getCombinedAiModel()
```

**Retry network operations — dùng `retryWithBackoff()`:**
- Frontend: `public/js/firebase-sync/sync-core.js:10` — cho storage upload/sync
- Backend: tự implement try/catch retry khi gọi external API (Gmail, Sheets, Gemini)

**Config cố định — KHÔNG đổi:**
- `functions/src/config.ts` dòng 8: `DELEGATED_USER = "an@futagobim.com"` — GIỮ NGUYÊN

---

## 10. Patterns bắt buộc (business flow)

**File switching — 2 code path RIÊNG BIỆT, KHÔNG gọi lẫn nhau:**
```
loadFile(file)              ← app/app-core.js:60
  → Initial load khi mở app
  → Reset page = 1
  → Dùng cho: load từ Gmail, load từ cache

switchToLocalFile(index)    ← file-manager/file-core.js:334
  → User click file trong danh sách
  → Restore lastPage (giữ page cũ)
  → Debounce 150ms (FILE_SWITCH_DEBOUNCE) chống click nhanh
```

**Early return phải tự cleanup:**
```javascript
async function loadAndRender(fileId) {
  if (!fileId) {
    appState.currentFile = null;     // ← reset state trước return
    hideLoading();                    // ← cleanup UI trước return
    return;
  }
  // ... load logic
}
```

**Debounce timing chuẩn (từ `core-utils.js` APP_CONSTANTS):**
```
LOADING_DEBOUNCE:      300ms  → selections, overlays, tags autosave
DEBOUNCE_TYPING:       500ms  → text field autosave (tránh save giữa câu)
FILE_SWITCH_DEBOUNCE:  150ms  → chuyển file nhanh
```

**Central state — `window.appState` (>15 file đọc/ghi):**
- File chính: `public/js/app/index.js`
- Field chính: `currentFile`, `files`, `currentPage`, `selectedIds`, `messageId`
- Modify qua helper function, KHÔNG assign trực tiếp từ random file
- Sau `await`: RE-CHECK `appState.currentFile?.id` trước khi render (user có thể đã switch file)

**File ID — luôn dùng UUID, KHÔNG BAO GIỜ `file.name`:**
```javascript
// SAI — file.name có thể trùng, có thể đổi
appState.files[file.name] = data;

// ĐÚNG — file.id là UUID, duy nhất, bất biến
appState.files.find(f => f.id === fileId);
```

**Fetch Storage — PHẢI qua `window.firebaseAuthFetch`:**
```javascript
// Auto attach auth token, retry 401, không cần tự xử lý
const response = await window.firebaseAuthFetch(storageUrl);
```

---

## 11. KHÔNG ĐƯỢC LÀM (iron laws)

**Data handling:**
- KHÔNG thêm dữ liệu trực tiếp vào Firebase bằng console/script
  → Mọi data PHẢI qua webapp flow
- KHÔNG upload file trực tiếp lên Storage mà không qua webapp
- KHÔNG dùng `file.name` làm key — LUÔN dùng `file.id` (UUID)

**Modification scope:**
- KHÔNG sửa `firebase-config.js`, `.env`, config files mà không confirm user
- KHÔNG sửa `public/js/firebase-sync/` mà không hiểu rõ **chống loop 3 tầng**
  (xem `docs/SYNC-FLOW.md` trước khi sửa)
- KHÔNG cài thêm dependency (`npm install`) mà không confirm user
- KHÔNG refactor ngoài scope được yêu cầu
- KHÔNG đọc thư mục cũ đã lỗi thời (nếu còn tồn tại)

**Backend config (GIỮ NGUYÊN):**
- `functions/src/config.ts` dòng 8: `DELEGATED_USER = "an@futagobim.com"`
  → KHÔNG flag là "hardcoded secret", KHÔNG đề xuất đổi

**Flow control:**
- KHÔNG tự chạy `firebase deploy` — chờ user nói "deploy" rồi mới làm
- KHÔNG tự sửa code khi user chỉ hỏi "có cần tối ưu gì không" — chờ xác nhận
