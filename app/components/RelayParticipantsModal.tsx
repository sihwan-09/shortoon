"use client";

import { useEffect, useState } from "react";
import type { RelayParticipant } from "../../lib/relay";
import { loadFollowerCount } from "../../lib/follows";

export function RelayParticipantsModal({ participants, relayId, onClose }: { participants: RelayParticipant[]; relayId: string; onClose: () => void }) {
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>(() => Object.fromEntries(participants.map((participant) => [participant.ownerId, participant.followerCount])));

  useEffect(() => {
    let cancelled = false;
    void Promise.all(participants.map(async (participant) => {
      try {
        return [participant.ownerId, await loadFollowerCount(participant.ownerId)] as const;
      } catch (error) {
        console.error("참여자 팔로워 수 조회 실패", error);
        return [participant.ownerId, participant.followerCount] as const;
      }
    })).then((counts) => {
      if (!cancelled) setFollowerCounts(Object.fromEntries(counts));
    });
    return () => { cancelled = true; };
  }, [participants]);

  return (
    <div className="sheet-backdrop relay-participants-backdrop" role="presentation" onClick={onClose}>
      <aside className="comment-sheet relay-participants-sheet" role="dialog" aria-modal="true" aria-label="참여자" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header><strong>참여자</strong><button type="button" onClick={onClose} aria-label="참여자 닫기">×</button></header>
        <div className="relay-participants-list">
          {participants.map((participant) => (
              <div className="relay-participant-row" key={participant.ownerId} role="button" tabIndex={0} onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: participant.ownerId } })); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClose(); window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: participant.ownerId } })); } }}>
              <span className="relay-participant-avatar" style={participant.profileImageUrl ? { backgroundImage: "url(" + participant.profileImageUrl + ")" } : undefined} aria-hidden="true" />
              <div className="relay-participant-copy"><strong>{participant.name}</strong><span>@{participant.channelId}<em> · 팔로워 {followerCounts[participant.ownerId] ?? participant.followerCount}명</em></span></div>
              <button className="relay-participant-comment" type="button" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onClose(); window.dispatchEvent(new CustomEvent("shorttoon-open-relay-comment", { detail: { relayId, participant: { ownerId: participant.ownerId, channelId: participant.channelId } } })); }}>댓글 달기</button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
