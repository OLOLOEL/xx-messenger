import { useEffect, useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import {
  adminGetConversationMessages,
  adminListConversations,
  adminListLoginLogs,
  adminListUsers,
  callAdminUserApi,
} from "../services/adminService";

import {
  approveApplication,
  changeEmployeePosition,
  listPendingApplications,
  rejectApplication,
  setEmployeeAccountStatus,
} from "../services/profileService";

const POSITIONS = [
  "회장",
  "사장",
  "부장",
  "차장",
  "과장",
  "대리",
  "주임",
  "사원",
  "인턴",
];

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

function statusLabel(status) {
  if (status === "approved") return "활성";
  if (status === "suspended") return "정지";
  if (status === "pending") return "승인 대기";
  if (status === "rejected") return "거절";
  return status || "-";
}

export default function AdminPage({
  session,
  currentProfile,
}) {
  const canViewAllChats =
    currentProfile?.role === "ceo" ||
    currentProfile?.can_view_all_chats === true;

  const [tab, setTab] = useState("approvals");

  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [logs, setLogs] = useState([]);

  const [selectedConversation, setSelectedConversation] =
    useState(null);

  const [messages, setMessages] = useState([]);

  const [query, setQuery] = useState("");
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [loading, setLoading] = useState(false);

  const [approvalPositions, setApprovalPositions] =
    useState({});

  const loadApplications = async () => {
    setLoading(true);
    setErrorText("");

    try {
      const data = await listPendingApplications();

      setApplications(data);

      setApprovalPositions((current) => {
        const next = { ...current };

        data.forEach((application) => {
          if (!next[application.id]) {
            next[application.id] =
              application.requested_position || "사원";
          }
        });

        return next;
      });
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

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
    if (!canViewAllChats) return;

    setLoading(true);
    setErrorText("");

    try {
      setConversations(
        await adminListConversations()
      );
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
    loadApplications();
  }, []);

  useEffect(() => {
    setQuery("");
    setInfoText("");
    setErrorText("");
    setSelectedConversation(null);
    setMessages([]);

    if (tab === "approvals") {
      loadApplications();
    }

    if (tab === "users") {
      loadUsers();
    }

    if (tab === "chats" && canViewAllChats) {
      loadConversations();
    }

    if (tab === "logs") {
      loadLogs();
    }
  }, [tab, canViewAllChats]);

  useEffect(() => {
    if (!canViewAllChats && tab === "chats") {
      setTab("approvals");
    }
  }, [canViewAllChats, tab]);

  const filteredApplications = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return applications;

    return applications.filter((application) =>
      [
        application.name,
        application.email,
        application.requested_position,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [applications, query]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return users;

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.position_name,
        user.position,
        user.role,
        user.account_status,
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

  const handleApprove = async (application) => {
    const position =
      approvalPositions[application.id] ||
      application.requested_position ||
      "사원";

    setErrorText("");
    setInfoText("");

    try {
      setLoading(true);

      await approveApplication(
        application.id,
        position
      );

      setInfoText(
        `${application.name || application.email} 계정을 ${position} 직급으로 승인했어요.`
      );

      await loadApplications();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (application) => {
    if (
      !window.confirm(
        `${
          application.name || application.email
        }님의 가입 신청을 거절할까요?`
      )
    ) {
      return;
    }

    setErrorText("");
    setInfoText("");

    try {
      setLoading(true);

      await rejectApplication(application.id);

      setInfoText(
        `${
          application.name || application.email
        }님의 가입 신청을 거절했어요.`
      );

      await loadApplications();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePositionChange = async (
    user,
    position
  ) => {
    setErrorText("");
    setInfoText("");

    try {
      setLoading(true);

      await changeEmployeePosition(
        user.id,
        position
      );

      setInfoText(
        `${
          user.name || user.email
        }님의 직급을 ${position}(으)로 변경했어요.`
      );

      await loadUsers();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountStatus = async (
    user,
    nextStatus
  ) => {
    const action =
      nextStatus === "suspended"
        ? "정지"
        : "복구";

    if (
      !window.confirm(
        `${
          user.name || user.email
        } 계정을 ${action}할까요?`
      )
    ) {
      return;
    }

    setErrorText("");
    setInfoText("");

    try {
      setLoading(true);

      await setEmployeeAccountStatus(
        user.id,
        nextStatus
      );

      setInfoText(
        `${
          user.name || user.email
        } 계정을 ${action}했어요.`
      );

      await loadUsers();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (user) => {
    if (
      !window.confirm(
        `${
          user.name || user.email
        } 계정의 비밀번호를 임시 비밀번호로 초기화할까요?`
      )
    ) {
      return;
    }

    setErrorText("");
    setInfoText("");

    try {
      const result = await callAdminUserApi(
        "reset_password",
        {
          userId: user.id,
        }
      );

      setInfoText(
        `${
          user.name || user.email
        } 임시 비밀번호: ${
          result.temporaryPassword
        }`
      );
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const openConversation = async (room) => {
    if (!canViewAllChats) return;

    setSelectedConversation(room);
    setErrorText("");

    try {
      setMessages(
        await adminGetConversationMessages(
          room.conversation_id
        )
      );
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const refreshCurrentTab = () => {
    if (tab === "approvals") {
      loadApplications();
    }

    if (tab === "users") {
      loadUsers();
    }

    if (tab === "chats" && canViewAllChats) {
      loadConversations();
    }

    if (tab === "logs") {
      loadLogs();
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <div className="admin-title-line">
            <ShieldCheck size={20} />

            <h2>
              {roleLabel(currentProfile?.role)} 관리자
            </h2>
          </div>

          <p>
            직원 계정과 XX Messenger를
            관리합니다.
          </p>
        </div>

        <button
          className="round-icon-button"
          title="새로고침"
          onClick={refreshCurrentTab}
        >
          <RefreshCw size={18} />
        </button>
      </header>

      <div className="admin-tabs">
        <button
          className={
            tab === "approvals" ? "active" : ""
          }
          onClick={() => setTab("approvals")}
        >
          <UserCheck size={15} />
          가입 승인
          {applications.length > 0 &&
            ` (${applications.length})`}
        </button>

        <button
          className={
            tab === "users" ? "active" : ""
          }
          onClick={() => setTab("users")}
        >
          <Users size={15} />
          직원
        </button>

        {canViewAllChats && (
          <button
            className={
              tab === "chats" ? "active" : ""
            }
            onClick={() => setTab("chats")}
          >
            <MessageSquareText size={15} />
            전체 대화
          </button>
        )}

        <button
          className={
            tab === "logs" ? "active" : ""
          }
          onClick={() => setTab("logs")}
        >
          <KeyRound size={15} />
          접속 기록
        </button>
      </div>

      {errorText && (
        <div className="admin-alert error">
          {errorText}
        </div>
      )}

      {infoText && (
        <div className="admin-alert info">
          {infoText}
        </div>
      )}

      {tab !== "logs" && (
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={16} />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder={
                tab === "approvals"
                  ? "가입 신청자 검색"
                  : tab === "users"
                    ? "직원 검색"
                    : "참여자 / 방 이름 / 메시지 검색"
              }
            />
          </div>
        </div>
      )}

      {tab === "approvals" && (
        <div className="admin-content">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>신청자</th>
                  <th>희망 직급</th>
                  <th>승인 직급</th>
                  <th>신청일</th>
                  <th>관리</th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.length ===
                0 ? (
                  <tr>
                    <td colSpan="5">
                      승인 대기 중인 계정이
                      없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map(
                    (application) => (
                      <tr key={application.id}>
                        <td>
                          <strong>
                            {application.name ||
                              "이름 없음"}
                          </strong>

                          <span>
                            {application.email}
                          </span>
                        </td>

                        <td>
                          {application.requested_position ||
                            "-"}
                        </td>

                        <td>
                          <select
                            value={
                              approvalPositions[
                                application.id
                              ] ||
                              application.requested_position ||
                              "사원"
                            }
                            onChange={(event) =>
                              setApprovalPositions(
                                (current) => ({
                                  ...current,
                                  [application.id]:
                                    event.target
                                      .value,
                                })
                              )
                            }
                          >
                            {POSITIONS.map(
                              (position) => (
                                <option
                                  key={position}
                                  value={position}
                                >
                                  {position}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td>
                          {dt(
                            application.created_at
                          )}
                        </td>

                        <td>
                          <div className="admin-row-actions">
                            <button
                              title="승인"
                              onClick={() =>
                                handleApprove(
                                  application
                                )
                              }
                            >
                              <Check
                                size={15}
                              />
                            </button>

                            <button
                              className="danger"
                              title="거절"
                              onClick={() =>
                                handleReject(
                                  application
                                )
                              }
                            >
                              <UserX
                                size={15}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="admin-content">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>직원</th>
                  <th>직급</th>
                  <th>권한</th>
                  <th>마지막 접속</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const accountStatus =
                    user.account_status ||
                    (user.is_active
                      ? "approved"
                      : "suspended");

                  const currentPosition =
                    user.position_name ||
                    user.position ||
                    "사원";

                  const isMe =
                    user.id === session.user.id;

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>
                          {user.name ||
                            "이름 없음"}
                        </strong>

                        <span>
                          {user.email}
                        </span>
                      </td>

                      <td>
                        <select
                          value={
                            POSITIONS.includes(
                              currentPosition
                            )
                              ? currentPosition
                              : "사원"
                          }
                          onChange={(event) =>
                            handlePositionChange(
                              user,
                              event.target.value
                            )
                          }
                        >
                          {POSITIONS.map(
                            (position) => (
                              <option
                                key={position}
                                value={position}
                              >
                                {position}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        {roleLabel(user.role)}
                      </td>

                      <td>
                        {dt(user.last_seen_at)}
                      </td>

                      <td>
                        {statusLabel(
                          accountStatus
                        )}
                      </td>

                      <td>
                        <div className="admin-row-actions">
                          <button
                            onClick={() =>
                              resetPassword(user)
                            }
                            title="비밀번호 초기화"
                          >
                            <KeyRound
                              size={15}
                            />
                          </button>

                          {!isMe &&
                            accountStatus ===
                              "approved" && (
                              <button
                                className="danger"
                                title="계정 정지"
                                onClick={() =>
                                  handleAccountStatus(
                                    user,
                                    "suspended"
                                  )
                                }
                              >
                                <UserX
                                  size={15}
                                />
                              </button>
                            )}

                          {!isMe &&
                            accountStatus ===
                              "suspended" && (
                              <button
                                title="계정 복구"
                                onClick={() =>
                                  handleAccountStatus(
                                    user,
                                    "approved"
                                  )
                                }
                              >
                                <UserCheck
                                  size={15}
                                />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "chats" &&
        canViewAllChats && (
          <div className="admin-chat-audit">
            <aside className="admin-room-list">
              {filteredConversations.map(
                (room) => (
                  <button
                    key={
                      room.conversation_id
                    }
                    className={
                      selectedConversation?.conversation_id ===
                      room.conversation_id
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      openConversation(room)
                    }
                  >
                    <strong>
                      {room.default_name ||
                        (room.conversation_type ===
                        "direct"
                          ? "1:1 채팅"
                          : "단체 채팅")}
                    </strong>

                    <span>
                      {room.member_names ||
                        "참여자 없음"}
                    </span>

                    <small>
                      {room.last_message ||
                        "메시지 없음"}
                    </small>
                  </button>
                )
              )}
            </aside>

            <section className="admin-message-view">
              {!selectedConversation ? (
                <div className="admin-empty">
                  왼쪽에서 조회할 채팅방을
                  선택하세요.
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
                      {
                        selectedConversation.member_count
                      }
                      명 · 생성{" "}
                      {dt(
                        selectedConversation.created_at
                      )}
                    </span>
                  </header>

                  <div className="admin-message-list">
                    {messages.map(
                      (message) => (
                        <div
                          key={
                            message.message_id
                          }
                          className="admin-message-row"
                        >
                          <div className="admin-message-meta">
                            <strong>
                              {message.sender_name ||
                                message.sender_email ||
                                "사용자"}
                            </strong>

                            <span>
                              {dt(
                                message.created_at
                              )}
                            </span>
                          </div>

                          {message.attachment_file_path ? (
                            message.attachment_mime_type?.startsWith(
                              "image/"
                            ) &&
                            message.attachment_signed_url ? (
                              <a
                                href={
                                  message.attachment_signed_url
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  className="admin-audit-image"
                                  src={
                                    message.attachment_signed_url
                                  }
                                  alt=""
                                />
                              </a>
                            ) : (
                              <a
                                href={
                                  message.attachment_signed_url ||
                                  "#"
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                📎{" "}
                                {
                                  message.attachment_file_name
                                }
                              </a>
                            )
                          ) : (
                            <p>
                              {
                                message.content
                              }
                            </p>
                          )}
                        </div>
                      )
                    )}
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
                        {log.user_name ||
                          log.user_email}
                      </strong>

                      <span>
                        {log.user_email}
                      </span>
                    </td>

                    <td>
                      {dt(log.logged_at)}
                    </td>

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
        <div className="admin-loading">
          불러오는 중...
        </div>
      )}
    </div>
  );
}