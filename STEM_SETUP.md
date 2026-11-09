# Triển khai các tính năng STEM

## Trạng thái hiện tại

- Mã giao diện đã được hợp nhất vào nhánh `main` trong PR #1.
- Hai migration `stem_learning_features` và `stem_attempts_server_only` đã chạy thành công trên Supabase project `xhgxxbjdidpkizxvrsfo`.
- Edge Function `learning-api` đã triển khai thành công và yêu cầu JWT hợp lệ.
- Đã kiểm tra quyền cơ sở dữ liệu: học sinh không thể đọc `correct_answer` và không thể tự ghi/sửa điểm luyện tập.
- Việc cập nhật website Cloudflare cần xác nhận trạng thái deploy trong Cloudflare Dashboard. Không có bằng chứng deploy tự động đã hoàn tất trong lần triển khai này.

## 1. Cơ sở dữ liệu

Đã áp dụng các migration:
- `stem_learning_features`: tạo `learning_resources`, `learning_activities`, `learning_questions`, `learning_attempts`, `learning_portfolio`, chính sách RLS và view an toàn `learning_questions_public`.
- `stem_attempts_server_only`: chỉ cho Edge Function phía máy chủ ghi kết quả luyện tập; học sinh không thể tự gửi điểm giả qua Data API.

Không sửa/xóa bảng hoặc dữ liệu hiện có trong `profiles`, `assignments`, `submissions`.

## 2. Edge Function

Hàm `learning-api` đã được triển khai trong đúng dự án Supabase:
- `study_assistant`: gọi OpenAI từ máy chủ, hướng dẫn học sinh tự tìm ý, lập dàn ý và chỉnh sửa.
- `quiz_submit`: đọc đáp án đúng phía máy chủ, chấm và lưu kết quả.
- JWT verification đang bật.
- Dùng biến môi trường Supabase được cấp cho Edge Functions; tuyệt đối không đưa Service Role Key vào trình duyệt.

## 3. Cấu hình trợ lý AI

Cần bảo đảm Supabase Edge Function Secrets có:
- Tên: `OPENAI_API_KEY`
- Giá trị: API key OpenAI của chủ dự án.

Nếu chưa có secret này, tính năng Trợ lý AI sẽ trả về thông báo chưa cấu hình; phần luyện tập trắc nghiệm vẫn có thể hoạt động. Không gửi API key qua tin nhắn hoặc đặt trong `index.html`.

## 4. Phát hành Cloudflare

Mã giao diện đã nằm trên `main`. Kiểm tra Cloudflare Worker `hoc-van-7-cung-co-thuong`:
1. Mở **Workers & Pages** và chọn Worker.
2. Kiểm tra deployment mới nhất có commit merge PR #1 hay chưa.
3. Nếu Worker chưa tự cập nhật từ GitHub, triển khai phiên bản `main` theo quy trình deploy đang dùng của Worker.
4. Sau deploy, mở website bằng tài khoản giáo viên và học sinh để kiểm thử.

## 5. Kiểm thử nghiệp vụ

- Giáo viên: đăng học liệu, tạo hoạt động gồm nhiều câu hỏi, xem thống kê và portfolio của học sinh.
- Học sinh lớp 7A/7C: xem học liệu phù hợp, làm trắc nghiệm, nhận điểm và giải thích, lưu sản phẩm.
- Kiểm tra học sinh không thể đọc đáp án đúng trước khi nộp hoặc tự sửa điểm trong database.
- Kiểm tra lại các chức năng cũ: đăng nhập, cấp tài khoản, giao bài, nộp bài, chấm bài, ôn tập.

## Các tính năng STEM

- **Trợ lý Ngữ văn:** gợi mở cách hiểu đề, tìm ý, lập dàn ý và tự sửa; không viết hộ toàn bộ bài.
- **Hồ sơ học tập:** tổng hợp bài nộp, điểm, lượt luyện tập và sản phẩm đã lưu.
- **Luyện tập tương tác:** giáo viên tạo câu hỏi trắc nghiệm; máy chủ chấm tự động.
- **Thư viện học liệu:** giáo viên đăng tài liệu theo lớp hoặc dùng chung.
- **Portfolio:** học sinh lưu bài viết, nhật ký học tập, dự án và đường dẫn sản phẩm.
