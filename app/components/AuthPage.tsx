"use client";

import { useState } from "react";

type SignupResult = { message: string | null; success: boolean };
type AuthPageProps = { mode: "login" | "signup"; onBack: () => void; onChangeMode: (mode: "login" | "signup") => void; onEmailLogin: (email: string, password: string) => Promise<string | null>; onEmailSignup: (email: string, password: string) => Promise<SignupResult>; onOAuth: (provider: "google" | "kakao") => Promise<string | null>; onOpenTerms: () => void; onOpenPrivacy: () => void };

type TermKey = "age" | "service" | "privacy";

const TERM_DETAILS: Record<TermKey, string> = {
  age: "하이라이툰 회원가입은 만 14세 이상만 가능합니다. 만 14세 미만으로 확인되면 계정과 관련 정보를 삭제하거나 이용을 제한할 수 있습니다.",
  service: "하이라이툰은 웹툰 작품을 감상하고 게시물, 댓글, 좋아요, 팔로우 등의 기능을 이용하는 서비스입니다. 회원은 정확한 정보를 제공하고 계정을 안전하게 관리해야 하며, 타인의 권리 침해나 불법·혐오·괴롭힘·스팸 등 금지행위를 해서는 안 됩니다.",
  privacy: "회원가입 시 이메일 주소, 인증 계정 식별자, 비밀번호 인증 정보(비밀번호 원문은 저장하지 않음), 가입 시각을 수집합니다. 계정 인증과 서비스 제공, 부정 이용 방지, 신고·문의 처리 및 법령 준수를 위해 이용하며, 회원 탈퇴 후에도 법령상 보존이나 분쟁 처리에 필요한 정보는 해당 기간 동안 보관할 수 있습니다.",
};

const TERM_LABELS: Record<TermKey, string> = {
  age: "[필수] 만 14세 이상입니다.",
  service: "[필수] 이용약관에 동의합니다.",
  privacy: "[필수] 개인정보 수집 및 이용에 동의합니다.",
};

export function AuthPage({ mode, onBack, onChangeMode, onEmailLogin, onEmailSignup, onOAuth, onOpenTerms, onOpenPrivacy }: AuthPageProps) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [terms, setTerms] = useState({ age: false, service: false, privacy: false });
  const [expandedTerm, setExpandedTerm] = useState<TermKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requiredTermsAccepted = terms.age && terms.service && terms.privacy;
  const validSignupEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validSignupPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*\-_+])[A-Za-z\d!@#$%^&*\-_+]{8,}$/.test(password);
  const canSubmit = isSignup
    ? validSignupEmail && validSignupPassword && password === confirmPassword && requiredTermsAccepted
    : email.trim().length > 0 && password.length > 0;
  const allTermsChecked = requiredTermsAccepted;
  const setAllTerms = (checked: boolean) => setTerms({ age: checked, service: checked, privacy: checked });
  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (isSignup) {
        const result = await onEmailSignup(email.trim(), password);
        if (result.success) onChangeMode("login");
        setMessage(result.message);
      } else {
        const result = await onEmailLogin(email.trim(), password);
        if (result) setMessage(result);
      }
    } catch { setMessage("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  const socialLogin = async (provider: "google" | "kakao") => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await onOAuth(provider);
      if (result) { setMessage(result); setBusy(false); }
    } catch { setMessage("소셜 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."); setBusy(false); }
  };

  return <section className="auth-page" aria-label={isSignup ? "회원가입" : "로그인"}>
    <header className="auth-header">
      <strong className="auth-header-title">{isSignup ? "회원가입" : "로그인"}</strong>
      <button type="button" className="auth-back" onClick={onBack} aria-label="뒤로 가기">←</button>
      {isSignup && <strong>회원가입</strong>}
    </header>
    <div className="auth-scroll">
      <div className="auth-brand"><span className="brand-logo" role="img" aria-label="하이라이툰" /></div>
      <p className="auth-lead">{isSignup ? "새로운 웹툰과 작가를 만나러 가볼까요?" : "다시 만나 반가워요"}</p>
      <p className="auth-sublead">{isSignup ? "" : "하이라이툰에서 새로운 작품을 발견해보세요"}</p>
      <div className="auth-socials">
        <button type="button" className="auth-social google" disabled={busy} onClick={() => void socialLogin("google")}><b>G</b>{isSignup ? "Google로 가입" : "Google로 로그인"}</button>
        <button type="button" className="auth-social kakao" disabled={busy} onClick={() => void socialLogin("kakao")}><b className="kakao-mark">●</b>{isSignup ? "카카오로 가입" : "카카오로 로그인"}</button>
      </div>
      <div className="auth-divider"><span>또는</span></div>
      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (canSubmit && !busy) void submit(); }}>
        <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" autoComplete="email" /></label>
        <label>비밀번호<div className="auth-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={13} placeholder={isSignup ? "영문 대소문자 + 숫자 + !, @, #, $, %, ^, &, *, -, _, + 로 8자 이상 입력" : "비밀번호 입력"} autoComplete={isSignup ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="비밀번호 표시">{showPassword ? "◉" : "◌"}</button></div></label>
        {isSignup && <label>비밀번호 확인<div className="auth-password"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} maxLength={13} placeholder="8자 이상 입력" autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label="비밀번호 확인 표시">{showConfirmPassword ? "◉" : "◌"}</button></div></label>}
        {isSignup && <div className="auth-terms">
          <label className="auth-term all"><input type="checkbox" checked={allTermsChecked} onChange={(event) => setAllTerms(event.target.checked)} />전체 동의</label>
          {(["age", "service", "privacy"] as const).map((termKey) => {
            const detailId = `auth-term-detail-${termKey}`;
            const checkboxId = `auth-term-checkbox-${termKey}`;
            const isExpanded = expandedTerm === termKey;
            return <div className="auth-term-group" key={termKey}>
              <div className="auth-term"><input id={checkboxId} type="checkbox" checked={terms[termKey]} onChange={(event) => setTerms((current) => ({ ...current, [termKey]: event.target.checked }))} /><label htmlFor={checkboxId}>{TERM_LABELS[termKey]}</label><button type="button" aria-expanded={isExpanded} aria-controls={detailId} aria-label={`${TERM_LABELS[termKey]} 상세`} onClick={() => setExpandedTerm((current) => current === termKey ? null : termKey)}>{isExpanded ? "⌄" : "›"}</button></div>
              {isExpanded && <div className="auth-term-detail" id={detailId}>
                <p>{TERM_DETAILS[termKey]}</p>
                {termKey === "service" && <button type="button" className="auth-term-detail-link" onClick={onOpenTerms}>이용약관 전문 보기</button>}
                {termKey === "privacy" && <button type="button" className="auth-term-detail-link" onClick={onOpenPrivacy}>개인정보 처리방침 전문 보기</button>}
              </div>}
            </div>;
          })}
        </div>}
        {message && <p className="auth-message" role="alert">{message}</p>}
        <button type="submit" className="auth-submit" disabled={!canSubmit || busy}>{busy ? "처리 중..." : isSignup ? "가입하기" : "로그인"}</button>
      </form>
      <p className="auth-switch">{isSignup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"} <button type="button" onClick={() => onChangeMode(isSignup ? "login" : "signup")}>{isSignup ? "로그인" : "회원가입"}</button></p>
    </div>
  </section>;
}
