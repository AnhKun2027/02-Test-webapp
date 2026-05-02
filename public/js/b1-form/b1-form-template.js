/**
 * B1 Form Template — HTML thuần cho form B1
 * Tách từ b1-form.js để dễ bảo trì giao diện
 */

// Generate B1 Form HTML
export function generateB1FormHTML() {
  return `
    <div class="b1-embedded-wrapper">
      <div id="b1_loading" class="loading pt-40" style="display: none;">
        <div class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div>Loading...</div>
            <div class="spinner-border mt-2" style="width: 2rem; height: 2rem;" role="status">
              <span class="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      </div>

      <div id="b1_userform" class="p-2">
        <!-- Tabs -->
        <ul class="nav nav-tabs nav-sm" id="b1_pills-tab" role="tablist">
          <li class="nav-item" role="presentation">
            <a class="nav-link active py-1 px-2" id="b1_pills-work-tab" data-toggle="pill" href="#b1_pills-work" role="tab">WORK</a>
          </li>
          <li class="nav-item" role="presentation">
            <a class="nav-link py-1 px-2" id="b1_pills-Diem-tab" data-toggle="pill" href="#b1_pills-Diem" role="tab">Diem</a>
          </li>
          <li class="nav-item" role="presentation">
            <a class="nav-link py-1 px-2" id="b1_pills-other-tab" data-toggle="pill" href="#b1_pills-other" role="tab">Other</a>
          </li>
        </ul>

        <div class="tab-content mt-2" id="b1_pills-tabContent">
          <!-- TAB WORK -->
          <div class="tab-pane fade show active" id="b1_pills-work" role="tabpanel">
            <!-- Message ID + Add Row -->
            <div class="form-row mb-3">
              <div class="col-12">
                <input type="text" class="form-control form-control-sm" id="b1_O_MessageID" readonly placeholder="Message ID">
              </div>
            </div>

            <!-- Flow -->
            <div class="mb-3">
              <select class="form-control form-control-sm" id="b1_O_Flow" onchange="KhiFlowThayDoi()" required>
                <option>Not Work</option>
                <option>Shared Work</option>
                <option>Work</option>
                <option>Doing</option>
                <option>Check Finish</option>
                <option>Do it again</option>
                <option>OK Finish and Send</option>
                <option>Delete Mail</option>
              </select>
            </div>

            <!-- Cong Viec -->
            <div class="mb-3">
            <select class="form-control form-control-sm" id="b1_O_CongViec" onchange="KhiGiaTriCongViecThayDoi()" required>
              <option>Goc Nhin - New</option>
              <option>MBTT - New</option>
              <option>Goc Nhin Va MBTT - New</option>
              <option>Render Anh</option>
              <option>Them Goc Nhin</option>
              <option>Chinh Goc Nhin</option>
              <option>Chinh MBTT</option>
              <option>Chinh Goc Nhin Va MBTT</option>
              <option>Chinh Anh</option>
              <option>Chinh Anh - Up Vat Lieu</option>
              <option>Chinh Anh - Up Du Lieu</option>
              <option>Chinh Anh - Up DL va VL</option>
              <option>Them Du Lieu</option>
              <option>Hoan Thien Nha 69 Only</option>
              <option>Hoan Thanh - Ket Thuc</option>
              <option>Bao Gia</option>
              <option>Other</option>
            </select>
              <div class="valid-feedback">Công việc đã chọn</div>
              <div class="invalid-feedback">Chưa chọn công việc</div>
            </div>

            <!-- Khung Cong Trinh -->
            <div id="b1_KhungCongTrinh">
              <div class="mb-3">
                <input type="text" class="form-control form-control-sm" id="b1_O_MaCongTy" placeholder="Ma Cong Ty" required
                  onkeyup="if(event.key==='Enter') window.ClickButtonCheckKhachHangNew?.()"
                  title="Khi ô mã công ty trống = Khách hàng mới&#10;Nhập mã KH mới: ID, HE, JK...&#10;• Chi nhánh mới của ID → nhập 'ID' rồi Enter&#10;• KH mới → dựa vào tên công ty hoặc tên WEB, đặt 2 chữ viết hoa rồi Enter">
                <div class="valid-feedback">Mã công ty OK</div>
                <div class="invalid-feedback">Nhập mã KH mới JK,HE,KE,... + Enter</div>
              </div>
              <div class="mb-3">
                <input type="text" class="form-control form-control-sm" id="b1_O_CongTrinhVT" placeholder="Ten Cong Trinh Viet Tac" required style="color: #0D47A1; font-weight: bold;"
                  onkeyup="if(event.key==='Enter' && this.value!=='') window.ClickButtonKiemTraCongTrinhCoDangTonTai?.()">
                <div class="valid-feedback">Tìm thấy công trình</div>
                <div class="invalid-feedback">Chưa tìm thấy công trình</div>
              </div>

              <!-- Khung Nhap ID (hidden by default) - 3 fields: SoPJ + KyHieuTiem + NhapTenTiengNhat -->
              <div id="b1_KhungNhapID" style="display: none; background: #ffe0b2; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <div class="form-row mb-3">
                  <div class="col-5"><input type="text" class="form-control form-control-sm" id="b1_O_SoPJ" placeholder="PJ-xxx" onchange="NhapTenCongTrinhID()"></div>
                  <div class="col-7"><input type="text" class="form-control form-control-sm" id="b1_O_KyHieuTiem" placeholder="（本）" onchange="NhapTenCongTrinhID()"></div>
                </div>
                <input type="text" class="form-control form-control-sm" id="b1_O_NhapTenTiengNhat" placeholder="Nhap Ten Tieng Nhat" onchange="NhapTenCongTrinhID()">
              </div>

              <div style="margin-bottom: 8px;">
                <input type="text" class="form-control form-control-sm" id="b1_O_TenCTrTiengNhat" placeholder="Ten Cong Trinh Tieng Nhat" required readonly>
                <div class="valid-feedback">Tên tiếng Nhật OK</div>
                <div class="invalid-feedback">Chưa có tên tiếng Nhật</div>
              </div>
              <!-- Khung Tạo Công Trình (ẩn mặc định, chỉ hiện khi CongViec chứa "New") -->
              <div id="b1_KhungTaoCongTrinh" style="display: none; background: rgb(187, 222, 251); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <div class="form-row">
                  <div class="col-8">
                    <button type="button" class="btn btn-primary btn-sm btn-block" id="b1_N_TaoCongTrinh" onclick="ClickButtonTaoCongTrinhMoi()">+ Tao Cong Trinh Moi</button>
                  </div>
                  <div class="col-4">
                    <input type="text" class="form-control form-control-sm text-center" id="b1_O_TrangThaiTaoCT" value="" style="font-weight: bold;">
                  </div>
                </div>
              </div>

              <!-- Folder inputs (hiện để debug) -->
              <input type="text" class="form-control form-control-sm mb-1" id="b1_O_FolderMail" readonly>
              <input type="text" class="form-control form-control-sm mb-1" id="b1_O_FolderServer" readonly>
              <input type="text" class="form-control form-control-sm mb-1" id="b1_O_FolderSend" readonly>

              <!-- Folder buttons -->
              <div class="form-row mb-3">
                <div class="col-4">
                  <button type="button" class="btn btn-light btn-sm btn-block" id="b1_N_FolderMail" onclick="CopyFolderMail()">Mail</button>
                </div>
                <div class="col-4">
                  <button type="button" class="btn btn-light btn-sm btn-block" id="b1_N_FolderServer" onclick="CopyFolderServer()">CT</button>
                </div>
                <div class="col-4">
                  <button type="button" class="btn btn-light btn-sm btn-block" id="b1_N_FolderSend" onclick="CopyFolderSend()">Gui</button>
                </div>
              </div>

              <!-- Tạo Folder Mới (chỉ hiện trong Electron) -->
              <div class="form-row mb-3" id="b1_row_TaoFolder" style="display:none">
                <div class="col-12">
                  <button type="button" class="btn btn-outline-secondary btn-sm btn-block" id="b1_N_TaoFolder" onclick="ClickButtonTaoFolderMoi()">+ Tạo Folder Mới</button>
                </div>
              </div>

              <!-- Nhan Vien + AI -->
              <div class="form-row mb-3">
                <div class="col-9">
                  <select class="form-control form-control-sm" id="b1_O_NhanVien" onchange="NhanVienThayDoi()">
                    <option selected>Chua chon NV ...</option>
                    <!-- Options loaded from Firebase RTDB /04_employees -->
                  </select>
                  <div class="valid-feedback">Nhân viên đã chọn</div>
                  <div class="invalid-feedback">Chưa chọn nhân viên</div>
                </div>
                <div class="col-3">
                  <button type="button" class="btn btn-outline-warning btn-sm btn-block" id="b1_N_TimKiemNhanSuAI" onclick="hamchayAI()" disabled>AI</button>
                </div>
              </div>

              <!-- Ghi Chu Cong Viec -->
              <input type="text" class="form-control form-control-sm mb-3" id="b1_O_GhiChuCongViec" placeholder="Chu Y">

              <!-- Ngay + Gio -->
              <div class="form-row mb-3">
                <div class="col-4"><input type="text" class="form-control form-control-sm" id="b1_O_Thu" placeholder="Thu"></div>
                <div class="col-8">
                  <input type="date" class="form-control form-control-sm" id="b1_O_NgayHoanThanh" onchange="ChangeThuMay()">
                  <div class="valid-feedback" id="b1_NgayFeedback">Ngày đã chọn</div>
                  <div class="invalid-feedback">Chưa chọn ngày</div>
                </div>
              </div>

              <div class="form-row mb-3">
                <div class="col-4"><input type="text" class="form-control form-control-sm" id="b1_O_ThuJP" placeholder="JP"></div>
                <div class="col-8">
                  <select class="form-control form-control-sm" id="b1_O_GioGui">
                    <option value="08:00">08:00</option>
                    <option value="09:00">09:00</option>
                    <option value="10:00">10:00</option>
                    <option value="11:00">11:00</option>
                    <option value="12:00">12:00</option>
                    <option value="13:00">13:00</option>
                    <option value="14:00">14:00</option>
                    <option value="15:00">15:00</option>
                    <option value="16:00">16:00</option>
                    <option value="17:00">17:00</option>
                    <option value="18:00">18:00</option>
                    <option value="19:00" selected>19:00</option>
                    <option value="20:00">20:00</option>
                    <option value="21:00">21:00</option>
                  </select>
                </div>
              </div>

              <!-- So Gio Truoc -->
              <div class="form-row mb-3">
                <div class="col-4"><input type="number" class="form-control form-control-sm" id="b1_O_SoGioTruoc"></div>
                <div class="col-8">
                  <select class="form-control form-control-sm" id="b1_O_ChonSoGioTruoc" onchange="SoGioTruocThayDoi()">
                    <option selected>Before...hours</option>
                    <option>Before 0 hours</option>
                    <option>Before 2 hours</option>
                    <option>Before 4 hours</option>
                    <option>Before 1 day</option>
                    <option>Before 2 days</option>
                    <option>Before 3 days</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Tra Loi -->
            <div class="form-row mb-3">
              <div class="col-12">
                <select class="form-control form-control-sm" id="b1_O_TraLoi" onchange="TraLoiThayDoi()" required>
                  <option>No_Reply</option>
                  <option>Wait_Reply</option>
                  <option>Now_Reply</option>
                  <option>TraLoiChung_Chinh</option>
                  <option>TraLoiChung_Phu</option>
                  <option>REPLIED</option>
                </select>
                <div class="valid-feedback">Trả lời đã chọn</div>
                <div class="invalid-feedback">Chưa chọn trả lời</div>
              </div>
            </div>

            <!-- Gui Bai -->
            <div class="form-row mb-3">
              <div class="col-12">
                <select class="form-control form-control-sm" id="b1_O_GuiBai" onchange="GuiBaiThayDoi()" required>
                  <option>No_Send</option>
                  <option>Wait_Send</option>
                  <option>Can_Send</option>
                  <option>Link_Send</option>
                  <option>GuiChung_Chinh</option>
                  <option>GuiChung_Chinh_Link</option>
                  <option>GuiChung_Phu</option>
                  <option>SENT</option>
                </select>
                <div class="valid-feedback">Gửi bài đã chọn</div>
                <div class="invalid-feedback">Chưa chọn gửi bài</div>
              </div>
            </div>

          </div>

          <!-- TAB DIEM -->
          <div class="tab-pane fade" id="b1_pills-Diem" role="tabpanel">
            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">So Nha</label></div>
              <div class="col-6"><input type="number" class="form-control form-control-sm" onchange="TinhDiem()" min="0" max="30" step="1" id="b1_O_SoNha" placeholder="so nha" required></div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">So View</label></div>
              <div class="col-6"><input type="number" class="form-control form-control-sm" onchange="TinhDiem()" min="0" max="10" step="1" id="b1_O_SoView" placeholder="so view" required></div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">Diem Goc</label></div>
              <div class="col-6 dblclick-editable" ondblclick="enableEditOnDblClick('b1_O_DiemGoc')" style="cursor: pointer;"><input type="number" class="form-control form-control-sm" onchange="TinhDiem()" id="b1_O_DiemGoc" min="0" disabled style="pointer-events: none;"></div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">Phan Tram</label></div>
              <div class="col-6 dblclick-editable" ondblclick="enableEditOnDblClick('b1_O_PhanTramDiem')" style="cursor: pointer;"><input type="number" class="form-control form-control-sm" onchange="TinhDiem()" id="b1_O_PhanTramDiem" min="0" step="10" disabled style="pointer-events: none;"></div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">He So</label></div>
              <div class="col-6 dblclick-editable" ondblclick="enableEditOnDblClick('b1_O_HeSo')" style="cursor: pointer;"><input type="number" class="form-control form-control-sm" onchange="TinhDiem()" id="b1_O_HeSo" min="1" max="2" step="0.5" disabled style="pointer-events: none;"></div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">Tong Diem</label></div>
              <div class="col-6"><input type="text" class="form-control form-control-sm" id="b1_O_TongDiem" disabled></div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">Trang Thai</label></div>
              <div class="col-6">
                <select class="form-control form-control-sm" id="b1_O_DiemDuTinh">
                  <option>Du Tinh</option>
                  <option>Chinh Thuc</option>
                </select>
                <div class="valid-feedback">Đã xác nhận điểm</div>
                <div class="invalid-feedback">Chưa xác nhận điểm — chọn Chinh Thuc</div>
              </div>
            </div>

            <div class="form-row mb-3">
              <div class="col-6"><label class="col-form-label" style="font-size: 12px;">So Loi</label></div>
              <div class="col-6"><input type="number" class="form-control form-control-sm" id="b1_O_SoLoi" value="0" min="0" step="1"></div>
            </div>

            <input class="form-control form-control-sm mb-3" id="b1_O_DanhGia" placeholder="Danh gia">
          </div>

          <!-- TAB OTHER -->
          <div class="tab-pane fade" id="b1_pills-other" role="tabpanel">
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DinhKemTraLoi" readonly placeholder="Dinh Kem Tra Loi">
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_ToEmail" readonly placeholder="To Email">
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_EmailKhachHang" placeholder="Email Khach Hang" readonly>
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_EmailCC" placeholder="Email CC" readonly>
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DanhBaWebsite" placeholder="DanhBa-Website">
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DanhBaCongTy" placeholder="DanhBa-Cong Ty" required>
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DanhBaChiNhanh" placeholder="DanhBa-Chi Nhanh">
            <div class="form-row mb-3">
              <div class="col-6"><input type="text" class="form-control form-control-sm" id="b1_O_DanhBaHo" placeholder="DanhBa-Ho" required></div>
              <div class="col-6">
                <select class="form-control form-control-sm" id="b1_O_DanhBaMotNhieu">
                  <option>Mot_Nguoi</option>
                  <option>Nhieu_Nguoi</option>
                </select>
              </div>
            </div>
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DanhBaTen" placeholder="DanhBa-Ten">
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DanhBaSoPhone" placeholder="DanhBa-So Phone">
            <input type="text" class="form-control form-control-sm mb-3" id="b1_O_DanhBaSoMobile" placeholder="DanhBa-So Mobile">
            <select class="form-control form-control-sm mb-3" id="b1_O_DanhBaCachGuiFile">
              <option>Nothing</option>
              <option>Link_Send</option>
              <option>1-HUY DOMAIN</option>
              <option>2-HUY EMAIL</option>
              <option>3-KHONG TRA LOI</option>
              <option>4-CHO DOI</option>
              <option>5-GAP MAT</option>
              <option>6-BAO GIA</option>
              <option>7-WORK</option>
              <option>8-DANG LAM</option>
            </select>
            <button type="button" class="btn btn-success btn-sm btn-block" id="b1_N_SaveDanhBa" onclick="ClickButtonSaveDanhBa()" disabled>Save Danh Ba</button>
          </div>
        </div>

        <!-- Save Button -->
        <button type="button" class="btn btn-primary btn-sm btn-block mt-2" id="b1_N_ButtonSaveRowPhienDich" onclick="ClickButtonSaveRowPhienDich()" disabled>&#10003; Đã lưu</button>

        <!-- Gui Tin Nhan -->
        <div class="mt-4">
          <textarea class="form-control form-control-sm mb-3" id="b1_O_GhiChuGuiNV" rows="3" placeholder="Gui thu (neu co)"></textarea>
          <button type="button" class="btn btn-outline-dark btn-sm btn-block btn-stable-text" id="b1_N_ButtonGuiThongBao" onclick="ClickButtonGuiTinNhanDenNhanVien()" disabled>Gửi Thông Báo</button>
        </div>

        <!-- Toast Notifications -->
        <div id="notifications" class="mt-2">
          <div style="background-color:salmon; display: none;" id="b1_errorNotifications" class="toast" role="alert" data-delay="2000">
            <div class="toast-body" style="font-size: 12px;">error : Con o trong</div>
          </div>
          <div style="background-color:#90EE90; display: none;" id="b1_successNotifications" class="toast" role="alert" data-delay="2000">
            <div class="toast-body" style="font-size: 12px;">success : Nhap thanh cong</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
