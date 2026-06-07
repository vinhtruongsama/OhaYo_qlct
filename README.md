# OhaYo_qlct

Ứng dụng quản lý chi tiêu cá nhân dùng Vite, JavaScript module, Tailwind CDN và Supabase.

## Cấu trúc hiện tại

```text
.
├── index.html                 # Shell HTML và markup UI chính
├── index.css                  # Theme, dark mode và style bổ trợ
├── src/
│   ├── main.js                # Entry app: state, render, event handlers
│   ├── config/
│   │   └── appConfig.js       # Hằng số, dữ liệu mặc định, màu, tỷ giá
│   ├── features/
│   │   ├── transactions/
│   │   │   └── transactionService.js
│   │   └── wallets/
│   │       └── walletService.js
│   ├── i18n/
│   │   └── translations.js    # Từ điển đa ngôn ngữ
│   ├── services/
│   │   ├── authService.js     # Đăng nhập, đăng ký, đăng xuất, session
│   │   ├── supabaseClient.js  # Supabase client
│   │   └── userDataService.js # Profile, settings, transactions API
│   ├── state/
│   │   └── appState.js        # Khởi tạo state mặc định
│   ├── storage/
│   │   └── appStorage.js      # Đọc/ghi localStorage
│   └── utils/
│       ├── currency.js        # Format/chuyển đổi tiền tệ
│       └── date.js            # Helper ngày tháng
└── supabaseClient.js          # Re-export tạm để tương thích import cũ
```

## Quy ước phát triển tiếp

- Tính năng mới nên tách theo module trong `src/features/<feature-name>/`.
- Dữ liệu mặc định và hằng số không đặt trong `src/main.js`; đưa vào `src/config/appConfig.js`.
- Chuỗi hiển thị đưa vào `src/i18n/translations.js`.
- API/client bên ngoài đặt trong `src/services/`.
- State khởi tạo đặt trong `src/state/`; đọc/ghi cache đặt trong `src/storage/`.
- Helper thuần, không phụ thuộc DOM, đặt trong `src/utils/`.
- Tránh thêm `onclick` inline mới trong HTML; ưu tiên bind event trong JavaScript để dễ kiểm tra và refactor.
