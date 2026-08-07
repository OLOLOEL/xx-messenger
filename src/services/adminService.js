import { supabase } from "../lib/supabase";

export async function recordLogin(userId) {
  if (!userId) return;

  const { error } = await supabase
    .from("user_login_logs")
    .insert({
      user_id: userId,
      user_agent: navigator.userAgent,
    });

  if (error) {
    console.error("접속 로그 기록 실패:", error);
  }
}

export async function adminListUsers() {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return data ?? [];
}

export async function adminListConversations() {
  const { data, error } = await supabase.rpc("admin_list_conversations");
  if (error) throw error;
  return data ?? [];
}

export async function adminGetConversationMessages(conversationId) {
  const { data, error } = await supabase.rpc(
    "admin_get_conversation_messages",
    { target_conversation_id: conversationId }
  );

  if (error) throw error;

  const rows = data ?? [];

  return Promise.all(
    rows.map(async (row) => {
      let signedUrl = null;

      if (row.attachment_file_path) {
        const { data: signed } = await supabase.storage
          .from("chat-files")
          .createSignedUrl(row.attachment_file_path, 60 * 30);

        signedUrl = signed?.signedUrl ?? null;
      }

      return {
        ...row,
        attachment_signed_url: signedUrl,
      };
    })
  );
}

export async function adminListLoginLogs() {
  const { data, error } = await supabase.rpc("admin_list_login_logs");
  if (error) throw error;
  return data ?? [];
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function callAdminUserApi(action, payload = {}) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch("/api/admin-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    // Vite dev server에서 /api가 없을 때 HTML이 오는 경우
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "계정 관리 API는 Vercel 배포 후 사용할 수 있어요. 로컬에서 테스트하려면 `npx vercel dev`로 실행해주세요."
      );
    }

    throw new Error(
      result.error || `관리자 API 오류 (${response.status})`
    );
  }

  return result;
}
