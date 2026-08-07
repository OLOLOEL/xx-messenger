import { useMemo, useState } from "react";
import { MessageCircle, Plus, Search, Users, X } from "lucide-react";

function formatTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  onNewGroup,
  onlineUserIds,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return conversations;

    return conversations.filter((room) => {
      return [
        room.room_name,
        room.default_room_name,
        room.other_user_name,
        room.other_user_email,
        room.last_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [conversations, query]);

  return (
    <>
      <header className="room-column-header">
        <div>
          <span className="tiny-label">XX Messenger</span>
          <h1>채팅</h1>
        </div>

        <button className="round-icon-button" onClick={onNewGroup}>
          <Plus size={21} />
        </button>
      </header>

      <div className="room-search">
        <Search size={17} />

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="채팅방 검색"
        />

        {query && (
          <button
            className="room-search-clear"
            onClick={() => setQuery("")}
            title="검색어 지우기"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="room-list">
        {!filtered.length ? (
          <div className="room-empty">
            <MessageCircle size={28} />
            {query ? "검색 결과가 없어요." : "아직 채팅방이 없어요."}
          </div>
        ) : (
          filtered.map((room) => {
            const group = room.conversation_type === "group";
            const online =
              !group && onlineUserIds.has(room.other_user_id);
            const unread = Number(room.unread_count ?? 0);

            return (
              <button
                key={room.conversation_id}
                className={`conversation-item ${
                  selectedConversationId === room.conversation_id
                    ? "active"
                    : ""
                }`}
                onClick={() => onSelect(room)}
              >
                <div className="conversation-avatar-wrap">
                  <div
                    className={`conversation-avatar ${
                      group ? "group" : ""
                    }`}
                  >
                    {group ? (
                      <Users size={19} />
                    ) : room.other_avatar_signed_url ? (
                      <img
                        className="avatar-image"
                        src={room.other_avatar_signed_url}
                        alt=""
                      />
                    ) : (
                      room.room_name.slice(0, 1)
                    )}
                  </div>

                  {!group && (
                    <span
                      className={`presence-dot ${
                        online ? "online" : ""
                      }`}
                    />
                  )}
                </div>

                <div className="conversation-copy">
                  <div className="conversation-topline">
                    <strong>
                      {room.room_name}

                      {group && (
                        <small className="member-count">
                          {room.member_count}
                        </small>
                      )}
                    </strong>

                    <span>{formatTime(room.last_message_at)}</span>
                  </div>

                  <div className="conversation-bottomline">
                    <p>
                      {room.last_message || "대화를 시작해보세요."}
                    </p>

                    {unread > 0 && (
                      <span className="room-unread-badge">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
