import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  adminGetConversationMessages,
  adminListConversations,
  adminListLoginLogs,
  adminListUsers,
  callAdminUserApi,
} from "../services/adminService";

function dt(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role) {
  if (role === "ceo") return "사장";
  if (role === "president") return "회장";
  return "직원";
}

export default function AdminPage({
  session,
  currentProfile,
}) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDepartment, setCreateDepartment] = useState("");
  const [createPosition, setCreatePosition] = useState("");
  const [createRole, setCreateRole] = useState("employee");

  const loadUsers = async () => {
    setLoading(true);
    setErrorText("");

    try {
      setUsers(await adminListUsers());
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    setLoading(true);
    setErrorText("");

    try {
      setConversations(await adminListConversations());
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    setErrorText("");

    try {
      setLogs(await adminListLoginLogs());
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setQuery("");
    setInfoText("");
    setErrorText("");

    if (tab === "users") loadUsers();
    if (tab === "chats") loadConversations();
    if (tab === "logs") loadLogs();
  }, [tab]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.department,
        user.position_name,
        user.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, query]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((room) =>
      [
        room.default_name,
        room.member_names,
        room.last_message,
        room.conversation_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [conversations, query]);

  const createUser = async () => {
    setErrorText("");
    setInfoText("");

    if (!createEmail.trim() || !createPassword) {
      setErrorText("이메일과 임시 비밀번호를 입력해주세요.");
      return;
    }

    try {
      const result = await callAdminUserApi("create", {
        email: createEmail.trim(),
        password: createPassword,
        name: createName.trim(),
        department: createDepartment.trim(),
        position: createPosition.trim(),
        role: createRole,
      });

      setInfoText(`${result.email} 계정을 만들었어요.`);
      setShowCreate(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateDepartment("");
      setCreatePosition("");
      setCreateRole("employee");
      await loadUsers();
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const resetPassword = async (user) => {
    if (
      !window.confirm(
        `${user.name || user.email} 계정의 비밀번호를 임시 비밀번호로 초기화할까요?`
      )
    ) {
      return;
    }

    setErrorText("");
    setInfoText("");

    try {
      const result = await callAdminUserApi("reset_password", {
        userId: user.id,
      });

      setInfoText(
        `${user.name || user.email} 임시 비밀번호: ${result.temporaryPassword}`
      );
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const deleteUser = async (user) => {
    if (user.id === session.user.id) {
      setErrorText("현재 로그인한 사장 계정은 삭제할 수 없어요.");
      return;
    }

    if (
      !window.confirm(
        `${user.name || user.email} 계정을 정말 삭제할까요? 이 작업은 되돌리기 어렵습니다.`
      )
    ) {
      return;
    }

    setErrorText("");
    setInfoText("");

    try {
      await callAdminUserApi("delete", {
        userId: user.id,
      });

      setInfoText(`${user.name || user.email} 계정을 삭제했어요.`);
      await loadUsers();
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const changeRole = async (user, role) => {
    setErrorText("");
    setInfoText("");

    try {
      await callAdminUserApi("update_role", {
        userId: user.id,
        role,
      });

      setInfoText(
        `${user.name || user.email} 권한을 ${roleLabel(role)}(으)로 변경했어요.`
      );
      await loadUsers();
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const openConversation = async (room) => {
    setSelectedConversation(room);
    setErrorText("");

    try {
      setMessages(
        await adminGetConversationMessages(room.conversation_id)
      );
    } catch (error) {
      setErrorText(error.message);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <div className="admin-title-line">
            <ShieldCheck size={20} />
            <h2>사장 관리자</h2>
          </div>
          <p>
            직원 계정 관리와 전체 사내 대화 감사 기능입니다.
          </p>
        </div>

        <button
          className="round-icon-button"
          title="새로고침"
          onClick={() => {
            if (tab === "users") loadUsers();
            if (tab === "chats") loadConversations();
            if (tab === "logs") loadLogs();
          }}
        >
          <RefreshCw size={18} />
        </button>
      </header>

      <div className="admin-tabs">
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          <Users size={15} />
          직원
        </button>

        <button
          className={tab === "chats" ? "active" : ""}
          onClick={() => setTab("chats")}
        >
          <MessageSquareText size={15} />
          전체 대화
        </button>

        <button
          className={tab === "logs" ? "active" : ""}
          onClick={() => setTab("logs")}
        >
          <KeyRound size={15} />
          접속 기록
        </button>
      </div>

      {errorText && (
        <div className="admin-alert error">{errorText}</div>
      )}

      {infoText && (
        <div className="admin-alert info">{infoText}</div>
      )}

      {tab !== "logs" && (
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "users"
                  ? "직원 검색"
                  : "참여자 / 방 이름 / 메시지 검색"
              }
            />
          </div>

          {tab === "users" && (
            <button
              className="admin-primary-button"
              onClick={() => setShowCreate((value) => !value)}
            >
              <Plus size={16} />
              직원 계정 생성
            </button>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="admin-content">
          {showCreate && (
            <div className="admin-create-card">
              <h3>새 직원 계정</h3>

              <div className="admin-form-grid">
                <input
                  placeholder="이름"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                />
                <input
                  placeholder="이메일"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                />
                <input
                  placeholder="임시 비밀번호"
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                />
                <input
                  placeholder="부서"
                  value={createDepartment}
                  onChange={(event) => setCreateDepartment(event.target.value)}
                />
                <input
                  placeholder="직급"
                  value={createPosition}
                  onChange={(event) => setCreatePosition(event.target.value)}
                />
                <select
                  value={createRole}
                  onChange={(event) => setCreateRole(event.target.value)}
                >
                  <option value="employee">직원</option>
                  <option value="president">회장</option>
                  <option value="ceo">사장</option>
                </select>
              </div>

              <button
                className="admin-create-submit"
                onClick={createUser}
              >
                계정 생성
              </button>
            </div>
          )}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>직원</th>
                  <th>부서 / 직급</th>
                  <th>권한</th>
                  <th>마지막 접속</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name || "이름 없음"}</strong>
                      <span>{user.email}</span>
                    </td>
                    <td>
                      {[user.department, user.position_name]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </td>
                    <td>
                      <select
                        value={user.role || "employee"}
                        disabled={user.id === session.user.id}
                        onChange={(event) =>
                          changeRole(user, event.target.value)
                        }
                      >
                        <option value="employee">직원</option>
                        <option value="president">회장</option>
                        <option value="ceo">사장</option>
                      </select>
                    </td>
                    <td>{dt(user.last_seen_at)}</td>
                    <td>
                      {user.is_active ? "활성" : "비활성"}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          onClick={() => resetPassword(user)}
                          title="비밀번호 초기화"
                        >
                          <KeyRound size={15} />
                        </button>

                        <button
                          className="danger"
                          onClick={() => deleteUser(user)}
                          disabled={user.id === session.user.id}
                          title="계정 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "chats" && (
        <div className="admin-chat-audit">
          <aside className="admin-room-list">
            {filteredConversations.map((room) => (
              <button
                key={room.conversation_id}
                className={
                  selectedConversation?.conversation_id ===
                  room.conversation_id
                    ? "active"
                    : ""
                }
                onClick={() => openConversation(room)}
              >
                <strong>
                  {room.default_name ||
                    (room.conversation_type === "direct"
                      ? "1:1 채팅"
                      : "단체 채팅")}
                </strong>
                <span>{room.member_names || "참여자 없음"}</span>
                <small>
                  {room.last_message || "메시지 없음"}
                </small>
              </button>
            ))}
          </aside>

          <section className="admin-message-view">
            {!selectedConversation ? (
              <div className="admin-empty">
                왼쪽에서 조회할 채팅방을 선택하세요.
              </div>
            ) : (
              <>
                <header>
                  <strong>
                    {selectedConversation.default_name ||
                      selectedConversation.member_names ||
                      "채팅방"}
                  </strong>
                  <span>
                    {selectedConversation.member_count}명 · 생성{" "}
                    {dt(selectedConversation.created_at)}
                  </span>
                </header>

                <div className="admin-message-list">
                  {messages.map((message) => (
                    <div
                      key={message.message_id}
                      className="admin-message-row"
                    >
                      <div className="admin-message-meta">
                        <strong>
                          {message.sender_name ||
                            message.sender_email ||
                            "사용자"}
                        </strong>
                        <span>{dt(message.created_at)}</span>
                      </div>

                      {message.attachment_file_path ? (
                        message.attachment_mime_type?.startsWith(
                          "image/"
                        ) &&
                        message.attachment_signed_url ? (
                          <a
                            href={message.attachment_signed_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              className="admin-audit-image"
                              src={message.attachment_signed_url}
                              alt=""
                            />
                          </a>
                        ) : (
                          <a
                            href={message.attachment_signed_url || "#"}
                            target="_blank"
                            rel="noreferrer"
                          >
                            📎 {message.attachment_file_name}
                          </a>
                        )
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "logs" && (
        <div className="admin-content">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>직원</th>
                  <th>접속 시각</th>
                  <th>브라우저</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.log_id}>
                    <td>
                      <strong>
                        {log.user_name || log.user_email}
                      </strong>
                      <span>{log.user_email}</span>
                    </td>
                    <td>{dt(log.logged_at)}</td>
                    <td className="admin-user-agent">
                      {log.user_agent || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="admin-loading">불러오는 중...</div>
      )}
    </div>
  );
}
