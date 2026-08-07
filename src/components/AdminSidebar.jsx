import { KeyRound, MessageSquareText, ShieldCheck, Users } from "lucide-react";

export default function AdminSidebar({ profile }) {
  return (
    <section className="admin-sidebar">
      <header className="admin-side-header">
        <span className="tiny-label">XX Messenger</span>
        <h1>관리자</h1>
      </header>

      <div className="admin-owner-card">
        <div className="admin-owner-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <strong>{profile?.name || profile?.email}</strong>
          <span>사장 전용 관리자</span>
        </div>
      </div>

      <div className="admin-feature-list">
        <div>
          <Users size={17} />
          <span>직원 계정 관리</span>
        </div>
        <div>
          <MessageSquareText size={17} />
          <span>전체 대화 조회</span>
        </div>
        <div>
          <KeyRound size={17} />
          <span>접속 기록 / 비밀번호 초기화</span>
        </div>
      </div>

      <p className="admin-side-note">
        전체 대화 조회 권한은 CEO 역할에만 부여돼요.
      </p>
    </section>
  );
}
