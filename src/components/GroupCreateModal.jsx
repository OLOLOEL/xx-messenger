import { useEffect, useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function GroupCreateModal({
  currentUserId,
  onClose,
  onCreate,
}) {
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [query, setQuery] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,name,email,department,position")
      .eq("is_active", true)
      .neq("id", currentUserId)
      .order("name", { ascending: true })
      .then(({ data }) => setEmployees(data ?? []));
  }, [currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((e) =>
      [e.name, e.email, e.department, e.position]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [employees, query]);

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const create = async () => {
    if (!roomName.trim()) return setErrorText("방 이름을 입력해주세요.");
    if (!selectedIds.length) return setErrorText("직원을 한 명 이상 선택해주세요.");

    try {
      await onCreate(roomName.trim(), selectedIds);
    } catch (e) {
      setErrorText(e.message);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="group-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="group-modal-header">
          <div>
            <span className="tiny-label">새 채팅</span>
            <h2>단체방 만들기</h2>
          </div>
          <button className="round-icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="group-form">
          <label className="group-name-label">
            <span>방 이름</span>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="예: 마케팅팀"
            />
          </label>

          <div className="group-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="직원 검색"
            />
          </div>

          <div className="selected-summary">
            <Users size={15} />
            {selectedIds.length}명 선택
          </div>

          <div className="group-employee-list">
            {filtered.map((employee) => {
              const checked = selectedIds.includes(employee.id);

              return (
                <button
                  key={employee.id}
                  className={`group-employee-row ${checked ? "selected" : ""}`}
                  onClick={() => toggle(employee.id)}
                >
                  <div className="group-check">{checked ? "✓" : ""}</div>
                  <div className="employee-avatar fallback small">
                    {(employee.name || employee.email || "?").slice(0, 1)}
                  </div>
                  <div className="group-employee-copy">
                    <strong>{employee.name || employee.email}</strong>
                    <span>
                      {[employee.department, employee.position]
                        .filter(Boolean)
                        .join(" · ") || employee.email}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {errorText && <div className="group-error">{errorText}</div>}

          <button className="group-create-button" onClick={create}>
            단체방 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
