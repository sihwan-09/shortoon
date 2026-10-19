"use client";

export function RelayParticipationNoticeModal({ remainingText, availableAt, onClose }: { remainingText: string; availableAt: Date; onClose: () => void }) {
  return (
    <div className="relay-notice-backdrop" role="presentation" onClick={onClose}>
      <section className="relay-notice-modal" role="dialog" aria-modal="true" aria-labelledby="relay-notice-title" onClick={(event) => event.stopPropagation()}>
        <button className="relay-notice-close" type="button" onClick={onClose} aria-label="안내 닫기">×</button>
        <span className="relay-notice-icon" aria-hidden="true">!</span>
        <h2 id="relay-notice-title">잠시 후 다시 참여할 수 있어요</h2>
        <p>이 릴레이툰은 참여자 활동 제한 기간이 적용되어 있습니다.</p>
        <div className="relay-notice-time">
          <strong>{remainingText} 후 업로드 가능</strong>
          <span>{availableAt.toLocaleString("ko-KR")}부터 참여할 수 있습니다.</span>
        </div>
        <button className="relay-notice-confirm" type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  );
}
