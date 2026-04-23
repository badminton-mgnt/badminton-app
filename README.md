# Badminton Attendance & Expense App

Một ứng dụng web mobile-first để quản lý tham dự, chi phí và thanh toán cho các sự kiện cầu lông.

## 🎯 Tính năng

### Authentication
- ✅ Đăng ký với email + mật khẩu
- ✅ Xác thực email bắt buộc
- ✅ Đăng nhập / Đăng xuất
- ✅ Lưu trữ session

### Quản lý Sự kiện
- ✅ Tạo/chỉnh sửa sự kiện
- ✅ Danh sách sự kiện
- ✅ Nêu bật sự kiện hôm nay
- ✅ Kiểm tra sự kiện

### Hệ thống Chi phí
- ✅ Người dùng thêm chi phí
- ✅ Admin phê duyệt/từ chối
- ✅ Chỉ tính chi phí được phê duyệt
- ✅ Trạng thái: PENDING, APPROVED, REJECTED

### Thanh toán
- ✅ Hiển thị mã QR
- ✅ Thông tin ngân hàng
- ✅ Xác nhận thanh toán
- ✅ Tính toán nợ/công

### Team (Nhóm)
- ✅ Admin tạo team
- ✅ Người dùng tham gia team
- ✅ Quản lý thành viên
- ✅ Gán role trong team

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Backend**: Supabase
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account

### Installation

1. Clone repository
```bash
git clone <repo-url>
cd badminton-app
```

2. Install dependencies
```bash
npm install
```

3. Setup environment
```bash
cp .env.example .env
```

4. Add Supabase credentials to `.env`:
```
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key
```

5. Run development server
```bash
npm run dev
```

6. Open http://localhost:5173

## 📱 Mobile First Design

- Optimized for phones (primary users)
- Responsive layout
- Touch-friendly UI
- Bottom navigation

## 🎨 Design System

### Colors
- Primary Green: `#43A047`
- Secondary Light: `#66BB6A`
- Background: `#F9FAFB`
- Status: Success, Warning, Error

### Components
- Button (primary, secondary)
- Card
- Badge
- Modal (bottom sheet)
- Input
- Bottom Navigation
- Header

## 📊 Database Schema

```
users
  ├── id (uuid)
  ├── name
  └── created_at

teams
  ├── id (uuid)
  ├── name
  ├── created_by
  └── created_at

team_members
  ├── id (uuid)
  ├── team_id
  ├── user_id
  ├── role (user/sub_admin/admin)
  └── joined_at

events
  ├── id (uuid)
  ├── team_id
  ├── title
  ├── date
  ├── location
  ├── court_number
  ├── status (UPCOMING/ONGOING/COMPLETED/FINALIZED)
  ├── created_by
  └── created_at

expenses
  ├── id (uuid)
  ├── team_id
  ├── event_id
  ├── user_id
  ├── amount
  ├── description
  ├── status (PENDING/APPROVED/REJECTED)
  └── created_at

payments
  ├── id (uuid)
  ├── team_id
  ├── event_id
  ├── user_id
  ├── amount
  ├── status (PENDING/CONFIRMED)
  └── created_at

payment_info
  ├── user_id
  ├── bank_name
  ├── account_number
  ├── account_name
  └── qr_url
```

## 🔐 Security

- Supabase RLS (Row Level Security)
- Users only modify own data
- Admin assigns roles
- Admin/sub_admin approve expenses

## 📦 Build & Deploy

### Build for production
```bash
npm run build
```

### Preview
```bash
npm run preview
```

## 🌐 Deployment

- **Frontend**: GitHub Pages
- **Backend**: Supabase

## 📝 Notes

- Password requirements: 8+ chars, uppercase, lowercase, number, special char
- Real-time password validation
- Smooth animations with Framer Motion
- Clean, minimal UI design

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

Made with ❤️ for Badminton lovers
