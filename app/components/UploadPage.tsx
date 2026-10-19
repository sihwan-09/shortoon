"use client";

import { useEffect, useRef, useState } from "react";

type UploadItem = { id: string; file: File; url: string; width: number; height: number };
type UploadStep = 1 | 2 | 3;

const MAX_FILES = 10;
const MAX_SIZE = 3 * 1024 * 1024;
const MAX_HEIGHT = 30000;
const genres = ["로맨스", "판타지", "일상", "액션", "개그", "공포", "스릴러", "순정", "드라마", "시대극", "스포츠", "감성"];

export type PublishedShorttoon = { id?: string; title: string; coverUrl: string; imageUrls: string[]; genre: string; description?: string; allowComments?: boolean; createdAt?: string; likeCount?: number; commentCount?: number; viewCount?: number; likedByMe?: boolean; link?: { title: string; url: string }; authorName?: string; authorChannelId?: string | null; coverFile?: File | null; imageFiles?: File[]; isTest?: boolean; relayDays?: number; participantHours?: number; isRelay?: boolean; relayId?: string };

export function UploadPage({ onClose, step, onStepChange, onPublish, onAddLink, onEditLink, link, visible = true, relayMode = false, relayParticipantMode = false }: { onClose: () => void; step: UploadStep; onStepChange: (step: UploadStep) => void; onPublish: (post: PublishedShorttoon) => void; onAddLink: () => void; onEditLink: () => void; link?: { title: string; url: string } | null; visible?: boolean; relayMode?: boolean; relayParticipantMode?: boolean }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [previewScroll, setPreviewScroll] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [relayDays, setRelayDays] = useState(30);
  const [participantHours, setParticipantHours] = useState(8);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [allowComments, setAllowComments] = useState(true);
  const [rightsConfirmed, setRightsConfirmed] = useState([false, false, false]);
  const [publishCooldown, setPublishCooldown] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityClass = visible ? "" : " upload-page-hidden";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector<HTMLElement>(".upload-page")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const addFiles = (files: File[]) => {
    const nextErrors: string[] = [];
    const relayImageMode = relayMode || relayParticipantMode;
    const maxFiles = relayImageMode ? 1 : MAX_FILES;
    const maxSize = relayImageMode ? 2 * 1024 * 1024 : MAX_SIZE;
    const maxHeight = relayImageMode ? 2000 : MAX_HEIGHT;
    const maxImageHeight = relayImageMode ? 2000 : 6000;
    const candidates = files.slice(0, Math.max(0, maxFiles - items.length));
    if (files.length > candidates.length) nextErrors.push(`이미지는 최대 ${maxFiles}장까지 추가할 수 있습니다.`);
    Promise.all(candidates.map((file) => new Promise<UploadItem | null>((resolve) => {
      if (!file.type.match(/^image\/(jpeg|png)$/i)) { nextErrors.push(`${file.name}: JPG 또는 PNG 파일만 업로드할 수 있습니다.`); resolve(null); return; }
      if (file.size > maxSize) { nextErrors.push(`파일 용량이 ${relayImageMode ? "2MB" : "3MB"}를 초과했습니다. 현재 용량: ${(file.size / 1024 / 1024).toFixed(1)}MB`); resolve(null); return; }
      const image = new Image();
      image.onload = () => {
        if (image.width !== 690) { nextErrors.push(`가로 폭이 690px가 아닙니다. 현재 크기: ${image.width}×${image.height}px`); resolve(null); return; }
        if (image.height > maxImageHeight) { nextErrors.push(`세로 길이가 최대 ${maxImageHeight.toLocaleString()}px를 초과했습니다. 현재 크기: ${image.width}×${image.height}px`); resolve(null); return; }
        resolve({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, url: URL.createObjectURL(file), width: image.width, height: image.height });
      };
      image.onerror = () => { nextErrors.push(`${file.name}: 이미지를 읽을 수 없습니다.`); resolve(null); };
      image.src = URL.createObjectURL(file);
    }))).then((added) => {
      const valid = added.filter(Boolean) as UploadItem[];
      const totalHeight = items.reduce((sum, item) => sum + item.height, 0) + valid.reduce((sum, item) => sum + item.height, 0);
      if (totalHeight > maxHeight) nextErrors.push(`전체 높이가 최대 ${maxHeight.toLocaleString()}px를 초과합니다.`);
      else setItems((current) => [...current, ...valid]);
      setErrors(nextErrors);
    });
  };

  const remove = (id: string) => setItems((current) => { const item = current.find((entry) => entry.id === id); if (item) URL.revokeObjectURL(item.url); return current.filter((entry) => entry.id !== id); });
  const move = (from: number, to: number) => setItems((current) => { if (to < 0 || to >= current.length || from === to) return current; const copy = [...current]; const [picked] = copy.splice(from, 1); copy.splice(to, 0, picked); return copy; });
  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const totalHeight = items.reduce((sum, item) => sum + item.height, 0);
  const toggleGenre = (genre: string) => setSelectedGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : current.length >= 3 ? current : [...current, genre]);
  const canProceedFromInfo = relayMode ? title.trim().length > 0 : title.trim().length > 0 && selectedGenres.length > 0 && Boolean(coverUrl);
  const selectCoverFile = (file?: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png)$/i)) { setCoverError("JPG 또는 PNG 파일만 업로드할 수 있습니다."); return; }
    if (file.size > 2 * 1024 * 1024) { setCoverError(`파일 용량이 2MB를 초과했습니다. 현재 용량: ${(file.size / 1024 / 1024).toFixed(1)}MB`); return; }
    const image = new Image();
    image.onload = () => {
      if (image.width !== 690) { setCoverError(`가로 폭이 690px가 아닙니다. 현재 크기: ${image.width}×${image.height}px`); return; }
      if (image.height !== 980) { setCoverError(`세로 길이가 980px가 아닙니다. 현재 크기: ${image.width}×${image.height}px`); return; }
      setCoverUrl(URL.createObjectURL(file));
      setCoverFile(file);
      setCoverError(null);
    };
    image.onerror = () => setCoverError("이미지를 읽을 수 없습니다.");
    image.src = URL.createObjectURL(file);
  };

  const publish = () => {
    if (publishCooldown || (!relayMode && !coverUrl && !relayParticipantMode) || (!relayParticipantMode && !title.trim())) return;
    setPublishCooldown(true);
    window.setTimeout(() => setPublishCooldown(false), 3000);
    onPublish({ title: title.trim(), description, allowComments, link: link ?? undefined, coverUrl: coverUrl ?? items[0]?.url ?? "", coverFile, imageUrls: items.map((item) => item.url), imageFiles: items.map((item) => item.file), genre: selectedGenres.join(" · "), relayDays: relayMode ? relayDays : undefined, participantHours: relayMode ? participantHours : undefined });
  };

  const progress = relayParticipantMode ? <div className="upload-progress"><span className="progress-label is-active">이미지</span><i className={`progress-line ${step >= 3 ? "is-active" : ""}`} /><span className={`progress-label ${step >= 3 ? "is-active" : ""}`}>게시</span></div> : <div className="upload-progress"><span className="progress-label is-active">이미지</span><i className={`progress-line ${step >= 2 ? "is-active" : ""}`} /><span className={`progress-label ${step >= 2 ? "is-active" : ""}`}>정보</span><i className={`progress-line ${step >= 3 ? "is-active" : ""}`} /><span className={`progress-label ${step >= 3 ? "is-active" : ""}`}>게시</span></div>;

  if (step === 3) return <section className={`upload-page upload-publish-page${visibilityClass}`} aria-label={relayParticipantMode ? "릴레이툰 참여 게시" : "숏툰 게시"}>
    {progress}
    {!relayParticipantMode && <div className="upload-section publish-settings-section"><h2>게시 설정</h2><label className="publish-toggle-row"><span>댓글 허용</span><input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} /><span className="toggle-visual" aria-hidden="true" /></label></div>}
    <div className="upload-section rights-section"><h2>저작권 및 권리 확인</h2>{["이 콘텐츠를 업로드하고 공개할 권리가 있습니다.", "타인의 저작물을 무단으로 사용하지 않았습니다.", "타 플랫폼 연재 작품인 경우 외부 홍보 권한을 확인했습니다."].map((right, index) => <label className="right-check-row" key={right}><input type="checkbox" checked={rightsConfirmed[index]} onChange={(event) => setRightsConfirmed((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span>{right}</span></label>)}</div>
    <button className="next-upload-button publish-button" type="button" disabled={publishCooldown || !rightsConfirmed.every(Boolean) || (!relayMode && !coverUrl && !relayParticipantMode) || (!relayParticipantMode && !title.trim())} onClick={publish}>{publishCooldown ? "게시 준비 중..." : "게시하기"}</button>
  </section>;

  if (step === 2) return <section className={`upload-page upload-info-page${visibilityClass}`} aria-label="숏툰 정보 입력">
    {progress}
    <div className="upload-section info-fields-section"><label className="upload-field-label" htmlFor="shorttoon-title">{relayMode ? "주제" : "제목"}</label><input id="shorttoon-title" className="upload-text-input" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /><span className="character-count">{title.length}/100</span>{relayMode ? <><div className="relay-duration-field"><div className="relay-duration-heading"><label className="upload-field-label" htmlFor="relay-duration">활동 기간</label><strong>{relayDays}일</strong></div><input id="relay-duration" className="relay-duration-slider" type="range" min="10" max="100" step="5" value={relayDays} onChange={(event) => setRelayDays(Number(event.target.value))} /><div className="relay-duration-scale"><span>10일</span><span>100일</span></div></div><div className="relay-duration-field"><div className="relay-duration-heading"><label className="upload-field-label" htmlFor="participant-hours">참여자 활동 제한 기간</label><strong>{participantHours}시간</strong></div><input id="participant-hours" className="relay-duration-slider" type="range" min="1" max="24" step="1" value={participantHours} onChange={(event) => setParticipantHours(Number(event.target.value))} /><div className="relay-duration-scale"><span>1시간</span><span>24시간</span></div></div></> : <><label className="upload-field-label description-label" htmlFor="shorttoon-description">설명 추가</label><textarea id="shorttoon-description" className="upload-textarea" maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /><span className="character-count">{description.length}/500</span></>}</div>
    {!relayMode && <><div className="upload-section upload-channel-link-section"><div className="edit-links"><button type="button" onClick={link ? onEditLink : onAddLink}>{link ? "링크 수정" : "링크 추가"} <span aria-hidden="true">＋</span></button>{link && <button className="existing-link" type="button" onClick={onEditLink}><strong>{link.title}</strong><span>{link.url}</span></button>}</div></div><div className="upload-section genre-section"><h2>장르</h2><div className="genre-grid">{genres.map((genre) => <label className={`genre-option ${selectedGenres.includes(genre) ? "is-selected" : ""}`} key={genre}><input type="checkbox" checked={selectedGenres.includes(genre)} onChange={() => toggleGenre(genre)} /><span>{genre}</span></label>)}</div><span className="character-count genre-count">{selectedGenres.length}/3</span></div><div className="upload-section cover-section"><h2>대표 이미지</h2><div className="upload-preview-shell cover-upload-shell"><div className="upload-preview-viewport"><label className="upload-dropzone cover-dropzone"><input type="file" accept="image/jpeg,image/png" onChange={(event) => { selectCoverFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />{coverUrl ? <div className="upload-preview-stack"><img className="cover-image" src={coverUrl} alt="대표 이미지 미리보기" /></div> : <><span className="upload-plus">＋</span><strong>이미지 선택</strong><small>JPG 또는 PNG<br />가로 690px · 세로 980px<br />파일당 최대 2MB</small></>}</label></div><span className="cover-scroll-spacer" aria-hidden="true" /></div>{coverError && <div className="upload-errors cover-errors" role="alert"><p>{coverError}</p></div>}<p className="cover-fallback-note">대표 이미지를 선택하지 않으면 '업로드한 이미지'의 '1번 이미지' 상단 부분이 대표 이미지로 적용됩니다.</p><label className="cover-change-button"><input type="file" accept="image/jpeg,image/png" onChange={(event) => { selectCoverFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />대표 이미지 변경</label></div></>}
    <button className="next-upload-button" type="button" disabled={!canProceedFromInfo} onClick={() => onStepChange(3)}>다음</button>
  </section>;

  return <section className={`upload-page${visibilityClass}${relayMode || relayParticipantMode ? " relay-upload-step" : ""}`} aria-label={relayMode || relayParticipantMode ? "릴레이툰 업로드 이미지 단계" : "숏툰 업로드 이미지 단계"}>
    {progress}
    <div className="upload-section"><h2>이미지 추가</h2><div className={`upload-preview-shell ${items.length > 0 ? "has-previews" : ""}`}><div ref={previewRef} className="upload-preview-viewport" onScroll={(event) => { const target = event.currentTarget; const max = target.scrollHeight - target.clientHeight; setPreviewScroll(max > 0 ? (target.scrollTop / max) * 100 : 0); }}><label className="upload-dropzone"><input type="file" accept="image/jpeg,image/png" multiple={!(relayMode || relayParticipantMode)} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />{items.length > 0 ? <div className="upload-preview-stack">{items.map((item, index) => <img key={item.id} src={item.url} alt={`${index + 1}번 이미지`} />)}</div> : <><span className="upload-plus">＋</span><strong>이미지 선택</strong><small>JPG 또는 PNG<br />가로 690px · 세로 최대 {relayMode || relayParticipantMode ? "2,000" : "6,000"}px<br />파일당 최대 {relayMode || relayParticipantMode ? "2" : "3"}MB</small></>}</label></div>{items.length > 0 && <div className="preview-scroll-rail"><span className="scroll-arrow scroll-arrow-up" aria-hidden="true" /><input className="preview-scroll-control" type="range" min="0" max="100" step="0.1" value={previewScroll} aria-label="업로드 이미지 세로 위치" onChange={(event) => { const value = Number(event.target.value); setPreviewScroll(value); const target = previewRef.current; if (target) target.scrollTop = (target.scrollHeight - target.clientHeight) * (value / 100); }} /><span className="scroll-arrow scroll-arrow-down" aria-hidden="true" /></div>}</div><p className="upload-limits">최대 {relayMode || relayParticipantMode ? "1" : "10"}장<br />전체 높이 최대 {relayMode || relayParticipantMode ? "2,000" : "30,000"}px</p></div>
    {errors.length > 0 && <div className="upload-errors" role="alert">{errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div>}
    {!relayMode && <div className="upload-section uploaded-section"><h2>업로드한 이미지</h2>{items.length === 0 ? <p className="upload-empty">선택한 이미지가 여기에 표시됩니다.</p> : <div className="upload-list">{items.map((item, index) => <div className="upload-item" key={item.id}><img src={item.url} alt={`${index + 1}번 이미지 미리보기`} /><div className="upload-item-info"><strong>{index + 1}번 이미지</strong><span>{item.width}×{item.height}</span><small>{(item.file.size / 1024 / 1024).toFixed(1)}MB</small></div><button className={`drag-handle ${dragging === index ? "is-dragging" : ""}`} type="button" aria-label={`${index + 1}번 이미지 순서 변경`} onPointerDown={() => { pressTimer.current = setTimeout(() => setDragging(index), 350); }} onPointerUp={() => { if (pressTimer.current) clearTimeout(pressTimer.current); setDragging(null); }} onPointerLeave={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }} onPointerEnter={() => { if (dragging !== null) move(dragging, index); }}><span>≡</span></button><button className="remove-upload" type="button" onClick={() => remove(item.id)} aria-label={`${index + 1}번 이미지 삭제`}>×</button></div>)}</div>}<label className="add-more-button"><input type="file" accept="image/jpeg,image/png" multiple onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />＋ 이미지 더 추가</label></div>}
    <div className="upload-summary"><span>전체 {items.length}장 · {(totalSize / 1024 / 1024).toFixed(1)}MB</span><span>전체 높이 {totalHeight.toLocaleString()}px</span></div>
    <button className="next-upload-button" type="button" disabled={items.length === 0} onClick={() => onStepChange(relayParticipantMode ? 3 : 2)}>다음</button>
  </section>;
}
