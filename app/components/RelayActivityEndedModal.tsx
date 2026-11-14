"use client";

export function RelayActivityEndedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="relay-notice-backdrop" role="presentation" onClick={onClose}>
      <section className="relay-notice-modal" role="dialog" aria-modal="true" aria-labelledby="relay-activity-ended-title" onClick={(event) => event.stopPropagation()}>
        <button className="relay-notice-close" type="button" onClick={onClose} aria-label="안내 닫기">×</button>
        <span className="relay-notice-icon" aria-hidden="true">!</span>
        <h2 id="relay-activity-ended-title">활동 기간이 종료되었습니다</h2>
        <p>게시자가 설정한 활동 기간이 지나 이 릴레이툰에는 추가 게시물을 등록할 수 없습니다.</p>
        <button className="relay-notice-confirm" type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  );
}
