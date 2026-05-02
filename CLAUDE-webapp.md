# CLAUDE.md — CheckCongViec Webapp

## Overview

CheckCongViec là webapp quản lý tài liệu và workflow, xây trên nền Firebase.

## Tech Stack

- **Frontend:** 86 file JS ES modules + PDF.js + Bootstrap 4 (Firebase Hosting)
- **Backend:** 11 Cloud Functions (TypeScript) + Gmail / Sheets / Vision / Gemini + Genkit
- **Data:** Firebase RTDB + Cloud Storage
- **Desktop:** Electron wrapper (optional)

## Project Structure

```
public/js/          ← Frontend JS modules
functions/src/      ← Cloud Functions TypeScript
electron/           ← Desktop wrapper
docs/               ← Tài liệu chi tiết (progressive disclosure)
utils/              ← Pure utility functions (CommonJS, no DOM/Firebase deps)
```

| Doc | Nội dung |
|-----|----------|
| **CODING-CONVENTION.md** (root) | Convention 11 section: Naming, Function, File layout, Module, DOM, Firebase, Performance, ESLint, Backend TS, Patterns, KHÔNG ĐƯỢC LÀM — ở root để CodeRabbit auto-scan |
| **docs/ARCHITECTURE.md** | Kiến trúc FE/BE, load order, dependency layers, file sizes |
| **docs/DATABASE.md** | RTDB schema v3.5, SKIP_FIELDS |
| **docs/API-SPEC.md** | 11 Cloud Functions endpoints |
| **docs/SYNC-FLOW.md** | Save paths, realtime sync, chống loop 3 tầng, presence |
| **CODING-HOOKS.md** (root) | Sơ đồ flow 4 hook events + chi tiết 6 section (PreToolUse/PostToolUse/Stop + AI Judge + QA Judge) |

## Setup (dev mới onboard — mỗi máy 1 lần)
cập nhật sau
## Commands

```bash
firebase deploy --only hosting                                       # Frontend
cd functions && npm run build && firebase deploy --only functions    # Backend
```

**Test URL:** `http://127.0.0.1:5000/app?messageId=19d421940d307065`

- Luôn test trên localhost (emulator). MessageId trên là session chính thức.
- **DỮ LIỆU LÀ THẬT** — local và production dùng cùng Firebase DB/Storage.
- Hosting rewrite: `/app` → `webapp.html`
- api-client.js: `localhost` → Emulator 5001 | `web.app` → Production

| Lỗi | Fix |
|-----|-----|
| Authentication Error | `firebase login --reauth` |
| Function không tồn tại / CORS | Build + deploy functions |
| Failed to fetch (local) | Emulator chưa chạy |

## Conventions

> **KHI viết/sửa code MỚI, PHẢI đọc `CODING-CONVENTION.md` (root) TRƯỚC.**
>
> **KHI làm việc liên quan đến Claude Code hooks** (cấu hình, debug, thêm/sửa hook events, viết `settings.json`, `CODING-HOOKS.md`): PHẢI fetch `https://code.claude.com/docs/en/hooks-guide` TRƯỚC để lấy spec mới nhất.
>
> **KHI làm việc liên quan đến tự động hóa** (bất kỳ task automation nào: cron, git hook, CI/CD, batch script, dùng `claude -p` / Agent SDK): PHẢI fetch `https://code.claude.com/docs/en/headless` TRƯỚC để lấy spec mới nhất.

Format giải thích / đề xuất sửa code: xem `.claude/output-styles/vietnamese-dev.md`.

## Quirks

### Data flow (iron law)

- TẤT CẢ dữ liệu PHẢI thêm/load QUA WEBAPP — script trực tiếp bỏ qua validation, gây corrupt RTDB.
- KHÔNG upload file trực tiếp lên Storage — metadata RTDB sẽ lệch với Storage, file mồ côi.
- Key dùng `file.id` (UUID) — **KHÔNG BAO GIỜ** dùng `file.name` — tên file có thể trùng, UUID là duy nhất.

Luồng chấp nhận:

```
Gmail (auto):    Gmail → gmail-sync → Firebase Storage + RTDB
Local (manual):  Kéo thả / chọn / Ctrl+V → Webapp → Firebase
```

### Config cố định — KHÔNG đổi

