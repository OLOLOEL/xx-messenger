import { supabase } from "../lib/supabase";
import { getAvatarSignedUrl } from "./profileService";

export async function getOrCreateDirectConversation(targetUserId) {
  const { data, error } = await supabase.rpc(
    "get_or_create_direct_conversation",
    { target_user_id: targetUserId }
  );
  if (error) throw error;
  return data;
}

export async function createGroupConversation(roomName, memberIds) {
  const { data, error } = await supabase.rpc("create_group_conversation", {
    room_name: roomName,
    member_ids: memberIds,
  });
  if (error) throw error;
  return data;
}

export async function inviteToGroup(conversationId, userIds) {
  const { data, error } = await supabase.rpc("invite_to_group", {
    target_conversation_id: conversationId,
    target_user_ids: userIds,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function leaveConversation(conversationId) {
  const { error } = await supabase.rpc("leave_conversation", {
    target_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function setMyRoomName(conversationId, name) {
  const { error } = await supabase.rpc("set_my_room_name", {
    target_conversation_id: conversationId,
    new_name: name,
  });
  if (error) throw error;
}

export async function markConversationRead(conversationId) {
  const { error } = await supabase.rpc("mark_conversation_read", {
    target_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function getMessageUnreadCounts(conversationId) {
  const { data, error } = await supabase.rpc("get_message_unread_counts", {
    target_conversation_id: conversationId,
  });

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.message_id,
      Number(row.unread_count ?? 0),
    ])
  );
}

export async function getMyConversations() {
  const { data, error } = await supabase.rpc("get_my_conversations");
  if (error) throw error;

  const rows = data ?? [];
  const directUserIds = [
    ...new Set(
      rows
        .filter((room) => room.conversation_type === "direct")
        .map((room) => room.other_user_id)
        .filter(Boolean)
    ),
  ];

  let avatarMap = new Map();

  if (directUserIds.length) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id,avatar_path")
      .in("id", directUserIds);

    if (profileError) throw profileError;

    avatarMap = new Map(
      (profileRows ?? []).map((profile) => [
        profile.id,
        profile.avatar_path,
      ])
    );
  }

  return Promise.all(
    rows.map(async (room) => ({
      ...room,
      other_avatar_signed_url:
        room.conversation_type === "direct"
          ? await getAvatarSignedUrl(
              avatarMap.get(room.other_user_id) ?? null
            )
          : null,
    }))
  );
}

export async function getConversationMembers(conversationId) {
  const { data, error } = await supabase.rpc("get_conversation_members", {
    target_conversation_id: conversationId,
  });
  if (error) throw error;

  const rows = data ?? [];

  // RPC is older and doesn't expose avatar_path, so fetch profiles directly.
  const ids = rows.map((row) => row.user_id);

  if (!ids.length) return rows;

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id,avatar_path,status_message")
    .in("id", ids);

  const profileMap = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile])
  );

  return Promise.all(
    rows.map(async (row) => {
      const profile = profileMap.get(row.user_id);
      return {
        ...row,
        avatar_path: profile?.avatar_path ?? null,
        status_message: profile?.status_message ?? null,
        avatar_signed_url: await getAvatarSignedUrl(profile?.avatar_path),
      };
    })
  );
}

export async function getActiveEmployees() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,email,department,position,avatar_path,status_message,role,last_seen_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (employee) => ({
      ...employee,
      avatar_signed_url: await getAvatarSignedUrl(employee.avatar_path),
    }))
  );
}

async function hydrateSenderAvatar(message) {
  if (!message?.sender) return message;

  return {
    ...message,
    sender: {
      ...message.sender,
      avatar_signed_url: await getAvatarSignedUrl(
        message.sender.avatar_path
      ),
    },
  };
}

async function addSignedUrls(messages) {
  const result = [];

  for (const raw of messages) {
    const message = await hydrateSenderAvatar(raw);
    const attachments = message.attachments ?? [];
    const signedAttachments = [];

    for (const attachment of attachments) {
      const { data, error } = await supabase.storage
        .from("chat-files")
        .createSignedUrl(attachment.file_path, 60 * 60);

      signedAttachments.push({
        ...attachment,
        signed_url: error ? null : data?.signedUrl ?? null,
      });
    }

    result.push({
      ...message,
      attachments: signedAttachments,
    });
  }

  return result;
}

