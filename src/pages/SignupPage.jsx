import { useState } from "react";
import {
  ArrowLeft,
  Camera,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { uploadMyAvatar } from "../services/profileService";

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

export default function SignupPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("사원");
  const [avatar, setAvatar] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrorText("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            requested_position: position,
          },
        },
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("계정 신청에 실패했습니다.");
      }

      // 이메일 확인이 꺼져 있어서 세션이 바로 생성된 경우
      // 프로필 사진까지 즉시 저장
      if (avatar && data.session) {
        await uploadMyAvatar(data.user.id, avatar);
      }

      setDone(true);
    } catch (error) {
      setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="login-page">
        <div className="login-card signup-complete-card">
          <div className="login-brand">
            <strong>XX</strong>
            <span>Messenger</span>
          </div>

          <div className="login-heading">
            <h2>계정 신청 완료</h2>
            <p>
              관리자 승인 후
              <br />
              XX Messenger를 이용할 수 있습니다.
            </p>
          </div>

          <button className="primary-button" onClick={onBack}>
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <button
          type="button"
          className="signup-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
          로그인
        </button>

        <div className="login-brand">
          <strong>XX</strong>
          <span>Messenger</span>
        </div>

        <div className="login-heading">
          <h2>계정 신청</h2>
          <p>승인 후 사내 메신저를 이용할 수 있습니다.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>이름</span>
            <div className="input-wrap">
              <UserRound size={18} />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          </label>

          <label>
            <span>이메일</span>
            <div className="input-wrap">
              <Mail size={18} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </div>
          </label>

          <label>
            <span>비밀번호</span>
            <div className="input-wrap">
              <LockKeyhole size={18} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={6}
                required
              />
            </div>
          </label>

          <label>
            <span>희망 직급</span>
            <select
              className="signup-position-select"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            >
              {POSITIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>프로필 사진</span>

            <div className="signup-file-row">
              <Camera size={18} />
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setAvatar(event.target.files?.[0] ?? null)
                }
              />
            </div>
          </label>

          {errorText && (
            <div className="login-message">{errorText}</div>
          )}

          <button className="primary-button" disabled={loading}>
            {loading ? "신청 중..." : "계정 신청"}
          </button>
        </form>
      </div>
    </div>
  );
}