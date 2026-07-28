"use client";

import { useState } from "react";

type AuthPageProps = { mode: "login" | "signup"; onBack: () => void; onChangeMode: (mode: "login" | "signup") => void };

export function AuthPage({ mode, onBack, onChangeMode }: AuthPageProps) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [terms, setTerms] = useState({ age: false, service: false, privacy: false, marketing: false });

  const requiredTermsAccepted = terms.age && terms.service && terms.privacy;
  const canSubmit = isSignup
    ? email.trim().length > 0 && password.length >= 8 && password === confirmPassword && requiredTermsAccepted
    : email.trim().length > 0 && password.length > 0;
  const allTermsChecked = requiredTermsAccepted && terms.marketing;
  const setAllTerms = (checked: boolean) => setTerms({ age: checked, service: checked, privacy: checked, marketing: checked });

  return <section className="auth-page" aria-label={isSignup ? "회원가입" : "로그인"}>
    <header className="auth-header">
      <button type="button" className="auth-back" onClick={onBack} aria-label="뒤로 가기">←</button>
      {isSignup && <strong>회원가입</strong>}
    </header>
    <div className="auth-scroll">
      <div className="auth-brand"><span className="brand-logo" role="img" aria-label="숏툰" /></div>
      <p className="auth-lead">{isSignup ? "새로운 웹툰과 작가를 만나러 가볼까요?" : "다시 만나 반가워요"}</p>
      <p className="auth-sublead">{isSignup ? "" : "숏툰에서 새로운 작품을 발견해보세요"}</p>
      <div className="auth-socials">
        <button type="button" className="auth-social google"><b>G</b>{isSignup ? "Google로 가입" : "Google로 로그인"}</button>
        <button type="button" className="auth-social kakao"><b className="kakao-mark">●</b>{isSignup ? "카카오로 가입" : "카카오로 로그인"}</button>
      </div>
      <div className="auth-divider"><span>또는</span></div>
      <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
        <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" autoComplete="email" /></label>
        <label>비밀번호<div className="auth-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "8자 이상 입력" : "비밀번호 입력"} autoComplete={isSignup ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="비밀번호 표시">{showPassword ? "◉" : "◌"}</button></div></label>
        {isSignup && <label>비밀번호 확인<div className="auth-password"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="비밀번호 다시 입력" autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label="비밀번호 확인 표시">{showConfirmPassword ? "◉" : "◌"}</button></div></label>}
        {!isSignup && <button type="button" className="auth-forgot">비밀번호 찾기</button>}
        {isSignup && <div className="auth-terms">
          <label className="auth-term all"><input type="checkbox" checked={allTermsChecked} onChange={(event) => setAllTerms(event.target.checked)} />전체 동의</label>
          <label className="auth-term"><input type="checkbox" checked={terms.age} onChange={(event) => setTerms((current) => ({ ...current, age: event.target.checked }))} /><span>[필수] 만 14세 이상입니다.</span><button type="button" aria-label="만 14세 이상 약관 상세">›</button></label>
          <label className="auth-term"><input type="checkbox" checked={terms.service} onChange={(event) => setTerms((current) => ({ ...current, service: event.target.checked }))} /><span>[필수] 이용약관에 동의합니다.</span><button type="button" aria-label="이용약관 상세">›</button></label>
          <label className="auth-term"><input type="checkbox" checked={terms.privacy} onChange={(event) => setTerms((current) => ({ ...current, privacy: event.target.checked }))} /><span>[필수] 개인정보 수집 및 이용에 동의합니다.</span><button type="button" aria-label="개인정보 수집 약관 상세">›</button></label>
          <label className="auth-term"><input type="checkbox" checked={terms.marketing} onChange={(event) => setTerms((current) => ({ ...current, marketing: event.target.checked }))} /><span>[선택] 새로운 작품과 서비스 소식을 받습니다.</span><button type="button" aria-label="마케팅 수신 약관 상세">›</button></label>
        </div>}
        <button type="submit" className="auth-submit" disabled={!canSubmit}>{isSignup ? "가입하기" : "로그인"}</button>
      </form>
      <p className="auth-switch">{isSignup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"} <button type="button" onClick={() => onChangeMode(isSignup ? "login" : "signup")}>{isSignup ? "로그인" : "회원가입"}</button></p>
    </div>
  </section>;
}
