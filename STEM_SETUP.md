# Triển khai các tính năng STEM

Các thay đổi đang nằm trên nhánh `stem-enhancements-phase1` để bảo vệ phiên bản website đang hoạt động. Chưa đưa lên website chính thức.

## 1. Cơ sở dữ liệu

Mở đúng dự án Supabase đang dùng cho website, vào **SQL Editor**, tạo truy vấn mới và chạy toàn bộ nội dung tệp:

`supabase/migrations/202611090001_stem_learning_features.sql`

Migration tạo các bảng học liệu, hoạt động, câu hỏi, lượt luyện tập và hồ sơ sản phẩm. Không sửa/xóa bảng `profiles`, `assignments`, `submissions` hoặc dữ liệu hiện có.

## 2. Triển khai Edge Function

Cần triển khai hàm mới `learning-api` từ:

`supabase/functions/learning-api/index.ts`

Nếu dùng Supabase CLI:

```bash
supabase functions deploy learning-api
```

Hàm dùng biến môi trường có sẵn `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` của môi trường Edge Functions. Không đưa Service Role Key vào mã trình duyệt.

## 3. Bật trợ lý AI

Trong Supabase Dashboard, mở **Project Settings → Edge Functions → Secrets** (tên mục có thể thay đổi theo giao diện), thêm:

- Tên: `OPENAI_API_KEY`
- Giá trị: API key OpenAI của chủ dự án

Không gửi API key qua tin nhắn hoặc đặt trong `index.html`.

Sau đó triển khai lại `learning-api` nếu cần.

## 4. Kiểm thử trước khi đưa lên website chính

- Đăng nhập giáo viên: tạo học liệu, tạo hoạt động gồm nhiều câu hỏi, xem thống kê.
- Đăng nhập học sinh lớp 7A/7C: xem đúng học liệu của lớp, làm bài trắc nghiệm, nhận điểm và giải thích, lưu sản phẩm vào hồ sơ.
- Thử đăng nhập hai vai trò để kiểm tra học sinh không đọc được đáp án đúng trước khi nộp.
- Kiểm tra lại các chức năng cũ: cấp tài khoản, giao bài, nộp bài, chấm bài, ôn tập.
- Chỉ sau khi kiểm thử đạt mới hợp nhất nhánh vào `main` và triển khai Cloudflare.

## Các phần đã chuẩn bị

- Trợ lý Ngữ văn: Edge Function hướng dẫn tìm ý, lập dàn ý và tự sửa, không viết hộ toàn bộ bài.
- Hồ sơ học tập: tổng hợp bài nộp, điểm, lượt luyện tập và sản phẩm đã lưu.
- Luyện tập tương tác: giáo viên tạo câu hỏi trắc nghiệm nhiều lựa chọn; máy chủ chấm tự động.
- Thư viện và portfolio: đăng học liệu theo lớp; học sinh lưu bài viết, nhật ký học tập, dự án và đường dẫn sản phẩm.

Lưu ý: phần giao diện gọi Edge Function mới nên Trợ lý AI và chấm trắc nghiệm chỉ hoạt động sau khi migration và function được triển khai trong đúng dự án Supabase.
