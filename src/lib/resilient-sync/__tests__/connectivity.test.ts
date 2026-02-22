import { describe, it, expect } from "vitest";
import {
  computeConnectivityState,
  createConnectivityInput,
} from "../connectivity";

describe("computeConnectivityState", () => {
  it("returns OFFLINE when navigator is offline", () => {
    const input = {
      ...createConnectivityInput(),
      navigatorOnLine: false,
      realtimeConnected: true,
      pendingCount: 0,
    };
    expect(computeConnectivityState(input)).toBe("OFFLINE");
  });

  it("returns ONLINE_SYNCED when online, connected, no pending", () => {
    const input = {
      ...createConnectivityInput(),
      navigatorOnLine: true,
      realtimeConnected: true,
      pendingCount: 0,
    };
    expect(computeConnectivityState(input)).toBe("ONLINE_SYNCED");
  });

  it("returns ONLINE_SYNCING when online, connected, has pending", () => {
    const input = {
      ...createConnectivityInput(),
      navigatorOnLine: true,
      realtimeConnected: true,
      pendingCount: 5,
    };
    expect(computeConnectivityState(input)).toBe("ONLINE_SYNCING");
  });

  it("returns DEGRADED when online, disconnected, has pending", () => {
    const input = {
      ...createConnectivityInput(),
      navigatorOnLine: true,
      realtimeConnected: false,
      pendingCount: 5,
    };
    expect(computeConnectivityState(input)).toBe("DEGRADED");
  });

  it("returns DEGRADED when high error rate", () => {
    const input = {
      ...createConnectivityInput(),
      navigatorOnLine: true,
      realtimeConnected: true,
      pendingCount: 0,
      recentErrors: 5,
      recentErrorsWindowStart: Date.now() - 10000,
    };
    expect(computeConnectivityState(input)).toBe("DEGRADED");
  });

  it("returns READONLY_FAILSAFE when readOnlyFailsafe is true", () => {
    const input = {
      ...createConnectivityInput(),
      navigatorOnLine: true,
      realtimeConnected: true,
      readOnlyFailsafe: true,
    };
    expect(computeConnectivityState(input)).toBe("READONLY_FAILSAFE");
  });
});
