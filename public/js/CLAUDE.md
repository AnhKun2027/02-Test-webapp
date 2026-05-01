# Frontend JS — Conventions

## Kiến trúc hiện tại
- **ES modules** — tất cả file dùng `type="module"`, giao tiếp qua `export/import`
- Một số file vẫn gán `window.*` cho cross-folder call (tránh circular: `file-manager → app/`)
- **Central state:** `window.appState` — nhiều file đọc/ghi (app-core, app-init, app-toolbar, app-save, file-manager, overlay-system, ...)
- **Window bindings từ `app/index.js`** — chỉ 6 cái thực sự cần:
  - `appState`, `showLoading`, `hideLoading` — dùng từ overlay-system, file-manager, ai/, email-composer
  - `loadText` — file-manager/file-loader.js gọi (cross-folder, tránh circular)
  - `saveAndSyncAll` — ai-processing.js, email-send.js gọi
  - `exitSelectMode` — app-core.js gọi (tránh circular: app-core ↔ app-toolbar)
- **Load order** trong webapp.html (lines 778-801) — thay đổi thứ tự = lỗi im lặng
- Chi tiết load order + dependency layers: xem **docs/ARCHITECTURE.md**

## Export pattern
```javascript
// ES module export (chính):
export function functionName() { ... }

// Legacy window export (chỉ khi cần cho HTML onclick hoặc cross-module chưa refactor):
window.functionName = functionName;
```

## Guard pattern (gọi cross-file, legacy)
```javascript
// Vẫn còn dùng ở một số file chưa refactor hoàn toàn
if (typeof functionName === 'function') {
  functionName();
}
```

## File switching — 2 code path riêng biệt (KHÔNG gọi lẫn nhau)
- `loadFile()` (app/app-core.js) — Initial load, reset page = 1
- `switchToLocalFile()` (app/app-toolbar.js, dòng ~250) — User click, restore lastPage

## Dependency chain khi switch file (thứ tự KHÔNG được đảo)
1. `appState.currentFile = file`
2. `appState.currentFileIndex = files.indexOf(file)`
3. `appState.currentPage = 1/lastPage` ← PHẢI trước renderSelections
4. `window.currentFileId = file.id` ← PHẢI trước renderSelections
5. Cleanup stale UI
6. Load content (loadPDF / loadImage / loadText)

⚠️ `renderSelectionsForCurrentPage()` KHÔNG tự gọi trong `loadFile()` — caller tự gọi sau khi cần (changePage, loadText, v.v.)

## Early return phải tự cleanup
Mọi early return path đều phải update global state + cleanup UI trước khi return.

## App module structure (app/)
Tách từ old app.js — mỗi file một trách nhiệm:
- `app/index.js`         — Entry point: window bindings + DOMContentLoaded (KHÔNG re-export, KHÔNG file nào import từ đây)
- `app/app-core.js`      — State + loadFile, loadPDF, loadImage, loadText, page nav
- `app/app-init.js`      — initApp(): load Firebase data, realtime sync
- `app/app-toolbar.js`   — UI event handlers: buttons, zoom, tag filters, switchToLocalFile
- `app/app-save.js`      — Save & sync operations
- `app/app-ai-config.js` — AI model config UI: initAiModelConfig()

## B1-Form module (b1-form/)
- `b1-form/index.js`           — Entry point: re-exports + window bindings
- `b1-form/b1-form-core.js`    — Form loading, state, validation
- `b1-form/b1-form-actions.js` — Action handlers (save, search, folder)
- `b1-form/b1-form-template.js` — HTML template cho form
- `b1-form/b1-form-diem.js`    — Tính điểm công trình
- `b1-form/b1-form-email.js`   — Email preview listeners

## Save/Sync
Chi tiết: xem **docs/SYNC-FLOW.md**

## Coding Convention
Chi tiết bộ quy tắc coding convention (naming, function, file layout, module, DOM, Firebase): xem **CLAUDE.md** (root) section "Coding Convention (Frontend JS)"
