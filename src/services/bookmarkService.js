import { supabase } from "../lib/supabase";
import { getMessageById } from "./chatService";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;

  if (!user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  return user.id;
}

export async function getBookmarkedMessageIds(
  messageIds = []
) {
  if (!messageIds.length) return [];

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("message_bookmarks")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);

  if (error) throw error;

  return (data ?? []).map(
    (row) => row.message_id
  );
}

export async function isMessageBookmarked(
  messageId
) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("message_bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}

export async function addMessageBookmark(
  messageId
) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("message_bookmarks")
    .insert({
      user_id: userId,
      message_id: messageId,
    });

  // 이미 북마크된 메시지는 그냥 성공으로 처리
  if (error && error.code !== "23505") {
    throw error;
  }

  return true;
}

export async function removeMessageBookmark(
  messageId
) {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("message_bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("message_id", messageId);

  if (error) throw error;

  return false;
}

export async function toggleMessageBookmark(
  messageId
) {
  const bookmarked =
    await isMessageBookmarked(messageId);

  if (bookmarked) {
    await removeMessageBookmark(messageId);
    return false;
  }

  await addMessageBookmark(messageId);
  return true;
}

export async function getMyBookmarks() {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("message_bookmarks")
    .select("id,message_id,created_at")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  const hydrated = await Promise.all(
    (data ?? []).map(async (bookmark) => {
      try {
        const message = await getMessageById(
          bookmark.message_id
        );

        return {
          ...bookmark,
          message,
        };
      } catch (error) {
        console.error(
          "북마크 원본 메시지 조회 실패:",
          error
        );

        return null;
      }
    })
  );

  return hydrated.filter(Boolean);
}