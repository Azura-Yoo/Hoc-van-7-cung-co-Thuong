# Văn học số – Kiến trúc nền tảng

## 1. Mô hình sản phẩm

- **Văn học số** là thương hiệu và trang chủ chung, chỉ dành cho môn Ngữ văn.
- Mỗi giáo viên có một không gian riêng, được định danh bằng `teacher_spaces.slug`.
- Trong không gian của mỗi giáo viên có các nhánh theo khối: **Học Văn 6/7/8/9 cùng [tên giáo viên]**.
- URL chia sẻ hiện dùng query route `/?teacher=<slug>&grade=<6|7|8|9>` để tương thích hosting tĩnh; có thể ánh xạ sang subdomain/tên miền riêng khi cấu hình Cloudflare DNS.
- Học sinh đăng nhập bằng tài khoản đã được cấp. Tài khoản chỉ vào đúng không gian giáo viên và khối lớp gắn với hồ sơ.

## 2. Quyền sở hữu dữ liệu

- `profiles.teacher_id`: giáo viên sở hữu hồ sơ học sinh; hồ sơ giáo viên tự sở hữu bằng chính ID của mình.
- `teacher_spaces`: slug, tên hiển thị và tên miền riêng (nếu có) của từng giáo viên.
- `teacher_classes`: danh sách lớp thuộc từng giáo viên.
- `assignments.created_by`: giáo viên giao bài.
- `learning_resources.created_by` và `learning_activities.created_by`: giáo viên tạo học liệu/hoạt động.
- `submissions`, `learning_questions`, `learning_attempts` được giới hạn theo bài tập/hoạt động và chủ sở hữu tương ứng.

Không dùng tên lớp đơn lẻ làm ranh giới bảo mật vì nhiều giáo viên có thể cùng có lớp 7A. Ranh giới bắt buộc là giáo viên sở hữu cộng với lớp.

## 3. Quy tắc phân quyền

- Học sinh chỉ đọc hồ sơ của mình, bài tập đúng lớp trong không gian của giáo viên mình, bài nộp của mình và học liệu/hoạt động đã công bố.
- Giáo viên chỉ quản lý học sinh, bài tập, bài nộp, học liệu, câu hỏi và kết quả thuộc không gian của mình.
- Quản trị viên nền tảng được phép tạo tài khoản giáo viên và cấp slug/lớp; không mặc định có quyền xem bài làm riêng của các giáo viên.
- RLS ở PostgreSQL và Storage là lớp bảo vệ cuối cùng; kiểm tra giao diện/URL chỉ là lớp bổ sung.
- View `learning_questions_public` dùng `security_invoker=true` và chỉ trả về nội dung câu hỏi, không trả lời đúng hay lời giải.

## 4. AI và chấm bài

- AI chạy ở Edge Function, không đưa khóa bí mật vào trình duyệt.
- AI chỉ đưa gợi ý/chấm sơ bộ; giáo viên phải xem và duyệt trước khi công bố điểm.
- Đáp án, rubric, nhận xét nội bộ và đề xuất AI của giáo viên không được đưa vào truy vấn của học sinh.
- Điểm chính thức chỉ được ghi/công bố theo thao tác xác nhận của giáo viên.

## 5. Dữ liệu hiện hữu

Đã bổ sung quyền sở hữu giáo viên cho hồ sơ hiện tại mà không tạo lại tài khoản. Kiểm tra sau cập nhật xác nhận:
- 81 hồ sơ (1 giáo viên, 80 học sinh) đều có `teacher_id`.
- 4 bài tập, 84 bài nộp và 46 tệp trong bucket bài nộp vẫn còn.
- Kiểm tra RLS mô phỏng: giáo viên hiện tại thấy 81 hồ sơ/4 bài tập/84 bài nộp/46 tệp; học sinh mẫu chỉ thấy 1 hồ sơ/2 bài tập/4 bài nộp/0 tệp của người khác.

## 6. Trạng thái triển khai

- Đã cập nhật schema sở hữu giáo viên, `teacher_spaces`, chính sách RLS cho hồ sơ/bài tập/bài nộp/STEM/học liệu/portfolio và Storage.
- Đã cập nhật Edge Functions `clever-api` và `learning-api` để kiểm tra chủ sở hữu giáo viên.
- Đã thêm luồng quản trị tạo tài khoản giáo viên trong nhánh giao diện mới; cần kiểm thử đầu-cuối bằng một tài khoản giáo viên thử nghiệm trước khi mở rộng.
- Trang chủ và định tuyến khối lớp đang ở nhánh `van-hoc-so-homepage`, PR #2. Chưa hợp nhất vào `main` và chưa triển khai lên Cloudflare.
- Hiện chỉ không gian khối 7 có dữ liệu và đang hoạt động; khối 6, 8, 9 được giữ đúng tên, chờ hoàn thiện học liệu/lớp trước khi mở cho học sinh.
