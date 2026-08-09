import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Bookmark,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import EmployeeList from "../components/EmployeeList";
import ConversationList from "../components/ConversationList";
import ChatView from "../components/ChatView";
import GroupCreateModal from "../components/GroupCreateModal";
import RoomManageModal from "../components/RoomManageModal";
import ProfileEditModal from "../components/ProfileEditModal";
import AdminSidebar from "../components/AdminSidebar";
import AdminPage from "../components/AdminPage";
import {
  createGroupConversation,
  getMessageById,
  getMyConversations,
  getOrCreateDirectConversation,
  markConversationRead,
} from "../services/chatService";
import {
  getMyProfile,
} from "../services/profileService";
import { touchLastSeen } from "../services/presenceService";

const APP_TITLE = "XX Messenger";

function setUnreadFavicon(unreadCount) {
  const existing = document.querySelector('link[rel="icon"]');

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#20252d";
  ctx.beginPath();

  if (ctx.roundRect) {
    ctx.roundRect(6, 6, 52, 52, 15);
  } else {
    ctx.rect(6, 6, 52, 52);
  }

  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("XX", 32, 33);

  if (unreadCount > 0) {
    ctx.fillStyle = "#ff4d62";
    ctx.beginPath();
    ctx.arc(50, 14, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(unreadCount > 9 ? "9+" : String(unreadCount), 50, 14);
  }

  const href = canvas.toDataURL("image/png");

  if (existing) {
    existing.href = href;
  } else {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    document.head.appendChild(link);
  }
}

export default function MessengerLayout({
  profile: initialProfile,
  session,
  onLogout,
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [activeMenu, setActiveMenu] = useState("chat");
  const [conversations, setConversations] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [actionError, setActionError] = useState("");
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported"
  );

  const selectedRoomRef = useRef(null);
  const conversationsRef = useRef([]);

  useEffect(() => {
    getMyProfile(session.user.id)
      .then(setProfile)
      .catch(console.error);
  }, [session.user.id, profileRefreshKey]);

  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const totalUnread = useMemo(
    () =>
      conversations.reduce(
        (sum, room) => sum + Number(room.unread_count ?? 0),
        0
      ),
    [conversations]
  );

  useEffect(() => {
    document.title =
      totalUnread > 0
        ? `(${totalUnread > 99 ? "99+" : totalUnread}) ${APP_TITLE}`
        : APP_TITLE;

    setUnreadFavicon(totalUnread);
  }, [totalUnread]);

  const loadConversations = async (preferredId = null) => {
    try {
      const rooms = await getMyConversations();
      setConversations(rooms);
      conversationsRef.current = rooms;

      const currentSelectedId =
        selectedRoomRef.current?.conversation_id ?? null;

      const id =
        typeof preferredId === "string"
          ? preferredId
          : currentSelectedId || rooms[0]?.conversation_id;

      const nextRoom =
        rooms.find((room) => room.conversation_id === id) || null;

      setSelectedRoom(nextRoom);
      selectedRoomRef.current = nextRoom;

      return rooms;
    } catch (error) {
      setActionError(error.message);
      return [];
    }
  };

  const selectRoom = async (room) => {
    setSelectedRoom(room);
    selectedRoomRef.current = room;
    setMobileChatOpen(true);

    try {
      await markConversationRead(room.conversation_id);
      await loadConversations(room.conversation_id);
    } catch (error) {
      console.error(error);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      setActionError("이 브라우저는 알림 기능을 지원하지 않아요.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        new Notification("XX Messenger", {
          body: "브라우저 알림이 켜졌어요.",
          tag: "xx-messenger-permission",
        });
      } else if (permission === "denied") {
        setActionError(
          "알림이 차단됐어요. 브라우저 주소창의 사이트 설정에서 알림을 허용해주세요."
        );
      }
    } catch (error) {
      setActionError(error.message);
    }
  };

  const showMessageNotification = async (messageRow, rooms) => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    if (messageRow.sender_id === session.user.id) return;

    const selectedId = selectedRoomRef.current?.conversation_id;

    if (
      document.visibilityState === "visible" &&
      selectedId === messageRow.conversation_id
    ) {
      return;
    }

    try {
      const fullMessage = await getMessageById(messageRow.id);

      const room =
        rooms.find(
          (item) =>
            item.conversation_id === messageRow.conversation_id
        ) ||
        conversationsRef.current.find(
          (item) =>
            item.conversation_id === messageRow.conversation_id
        );

      const senderName =
        fullMessage.sender?.name ||
        fullMessage.sender?.email ||
        "새 메시지";

      let body = fullMessage.content || "새 메시지가 도착했어요.";

      if (fullMessage.type === "image") {
        body = "📷 사진을 보냈습니다.";
      } else if (fullMessage.type === "file") {
        body = `📎 ${
          fullMessage.attachments?.[0]?.file_name ||
          fullMessage.content ||
          "파일"
        }`;
      }

      const notification = new Notification(
        room?.room_name || senderName,
        {
          body:
            room?.conversation_type === "group"
              ? `${senderName}: ${body}`
              : body,
          tag: `conversation-${messageRow.conversation_id}`,
          renotify: true,
        }
      );

      notification.onclick = () => {
        window.focus();

        const targetRoom =
          conversationsRef.current.find(
            (item) =>
              item.conversation_id === messageRow.conversation_id
          ) || room;

        if (targetRoom) {
          selectRoom(targetRoom);
          setActiveMenu("chat");
        }

        notification.close();
      };
    } catch (error) {
      console.error("브라우저 알림 생성 실패:", error);
    }
  };

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel(`rooms:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const rooms = await loadConversations();
          await showMessageNotification(payload.new, rooms);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`profile-updates:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          setProfileRefreshKey((value) => value + 1);
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  useEffect(() => {
    const presence = supabase.channel("xx-messenger-presence", {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    const sync = () => {
      setOnlineUserIds(
        new Set(Object.keys(presence.presenceState()))
      );
    };

    presence
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({
            user_id: session.user.id,
            online_at: new Date().toISOString(),
          });

          await touchLastSeen(session.user.id);
        }
      });

    const timer = setInterval(
      () => touchLastSeen(session.user.id),
      60_000
    );

    return () => {
      clearInterval(timer);
      supabase.removeChannel(presence);
    };
  }, [session.user.id]);

  const openDirect = async (employee) => {
    if (employee.id === session.user.id) {
      setShowProfileModal(true);
      return;
    }

    try {
      const id = await getOrCreateDirectConversation(employee.id);
      setActiveMenu("chat");

      const rooms = await getMyConversations();
      setConversations(rooms);
      conversationsRef.current = rooms;

      const room =
        rooms.find((item) => item.conversation_id === id) || null;

      if (room) {
        await selectRoom(room);
      }
    } catch (error) {
      setActionError(error.message);
    }
  };

  const createGroup = async (name, ids) => {
    const id = await createGroupConversation(name, ids);
    setShowGroupModal(false);
    setActiveMenu("chat");

    const rooms = await getMyConversations();
    setConversations(rooms);
    conversationsRef.current = rooms;

    const room =
      rooms.find((item) => item.conversation_id === id) || null;

    if (room) {
      await selectRoom(room);
    }
  };

  const handleProfileUpdated = async (updated) => {
    setProfile(updated);
    setProfileRefreshKey((value) => value + 1);
    await loadConversations(
      selectedRoomRef.current?.conversation_id ?? null
    );
  };

  const handleRoomChanged = async () => {
    const id = selectedRoomRef.current?.conversation_id;
    await loadConversations(id);
  };

  const handleLeftRoom = async () => {
    setShowManageModal(false);
    setSelectedRoom(null);
    selectedRoomRef.current = null;
    setMobileChatOpen(false);
    await loadConversations();
  };

  const displayName =
    profile?.name || session.user.email || "사용자";

  return (
    <div
      className={`messenger-shell ${
        mobileChatOpen && activeMenu === "chat" ? "mobile-chat-open" : ""
      } ${activeMenu === "admin" ? "mobile-admin-open" : ""}`}
    >
      <aside className="app-rail">
        <div className="app-logo">XX</div>

        <nav className="app-nav">
          <button
            className={`app-nav-button ${
              activeMenu === "chat" ? "active" : ""
            }`}
            onClick={() => {
              setActiveMenu("chat");
              setMobileChatOpen(false);
            }}
            title={`채팅${totalUnread > 0 ? ` (${totalUnread})` : ""}`}
          >
            <div className="rail-icon-wrap">
              <MessageCircle size={22} />

              {totalUnread > 0 && (
                <span className="rail-unread-badge">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
          </button>

          <button
            className={`app-nav-button ${
              activeMenu === "employees" ? "active" : ""
            }`}
            onClick={() => {
              setActiveMenu("employees");
              setMobileChatOpen(false);
            }}
          >
            <Users size={22} />
          </button>

          <button className="app-nav-button">
            <Bookmark size={22} />
          </button>

          <button
            className={`app-nav-button ${
              notificationPermission === "granted"
                ? "notification-enabled"
                : ""
            }`}
            title={
              notificationPermission === "granted"
                ? "브라우저 알림 켜짐"
                : "브라우저 알림 켜기"
            }
            onClick={requestNotificationPermission}
          >
            {notificationPermission === "denied" ? (
              <BellOff size={22} />
            ) : (
              <Bell size={22} />
            )}
          </button>

          {profile?.role === "ceo" && (
            <button
              className={`app-nav-button ${
                activeMenu === "admin" ? "active" : ""
              }`}
              title="사장 관리자"
              onClick={() => {
                setActiveMenu("admin");
                setMobileChatOpen(false);
              }}
            >
              <ShieldCheck size={22} />
            </button>
          )}

        </nav>

        <button className="app-nav-button rail-settings">
          <Settings size={22} />
        </button>
      </aside>

      <section className="middle-column">
        {activeMenu === "chat" ? (
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedRoom?.conversation_id}
            onSelect={selectRoom}
            onNewGroup={() => setShowGroupModal(true)}
            onlineUserIds={onlineUserIds}
          />
        ) : activeMenu === "employees" ? (
          <EmployeeList
            currentUserId={session.user.id}
            onlineUserIds={onlineUserIds}
            onSelectEmployee={openDirect}
            refreshKey={profileRefreshKey}
          />
        ) : (
          <AdminSidebar profile={profile} />
        )}

        <button
          className="my-profile-strip my-profile-button"
          onClick={() => setShowProfileModal(true)}
        >
          <div className="my-avatar">
            {profile?.avatar_signed_url ? (
              <img
                className="avatar-image"
                src={profile.avatar_signed_url}
                alt=""
              />
            ) : (
              displayName.slice(0, 1)
            )}
          </div>

          <div className="my-profile-copy">
            <strong>{displayName}</strong>
            <span>
              {profile?.status_message || "온라인"}
            </span>
          </div>

          <span className="profile-edit-shortcut">
            프로필
          </span>
        </button>

        <button className="logout-button profile-logout" onClick={onLogout}>
          로그아웃
        </button>
      </section>

      <main className="chat-column">
        {actionError && (
          <button
            className="top-error"
            onClick={() => setActionError("")}
          >
            {actionError}
          </button>
        )}

        {activeMenu === "admin" && profile?.role === "ceo" ? (
          <AdminPage
            session={session}
            currentProfile={profile}
          />
        ) : selectedRoom ? (
          <ChatView
            key={`${selectedRoom.conversation_id}-${profileRefreshKey}`}
            room={selectedRoom}
            currentUserId={session.user.id}
            isOtherOnline={
              selectedRoom.conversation_type === "direct" &&
              onlineUserIds.has(selectedRoom.other_user_id)
            }
            onMessageActivity={() =>
              loadConversations(selectedRoom.conversation_id)
            }
            onOpenManage={() => setShowManageModal(true)}
            onBack={() => setMobileChatOpen(false)}
          />
        ) : (
          <div className="detail-empty">
            <div className="detail-empty-icon">
              <MessageCircle size={34} />
            </div>

            <h2>대화를 시작해보세요</h2>
            <p>
              직원과 1:1 채팅을 하거나 단체방을 만들어보세요.
            </p>
          </div>
        )}
      </main>

      {showGroupModal && (
        <GroupCreateModal
          currentUserId={session.user.id}
          onClose={() => setShowGroupModal(false)}
          onCreate={createGroup}
        />
      )}

      {showManageModal && selectedRoom && (
        <RoomManageModal
          room={selectedRoom}
          currentUserId={session.user.id}
          onClose={() => setShowManageModal(false)}
          onChanged={handleRoomChanged}
          onLeft={handleLeftRoom}
        />
      )}

      {showProfileModal && profile && (
        <ProfileEditModal
          profile={profile}
          currentUserId={session.user.id}
          onClose={() => setShowProfileModal(false)}
          onUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}