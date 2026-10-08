# NetShield Pro - Chặn Ads, IP Mạng, Lừa Đảo, Chống Thu Thập Tin & Ẩn Danh IP WebRTC (Manifest V3)

**NetShield Pro** là tiện ích mở rộng (Browser Extension) toàn diện dành cho các trình duyệt Chromium (Google Chrome, Microsoft Edge, Brave, Cốc Cốc...) chuẩn **Manifest V3**. Tiện ích tích hợp đa tầng bảo vệ chuyên sâu: Chặn quảng cáo & IP độc hại, Khiên chống lừa đảo (Anti-Phishing), Khiên cấm thu thập thông tin trái phép (Anti-Tracking) và **Khiên chống rò rỉ IP qua WebRTC & Ẩn danh IP (WebRTC IP Leak Shield)**.

---

## 🍓 1. Khiên Chống Rò Rỉ IP Thật Qua WebRTC & Ẩn Danh IP (WebRTC IP Leak Shield)

Ngay cả khi bạn dùng VPN hay Proxy, nhiều trang web và công ty quảng cáo vẫn có thể lấy được địa chỉ IP thật nội bộ hoặc IP công cộng của bạn thông qua giao thức WebRTC (gọi video/P2P trên trình duyệt). Tính năng này giải quyết triệt để nguy cơ đó:

- **Khóa Rò Rỉ IP Cấp Trình Duyệt (Chrome Privacy Policy)**: Kích hoạt chính sách `disable_non_proxied_udp`, chặn mọi luồng UDP không kiểm soát từ WebRTC có khả năng để lộ IP thực tế của máy.
- **Lọc Gói Tin ICE Candidate Tầng Trang (Dual-layer ICE Filtering)**: Can thiệp trực tiếp vào `RTCPeerConnection` trong trang web, lọc sạch các gói `typ host` và `typ srflx` chứa địa chỉ IPv4/IPv6 thật của thiết bị.
- **Thẻ Trạng Thái IP Thời Gian Thực (Live Public IP Inspector)**: Hiển thị địa chỉ IP công cộng hiện tại và biểu tượng ổ khóa bảo vệ WebRTC ngay trên giao diện Popup. Bạn có thể bật/tắt khiên chống rò rỉ IP bất cứ lúc nào chỉ với một cú nhấp chuột.

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

## 🎬 2. Bộ Tối Ưu Chặn Quảng Cáo YouTube Chuyên Sâu Cấp Độc Quyền (YouTube Turbo Engine)

YouTube liên tục cập nhật công nghệ chống trình chặn quảng cáo (chèn quảng cáo từ máy chủ, quảng cáo Shorts, popup cảnh báo 3 video). NetShield Pro đã được nâng cấp hệ thống chặn 2 tầng cực kỳ mạnh mẽ:
- **Can Thiệp Tầng Dữ Liệu Gốc Của Trình Phát (MAIN World Player Data Sanitizer)**: Can thiệp trực tiếp vào API `fetch` & `XMLHttpRequest` của YouTube đối với endpoint `/youtubei/v1/player`, bóc tách sạch sẽ toàn bộ các khối dữ liệu `adPlacements`, `playerAds`, `adSlots` trước khi trình phát kịp khởi tạo quảng cáo.
- **Tua Nhanh & Tự Động Bỏ Qua Video Ads (16x Turbo Fast-Forward & Instant Skip)**: Khi phát hiện video quảng cáo hoặc bumper ads, tự động tăng tốc lên **16x**, tua thẳng về cuối trong **0.01 giây**, tắt tiếng tức thì và mô phỏng chuỗi sự kiện chuột đa tầng bấm bỏ qua.
- **Tự Động Bỏ Qua Quảng Cáo Trong YouTube Shorts (Auto Shorts Ad Skip)**: Nhận diện các clip ngắn được tài trợ/quảng cáo trong mục Shorts và tự động cuộn lướt qua video tiếp theo.
- **Tự Động Tắt Popup Cảnh Báo Của YouTube (Anti-Enforcement Dismissal)**: Tự động gỡ bỏ bảng thông báo *"Trình chặn quảng cáo vi phạm Điều khoản dịch vụ của YouTube"*, xóa màn mờ và tự động phát tiếp video liền mạch.
- **Xóa Sạch 100% Banner, Thẻ Gợi Ý Được Tài Trợ & Masthead Ads**: Loại bỏ hoàn toàn các khung quảng cáo trên trang chủ, danh sách video đề xuất và bảng điều khiển cạnh video.

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
