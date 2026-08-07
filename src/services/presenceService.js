import { supabase } from "../lib/supabase";

export async function touchLastSeen(userId) {
  if (!userId) return;

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) console.error("last_seen_at 업데이트 실패:", error);
}

export function formatLastSeen(value) {
  if (!value) return "오프라인";

  const diff = Date.now() - new Date(value).getTime();

  if (diff < 60_000) return "방금 전 접속";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}분 전 접속`;
  if (diff < 24 * 60 * 60_000)
    return `${Math.floor(diff / (60 * 60_000))}시간 전 접속`;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