async function attachReplyPreviews(messages) {
  const replyIds = [
    ...new Set(
      messages
        .map((message) => message.reply_to_id)
        .filter(Boolean)
    ),
  ];

  if (!replyIds.length) {
    return messages.map((message) => ({
      ...message,
      reply_to: null,
    }));
  }

  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      sender_id,
      type,
      content,
      created_at,
      sender:profiles!messages_sender_id_fkey (
        id,
        name,
        email,
        avatar_path
      ),
      attachments (
        id,
        file_name,
        file_path,
        mime_type,
        file_size
      )
    `)
    .in("id", replyIds);

  if (error) throw error;

  const signedReplies = await addSignedUrls(data ?? []);
  const replyMap = new Map(
    signedReplies.map((message) => [message.id, message])
  );

  return messages.map((message) => ({
    ...message,
    reply_to: message.reply_to_id
      ? replyMap.get(message.reply_to_id) ?? null
      : null,
  }));
}

async function hydrateMessages(messages) {
  const signed = await addSignedUrls(messages);
  return attachReplyPreviews(signed);
}

export async function getConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      conversation_id,
      sender_id,
      type,
      content,
      reply_to_id,
      created_at,
      sender:profiles!messages_sender_id_fkey (
        id,
        name,
        email,
        avatar_path
      ),
      attachments (
        id,
        file_name,
        file_path,
        mime_type,
        file_size
      )
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return hydrateMessages(data ?? []);
}

export async function getMessageById(messageId) {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      conversation_id,
      sender_id,
      type,
      content,
      reply_to_id,
      created_at,
      sender:profiles!messages_sender_id_fkey (
        id,
        name,
        email,
        avatar_path
      ),
      attachments (
        id,
        file_name,
        file_path,
        mime_type,
        file_size
      )
    `)
    .eq("id", messageId)
    .single();

  if (error) throw error;

  const [message] = await hydrateMessages([data]);
  return message;
}

export async function sendTextMessage({
  conversationId,
  senderId,
  content,
  replyToId = null,
}) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type: "text",
      content: trimmed,
      reply_to_id: replyToId,
    })
    .select(`
      id,
      conversation_id,
      sender_id,
      type,
      content,
      reply_to_id,
      created_at,
      sender:profiles!messages_sender_id_fkey (
        id,
        name,
        email,
        avatar_path
      )
    `)
    .single();

  if (error) throw error;

  const [message] = await hydrateMessages([
    {
      ...data,
      attachments: [],
    },
  ]);

  return message;
}

function getSafeExtension(fileName) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return "";

  const ext = fileName
    .slice(lastDot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return ext ? `.${ext.slice(0, 10)}` : "";
}

export async function sendAttachmentMessage({
  conversationId,
  senderId,
  file,
  replyToId = null,
}) {
  if (!file) return null;

  if (file.size > 50 * 1024 * 1024) {
    throw new Error("파일은 최대 50MB까지 보낼 수 있어요.");
  }

  const extension = getSafeExtension(file.name);
  const storageFileName = `${crypto.randomUUID()}${extension}`;
  const filePath = `${senderId}/${conversationId}/${storageFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-files")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw new Error(`파일 업로드 실패: ${uploadError.message}`);
  }

  try {
    const { data: messageId, error: rpcError } = await supabase.rpc(
      "create_attachment_message",
      {
        target_conversation_id: conversationId,
        target_file_name: file.name,
        target_file_path: filePath,
        target_mime_type: file.type || "application/octet-stream",
        target_file_size: file.size,
      }
    );

    if (rpcError) throw rpcError;

    if (replyToId) {
      const { error: replyError } = await supabase
        .from("messages")
        .update({ reply_to_id: replyToId })
        .eq("id", messageId)
        .eq("sender_id", senderId);

      if (replyError) throw replyError;
    }

    return await getMessageById(messageId);
  } catch (error) {
    await supabase.storage.from("chat-files").remove([filePath]);
    throw new Error(`첨부 메시지 생성 실패: ${error.message}`);
  }
}


// =========================================================
// FINAL FEATURES
// 이모지 반응 / 채팅방 공지
// =========================================================

export async function getConversationReactions(conversationId) {
  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);

  if (messageError) throw messageError;

  const messageIds = (messageRows ?? []).map((row) => row.id);

  if (!messageIds.length) {
    return {};
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .select(`
      id,
      message_id,
      user_id,
      emoji,
      created_at,
      user:profiles!message_reactions_user_id_fkey (
        id,
        name,
        email
      )
    `)
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const grouped = {};

  for (const reaction of data ?? []) {
    if (!grouped[reaction.message_id]) {
      grouped[reaction.message_id] = [];
    }

    grouped[reaction.message_id].push(reaction);
  }

  return grouped;
}

export async function toggleMessageReaction({
  messageId,
  userId,
  emoji,
}) {
  const { data: existing, error: findError } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) throw error;

    return false;
  }

  const { error } = await supabase
    .from("message_reactions")
    .insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    });

  if (error) throw error;

  return true;
}

export async function getConversationAnnouncement(conversationId) {
  const { data, error } = await supabase
    .from("conversation_announcements")
    .select(`
      conversation_id,
      message_id,
      set_by,
      created_at,
      updated_at
    `)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return null;
  }

  const message = await getMessageById(data.message_id);

  return {
    ...data,
    message,
  };
}

export async function setConversationAnnouncement(
  conversationId,
  messageId
) {
  const { error } = await supabase.rpc(
    "set_conversation_announcement",
    {
      target_conversation_id: conversationId,
      target_message_id: messageId,
    }
  );

  if (error) throw error;
}

export async function clearConversationAnnouncement(conversationId) {
  const { error } = await supabase.rpc(
    "clear_conversation_announcement",
    {
      target_conversation_id: conversationId,
    }
  );

  if (error) throw error;
}
