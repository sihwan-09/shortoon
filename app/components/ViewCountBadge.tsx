"use client";

import { useEffect, useState } from "react";
import { loadPostViewCounts } from "../../lib/views";

export function ViewCountBadge({ postId, fallback = 0 }: { postId?: string; fallback?: number }) {
  const [count, setCount] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    if (!postId) return () => { cancelled = true; };
    void loadPostViewCounts([postId]).then((counts) => {
      if (!cancelled) setCount(counts[postId] ?? 0);
    });
    return () => { cancelled = true; };
  }, [postId, fallback]);
  return <span className="thumbnail-view-count">조회수 {count}회</span>;
}
