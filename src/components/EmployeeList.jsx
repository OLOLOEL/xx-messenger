import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { getActiveEmployees } from "../services/chatService";
import { formatLastSeen } from "../services/presenceService";

function roleLabel(role) {
  if (role === "ceo") return "CEO";
  if (role === "president") return "회장";
  return "직원";
}

export default function EmployeeList({
  currentUserId,
  onlineUserIds,
  onSelectEmployee,
  refreshKey,
}) {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    try {
      const data = await getActiveEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((e) =>
      [
        e.name,
        e.email,
        e.department,
        e.position,
        e.status_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [employees, query]);

  return (
    <section className="employee-panel">
      <header className="employee-header">
        <div>
          <span className="tiny-label">XX Messenger</span>
          <h1>직원</h1>
        </div>

        <button className="round-icon-button" onClick={load}>
          <RefreshCw size={18} />
        </button>
      </header>

      <div className="employee-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름, 부서, 직급 검색"
        />
      </div>

      <div className="employee-list">
        {filtered.map((employee) => {
          const online = onlineUserIds.has(employee.id);

          return (
            <button
              key={employee.id}
              className="employee-card"
              onClick={() => onSelectEmployee(employee)}
            >
              <div className="employee-avatar-wrap">
                <div className="employee-avatar fallback">
                  {employee.avatar_signed_url ? (
                    <img
                      className="avatar-image"
                      src={employee.avatar_signed_url}
                      alt=""
                    />
                  ) : (
                    (employee.name || employee.email || "?")
                      .slice(0, 1)
                      .toUpperCase()
                  )}
                </div>

                <span
                  className={`presence-dot ${
                    online ? "online" : ""
                  }`}
                />
              </div>

              <div className="employee-info">
                <div className="employee-name-line">
                  <strong>{employee.name || employee.email}</strong>

                  {employee.id === currentUserId && (
                    <span className="me-badge">나</span>
                  )}

                  {employee.role !== "employee" && (
                    <span className={`role-badge ${employee.role}`}>
                      {roleLabel(employee.role)}
                    </span>
                  )}
                </div>

                <span
                  className={`employee-presence ${
                    online ? "online" : ""
                  }`}
                >
                  {online
                    ? "온라인"
                    : formatLastSeen(employee.last_seen_at)}
                </span>

                <span className="employee-meta">
                  {employee.status_message ||
                    [employee.department, employee.position]
                      .filter(Boolean)
                      .join(" · ") ||
                    employee.email}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
