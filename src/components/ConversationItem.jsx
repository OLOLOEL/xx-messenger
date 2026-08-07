export default function ConversationItem({
  name,
  preview,
  time,
  unread,
  active,
  initials,
}) {
  return (
    <button className={`conversation-item ${active ? "active" : ""}`}>
      <div className="conversation-avatar">{initials}</div>

      <div className="conversation-copy">
        <div className="conversation-topline">
          <strong>{name}</strong>
          <span>{time}</span>
        </div>

        <div className="conversation-bottomline">
          <p>{preview}</p>
          {unread ? <span className="unread-badge">{unread}</span> : null}
        </div>
      </div>
    </button>
  );
}
