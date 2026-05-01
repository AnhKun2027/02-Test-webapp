/**
 * Email Templates — Special & Other Work Types
 *
 * Templates cho: Hoan Thien Nha 69 Only, Hoan Thanh - Ket Thuc,
 *                Hen Tre, Hoi Khach, Bao Gia, Other
 */

export const TEMPLATES_SPECIAL = {

  // ╔════════════════════════════════════════════════════════════════╗
  // ║                    SPECIAL WORK TYPES                          ║
  // ╚════════════════════════════════════════════════════════════════╝

  "Hoan Thien Nha 69 Only": {
    subjectTraLoiJP: "資料確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận tài liệu｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "完成パース送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi ảnh hoàn thiện｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件の資料、確認いたしました。
TENCONGTRINHDAYDU

作業を開始いたします。
NGAYNOPまでに、完成パースをお送りさせていただきます。

よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Đã xác nhận tài liệu công trình bên dưới.
TENCONGTRINHDAYDU

Bắt đầu thực hiện.
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

  "Hoan Thanh - Ket Thuc": {
    traLoi:
`CONGTY
CHINHANH
HO様

お世話になっております。

TENCONGTRINHDAYDU
完了のご連絡、ありがとうございます。

また何かございましたら、お気軽にご連絡ください。
引き続きよろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Cảm ơn anh/chị đã thông báo hoàn thành công trình
TENCONGTRINHDAYDU.

Nếu có gì cứ liên hệ thoải mái nhé.
Mong tiếp tục được hợp tác.`
  },

  "Hen Tre": {
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

TENCONGTRINHDAYDU
の納期に関してのご相談がございまして、ご連絡させていただきました。

誠に心苦しいかぎりですが、当初提示していました
NGAYNOPCUの納期を
NGAYNOPに延期していただけないでしょうか。

ご迷惑おかけし、誠に申し訳ございませんが、
何卒ご容赦くださいますようお願い申し上げます。

取り急ぎ、納期延期のお詫びとお願いを申し上げます。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Về thời hạn giao công trình
TENCONGTRINHDAYDU
xin phép liên hệ để trao đổi.

Rất xin lỗi vì sự bất tiện, nhưng thời hạn ban đầu
NGAYNOPCU
xin được gia hạn đến NGAYNOP.

Rất mong anh/chị thông cảm.

Xin gửi lời xin lỗi và nhờ anh/chị chấp thuận việc gia hạn.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

遅延していた件、対応いたしましたので
ご確認をお願いいたします。
LINKSEND
よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Về phần đã bị trễ, đã hoàn thành xử lý.
Nhờ anh/chị xác nhận.
LINKSEND
Trân trọng.`
  },

  "Hoi Khach": {
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

TENCONGTRINHDAYDU
について、確認させていただきたい点がございまして、ご連絡させていただきました。

お忙しいところ大変恐縮ですが、
ご確認いただけますと幸いです。

何卒よろしくお願い申し上げます。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Về công trình TENCONGTRINHDAYDU
có một số điểm cần xác nhận, xin phép liên hệ trao đổi.

Rất mong anh/chị xác nhận giúp.

Xin cảm ơn.`
  },

  // ╔════════════════════════════════════════════════════════════════╗
  // ║                    OTHER TYPES (Generic)                       ║
  // ╚════════════════════════════════════════════════════════════════╝

  "Bao Gia": {
    subjectTraLoiJP: "見積り確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận báo giá｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "見積り送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi báo giá｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

見積もりと製作期間を出させていただきます。


よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Sẽ gửi báo giá và thời gian thực hiện.


Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

お見積りを添付にてお送りいたします。
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi báo giá đính kèm.
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  },

  "Other": {
    subjectTraLoiJP: "資料確認｜TENCONGTRINHDAYDU",
    subjectTraLoiVN: "Xác nhận tài liệu｜TENCONGTRINHDAYDU",
    subjectNopBaiJP: "資料送付｜TENCONGTRINHDAYDU",
    subjectNopBaiVN: "Gửi tài liệu｜TENCONGTRINHDAYDU",
    traLoi:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。


よろしくお願いいたします。`,

    traLoiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様


Trân trọng.`,

    nopBai:
`CONGTY
CHINHANH
HO様

いつもお世話になっております。

下記物件をお送りさせていただきます。
TENCONGTRINHDAYDU
LINKSEND
ご確認のほど、よろしくお願いいたします。`,

    nopBaiVN:
`Công ty CONGTY
Chi nhánh CHINHANH
Gửi: HO様

Gửi tài liệu công trình bên dưới.
TENCONGTRINHDAYDU
LINKSEND
Nhờ anh/chị xác nhận. Trân trọng.`
  }

};
