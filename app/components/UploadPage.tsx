"use client";

import { useRef, useState } from "react";

type UploadItem = { id: string; file: File; url: string; width: number; height: number };

const MAX_FILES = 10;
const MAX_SIZE = 3 * 1024 * 1024;
const MAX_HEIGHT = 30000;

export function UploadPage({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [previewScroll, setPreviewScroll] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addFiles = (files: File[]) => {
    const nextErrors: string[] = [];
    const candidates = files.slice(0, Math.max(0, MAX_FILES - items.length));
    if (files.length > candidates.length) nextErrors.push("이미지는 최대 10장까지 추가할 수 있습니다.");
    Promise.all(candidates.map((file) => new Promise<UploadItem | null>((resolve) => {
      if (!file.type.match(/^image\/(jpeg|png)$/i)) { nextErrors.push(`${file.name}: JPG 또는 PNG 파일만 업로드할 수 있습니다.`); resolve(null); return; }
      if (file.size > MAX_SIZE) { nextErrors.push(`파일 용량이 3MB를 초과했습니다. 현재 용량: ${(file.size / 1024 / 1024).toFixed(1)}MB`); resolve(null); return; }
      const image = new Image();
      image.onload = () => {
        if (image.width !== 690) { nextErrors.push(`가로 폭이 690px가 아닙니다. 현재 크기: ${image.width}×${image.height}px`); resolve(null); return; }
        if (image.height > 6000) { nextErrors.push(`세로 길이는 최대 6,000px입니다. 현재 크기: ${image.width}×${image.height}px`); resolve(null); return; }
        resolve({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, url: URL.createObjectURL(file), width: image.width, height: image.height });
      };
      image.onerror = () => { nextErrors.push(`${file.name}: 이미지를 읽을 수 없습니다.`); resolve(null); };
      image.src = URL.createObjectURL(file);
    }))).then((added) => {
      const valid = added.filter(Boolean) as UploadItem[];
      const totalHeight = items.reduce((sum, item) => sum + item.height, 0) + valid.reduce((sum, item) => sum + item.height, 0);
      if (totalHeight > MAX_HEIGHT) nextErrors.push("전체 높이 최대 30,000px를 초과합니다.");
      else setItems((current) => [...current, ...valid]);
      setErrors(nextErrors);
    });
  };

  const remove = (id: string) => setItems((current) => { const item = current.find((entry) => entry.id === id); if (item) URL.revokeObjectURL(item.url); return current.filter((entry) => entry.id !== id); });
  const move = (from: number, to: number) => setItems((current) => { if (to < 0 || to >= current.length || from === to) return current; const copy = [...current]; const [picked] = copy.splice(from, 1); copy.splice(to, 0, picked); return copy; });
  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const totalHeight = items.reduce((sum, item) => sum + item.height, 0);

  return <section className="upload-page" aria-label="숏툰 업로드">
    <div className="upload-progress"><span className="progress-label is-active">이미지</span><i className="progress-line is-active" /><span className="progress-label">게시</span></div>
    <div className="upload-section"><h2>이미지 추가</h2><div className={`upload-preview-shell ${items.length > 0 ? "has-previews" : ""}`}><div ref={previewRef} className="upload-preview-viewport" onScroll={(event) => { const target = event.currentTarget; const max = target.scrollHeight - target.clientHeight; setPreviewScroll(max > 0 ? (target.scrollTop / max) * 100 : 0); }}><label className="upload-dropzone"><input type="file" accept="image/jpeg,image/png" multiple onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />{items.length > 0 ? <div className="upload-preview-stack">{items.map((item, index) => <img key={item.id} src={item.url} alt={`${index + 1}번 이미지`} />)}</div> : <><span className="upload-plus">＋</span><strong>이미지 선택</strong><small>JPG 또는 PNG<br />가로 690px · 세로 최대 6,000px<br />파일당 최대 3MB</small></>}</label></div>{items.length > 0 && <input className="preview-scroll-control" type="range" min="0" max="100" step="0.1" value={previewScroll} aria-label="업로드 이미지 세로 위치" onChange={(event) => { const value = Number(event.target.value); setPreviewScroll(value); const target = previewRef.current; if (target) target.scrollTop = (target.scrollHeight - target.clientHeight) * (value / 100); }} />}</div><p className="upload-limits">최대 10장<br />전체 높이 최대 30,000px</p></div>
    {errors.length > 0 && <div className="upload-errors" role="alert">{errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div>}
    <div className="upload-section uploaded-section"><h2>업로드한 이미지</h2>{items.length === 0 ? <p className="upload-empty">선택한 이미지가 여기에 표시됩니다.</p> : <div className="upload-list">{items.map((item, index) => <div className="upload-item" key={item.id}><img src={item.url} alt={`${index + 1}번 이미지 미리보기`} /><div className="upload-item-info"><strong>{index + 1}번 이미지</strong><span>{item.width}×{item.height}</span><small>{(item.file.size / 1024 / 1024).toFixed(1)}MB</small></div><button className={`drag-handle ${dragging === index ? "is-dragging" : ""}`} type="button" aria-label={`${index + 1}번 이미지 순서 변경`} onPointerDown={() => { pressTimer.current = setTimeout(() => setDragging(index), 350); }} onPointerUp={() => { if (pressTimer.current) clearTimeout(pressTimer.current); setDragging(null); }} onPointerLeave={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }} onPointerEnter={() => { if (dragging !== null) move(dragging, index); }}><span>≡</span></button><button className="remove-upload" type="button" onClick={() => remove(item.id)} aria-label={`${index + 1}번 이미지 삭제`}>×</button></div>)}</div>}<label className="add-more-button"><input type="file" accept="image/jpeg,image/png" multiple onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />＋ 이미지 더 추가</label></div>
    <div className="upload-summary"><span>전체 {items.length}장 · {(totalSize / 1024 / 1024).toFixed(1)}MB</span><span>전체 높이 {totalHeight.toLocaleString()}px</span></div>
    <button className="next-upload-button" type="button" disabled={items.length === 0}>다음</button>
  </section>;
}
