"use client";

import { useState } from "react";

type LinkEditPageProps = { onBack: () => void; onSave: (link: { title: string; url: string }) => void };

export function LinkEditPage({ onBack, onSave }: LinkEditPageProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  return (
    <section className="link-edit-page" aria-label="Add link">
      <div className="link-edit-form">
        <label>링크 제목<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 인스타그램" maxLength={30} /></label>
        <label>URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" type="url" /></label>
      </div>
      <button className="save-channel-button" type="button" disabled={!title.trim() || !url.trim()} onClick={() => onSave({ title: title.trim(), url: url.trim() })}>변경사항 저장</button>
      <button className="link-cancel-button" type="button" onClick={onBack}>취소</button>
    </section>
  );
}
