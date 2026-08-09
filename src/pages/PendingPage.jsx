import { Clock3, LogOut } from "lucide-react";

const STATUS_TEXT = {
  pending: {
    title: "계정 승인 대기 중",
    text: "관리자의 승인이 완료되면 XX Messenger를 이용할 수 있습니다.",
  },

  rejected: {
    title: "계정 신청이 승인되지 않았습니다",
    text: "관리자에게 문의해주세요.",
  },

  suspended: {
    title: "사용이 중지된 계정입니다",
    text: "관리자에게 문의해주세요.",
  },
};

export default function PendingPage({ status = "pending", onLogout }) {
  const content = STATUS_TEXT[status] ?? STATUS_TEXT.pending;

  return (
    <div className="login-page">
      <div className="login-card pending-card">
        <div className="login-brand">
          <strong>XX</strong>
          <span>Messenger</span>
        </div>

        <Clock3 size={38} />

        <div className="login-heading">
          <h2>{content.title}</h2>
          <p>{content.text}</p>
        </div>

        <button className="secondary-button" onClick={onLogout}>
          <LogOut size={17} />
          로그아웃
        </button>
      </div>
    </div>
  );
}