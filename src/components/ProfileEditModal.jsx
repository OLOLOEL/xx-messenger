import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import {
  removeMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
} from "../services/profileService";

export default function ProfileEditModal({
  profile,
  currentUserId,
  onClose,
  onUpdated,
}) {
  const [name, setName] = useState(profile?.name || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [position, setPosition] = useState(profile?.position || "");
  const [statusMessage, setStatusMessage] = useState(
    profile?.status_message || ""
  );
  const [working, setWorking] = useState(false);
  const [errorText, setErrorText] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    setName(profile?.name || "");
    setDepartment(profile?.department || "");
    setPosition(profile?.position || "");
    setStatusMessage(profile?.status_message || "");
  }, [profile]);

  const saveProfile = async () => {
    setWorking(true);
    setErrorText("");

    try {
      const updated = await updateMyProfile(currentUserId, {
        name,
        department,
        position,
        status_message: statusMessage,
      });

      await onUpdated(updated);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setWorking(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;

    setWorking(true);
    setErrorText("");

    try {
      const updated = await uploadMyAvatar(
        currentUserId,
        file,
        profile?.avatar_path ?? null
      );

      await onUpdated(updated);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setWorking(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!profile?.avatar_path) return;
    if (!window.confirm("프로필 사진을 삭제할까요?")) return;

    setWorking(true);
    setErrorText("");

    try {
      const updated = await removeMyAvatar(
        currentUserId,
        profile.avatar_path
      );

      await onUpdated(updated);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setWorking(false);
    }
  };

  const displayName = profile?.name || profile?.email || "?";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="profile-edit-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="profile-edit-header">
          <div>
            <span className="tiny-label">내 프로필</span>
            <h2>프로필 편집</h2>
          </div>

          <button className="round-icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="profile-edit-body">
          <div className="profile-avatar-editor">
            <div className="profile-avatar-large">
              {profile?.avatar_signed_url ? (
                <img src={profile.avatar_signed_url} alt="" />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>

            <div className="profile-avatar-buttons">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(event) =>
                  uploadAvatar(event.target.files?.[0])
                }
              />

              <button
                className="profile-photo-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={working}
              >
                <Camera size={16} />
                사진 변경
              </button>

              {profile?.avatar_path && (
                <button
                  className="profile-photo-remove"
                  onClick={removeAvatar}
                  disabled={working}
                >
                  <Trash2 size={15} />
                  삭제
                </button>
              )}
            </div>
          </div>

          <label className="profile-field">
            <span>이름</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
            />
          </label>

          <div className="profile-field-grid">
            <label className="profile-field">
              <span>부서</span>
              <input
                value={department}
                onChange={(event) =>
                  setDepartment(event.target.value)
                }
                maxLength={40}
              />
            </label>

            <label className="profile-field">
              <span>직급</span>
              <input
                value={position}
                onChange={(event) =>
                  setPosition(event.target.value)
                }
                maxLength={40}
              />
            </label>
          </div>

          <label className="profile-field">
            <span>상태 메시지</span>
            <input
              value={statusMessage}
              onChange={(event) =>
                setStatusMessage(event.target.value)
              }
              placeholder="예: 회의 중 / 자리 비움"
              maxLength={80}
            />
          </label>

          <div className="profile-email">
            로그인 이메일: {profile?.email || ""}
          </div>

          {errorText && (
            <div className="profile-error">{errorText}</div>
          )}

          <button
            className="profile-save-button"
            onClick={saveProfile}
            disabled={working}
          >
            {working ? "저장 중..." : "프로필 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
