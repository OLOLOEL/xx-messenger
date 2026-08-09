import { KeyRound, ShieldCheck, Users } from "lucide-react";

export default function AdminSidebar({ profile }) {
  return (
    <section className="admin-sidebar">
      <div className="admin-side-brand">
        <strong>XX Messenger</strong>
        <span>관리자</span>
      </div>

      <div className="admin-owner-card">
        <div className="admin-owner-icon">
          <ShieldCheck size={22} />
        </div>

        <div>
          <strong>{profile?.name || profile?.email}</strong>
          <span>관리자</span>
        </div>
      </div>

      <div className="admin-feature-list">
        <div>
          <Users size={17} />
          <span>직원 계정 관리</span>
        </div>

        <div>
          <KeyRound size={17} />
          <span>계정 및 접속 관리</span>
        </div>
      </div>

      <p className="admin-side-note">
        XX 사내 업무용 메신저입니다.
      </p>
    </section>
  );
}