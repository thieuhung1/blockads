# NetShield - Tiện Ích Chặn Quảng Cáo & IP Mạng Máy Chủ (Manifest V3)

**NetShield** là tiện ích mở rộng (Browser Extension) hiện đại dành cho Google Chrome, Microsoft Edge, Brave, Cốc Cốc... được xây dựng trên chuẩn **Manifest V3** mới nhất với công nghệ **Declarative Net Request**. Tiện ích cho phép chặn đứng các yêu cầu mạng quảng cáo, tracker theo dõi và các địa chỉ IP máy chủ độc hại ở tầng mạng với hiệu năng tối đa mà không làm chậm trình duyệt.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Chặn Quảng Cáo Theo Địa Chỉ IP Mạng (Network IP Blocking)**:
   - Chặn trực tiếp các yêu cầu gửi đến các địa chỉ IP máy chủ quảng cáo (IPv4 / IPv6).
   - Hỗ trợ thêm địa chỉ IP hoặc dải mạng thủ công hoặc dán hàng loạt (Batch input).
   - Tích hợp sẵn danh sách IP máy chủ adware, spam, đào coin và popunder độc hại.

2. **Chặn Theo Tên Miền & Mạng Quảng Cáo (Domain & Ad Network Blocking)**:
   - Tích hợp hơn 135+ quy tắc tĩnh chặn các mạng quảng cáo phổ biến nhất (Google AdSense, DoubleClick, Facebook Pixel, Criteo, Taboola, Outbrain, PopAds, Eclick, Admicro...).

3. **Giao Diện Popup Đẹp Mắt & Hiện Đại (Cyber Dark UI)**:
   - Nút bật/tắt nguồn tổng thể (Master Shield Switch) với hiệu ứng phát sáng Neon.
   - Thống kê thời gian thực: Số lượng quảng cáo & IP bị chặn trên tab hiện tại và tổng cộng.
   - Bật/Tắt chặn nhanh cho trang web đang xem (Tự động thêm vào Whitelist).
   - Ô nhập nhanh để chặn ngay lập tức một IP hoặc Domain mà không cần mở cài đặt.

4. **Bảng Điều Khiển Chuyên Sâu (Full Dashboard / Options Page)**:
   - **Tổng Quan**: Đồ họa số liệu, trạng thái bảo vệ, các thiết lập cốt lõi.
   - **Quản Lý Quy Tắc IP & Domain**: Tìm kiếm, lọc theo loại (IP / Domain), bật/tắt hoặc xóa từng quy tắc, nhập hàng loạt từ danh sách có sẵn.
   - **Danh Sách Trắng (Whitelist)**: Quản lý các trang web tin cậy được miễn trừ.
   - **Nhật Ký Mạng Trực Tiếp (Live Network Inspector)**: Giúp người dùng theo dõi mọi kết nối IP/Domain mà trang web đang gọi, kèm nút **[Chặn Ngay]** chỉ với 1 click.
   - **Sao Lưu & Khôi Phục (Backup & Restore)**: Xuất và nhập danh sách quy tắc ra file JSON để đồng bộ.

5. **Lọc Thẩm Mỹ (Cosmetic Filtering)**:
   - Tự động xóa sạch các khung hình chữ nhật quảng cáo rỗng, banner trống để giao diện trang web gọn gàng, liền mạch.

---

## 🚀 Hướng Dẫn Cài Đặt Vào Trình Duyệt

Tiện ích đã được xây dựng hoàn chỉnh và sẵn sàng để cài đặt trực tiếp vào trình duyệt qua chế độ **Developer Mode (Chế độ dành cho nhà phát triển)**:

### Bước 1: Mở trang quản lý Tiện ích mở rộng
- **Google Chrome / Cốc Cốc**: Nhập `chrome://extensions` vào thanh địa chỉ rồi nhấn Enter.
- **Microsoft Edge**: Nhập `edge://extensions` vào thanh địa chỉ rồi nhấn Enter.
- **Brave**: Nhập `brave://extensions` vào thanh địa chỉ rồi nhấn Enter.

### Bước 2: Bật "Developer Mode" (Chế độ cho nhà phát triển)
- Bật công tắc gạt **Developer mode** ở góc trên cùng bên phải màn hình.

### Bước 3: Tải thư mục Extension
- Bấm vào nút **"Load unpacked"** (hoặc **"Tải tiện ích đã giải nén"**).
- Chọn thư mục dự án này: `D:\dev\Thư mục mới` (hoặc thư mục chứa file `manifest.json`).

### Bước 4: Hoàn tất
- Biểu tượng khiên **NetShield** màu xanh neon sẽ xuất hiện trên thanh công cụ của trình duyệt.
- Bạn có thể ghim (Pin) biểu tượng ra thanh công cụ để dễ dàng theo dõi và sử dụng.

---

## 📁 Cấu Trúc Dự Án

```
├── manifest.json            # Cấu hình Manifest V3 cho trình duyệt
├── rules/
│   └── rules.json          # 135+ quy tắc tĩnh Declarative Net Request
├── background/
│   └── service_worker.js   # Service worker xử lý chặn IP, dynamic rules, badge & inspector
├── content/
│   ├── content.css         # CSS ẩn các placeholder, banner quảng cáo rỗng
│   └── content.js          # Script loại bỏ phần tử quảng cáo động
├── popup/
│   ├── popup.html          # Giao diện cửa sổ nhỏ khi bấm icon
│   ├── popup.css           # Giao diện Cyber Dark hiện đại
│   └── popup.js            # Điều khiển trạng thái nhanh & thống kê tab
├── options/
│   ├── options.html        # Trang Dashboard quản lý quy tắc IP & Domain toàn màn hình
│   ├── options.css         # Phong cách bảng điều khiển chuyên nghiệp
│   └── options.js          # Xử lý thêm, sửa, xóa IP, Whitelist, Live Inspector, Backup
├── assets/
│   ├── icon16.png          # Icon kích thước 16x16
│   ├── icon32.png          # Icon kích thước 32x32
│   ├── icon48.png          # Icon kích thước 48x48
│   └── icon128.png         # Icon kích thước 128x128
└── scripts/
    ├── generate_icons.js   # Script tạo bộ icon chuẩn PNG thuần Node.js
    └── generate_rules.js   # Script tạo bộ quy tắc tĩnh rules.json
```

---

## 🛠️ Cách Thêm Một Địa Chỉ IP Mạng Cần Chặn

1. Bấm vào biểu tượng **NetShield** trên thanh công cụ trình duyệt.
2. Tại mục **"Chặn nhanh IP / Domain máy chủ"**, nhập địa chỉ IP (ví dụ: `185.220.101.5` hoặc `192.168.1.100`) rồi bấm **Chặn**.
3. Hoặc bấm vào **"Mở Bảng Điều Khiển Chuyên Sâu"** > chọn tab **"Quy Tắc IP & Domain"** để quản lý chi tiết hoặc dán danh sách nhiều IP cùng lúc.
