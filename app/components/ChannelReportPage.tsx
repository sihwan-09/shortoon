"use client";

import { useState } from "react";

const CHANNEL_REPORT_CATEGORIES = [
  ["sexual", "성적인 콘텐츠"],
  ["violent", "폭력적 또는 혐오스러운 콘텐츠"],
  ["hate", "증오 또는 악의적인 콘텐츠"],
  ["harassment", "괴롭힘 또는 폭력"],
  ["misinformation", "잘못된 정보"],
  ["spam", "스팸 또는 혼동을 야기하는 콘텐츠"],
  ["impersonation", "명의 도용"],
  ["privacy", "개인 정보 보호 문제"],
] as const;

type ChannelReportPageProps = { onClose: () => void };

export function ChannelReportPage({ onClose }: ChannelReportPageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return <div className="report-page" role="dialog" aria-modal="true" aria-labelledby="channel-report-page-title">
    <header className="report-page-header"><strong id="channel-report-page-title">신고</strong><button type="button" onClick={onClose} aria-label="닫기">×</button></header>
    <div className="report-page-body">
      <h2>어떤 문제인가요?</h2>
      <div className="report-category-list">
        {CHANNEL_REPORT_CATEGORIES.map(([id, label]) => <button type="button" key={id} className={selected === id ? "selected" : ""} onClick={() => setSelected(id)}><span className="report-radio" aria-hidden="true" />{label}</button>)}
      </div>
      <button type="button" className="report-submit" disabled={!selected} onClick={onClose}>신고하기</button>
    </div>
  </div>;
}
