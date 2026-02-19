/**
 * Performance metrics store for the debug panel.
 * Captures: FPS, object sync latency, cursor sync latency, object count, concurrent users.
 */

const MAX_SAMPLES = 100;

type LatencySample = {
  last: number;
  samples: number[];
  min: number;
  max: number;
  avg: number;
};

function computeLatencyStats(samples: number[]): Omit<LatencySample, "samples"> {
  if (samples.length === 0) {
    return { last: 0, min: 0, max: 0, avg: 0 };
  }
  const last = samples[samples.length - 1] ?? 0;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { last, min, max, avg };
}

type Subscriber = () => void;

class PerformanceMetricsStore {
  private fps: { current: number; samples: number[]; min: number; max: number; avg: number } = {
    current: 0,
    samples: [],
    min: 0,
    max: 0,
    avg: 0,
  };
  private objectSyncLatency: LatencySample = {
    last: 0,
    samples: [],
    min: 0,
    max: 0,
    avg: 0,
  };
  private cursorSyncLatency: LatencySample = {
    last: 0,
    samples: [],
    min: 0,
    max: 0,
    avg: 0,
  };
  private objectCount = 0;
  private concurrentUsers = 0;
  private subscribers = new Set<Subscriber>();

  private notify() {
    this.subscribers.forEach((fn) => fn());
  }

  subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /** EMA smoothing factor: lower = smoother */
  private static readonly FPS_SMOOTH_ALPHA = 0.05;
  private fpsSmoothed = 0;
  private lastFpsNotifyAt = 0;
  private static readonly FPS_NOTIFY_INTERVAL_MS = 500;

  recordFps(frameTimeMs: number) {
    const fpsValue = frameTimeMs > 0 ? 1000 / frameTimeMs : 0;
    this.fpsSmoothed =
      this.fpsSmoothed === 0
        ? fpsValue
        : PerformanceMetricsStore.FPS_SMOOTH_ALPHA * fpsValue +
          (1 - PerformanceMetricsStore.FPS_SMOOTH_ALPHA) * this.fpsSmoothed;
    this.fps.current = Math.round(this.fpsSmoothed);
    this.fps.samples.push(fpsValue);
    if (this.fps.samples.length > MAX_SAMPLES) {
      this.fps.samples.shift();
    }
    const stats = computeLatencyStats(this.fps.samples);
    this.fps.min = Math.round(stats.min);
    this.fps.max = Math.round(stats.max);
    this.fps.avg = Math.round(stats.avg);
    const now = Date.now();
    if (now - this.lastFpsNotifyAt >= PerformanceMetricsStore.FPS_NOTIFY_INTERVAL_MS) {
      this.lastFpsNotifyAt = now;
      this.notify();
    }
  }

  recordObjectSyncLatency(latencyMs: number) {
    this.objectSyncLatency.last = Math.round(latencyMs);
    this.objectSyncLatency.samples.push(latencyMs);
    if (this.objectSyncLatency.samples.length > MAX_SAMPLES) {
      this.objectSyncLatency.samples.shift();
    }
    const stats = computeLatencyStats(this.objectSyncLatency.samples);
    Object.assign(this.objectSyncLatency, stats);
    this.objectSyncLatency.last = Math.round(latencyMs);
    this.notify();
  }

  recordCursorSyncLatency(latencyMs: number) {
    this.cursorSyncLatency.last = Math.round(latencyMs);
    this.cursorSyncLatency.samples.push(latencyMs);
    if (this.cursorSyncLatency.samples.length > MAX_SAMPLES) {
      this.cursorSyncLatency.samples.shift();
    }
    const stats = computeLatencyStats(this.cursorSyncLatency.samples);
    Object.assign(this.cursorSyncLatency, stats);
    this.cursorSyncLatency.last = Math.round(latencyMs);
    this.notify();
  }

  setObjectCount(count: number) {
    if (this.objectCount !== count) {
      this.objectCount = count;
      this.notify();
    }
  }

  setConcurrentUsers(count: number) {
    if (this.concurrentUsers !== count) {
      this.concurrentUsers = count;
      this.notify();
    }
  }

  getState() {
    return {
      fps: { ...this.fps },
      objectSyncLatency: { ...this.objectSyncLatency },
      cursorSyncLatency: { ...this.cursorSyncLatency },
      objectCount: this.objectCount,
      concurrentUsers: this.concurrentUsers,
    };
  }

  reset() {
    this.fpsSmoothed = 0;
    this.fps = { current: 0, samples: [], min: 0, max: 0, avg: 0 };
    this.objectSyncLatency = { last: 0, samples: [], min: 0, max: 0, avg: 0 };
    this.cursorSyncLatency = { last: 0, samples: [], min: 0, max: 0, avg: 0 };
    this.notify();
  }
}

export const performanceMetricsStore = new PerformanceMetricsStore();
