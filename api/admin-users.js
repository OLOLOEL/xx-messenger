import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function send(res, status, body) {
  res.status(status).json(body);
}

function tempPassword() {
  return `Xx!${crypto.randomBytes(8).toString("base64url")}9a`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "POST 요청만 지원합니다." });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return send(res, 500, {
      error:
        "Vercel 환경변수 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.",
    });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return send(res, 401, { error: "로그인이 필요합니다." });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const service = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return send(res, 401, { error: "유효하지 않은 로그인입니다." });
  }

  const { data: callerProfile } = await service
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", caller.id)
    .maybeSingle();

  if (
    !callerProfile ||
    callerProfile.role !== "ceo" ||
    callerProfile.is_active !== true
  ) {
    return send(res, 403, {
      error: "사장 계정만 사용할 수 있는 기능입니다.",
    });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    if (action === "create") {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      const name = String(body.name || "").trim() || null;
      const department =
        String(body.department || "").trim() || null;
      const position =
        String(body.position || "").trim() || null;
      const role = ["employee", "president", "ceo"].includes(
        body.role
      )
        ? body.role
        : "employee";

      if (!email || password.length < 8) {
        return send(res, 400, {
          error:
            "이메일과 8자 이상의 임시 비밀번호가 필요합니다.",
        });
      }

      const {
        data: created,
        error: createError,
      } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

      if (createError) throw createError;

      const userId = created.user.id;

      const { error: profileError } = await service
        .from("profiles")
        .upsert({
          id: userId,
          email,
          name,
          department,
          position,
          role,
          is_active: true,
        });

      if (profileError) {
        await service.auth.admin.deleteUser(userId);
        throw profileError;
      }

      await service.from("admin_audit_logs").insert({
        actor_id: caller.id,
        action: "create_user",
        target_user_id: userId,
        details: { email, role },
      });

      return send(res, 200, {
        ok: true,
        userId,
        email,
      });
    }

    if (action === "reset_password") {
      const userId = String(body.userId || "");

      if (!userId) {
        return send(res, 400, { error: "사용자 ID가 필요합니다." });
      }

      const password = tempPassword();

      const { error } =
        await service.auth.admin.updateUserById(userId, {
          password,
        });

      if (error) throw error;

      await service.from("admin_audit_logs").insert({
        actor_id: caller.id,
        action: "reset_password",
        target_user_id: userId,
      });

      return send(res, 200, {
        ok: true,
        temporaryPassword: password,
      });
    }

    if (action === "update_role") {
      const userId = String(body.userId || "");
      const role = String(body.role || "");

      if (
        !userId ||
        !["employee", "president", "ceo"].includes(role)
      ) {
        return send(res, 400, {
          error: "사용자 ID 또는 권한 값이 올바르지 않습니다.",
        });
      }

      if (userId === caller.id && role !== "ceo") {
        return send(res, 400, {
          error:
            "현재 로그인한 사장 계정은 자신의 사장 권한을 해제할 수 없습니다.",
        });
      }

      const { error } = await service
        .from("profiles")
        .update({ role })
        .eq("id", userId);

      if (error) throw error;

      await service.from("admin_audit_logs").insert({
        actor_id: caller.id,
        action: "update_role",
        target_user_id: userId,
        details: { role },
      });

      return send(res, 200, { ok: true });
    }

    if (action === "delete") {
      const userId = String(body.userId || "");

      if (!userId) {
        return send(res, 400, { error: "사용자 ID가 필요합니다." });
      }

      if (userId === caller.id) {
        return send(res, 400, {
          error: "현재 로그인한 사장 계정은 삭제할 수 없습니다.",
        });
      }

      // Audit target must be inserted before auth deletion.
      await service.from("admin_audit_logs").insert({
        actor_id: caller.id,
        action: "delete_user",
        target_user_id: userId,
      });

      const { error } =
        await service.auth.admin.deleteUser(userId);

      if (error) throw error;

      return send(res, 200, { ok: true });
    }

    return send(res, 400, {
      error: "지원하지 않는 관리자 작업입니다.",
    });
  } catch (error) {
    console.error(error);
    return send(res, 500, {
      error: error.message || "관리자 작업에 실패했습니다.",
    });
  }
}
