import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "Bạn cần đăng nhập." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ success: false, error: "Thiếu cấu hình Supabase ở máy chủ." }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ success: false, error: "Phiên đăng nhập không hợp lệ." }, 401);

  const { data: profile } = await admin.from("profiles")
    .select("id, role, class_name, full_name")
    .eq("id", authData.user.id).single();
  if (!profile || !["teacher", "student"].includes(profile.role)) {
    return json({ success: false, error: "Không tìm thấy hồ sơ hợp lệ." }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "Dữ liệu gửi lên không hợp lệ." }, 400); }

  if (body.action === "study_assistant") {
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json({ success: false, error: "Em hãy nhập câu hỏi hoặc bài làm cần hỗ trợ." }, 400);
    if (prompt.length > 6000) return json({ success: false, error: "Nội dung tối đa 6.000 ký tự." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ success: false, error: "Trợ lý AI chưa được cấu hình khóa API ở máy chủ." }, 503);

    const system = [
      "Bạn là Trợ lý học tập Ngữ văn 7 của cô Thương, hỗ trợ học sinh THCS bằng tiếng Việt chuẩn, gần gũi, kiên nhẫn.",
      "Không viết hộ toàn bộ bài văn/đoạn văn để học sinh chép. Hãy gợi mở từng bước, hỏi lại khi thiếu dữ kiện, hướng dẫn tìm ý, lập dàn ý, chọn dẫn chứng và tự sửa.",
      "Khi chữa bài, chỉ rõ điểm tốt trước, sau đó nêu tối đa 3 vấn đề cụ thể (chính tả, dùng từ, câu, liên kết, lập luận) và đề xuất cách tự chỉnh; không bịa trích dẫn hay nội dung SGK.",
      "Với câu hỏi kiến thức, giải thích ngắn gọn, có ví dụ phù hợp lớp 7. Nếu đề bài chưa rõ, yêu cầu học sinh gửi nguyên văn đề.",
      "Không yêu cầu hoặc tiết lộ thông tin cá nhân. Không chẩn đoán hay đưa lời khuyên ngoài phạm vi học tập."
    ].join(" ");

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Người học: ${profile.full_name || "Học sinh"}; lớp: ${profile.class_name || "chưa rõ"}.\nYêu cầu: ${prompt}` }
        ]
      })
    });
    const result = await ai.json().catch(() => ({}));
    if (!ai.ok) return json({ success: false, error: result?.error?.message || "Dịch vụ AI đang bận, em thử lại sau nhé." }, 502);
    return json({ success: true, answer: result?.choices?.[0]?.message?.content || "Cô/chú trợ lý chưa tạo được phản hồi." });
  }

  if (body.action === "quiz_submit") {
    if (profile.role !== "student") return json({ success: false, error: "Chỉ học sinh mới được làm bài." }, 403);
    const activityId = String(body.activity_id || "");
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    if (!activityId) return json({ success: false, error: "Thiếu mã hoạt động." }, 400);

    const { data: activity } = await admin.from("learning_activities")
      .select("id, class_name, is_published")
      .eq("id", activityId).single();
    if (!activity || !activity.is_published || activity.class_name !== profile.class_name) {
      return json({ success: false, error: "Hoạt động không tồn tại hoặc không dành cho lớp của em." }, 404);
    }

    const { data: questions, error: questionError } = await admin.from("learning_questions")
      .select("id, correct_answer, points, explanation")
      .eq("activity_id", activityId).order("position", { ascending: true });
    if (questionError || !questions?.length) return json({ success: false, error: "Hoạt động chưa có câu hỏi." }, 400);

    let score = 0;
    let total = 0;
    const review = questions.map((q) => {
      const points = Number(q.points || 1);
      total += points;
      const correct = String(answers[q.id] ?? "").trim().toUpperCase() === String(q.correct_answer).trim().toUpperCase();
      if (correct) score += points;
      return { question_id: q.id, correct, explanation: q.explanation || "" };
    });

    const { error: saveError } = await admin.from("learning_attempts").insert({
      activity_id: activityId,
      student_id: authData.user.id,
      answers,
      score,
      total
    });
    if (saveError) return json({ success: false, error: "Không lưu được kết quả: " + saveError.message }, 500);
    return json({ success: true, score, total, review });
  }

  return json({ success: false, error: "Thao tác không được hỗ trợ." }, 400);
});
