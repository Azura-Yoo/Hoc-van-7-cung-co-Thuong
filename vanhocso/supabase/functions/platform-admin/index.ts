import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://vanhocso.hocvancungcothuong.workers.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401);

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Invalid session" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("teacher_profiles")
      .select("is_platform_admin").eq("user_id", authData.user.id).single();
    if (profileError || profile?.is_platform_admin !== true) {
      return reply({ error: "Chỉ quản trị viên nền tảng mới được thực hiện thao tác này." }, 403);
    }

    const body = await req.json();
    if (body?.action === "overview") {
      const [{ data: profiles, error: pe }, { data: spaces, error: se }, { data: users, error: ue }] = await Promise.all([
        admin.from("teacher_profiles").select("user_id,full_name,created_at").eq("is_platform_admin", false).order("created_at", { ascending: false }),
        admin.from("teacher_spaces").select("teacher_id,slug,display_name,is_active"),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (pe || se || ue) return reply({ error: pe?.message || se?.message || ue?.message }, 500);
      const userMap = new Map((users.users || []).map((u: any) => [u.id, u.email || ""]));
      const spaceMap = new Map((spaces || []).map((s: any) => [s.teacher_id, s]));
      const teachers = (profiles || []).map((p: any) => {
        const s: any = spaceMap.get(p.user_id);
        return { user_id: p.user_id, full_name: p.full_name, email: userMap.get(p.user_id) || "",
          slug: s?.slug || "", display_name: s?.display_name || "", is_active: s?.is_active ?? false, created_at: p.created_at };
      });
      return reply({ total_teachers: teachers.length, total_spaces: (spaces || []).length,
        active_spaces: (spaces || []).filter((s: any) => s.is_active).length, teachers });
    }

    if (body?.action === "invite_teacher") {
      const email = String(body.email || "").trim().toLowerCase();
      const fullName = String(body.full_name || "").trim();
      const slug = String(body.slug || "").trim().toLowerCase();
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return reply({ error: "Email chưa hợp lệ." }, 400);
      if (fullName.length < 2 || fullName.length > 120) return reply({ error: "Họ tên cần từ 2 đến 120 ký tự." }, 400);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48) return reply({ error: "Mã không gian chỉ gồm chữ thường, số và dấu gạch ngang." }, 400);
      const { data: existing } = await admin.from("teacher_spaces").select("slug").eq("slug", slug).maybeSingle();
      if (existing) return reply({ error: "Mã không gian này đã được sử dụng." }, 409);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://vanhocso.hocvancungcothuong.workers.dev/giao-vien",
        data: { full_name: fullName, space_slug: slug },
      });
      if (error) return reply({ error: error.message }, 400);
      return reply({ ok: true, invited_email: email, user_id: data.user?.id });
    }

    if (body?.action === "update_teacher") {
      const userId = String(body.user_id || "");
      const fullName = String(body.full_name || "").trim();
      const slug = String(body.slug || "").trim().toLowerCase();
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: "Mã giáo viên không hợp lệ." }, 400);
      if (fullName.length < 2 || fullName.length > 120) return reply({ error: "Họ tên cần từ 2 đến 120 ký tự." }, 400);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48) return reply({ error: "Mã không gian chỉ gồm chữ thường, số và dấu gạch ngang." }, 400);
      const { data: target, error: te } = await admin.from("teacher_profiles").select("user_id,is_platform_admin").eq("user_id", userId).single();
      if (te || !target || target.is_platform_admin) return reply({ error: "Không tìm thấy giáo viên hoặc không thể sửa tài khoản quản trị." }, 404);
      const { data: collision } = await admin.from("teacher_spaces").select("teacher_id").eq("slug", slug).neq("teacher_id", userId).maybeSingle();
      if (collision) return reply({ error: "Mã không gian này đã được giáo viên khác sử dụng." }, 409);
      const { error: pError } = await admin.from("teacher_profiles").update({ full_name: fullName }).eq("user_id", userId);
      if (pError) return reply({ error: pError.message }, 400);
      const { error: sError } = await admin.from("teacher_spaces").update({ slug, display_name: fullName }).eq("teacher_id", userId);
      if (sError) return reply({ error: sError.message }, 400);
      return reply({ ok: true });
    }
    return reply({ error: "Unknown action" }, 400);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});