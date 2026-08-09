import {
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PendingPage from "./pages/PendingPage";
import MessengerLayout from "./layouts/MessengerLayout";
import { recordLogin } from "./services/adminService";
import "./styles/global.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);

  const [authPage, setAuthPage] = useState("login");

  const loggedSessionRef = useRef(null);

  const loadProfile = async (id) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(error);
    }

    setProfile(data ?? null);

    return data ?? null;
  };

  const logSessionOnce = async (nextSession, nextProfile) => {
    const key = nextSession?.access_token;

    if (!nextSession?.user?.id || !key) return;
    if (loggedSessionRef.current === key) return;

    // 승인된 직원만 실제 로그인 기록으로 취급
    if (nextProfile?.account_status !== "approved") return;

    loggedSessionRef.current = key;

    await recordLogin(nextSession.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const nextSession = data.session ?? null;

      setSession(nextSession);

      if (nextSession?.user?.id) {
        const nextProfile =
          await loadProfile(nextSession.user.id);

        await logSessionOnce(
          nextSession,
          nextProfile
        );
      }

      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);

        if (nextSession?.user?.id) {
          const nextProfile =
            await loadProfile(nextSession.user.id);

          await logSessionOnce(
            nextSession,
            nextProfile
          );
        } else {
          setProfile(null);
          loggedSessionRef.current = null;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="app-loading">
        XX Messenger 불러오는 중...
      </div>
    );
  }

  if (!session) {
    if (authPage === "signup") {
      return (
        <SignupPage
          onBack={() => setAuthPage("login")}
        />
      );
    }

    return (
      <LoginPage
        onSignup={() => setAuthPage("signup")}
      />
    );
  }

  if (!profile) {
    return (
      <div className="app-loading">
        계정 정보를 불러오는 중...
      </div>
    );
  }

  if (profile.account_status !== "approved") {
    return (
      <PendingPage
        status={profile.account_status}
        onLogout={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <MessengerLayout
      profile={profile}
      session={session}
      onLogout={() => supabase.auth.signOut()}
    />
  );
}