"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/lib/board/store";
import { useBoardPresenceContext } from "@/components/canvas/BoardPresenceProvider";
import { performanceMetricsStore } from "@/lib/performance/metrics-store";

export function PerformanceMetricsInline() {
  const [metrics, setMetrics] = useState(performanceMetricsStore.getState());
  const objects = useBoardStore((state) => state.objects);
  const activeUserIds = useBoardPresenceContext().activeUserIds;

  useEffect(() => {
    const unsub = performanceMetricsStore.subscribe(() => {
      setMetrics(performanceMetricsStore.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    performanceMetricsStore.setObjectCount(Object.keys(objects).length);
  }, [objects]);

  useEffect(() => {
    performanceMetricsStore.setConcurrentUsers(activeUserIds.size);
  }, [activeUserIds]);

  // FPS measurement via RAF (runs while component is mounted)
  useEffect(() => {
    let lastFrame = performance.now();
    let rafId: number;
    const tick = () => {
      const now = performance.now();
      const frameTimeMs = now - lastFrame;
      lastFrame = now;
      performanceMetricsStore.recordFps(frameTimeMs);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const objSync = metrics.objectSyncLatency.last
    ? `${metrics.objectSyncLatency.last}ms`
    : "—";
  const curSync = metrics.cursorSyncLatency.last
    ? `${metrics.cursorSyncLatency.last}ms`
    : "—";

  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span title="Frame rate (target: 60 FPS)">
        {metrics.fps.current} FPS
      </span>
      <span className="text-slate-400">|</span>
      <span title="Object sync latency (target: &lt;100ms)">
        Obj: {objSync}
      </span>
      <span className="text-slate-400">|</span>
      <span title="Cursor sync latency (target: &lt;50ms)">
        Cur: {curSync}
      </span>
      <span className="text-slate-400">|</span>
      <span title="Object count (target: 500+)">
        {metrics.objectCount} obj
      </span>
      <span className="text-slate-400">|</span>
      <span title="Concurrent users (target: 5+)">
        {metrics.concurrentUsers} user
        {metrics.concurrentUsers !== 1 ? "s" : ""}
      </span>
      <button
        type="button"
        onClick={() => performanceMetricsStore.reset()}
        className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600"
        title="Reset metrics"
      >
        Reset
      </button>
    </div>
  );
}
