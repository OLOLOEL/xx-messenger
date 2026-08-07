import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import MessengerLayout from "./layouts/MessengerLayout";
import { recordLogin } from "./services/adminService";
import "./styles/global.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const loggedSessionRef = useRef(null);

  const loadProfile = async (id) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setProfile(data);
  };

  const logSessionOnce = async (nextSession) => {
    const key = nextSession?.access_token;
    if (!nextSession?.user?.id || !key) return;
    if (loggedSessionRef.current === key) return;

    loggedSessionRef.current = key;
    await recordLogin(nextSession.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const nextSession = data.session ?? null;
      setSession(nextSession);

      if (nextSession?.user?.id) {
        await loadProfile(nextSession.user.id);
        await logSessionOnce(nextSession);
      }

      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);

        if (nextSession?.user?.id) {
          await loadProfile(nextSession.user.id);
          await logSessionOnce(nextSession);
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
    return <LoginPage onLogin={setSession} />;
  }

  return (
    <MessengerLayout
      profile={profile}
      session={session}
      onLogout={() => supabase.auth.signOut()}
    />
  );
}
