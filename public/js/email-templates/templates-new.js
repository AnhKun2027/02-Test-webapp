/**
 * Email Templates — New Work, Render, Additional Work
 *
 * Templates cho: Goc Nhin, MBTT, Goc Nhin Va MBTT (New),
 *                Render Anh, Them Goc Nhin, Them Du Lieu
 */

// ╔════════════════════════════════════════════════════════════════╗
// ║                     NEW WORK TYPES                             ║
// ║           (Goc Nhin, MBTT, Goc Nhin + MBTT)                    ║
// ╚════════════════════════════════════════════════════════════════╝

export const TEMPLATES_NEW = {

  "Goc Nhin - New": {
    subjectTraLoiJP: "アングル確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận làm góc nhìn｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "アングル送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi góc nhìn｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。
新規物件を送っていただき、ありがとうございました。

下記物件の資料、確認いたしました。
TENCONGTRINHDAYDU

アングル作成を開始いたします。
NGAYNOPまでに、アングルをお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Cảm ơn anh/chị đã gửi dự án mới.

Đã xác nhận tài liệu công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu tạo góc nhìn.
Sẽ gửi góc nhìn trước NGAYNOP.

Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件のアングルをお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi góc nhìn công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  },

  "MBTT - New": {
    subjectTraLoiJP: "区画図確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận làm MBTT｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "区画図送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi mặt bằng tổng thể｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。
新規物件を送っていただき、ありがとうございました。

下記物件の資料、確認いたしました。
TENCONGTRINHDAYDU

区画図作成を開始いたします。
NGAYNOPまでに、区画図をお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Cảm ơn anh/chị đã gửi dự án mới.

Đã xác nhận tài liệu công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu tạo mặt bằng tổng thể.
Sẽ gửi mặt bằng tổng thể trước NGAYNOP.

Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件の区画図をお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi mặt bằng tổng thể công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  },

  "Goc Nhin Va MBTT - New": {
    subjectTraLoiJP: "アングルと区画図確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận làm góc nhìn và MBTT｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "アングルと区画図送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi góc nhìn và mặt bằng tổng thể｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。
新規物件を送っていただき、ありがとうございました。

下記物件の資料、確認いたしました。
TENCONGTRINHDAYDU

アングルと区画図作成を開始いたします。
NGAYNOPまでに、アングルと区画図をお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Cảm ơn anh/chị đã gửi dự án mới.

Đã xác nhận tài liệu công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu tạo góc nhìn và mặt bằng tổng thể.
Sẽ gửi góc nhìn và mặt bằng tổng thể trước NGAYNOP.

Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件のアングルと区画図をお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi góc nhìn và mặt bằng tổng thể công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  },

  // ╔════════════════════════════════════════════════════════════════╗
  // ║                    RENDER / FINAL WORK                         ║
  // ╚════════════════════════════════════════════════════════════════╝

  "Render Anh": {
    subjectTraLoiJP: "着色確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận tô màu｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "完成パース送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi ảnh hoàn thiện｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件のアングル確定、確認いたしました。
TENCONGTRINHDAYDU

着色を開始いたします。
NGAYNOPまでに、完成パースをお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Đã xác nhận góc nhìn chốt của công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu tô màu.
Sẽ gửi ảnh hoàn thiện trước NGAYNOP.

Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件の完成パースをお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi ảnh hoàn thiện công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  },

  // ╔════════════════════════════════════════════════════════════════╗
  // ║                    ADDITIONAL WORK (THEM)                      ║
  // ╚════════════════════════════════════════════════════════════════╝

  "Them Goc Nhin": {
    subjectTraLoiJP: "追加アングル確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận thêm góc nhìn｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "追加アングル送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi góc nhìn bổ sung｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件のアングル追加内容、確認いたしました。
TENCONGTRINHDAYDU

追加アングル作成を開始いたします。
NGAYNOPまでに、追加アングルをお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Đã xác nhận nội dung thêm góc nhìn công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu tạo góc nhìn bổ sung.
Sẽ gửi góc nhìn bổ sung trước NGAYNOP.

Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件の追加アングルをお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi góc nhìn bổ sung công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  },

  "Them Du Lieu": {
    subjectTraLoiJP: "追加資料確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận tài liệu bổ sung｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "修正パース送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi ảnh chỉnh sửa｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件の追加資料、確認いたしました。
TENCONGTRINHDAYDU

パース修正の作業を開始いたします。
NGAYNOPまでに、修正パースをお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Đã xác nhận tài liệu bổ sung công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu chỉnh sửa ảnh.
Sẽ gửi ảnh chỉnh sửa trước NGAYNOP.

Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件の修正したパースをお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi ảnh đã chỉnh sửa công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  }

};
