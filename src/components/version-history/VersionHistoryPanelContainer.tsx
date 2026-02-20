"use client";

import { useVersionHistory } from "./VersionHistoryProvider";
import { VersionHistorySidePanel } from "./VersionHistorySidePanel";

const PANEL_WIDTH = 320;

export function VersionHistoryPanelContainer() {
  const { openHistoryPanel } = useVersionHistory();

  return (
    <div
      className="flex h-full shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[0_0_20px_rgba(0,0,0,0.08)] transition-[width] duration-200 ease-out"
      style={{ width: openHistoryPanel ? PANEL_WIDTH : 0 }}
      role="dialog"
      aria-label="Version history"
      aria-hidden={!openHistoryPanel}
    >
      <div className="flex h-full min-w-80 flex-col">
        <VersionHistorySidePanel />
      </div>
    </div>
  );
}
