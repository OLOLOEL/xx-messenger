import { useState } from "react";
import { LockKeyhole, Mail, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return setErrorText(error.message);
    onLogin?.(data.session);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon"><MessageCircle size={28}/></div>
          <div><h1>XX Messenger</h1><p>사내 메신저</p></div>
        </div>

        <div className="login-heading">
          <h2>로그인</h2>
          <p>회사 계정으로 로그인해주세요.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>이메일</span>
            <div className="input-wrap">
              <Mail size={18}/>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required/>
            </div>
          </label>

          <label>
            <span>비밀번호</span>
            <div className="input-wrap">
              <LockKeyhole size={18}/>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required/>
            </div>
          </label>

          {errorText && <div className="login-message">{errorText}</div>}
          <button className="primary-button">로그인</button>
        </form>
      </div>
    </div>
  );
}
