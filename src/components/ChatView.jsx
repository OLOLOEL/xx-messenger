import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Download,
  FileText,
  Image as ImageIcon,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Pin,
  Reply,
  Search,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  clearConversationAnnouncement,
  getConversationAnnouncement,
  getConversationMembers,
  getConversationMessages,
  getConversationReactions,
  getMessageById,
  getMessageUnreadCounts,
  markConversationRead,
  sendAttachmentMessage,
  sendTextMessage,
  setConversationAnnouncement,
  toggleMessageReaction,
} from "../services/chatService";
import {
  getBookmarkedMessageIds,
  toggleMessageBookmark,
} from "../services/bookmarkService";

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function bytes(size) {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function replySummary(message) {
  if (!message) return "메시지를 찾을 수 없어요.";
  if (message.type === "image") return "📷 이미지";
  if (message.type === "file") {
    return `📎 ${message.attachments?.[0]?.file_name || message.content || "파일"}`;
  }
  return message.content || "메시지";
}

function messageSearchText(message) {
  const sender =
    message.sender?.name ||
    message.sender?.email ||
    "";

  const attachmentNames =
    (message.attachments ?? [])
      .map((attachment) => attachment.file_name)
      .join(" ");

  return [
    sender,
    message.content,
    attachmentNames,
    replySummary(message.reply_to),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


function dateKey(value) {
  const date = new Date(value);

  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ].join("-");
}

function formatDateDivider(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function groupReactions(reactions, currentUserId) {
  const grouped = new Map();

  for (const reaction of reactions ?? []) {
    if (!grouped.has(reaction.emoji)) {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 0,
        mine: false,
        names: [],
      });
    }

    const item = grouped.get(reaction.emoji);
    item.count += 1;

    if (reaction.user_id === currentUserId) {
      item.mine = true;
    }

    item.names.push(
      reaction.user?.name ||
      reaction.user?.email ||
      "사용자"
    );
  }

  return [...grouped.values()];
}

function Avatar({ url, fallback, className = "" }) {
  return (
    <div className={className}>
      {url ? (
        <img className="avatar-image" src={url} alt="" />
      ) : (
        fallback
      )}
    </div>
  );
}

export default function ChatView({
  room,
  currentUserId,
  isOtherOnline,
  onMessageActivity,
  onOpenManage,
  onBack,
  isReadActive = true,
  focusMessageId = null,
  focusRequestKey = 0,
  onBookmarkChange,
}) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reactionsByMessage, setReactionsByMessage] = useState({});
  const [announcement, setAnnouncement] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState(null);
  const [bookmarkedMessageIds, setBookmarkedMessageIds] =
    useState(new Set());

  const fileInputRef = useRef(null);
  const channelRef = useRef(null);
  const bottomRef = useRef(null);
  const messageAreaRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const messageRefs = useRef({});

  const group = room.conversation_type === "group";

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return messages
      .filter((message) =>
        messageSearchText(message).includes(q)
      )
      .slice()
      .reverse();
  }, [messages, searchQuery]);

  const upsertMessage = (message) => {
    if (!message) return;

    setMessages((prev) => {
      const index = prev.findIndex(
        (item) => item.id === message.id
      );

      if (index === -1) return [...prev, message];

      const next = [...prev];
      next[index] = message;
      return next;
    });
  };

  const refreshUnreadCounts = async () => {
    try {
      const data = await getMessageUnreadCounts(
        room.conversation_id
      );
      setUnreadCounts(data);
    } catch (error) {
      console.error(error);
    }
  };

  const markRead = async () => {
    if (
      !isReadActive ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    try {
      await markConversationRead(room.conversation_id);
      await refreshUnreadCounts();
      onMessageActivity?.();
    } catch (error) {
      console.error(error);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await getConversationMembers(
        room.conversation_id
      );
      setMembers(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadReactions = async () => {
    try {
      const data = await getConversationReactions(
        room.conversation_id
      );

      setReactionsByMessage(data);
    } catch (error) {
      console.error("반응 조회 실패:", error);
    }
  };

  const loadAnnouncement = async () => {
    try {
      const data = await getConversationAnnouncement(
        room.conversation_id
      );

      setAnnouncement(data);
    } catch (error) {
      console.error("공지 조회 실패:", error);
    }
  };

  useEffect(() => {
    stickToBottomRef.current = true;
    setReplyingTo(null);
    setSearchOpen(false);
    setSearchQuery("");
    setMessageMenuId(null);
    setReactionPickerId(null);
    loadReactions();
    loadAnnouncement();

    let active = true;

    Promise.all([
      getConversationMessages(room.conversation_id),
      getConversationMembers(room.conversation_id),
      getMessageUnreadCounts(room.conversation_id),
    ]).then(async ([messageData, memberData, countData]) => {
      if (!active) return;

      setMessages(messageData);
      setMembers(memberData);
      setUnreadCounts(countData);

      try {
        const bookmarkIds =
          await getBookmarkedMessageIds(
            messageData.map((message) => message.id)
          );

        setBookmarkedMessageIds(
          new Set(bookmarkIds)
        );
      } catch (error) {
        console.error(
          "북마크 상태 조회 실패:",
          error
        );
      }

      await markRead();
    });

    return () => {
      active = false;
    };
  }, [room.conversation_id, isReadActive]);

  useEffect(() => {
    const refreshMessage = async (messageId) => {
      try {
        const full = await getMessageById(messageId);
        upsertMessage(full);

        if (full.sender_id !== currentUserId) {
          await markRead();
        } else {
          await refreshUnreadCounts();
        }

        onMessageActivity?.();
      } catch (error) {
        console.error(error);
      }
    };

    const channel = supabase
      .channel(`chat:${room.conversation_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${room.conversation_id}`,
        },
        async (payload) => refreshMessage(payload.new.id)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${room.conversation_id}`,
        },
        async (payload) => refreshMessage(payload.new.id)
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attachments",
          filter: `conversation_id=eq.${room.conversation_id}`,
        },
        async (payload) => refreshMessage(payload.new.message_id)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${room.conversation_id}`,
        },
        async () => {
          await loadMembers();
          await refreshUnreadCounts();
          onMessageActivity?.();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        async () => {
          await loadReactions();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_announcements",
          filter: `conversation_id=eq.${room.conversation_id}`,
        },
        async () => {
          await loadAnnouncement();
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === currentUserId) return;

        setTypingUsers((prev) => ({
          ...prev,
          [payload.userId]:
            payload.typing ? payload.name : null,
        }));

        if (payload.typing) {
          setTimeout(() => {
            setTypingUsers((prev) => ({
              ...prev,
              [payload.userId]: null,
            }));
          }, 2200);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [room.conversation_id, currentUserId, isReadActive]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        markRead();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleFocus
      );
    };
  }, [room.conversation_id, isReadActive]);

  useEffect(() => {
    if (
      isReadActive &&
      document.visibilityState === "visible"
    ) {
      markRead();
    }
  }, [isReadActive, room.conversation_id]);

  const handleMessageAreaScroll = () => {
    const area = messageAreaRef.current;
    if (!area) return;

    const distanceFromBottom =
      area.scrollHeight - area.scrollTop - area.clientHeight;

    stickToBottomRef.current =
      distanceFromBottom <= 120;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  const currentMember = members.find(
    (member) => member.user_id === currentUserId
  );

  const sendTyping = async (typing) => {
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUserId,
        name: currentMember?.name || "사용자",
        typing,
      },
    });
  };

  const sendText = async () => {
    if (!text.trim()) return;

    const value = text;
    const replyToId = replyingTo?.id ?? null;

    setText("");
    setReplyingTo(null);
    await sendTyping(false);

    try {
      const message = await sendTextMessage({
        conversationId: room.conversation_id,
        senderId: currentUserId,
        content: value,
        replyToId,
      });

      upsertMessage(message);
      await markConversationRead(room.conversation_id);
      await refreshUnreadCounts();
      onMessageActivity?.();
    } catch (error) {
      setErrorText(error.message);
      setText(value);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;

    const replyToId = replyingTo?.id ?? null;

    setUploading(true);
    setErrorText("");

    try {
      const message = await sendAttachmentMessage({
        conversationId: room.conversation_id,
        senderId: currentUserId,
        file,
        replyToId,
      });

      setReplyingTo(null);
      upsertMessage(message);
      await markConversationRead(room.conversation_id);
      await refreshUnreadCounts();
      onMessageActivity?.();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const scrollToMessage = (messageId) => {
    const element = messageRefs.current[messageId];
    if (!element) return;

    setSearchOpen(false);

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    element.classList.add("message-highlight");

    setTimeout(() => {
      element.classList.remove("message-highlight");
    }, 1400);
  };


  const toggleBookmarkForMessage = async (
    message
  ) => {
    try {
      const bookmarked =
        await toggleMessageBookmark(message.id);

      setBookmarkedMessageIds((prev) => {
        const next = new Set(prev);

        if (bookmarked) {
          next.add(message.id);
        } else {
          next.delete(message.id);
        }

        return next;
      });

      setMessageMenuId(null);
      onBookmarkChange?.();
    } catch (error) {
      console.error(error);
      setErrorText(
        error.message ||
          "북마크 처리에 실패했어요."
      );
    }
  };

  useEffect(() => {
    if (
      !focusMessageId ||
      !messages.length
    ) {
      return;
    }

    const timer = setTimeout(() => {
      scrollToMessage(focusMessageId);
    }, 80);

    return () => clearTimeout(timer);
  }, [
    focusMessageId,
    focusRequestKey,
    messages.length,
  ]);

  const reactToMessage = async (messageId, emoji) => {
    try {
      await toggleMessageReaction({
        messageId,
        userId: currentUserId,
        emoji,
      });

      setReactionPickerId(null);
      await loadReactions();
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const pinMessage = async (message) => {
    try {
      await setConversationAnnouncement(
        room.conversation_id,
        message.id
      );

      setMessageMenuId(null);
      await loadAnnouncement();
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const removeAnnouncement = async () => {
    try {
      await clearConversationAnnouncement(
        room.conversation_id
      );

      await loadAnnouncement();
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const downloadAttachment = async (attachment) => {
    if (!attachment?.signed_url) return;

    try {
      const response = await fetch(attachment.signed_url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.file_name || "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      window.open(
        attachment.signed_url,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const typingNames =
    Object.values(typingUsers).filter(Boolean);

  return (
    <>
      <header className="chat-topbar">
        <div className="chat-room-title">
          <button
            type="button"
            className="mobile-chat-back"
            onClick={onBack}
            aria-label="채팅 목록으로 돌아가기"
          >
            <ArrowLeft size={22} />
          </button>

          <Avatar
            className={`chat-room-avatar ${group ? "group" : ""}`}
            url={group ? null : room.other_avatar_signed_url}
            fallback={
              group ? <Users size={19} /> : room.room_name.slice(0, 1)
            }
          />

          <div>
            <h2>{room.room_name}</h2>
            <span
              className={
                !group && isOtherOnline
                  ? "online-text"
                  : ""
              }
            >
              {group
                ? `${members.length}명 참여 중`
                : isOtherOnline
                  ? "온라인"
                  : "오프라인"}
            </span>
          </div>
        </div>

        <div className="chat-top-actions">
          <button
            className={`round-icon-button ${
              searchOpen ? "active-search-button" : ""
            }`}
            title="메시지 검색"
            onClick={() => {
              setSearchOpen((prev) => !prev);
              setSearchQuery("");
            }}
          >
            <Search size={18} />
          </button>

          <button
            className="round-icon-button"
            title="채팅방 설정"
            onClick={onOpenManage}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {announcement?.message && (
        <div className="chat-announcement">
          <button
            className="chat-announcement-main"
            onClick={() =>
              scrollToMessage(announcement.message.id)
            }
          >
            <Pin size={15} />

            <div>
              <strong>공지</strong>
              <span>
                {replySummary(announcement.message)}
              </span>
            </div>
          </button>

          <button
            className="chat-announcement-close"
            title="공지 해제"
            onClick={removeAnnouncement}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {searchOpen && (
        <div className="message-search-panel">
          <div className="message-search-input-wrap">
            <Search size={16} />

            <input
              autoFocus
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="이 채팅방에서 검색"
            />

            <button
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="message-search-summary">
            {searchQuery.trim()
              ? `${searchResults.length}개 결과`
              : "검색어를 입력하세요."}
          </div>

          {searchQuery.trim() && (
            <div className="message-search-results">
              {searchResults.length === 0 ? (
                <div className="message-search-empty">
                  검색 결과가 없어요.
                </div>
              ) : (
                searchResults.map((message) => {
                  const sender =
                    message.sender?.name ||
                    message.sender?.email ||
                    "사용자";

                  const summary =
                    message.type === "image"
                      ? "📷 이미지"
                      : message.type === "file"
                        ? `📎 ${
                            message.attachments?.[0]?.file_name ||
                            message.content ||
                            "파일"
                          }`
                        : message.content;

                  return (
                    <button
                      key={message.id}
                      className="message-search-result"
                      onClick={() =>
                        scrollToMessage(message.id)
                      }
                    >
                      <div className="message-search-result-top">
                        <strong>{sender}</strong>
                        <span>
                          {formatDateTime(message.created_at)}
                        </span>
                      </div>
                      <p>{summary}</p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <div
        className="message-area"
        ref={messageAreaRef}
        onScroll={handleMessageAreaScroll}
      >
        {messages.map((message, messageIndex) => {
          const mine =
            message.sender_id === currentUserId;

          const sender =
            message.sender?.name ||
            message.sender?.email ||
            "사용자";

          const attachment =
            message.attachments?.[0];

          const isImage =
            attachment?.mime_type?.startsWith("image/");

          const unread = Number(
            unreadCounts[message.id] ?? 0
          );

          const showDateDivider =
            messageIndex === 0 ||
            dateKey(messages[messageIndex - 1].created_at) !==
              dateKey(message.created_at);

          const repliedSender =
            message.reply_to?.sender?.name ||
            message.reply_to?.sender?.email ||
            "사용자";

          return (
            <div
              key={message.id}
              className="message-with-date"
            >
              {showDateDivider && (
                <div className="date-divider">
                  <span>
                    {formatDateDivider(message.created_at)}
                  </span>
                </div>
              )}

              <div
                ref={(node) => {
                if (node) {
                  messageRefs.current[message.id] = node;
                }
              }}
              className={`message-row message-row-replyable ${
                mine ? "outgoing" : "incoming"
              }`}
            >
              {!mine && (
                <Avatar
                  className="message-avatar"
                  url={message.sender?.avatar_signed_url}
                  fallback={sender.slice(0, 1)}
                />
              )}

              <div className="message-content-stack">
                {!mine && (
                  <div className="message-sender">
                    {sender}
                  </div>
                )}

                <div className="message-action-anchor">
                  <button
                    className="message-more-button"
                    title="메시지 메뉴"
                    onClick={() => {
                      setMessageMenuId(
                        messageMenuId === message.id
                          ? null
                          : message.id
                      );
                      setReactionPickerId(null);
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {messageMenuId === message.id && (
                    <div className="message-action-menu">
                      <button
                        onClick={() => {
                          setReplyingTo(message);
                          setMessageMenuId(null);
                        }}
                      >
                        <Reply size={15} />
                        <span>답장</span>
                      </button>

                      <button
                        onClick={() => {
                          setReactionPickerId(message.id);
                          setMessageMenuId(null);
                        }}
                      >
                        <span className="reaction-action-face">
                          ☺
                        </span>
                        <span>반응</span>
                      </button>

                      <button
                        onClick={() =>
                          toggleBookmarkForMessage(message)
                        }
                      >
                        <Bookmark size={14} />
                        <span>
                          {bookmarkedMessageIds.has(
                            message.id
                          )
                            ? "북마크 해제"
                            : "북마크"}
                        </span>
                      </button>

                      <button
                        onClick={() => pinMessage(message)}
                      >
                        <Pin size={14} />
                        <span>공지 고정</span>
                      </button>
                    </div>
                  )}

                </div>

                <div className="message-line">
                  {mine && (
                    <div className="message-meta mine">
                      {unread > 0 && (
                        <span className="message-unread-count">
                          {unread}
                        </span>
                      )}

                      <span className="message-time">
                        {formatTime(
                          message.created_at
                        )}
                      </span>
                    </div>
                  )}

                  <div className="bubble-shell">
                    {message.reply_to && (
                      <button
                        className="reply-reference"
                        onClick={() =>
                          scrollToMessage(
                            message.reply_to.id
                          )
                        }
                      >
                        <strong>{repliedSender}</strong>
                        <span>
                          {replySummary(message.reply_to)}
                        </span>
                      </button>
                    )}

                    {attachment ? (
                      isImage ? (
                        <button
                          className="image-message"
                          onClick={() =>
                            attachment.signed_url &&
                            setPreviewImage(
                              attachment.signed_url
                            )
                          }
                        >
                          {attachment.signed_url ? (
                            <img
                              src={attachment.signed_url}
                              alt={attachment.file_name}
                            />
                          ) : (
                            <div className="broken-file">
                              <ImageIcon size={22} />
                              이미지 불러오기 실패
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="file-message final-file-card">
                          <div className="file-icon">
                            <FileText size={22} />
                          </div>

                          <div className="file-copy">
                            <strong>
                              {attachment.file_name}
                            </strong>
                            <span>
                              {bytes(attachment.file_size)}
                            </span>
                          </div>

                          <button
                            className="file-download-button"
                            title="다운로드"
                            onClick={() =>
                              downloadAttachment(attachment)
                            }
                          >
                            <Download size={17} />
                          </button>
                        </div>
                      )
                    ) : message.type === "image" ||
                      message.type === "file" ? (
                      <div className="attachment-loading">
                        첨부파일 불러오는 중...
                      </div>
                    ) : (
                      <div className="bubble">
                        {message.content}
                      </div>
                    )}
                  </div>

                  {groupReactions(
                    reactionsByMessage[message.id],
                    currentUserId
                  ).length > 0 && (
                    <div className="message-reactions">
                      {groupReactions(
                        reactionsByMessage[message.id],
                        currentUserId
                      ).map((reaction) => (
                        <button
                          key={reaction.emoji}
                          className={
                            reaction.mine ? "mine" : ""
                          }
                          title={reaction.names.join(", ")}
                          onClick={() =>
                            reactToMessage(
                              message.id,
                              reaction.emoji
                            )
                          }
                        >
                          <span>{reaction.emoji}</span>
                          <small>{reaction.count}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {!mine && (
                    <span className="message-time">
                      {formatTime(message.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            </div>
          );
        })}

        {typingNames.length > 0 && (
          <div className="typing-row">
            <div className="typing-bubble">
              <span />
              <span />
              <span />
            </div>

            <small>
              {typingNames.slice(0, 2).join(", ")}
              님이 입력 중...
            </small>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {reactionPickerId && (
        <>
          <button
            type="button"
            className="reaction-picker-backdrop"
            aria-label="반응 선택 닫기"
            onClick={() => setReactionPickerId(null)}
          />

          <div
            className="reaction-picker-global"
            role="dialog"
            aria-label="메시지 반응 선택"
          >
            {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(
              (emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() =>
                    reactToMessage(
                      reactionPickerId,
                      emoji
                    )
                  }
                >
                  {emoji}
                </button>
              )
            )}
          </div>
        </>
      )}

      <div className="composer-wrap">
        {errorText && (
          <div className="composer-error">
            {errorText}
          </div>
        )}

        {replyingTo && (
          <div className="composer-reply-preview">
            <div className="composer-reply-icon">
              <Reply size={16} />
            </div>

            <div className="composer-reply-copy">
              <strong>
                {replyingTo.sender?.name ||
                  replyingTo.sender?.email ||
                  "사용자"}
                에게 답장
              </strong>

              <span>{replySummary(replyingTo)}</span>
            </div>

            <button
              title="답장 취소"
              onClick={() =>
                setReplyingTo(null)
              }
            >
              <X size={17} />
            </button>
          </div>
        )}

        <div className="composer">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(event) =>
              handleFile(
                event.target.files?.[0]
              )
            }
          />

          <button
            className="composer-plus"
            type="button"
            title="파일 첨부"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={uploading}
          >
            <Paperclip size={20} />
          </button>

          <textarea
            placeholder={
              uploading
                ? "파일 업로드 중..."
                : replyingTo
                  ? "답장을 입력하세요."
                  : "메시지를 입력하세요."
            }
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              sendTyping(
                Boolean(
                  event.target.value.trim()
                )
              );
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                sendText();
              }

              if (
                event.key === "Escape" &&
                replyingTo
              ) {
                setReplyingTo(null);
              }
            }}
            disabled={uploading}
          />

          <button
            className="send-button"
            onClick={sendText}
            disabled={
              !text.trim() || uploading
            }
          >
            전송
          </button>
        </div>
      </div>

      {previewImage && (
        <div
          className="image-preview-backdrop"
          onClick={() =>
            setPreviewImage(null)
          }
        >
          <button
            className="image-preview-close"
            onClick={() =>
              setPreviewImage(null)
            }
          >
            <X size={24} />
          </button>

          <img
            className="image-preview-large"
            src={previewImage}
            alt=""
            onClick={(event) =>
              event.stopPropagation()
            }
          />
        </div>
      )}
    </>
  );
}