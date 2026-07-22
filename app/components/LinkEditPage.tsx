"use client";

import { useState } from "react";

type ChannelLink = { title: string; url: string };
type LinkEditPageProps = { onBack: () => void; onSave: (link: ChannelLink) => void; onDelete: () => void; initialLink: ChannelLink | null; titleLabel?: string; titlePlaceholder?: string };

export function LinkEditPage({ onBack, onSave, onDelete, initialLink, titleLabel = "링크 제목", titlePlaceholder = "예: 인스타그램" }: LinkEditPageProps) {
  const [title, setTitle] = useState(initialLink?.title ?? "");
  const [url, setUrl] = useState(initialLink?.url ?? "");
  const isEditing = Boolean(initialLink);
  const isUnchanged = isEditing && title === initialLink?.title && url === initialLink?.url;

  return (
    <section className="link-edit-page" aria-label="Add link">
      <div className="link-edit-form">
        <label>{titleLabel}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={titlePlaceholder} maxLength={30} /></label>
        <label>URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" type="url" /></label>
      </div>
      <button className="save-channel-button" type="button" disabled={!title.trim() || !url.trim() || isUnchanged} onClick={() => onSave({ title: title.trim(), url: url.trim() })}>변경사항 저장</button>
      {isEditing && <button className="delete-link-button" type="button" onClick={onDelete}>링크 삭제</button>}
    </section>
  );
}
