import { useState } from "react";
import {
  LockKeyhole,
  Mail,
  MessageCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function LoginPage({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrorText("");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoading(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    onLogin?.(data.session);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <MessageCircle size={31} />
          <div>
            <strong>XX</strong>
            <span>Messenger</span>
          </div>
        </div>

        <div className="login-heading">
          <h2>로그인</h2>
          <p>회사 계정으로 로그인해주세요.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>이메일</span>

            <div className="input-wrap">
              <Mail size={18} />
              <input
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
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
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                type="password"
                required
              />
            </div>
          </label>

          {errorText && (
            <div className="login-message">
              {errorText}
            </div>
          )}

          <button
            className="primary-button"
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="signup-link-area">
          <span>계정이 없으신가요?</span>

          <button type="button" onClick={onSignup}>
            계정 신청
          </button>
        </div>
      </div>
    </div>
  );
}