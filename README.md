# NetShield Pro - Chặn Quảng Cáo, IP Mạng, Lừa Đảo & Chống Thu Thập Thông Tin (Manifest V3)

**NetShield Pro** là tiện ích mở rộng (Browser Extension) toàn diện dành cho các trình duyệt Chromium (Google Chrome, Microsoft Edge, Brave, Cốc Cốc...) chuẩn **Manifest V3**. Tiện ích tích hợp 3 lớp bảo vệ chuyên sâu: Chặn quảng cáo & IP độc hại, Khiên chống lừa đảo (Anti-Phishing) và **Khiên cấm thu thập thông tin trái phép (Anti-Tracking & Privacy Shield)**.

---

## 🔒 1. Khiên Cấm Thu Thập Thông Tin Trái Phép (Anti-Tracking & Privacy Shield)

Tính năng này bảo vệ tuyệt đối quyền riêng tư và dữ liệu nhạy cảm của bạn khi lướt web:

- **Chặn Trình Quay Lén Màn Hình & Phím Bấm (Session Replay & Keyloggers)**:
  - Ngăn chặn hoàn toàn các công cụ ghi hình chuột, thao tác form và bàn phím ngầm (như Hotjar, Microsoft Clarity, FullStory, Mouseflow, Smartlook, LogRocket, Yandex Metrica...).
- **Chống Đọc Trộm Bộ Nhớ Tạm (Anti-Clipboard Sniffing)**:
  - Chặn đứng các đoạn mã JavaScript độc hại tự động đọc dữ liệu trong Clipboard (`navigator.clipboard.readText`) để đánh cắp mật khẩu, mã OTP, số thẻ tín dụng hoặc địa chỉ ví tiền điện tử mà bạn vừa sao chép.
- **Chống Lấy Dấu Vân Tay Trình Duyệt (Anti-Canvas Fingerprinting)**:
  - Tự động gây nhiễu vi lượng các hàm render đồ họa Canvas (`toDataURL` / `getImageData`) để các công ty quảng cáo và nhà môi giới dữ liệu (Data Brokers, FingerprintJS) không thể tạo mã định danh duy nhất theo dõi bạn qua các trang web khác nhau.
- **Tự Động Bật Tín Hiệu Không Theo Dõi (Do Not Track & Global Privacy Control)**:
  - Tự động kích hoạt các header và thuộc tính `DNT: 1` và `Sec-GPC: 1` để thông báo cho máy chủ từ chối việc bán hoặc chia sẻ dữ liệu của bạn.
- **Giấu Thông Tin Pin & Phần Cứng**:
  - Vô hiệu hóa các API rò rỉ trạng thái pin (`getBattery`) để ngăn chặn việc nhận dạng phần cứng thiết bị.

---

## 🎬 2. Bộ Tối Ưu Chặn Quảng Cáo YouTube Chuyên Sâu (YouTube Ad Engine)

YouTube thường xuyên thay đổi cơ chế chống chặn quảng cáo (gây đứng hình video 5-10s hoặc hiện thông báo chặn). NetShield đã được tích hợp bộ engine chuyên sâu:
- **Tua Nhanh & Tự Động Bỏ Qua Video Ads (16x Fast-Forward & Auto-Skip)**: Khi phát hiện video quảng cáo (kể cả loại không cho bấm bỏ qua), engine tự động tăng tốc độ phát lên **16x** và tua thẳng về cuối trong **0.05 giây**, tắt tiếng tức thì để không gây ồn.
- **Tự Động Tắt Popup Cảnh Báo Của YouTube (Anti-Enforcement Dismissal)**: Tự động gỡ bỏ bảng thông báo *"Trình chặn quảng cáo vi phạm Điều khoản dịch vụ của YouTube"*, xóa màn mờ và tự động phát tiếp video liền mạch.
- **Ẩn Toàn Bộ Banner Ads Trên YouTube**: Loại bỏ sạch sẽ các banner quảng cáo trên trang chủ, trong danh sách gợi ý và khung pop-up nổi trên trình phát video.

---

## 🛡️ 3. Khiên Chống Lừa Đảo (Anti-Phishing & Anti-Scam Shield)

- **Cảnh Báo Trang Web Lừa Đảo Toàn Màn Hình**: Tự động phát hiện các website mạo danh ngân hàng (Vietcombank, MB, Techcombank...), giả mạo cổng dịch vụ công VNeID, cơ quan nhà nước, trúng thưởng giả mạo.
- **Chống Bẫy Nhấp Chuột (Anti-Clickjacking)**: Tự động loại bỏ các lớp phủ tàng hình trên các trang web lậu ép nhảy tab mới sang trang cá cược, lừa đảo.

---

## 🌐 3. Chặn Quảng Cáo Tầng Mạng & Địa Chỉ IP (Network IP Blocking)

- **211+ Quy Tắc Tĩnh Chuẩn Declarative Net Request**: Chặn Google AdSense, DoubleClick, Facebook Trackers, PopAds, Admicro, Eclick, mã độc đào coin...
- **Chặn Trực Tiếp Theo Địa Chỉ IP Máy Chủ (IPv4 / IPv6)**: Nhập nhanh IP hoặc dán danh sách IP máy chủ quảng cáo để chặn tận gốc.
- **Nhật Ký Mạng Trực Tiếp (Live Network Inspector)**: Quét các kết nối mạng thời gian thực và cho phép chặn 1-click bất kỳ máy chủ nào.

---

## 🚀 Cách Cập Nhật Extension Trong Trình Duyệt

1. Mở trang quản lý tiện ích: `chrome://extensions` (hoặc `edge://extensions`).
2. Tìm thẻ tiện ích **NetShield Pro**.
3. Bấm vào **biểu tượng mũi tên xoay tròn (Tải lại / Reload)** trên thẻ tiện ích.
4. Mở Popup lên và bạn sẽ thấy công tắc **Cấm Thu Thập Tin** màu xanh ngọc cùng 4 thẻ thống kê số liệu chi tiết!
