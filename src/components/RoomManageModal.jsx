import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  getActiveEmployees,
  getConversationMembers,
  inviteToGroup,
  leaveConversation,
  setMyRoomName,
} from "../services/chatService";

export default function RoomManageModal({
  room,
  currentUserId,
  onClose,
  onChanged,
  onLeft,
}) {
  const [members, setMembers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customName, setCustomName] = useState(room.room_name || "");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [errorText, setErrorText] = useState("");
  const [busy, setBusy] = useState(false);

  const isGroup = room.conversation_type === "group";

  const load = async () => {
    try {
      const [memberData, employeeData] = await Promise.all([
        getConversationMembers(room.conversation_id),
        isGroup ? getActiveEmployees() : Promise.resolve([]),
      ]);

      setMembers(memberData);
      setEmployees(employeeData);
    } catch (error) {
      setErrorText(error.message);
    }
  };

  useEffect(() => {
    load();
  }, [room.conversation_id]);

  const memberIds = useMemo(
    () => new Set(members.map((member) => member.user_id)),
    [members]
  );

  const inviteCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();

    return employees.filter((employee) => {
      if (memberIds.has(employee.id)) return false;
      if (!q) return true;

      return [
        employee.name,
        employee.email,
        employee.department,
        employee.position,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [employees, memberIds, query]);

  const toggleInvite = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const saveName = async () => {
    setBusy(true);
    setErrorText("");

    try {
      await setMyRoomName(room.conversation_id, customName);
      await onChanged?.();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!selectedIds.length) return;

    setBusy(true);
    setErrorText("");

    try {
      await inviteToGroup(room.conversation_id, selectedIds);
      setSelectedIds([]);
      await load();
      await onChanged?.();
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    const message =
      room.conversation_type === "direct"
        ? "이 1:1 채팅방에서 나갈까요? 내 화면에서는 기존 대화 기록이 더 이상 보이지 않아요."
        : "이 단체 채팅방에서 나갈까요?";

    if (!window.confirm(message)) return;

    setBusy(true);
    setErrorText("");

    try {
      await leaveConversation(room.conversation_id);
      onLeft?.();
    } catch (error) {
      setErrorText(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="room-manage-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="manage-header">
          <div>
            <span className="tiny-label">채팅방 설정</span>
            <h2>{room.room_name}</h2>
          </div>

          <button className="round-icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="manage-body">
          <section className="manage-section">
            <h3>내 채팅방 이름</h3>
            <p>이 이름은 내 화면에서만 바뀌어요.</p>

            <div className="rename-row">
              <input
                value={customName}
                maxLength={50}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder={room.default_room_name || room.room_name}
              />
              <button onClick={saveName} disabled={busy}>
                저장
              </button>
            </div>
          </section>

          <section className="manage-section">
            <div className="section-title-row">
              <div>
                <h3>참여자</h3>
                <p>{members.length}명 참여 중</p>
              </div>
              <Users size={18} />
            </div>

            <div className="member-list">
              {members.map((member) => (
                <div className="member-row" key={member.user_id}>
                  <div className="member-avatar">
                    {member.avatar_signed_url ? (
                      <img
                        className="avatar-image"
                        src={member.avatar_signed_url}
                        alt=""
                      />
                    ) : (
                      (member.name || member.email || "?").slice(0, 1)
                    )}
                  </div>
                  <div>
                    <strong>
                      {member.name || member.email}
                      {member.user_id === currentUserId && (
                        <small> 나</small>
                      )}
                    </strong>
                    <span>
                      {member.status_message ||
                        [member.department, member.position_name]
                          .filter(Boolean)
                          .join(" · ") ||
                        member.email}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {isGroup && (
            <section className="manage-section">
              <div className="section-title-row">
                <div>
                  <h3>직원 초대</h3>
                  <p>선택한 직원은 바로 채팅방에 들어와요.</p>
                </div>
                <UserPlus size={18} />
              </div>

              <div className="manage-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="직원 검색"
                />
              </div>

              <div className="invite-list">
                {inviteCandidates.length === 0 ? (
                  <div className="invite-empty">
                    초대할 수 있는 직원이 없어요.
                  </div>
                ) : (
                  inviteCandidates.map((employee) => {
                    const selected = selectedIds.includes(employee.id);

                    return (
                      <button
                        key={employee.id}
                        className={`invite-row ${selected ? "selected" : ""}`}
                        onClick={() => toggleInvite(employee.id)}
                      >
                        <div className="invite-check">
                          {selected ? "✓" : ""}
                        </div>

                        <div className="member-avatar">
                          {employee.avatar_signed_url ? (
                            <img
                              className="avatar-image"
                              src={employee.avatar_signed_url}
                              alt=""
                            />
                          ) : (
                            (employee.name || employee.email || "?").slice(0, 1)
                          )}
                        </div>

                        <div>
                          <strong>{employee.name || employee.email}</strong>
                          <span>
                            {[employee.department, employee.position]
                              .filter(Boolean)
                              .join(" · ") || employee.email}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                className="invite-button"
                onClick={invite}
                disabled={busy || selectedIds.length === 0}
              >
                {selectedIds.length
                  ? `${selectedIds.length}명 초대`
                  : "초대할 직원 선택"}
              </button>
            </section>
          )}

          {errorText && <div className="manage-error">{errorText}</div>}

          <button
            className="leave-room-button"
            onClick={leave}
            disabled={busy}
          >
            <LogOut size={17} />
            채팅방 나가기
          </button>
        </div>
      </div>
    </div>
  );
}
