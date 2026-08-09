import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkX,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  getMyBookmarks,
  removeMessageBookmark,
} from "../services/bookmarkService";

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function summary(message) {
  if (!message) return "메시지를 찾을 수 없어요.";

  if (message.type === "image") {
    return "사진";
  }

  if (message.type === "file") {
    return (
      message.attachments?.[0]?.file_name ||
      message.content ||
      "파일"
    );
  }

  return message.content || "메시지";
}

export default function BookmarkList({
  conversations,
  refreshKey,
  onOpenBookmark,
}) {
  const [bookmarks, setBookmarks] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const load = async () => {
    setLoading(true);
    setErrorText("");

    try {
      setBookmarks(await getMyBookmarks());
    } catch (error) {
      console.error(error);
      setErrorText(
        error.message || "북마크를 불러오지 못했어요."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const roomNameMap = useMemo(() => {
    const map = new Map();

    for (const room of conversations ?? []) {
      map.set(
        room.conversation_id,
        room.room_name ||
          room.default_room_name ||
          "채팅방"
      );
    }

    return map;
  }, [conversations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return bookmarks;

    return bookmarks.filter((bookmark) => {
      const message = bookmark.message;
      const sender =
        message?.sender?.name ||
        message?.sender?.email ||
        "";

      const roomName =
        roomNameMap.get(message?.conversation_id) ||
        "채팅방";

      return [
        sender,
        roomName,
        summary(message),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [bookmarks, query, roomNameMap]);

  const remove = async (event, bookmark) => {
    event.stopPropagation();

    try {
      await removeMessageBookmark(
        bookmark.message_id
      );

      setBookmarks((prev) =>
        prev.filter(
          (item) =>
            item.message_id !== bookmark.message_id
        )
      );
    } catch (error) {
      setErrorText(
        error.message || "북마크 해제에 실패했어요."
      );
    }
  };

  return (
    <section className="bookmark-panel">
      <header className="bookmark-header">
        <div>
          <span className="tiny-label">
            XX Messenger
          </span>
          <h1>북마크</h1>
        </div>

        <button
          className="round-icon-button"
          onClick={load}
          title="새로고침"
        >
          <RefreshCw size={18} />
        </button>
      </header>

      <div className="bookmark-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="북마크 검색"
        />
      </div>

      {errorText && (
        <button
          className="bookmark-error"
          onClick={() => setErrorText("")}
        >
          {errorText}
        </button>
      )}

      <div className="bookmark-list">
        {loading ? (
          <div className="bookmark-empty">
            북마크 불러오는 중...
          </div>
        ) : !filtered.length ? (
          <div className="bookmark-empty">
            <Bookmark size={30} />
            <strong>
              {query
                ? "검색 결과가 없어요."
                : "아직 북마크가 없어요."}
            </strong>
            <span>
              메시지의 ⋮ 메뉴에서 북마크할 수 있어요.
            </span>
          </div>
        ) : (
          filtered.map((bookmark) => {
            const message = bookmark.message;
            const sender =
              message?.sender?.name ||
              message?.sender?.email ||
              "사용자";

            const roomName =
              roomNameMap.get(
                message?.conversation_id
              ) || "채팅방";

            const attachment =
              message?.attachments?.[0];

            return (
              <button
                key={bookmark.id}
                className="bookmark-card"
                onClick={() =>
                  onOpenBookmark(bookmark)
                }
              >
                <div className="bookmark-card-icon">
                  {message?.type === "image" ? (
                    attachment?.signed_url ? (
                      <img
                        src={attachment.signed_url}
                        alt=""
                      />
                    ) : (
                      <ImageIcon size={18} />
                    )
                  ) : message?.type === "file" ? (
                    <FileText size={18} />
                  ) : (
                    <Bookmark size={17} />
                  )}
                </div>

                <div className="bookmark-card-copy">
                  <div className="bookmark-card-top">
                    <strong>{sender}</strong>
                    <span>
                      {formatDate(
                        bookmark.created_at
                      )}
                    </span>
                  </div>

                  <p>{summary(message)}</p>

                  <small>
                    {roomName} · 원본 메시지로 이동
                  </small>
                </div>

                <button
                  type="button"
                  className="bookmark-remove-button"
                  title="북마크 해제"
                  onClick={(event) =>
                    remove(event, bookmark)
                  }
                >
                  <BookmarkX size={17} />
                </button>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}