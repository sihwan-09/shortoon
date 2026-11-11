"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const AUTH_RETURN_TAB_KEY = "shorttoon-auth-return-tab";

function callbackErrorMessage(error: string | null, description: string | null): string {
  if (/access_denied|cancel|denied|declined|취소/i.test(`${error ?? ""} ${description ?? ""}`)) {
    return "로그인이 취소되었습니다. 다시 시도해 주세요.";
  }
  if (/identity_already_exists|already registered|already exists/i.test(`${error ?? ""} ${description ?? ""}`)) {
    return "이미 다른 로그인 방식으로 사용 중인 계정입니다. 기존 로그인 방식으로 이용해 주세요.";
  }
  return description || "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("로그인 처리 중...");

  useEffect(() => {
    let cancelled = false;

    const completeOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const error = params.get("error") ?? hashParams.get("error");
        const description = params.get("error_description") ?? hashParams.get("error_description");

        if (error || description) {
          window.sessionStorage.removeItem(AUTH_RETURN_TAB_KEY);
          if (!cancelled) setMessage(callbackErrorMessage(error, description));
          return;
        }

        const code = params.get("code");
        const initialization = await supabase.auth.initialize();
        let { data, error: sessionError } = await supabase.auth.getSession();

        // PKCE callbacks are normally exchanged during Supabase client
        // initialization. Keep an explicit fallback for a callback that arrives
        // before the verifier is picked up by the initialized client.
        if ((initialization.error || sessionError || !data.session) && code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("OAuth 콜백 처리 실패", exchangeError);
            window.sessionStorage.removeItem(AUTH_RETURN_TAB_KEY);
            if (!cancelled) setMessage("로그인에 실패했습니다. 다시 시도해 주세요.");
            return;
          }
          ({ data, error: sessionError } = await supabase.auth.getSession());
        }
        if (sessionError || !data.session) {
          window.sessionStorage.removeItem(AUTH_RETURN_TAB_KEY);
          if (!cancelled) setMessage("로그인 세션을 확인하지 못했습니다. 다시 시도해 주세요.");
          return;
        }

        window.location.replace("/");
      } catch (error) {
        console.error("OAuth 콜백 처리 실패", error);
        window.sessionStorage.removeItem(AUTH_RETURN_TAB_KEY);
        if (!cancelled) setMessage("로그인에 실패했습니다. 다시 시도해 주세요.");
      }
    };

    void completeOAuth();
    return () => { cancelled = true; };
  }, []);

  return <main className="auth-callback-page" aria-live="polite"><strong>{message}</strong>{message !== "로그인 처리 중..." && <Link href="/">로그인 화면으로 돌아가기</Link>}</main>;
}
