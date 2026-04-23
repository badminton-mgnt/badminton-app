# Supabase Setup Guide

## 1. Tạo Supabase Project

1. Đi tới https://supabase.com
2. Tạo account hoặc login
3. Tạo project mới
4. Copy `URL` và `ANON_KEY` vào `.env`

## 2. Cấu hình Authentication

1. Vào **Authentication** → **Providers**
2. Bật **Email** provider
3. Cài đặt email templates nếu cần

## 3. Tạo Database Schema

1. Vào **SQL Editor**
2. Tạo query mới
3. Copy toàn bộ nội dung từ `supabase/schema.sql`
4. Chạy query
5. Copy nội dung từ `supabase/triggers.sql`
6. Chạy query

## 4. Environment Variables

Copy vào `.env`:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 5. Chạy ứng dụng

```bash
npm install
npm run dev
```

Ứng dụng sẽ chạy tại http://localhost:5173

## ✅ Checklist

- [ ] Supabase project created
- [ ] Email provider enabled
- [ ] Database schema created
- [ ] Triggers created
- [ ] Environment variables set
- [ ] App running locally

## 🔐 RLS (Row Level Security)

Tất cả các tables đã có RLS enabled và policies cấu hình sẵn:

- Users chỉ có thể xem/chỉnh sửa profile của họ
- Team admins có thể quản lý members
- Users chỉ có thể xem dữ liệu trong các team của họ
- Admins/sub_admins có thể phê duyệt expenses

## 📝 Notes

- Verify email là bắt buộc
- Passwords require: 8+ chars, uppercase, lowercase, number, special char
- Session tự động lưu trữ
