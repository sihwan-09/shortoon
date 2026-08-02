"use client";

export function LoginPromptModal({ onLogin, onClose }: { onLogin: () => void; onClose: () => void }) {
  return <div className="login-prompt-backdrop" role="presentation" onClick={onClose}>
    <section className="login-prompt-modal" role="dialog" aria-modal="true" aria-label="로그인 안내" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="login-prompt-close" onClick={onClose} aria-label="닫기">×</button>
      <h2>로그인이 필요해요</h2>
      <p>이 기능을 이용하려면 로그인해 주세요.</p>
      <button type="button" className="login-prompt-login" onClick={onLogin}>로그인</button>
    </section>
  </div>;
}