- `functions/src/config.ts` dòng 8: `DELEGATED_USER = "an@futagobim.com"` — **GIỮ NGUYÊN** dù audit hay refactor.

### Quyết định thiết kế đã chốt — KHÔNG đề xuất đổi

- **File list render full rebuild (không diff-based)**: project ~10-50 file/session → `displayLocalFileList()` xoá+tạo lại toàn bộ DOM mỗi lần là CỐ Ý. Chỉ đổi sang diff-based khi N>200 hoặc render>50ms. Chi tiết: xem JSDoc tại `public/js/file-manager/file-core.js` + `CODING-CONVENTION.md` mục 7.

### Deploy

- Deploy từ `d:/Projects/01-checkcongviec-webapp` (KHÔNG dùng folder `checkcongviec-webapp` cũ).
- KHÔNG tự chạy `firebase deploy` — production và local dùng cùng Firebase DB/Storage thật, deploy nhầm là ảnh hưởng data live.
- CORS đã config cho `127.0.0.1:5000` trên `gs://checkcongviec`.

### Interaction preferences

- Refactor/tối ưu: show bảng so sánh trước/sau + sơ đồ → chờ "làm đi" / "OK" rồi mới Edit.
- Khi user hỏi dạng khám phá ("có cần tối ưu không", "thấy gì"): CHỈ liệt kê + chờ xác nhận, KHÔNG tự sửa.
- KHÔNG lưu vào `~/.claude/projects/.../memory/` — ghi trực tiếp vào file này.
- **BẮT BUỘC đọc TOÀN BỘ file trước khi đề xuất/chỉnh sửa** — để hiểu ngữ cảnh, tránh phá logic sẵn có. Sau khi sửa xong, đọc lại tổng quát file một lần nữa → đưa kết luận + tối ưu cho ngắn gọn nhất.

### Format đề xuất sửa code (BẮT BUỘC vẽ sơ đồ)

Mỗi ACTION = 1 khối sơ đồ 2 cột **TRƯỚC / SAU** bằng ký tự box-drawing (`┌ │ └ ─ ┐`), ngăn cách bởi dòng `═══...` trên + dưới. KHÔNG dump code block dài, KHÔNG bảng markdown.

Template:

```
ACTION N — <tên vấn đề>

═══════════════════════════════════════════════════════════════════════════════
  TRƯỚC (hiện tại)                  │  SAU (đề xuất)
─────────────────────────────────── │ ───────────────────────────────────────
                                    │
  <sơ đồ cũ trong khung ┌─┐>        │  <sơ đồ mới trong khung ┌─┐>
                                    │
  ✗ <vấn đề 1>                      │  ✓ <cải thiện 1>
  ✗ <vấn đề 2>                      │  ✓ <cải thiện 2>
═══════════════════════════════════════════════════════════════════════════════
```

Quy ước ký hiệu:
- `✗` = vấn đề / cái sai | `✓` = giải pháp / cái đúng
- `▼ ▲ ← →` = luồng dữ liệu / dependency
- `◄──` = annotation chỉ vào điểm cần chú ý (vd: `◄── LỆCH`, `◄── BLIND`)
- Khung `┌─┐ │ └─┘` bao quanh file/component/block logic
- Mỗi ACTION tách nhau bởi **3 dòng trống**.

## Autonomous Operation (overnight run only)

> **ÁP DỤNG KHI:** chạy unattended trên branch `auto/overnight`.
> **KHÔNG áp dụng khi:** daily work trong VS Code extension.

### Core template — Yurukusa (`claudemd-best-practices.html`)

#### Critical Safety
- Hook tự động chặn lệnh phá huỷ và push main. Khi bị hook chặn, không retry.
- Stop and report if the same error occurs 3 times in a row

#### Work Pattern
- Create a git branch for each task
- Commit after each meaningful change
- Run tests after every code change

#### Context Management
- Save work state before context compaction
- Keep TODO items in `tasks/todo.md`

### Project-specific (adapt theo structure FE/BE của repo này)

#### Scope
- Chỉ sửa: `public/js/**`, `functions/src/**`
- KHÔNG sửa: `functions/src/config.ts`, `firebase.json`, `.firebaserc`, `package.json`, `electron/**`

#### Goal
- Complete all items in `tasks/todo.md`, top-down theo priority
- Don't ask questions. Decide and act.
