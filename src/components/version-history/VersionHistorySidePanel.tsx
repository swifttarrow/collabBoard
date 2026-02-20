"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronDown, ChevronRight, ChevronLeft, User, Filter, BookmarkCheck } from "lucide-react";
import { useVersionHistory } from "./VersionHistoryProvider";
import {
  groupIntoMilestones,
  computeStateAtRevision,
  opDescription,
  type ServerHistoryEntry,
} from "@/lib/version-history/server-history";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OpType = "create" | "update" | "delete";

export type HistorySave = {
  serverRevision: number;
  userId: string | null;
  userName: string;
  createdAt: string;
};

export function VersionHistorySidePanel() {
  const { boardId, openHistoryPanel, restoreToRevision, setOpenHistoryPanel } = useVersionHistory();
  const [entries, setEntries] = useState<ServerHistoryEntry[]>([]);
  const [saves, setSaves] = useState<HistorySave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [userFilter, setUserFilter] = useState<string>("all");
  const [opFilter, setOpFilter] = useState<OpType | "all">("all");

  const uniqueUsers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      const key = e.userId ?? "unknown";
      if (!seen.has(key)) {
        seen.set(key, e.userName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (userFilter !== "all" && (e.userId ?? "unknown") !== userFilter) return false;
      if (opFilter !== "all" && e.opType !== opFilter) return false;
      return true;
    });
  }, [entries, userFilter, opFilter]);

  const fetchHistory = useCallback(async (id: string, showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/boards/${id}/history`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `Failed to load history (${res.status})`;
        if (
          res.status === 500 &&
          typeof msg === "string" &&
          msg.toLowerCase().includes("does not exist")
        ) {
          throw new Error("History requires a database migration. Run: supabase db push");
        }
        throw new Error(msg);
      }
      setEntries(data?.entries ?? []);
      setSaves(data?.saves ?? []);
    } catch (err) {
      if (showLoading) {
        setError(err instanceof Error ? err.message : "Failed to load history");
        setEntries([]);
        setSaves([]);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!boardId || !openHistoryPanel) return;
    fetchHistory(boardId);
    const interval = setInterval(() => fetchHistory(boardId, false), 4000);
    return () => clearInterval(interval);
  }, [boardId, openHistoryPanel, fetchHistory]);

  const milestones = groupIntoMilestones(filteredEntries);

  useEffect(() => {
    if (milestones.length > 0 && expandedMilestones.size === 0) {
      setExpandedMilestones(new Set([milestones[0]!.id]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones.length]);

  const handleRestore = (targetRevision: number) => {
    const state = computeStateAtRevision(entries, targetRevision);
    restoreToRevision(state, targetRevision);
  };

  const toggleMilestone = (id: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Version History</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setOpenHistoryPanel(false)}
          aria-label="Close history panel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="mb-2 px-2 text-xs text-slate-400">
          All users&apos; changes. Restore syncs to the board for everyone.
        </p>

        {(entries.length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-2">
            <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              aria-label="Filter by user"
            >
              <option value="all">All users</option>
              {uniqueUsers.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={opFilter}
              onChange={(e) => setOpFilter(e.target.value as OpType | "all")}
              className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              aria-label="Filter by operation"
            >
              <option value="all">All operations</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
            {(userFilter !== "all" || opFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-500"
                onClick={() => {
                  setUserFilter("all");
                  setOpFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">Loading history…</p>
        ) : error ? (
          <p className="px-2 py-6 text-center text-sm text-red-600">{error}</p>
        ) : milestones.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            {entries.length === 0
              ? "No history yet. Changes will appear here as you edit."
              : "No matching changes. Try adjusting the filters."}
          </p>
        ) : (
          <ul className="space-y-1">
            {milestones.map((milestone) => {
              const isExpanded = expandedMilestones.has(milestone.id);
              const hasOps = milestone.entries.length > 0;

              return (
                <li key={milestone.id} className="rounded-md border border-slate-200 bg-white">
                  <div className="flex items-center gap-1 px-2 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => toggleMilestone(milestone.id)}
                      aria-expanded={isExpanded}
                    >
                      {hasOps ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      ) : null}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {milestone.label}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => handleRestore(milestone.endRevision)}
                      title="Restore to this point"
                    >
                      <ChevronLeft className="mr-0.5 h-3 w-3" />
                      Restore
                    </Button>
                  </div>

                  {isExpanded && hasOps && (
                    <ul className="border-t border-slate-100 px-2 py-1">
                      {milestone.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="group flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                            <User className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-slate-700">
                              {opDescription(entry.opType, entry.payload)}
                            </span>
                            <span className="ml-1 text-xs text-slate-400">
                              {entry.userName} · {formatTime(entry.createdAt)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100",
                              "transition-opacity"
                            )}
                            onClick={() => handleRestore(entry.serverRevision)}
                            title="Restore to this revision"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                      {saves
                        .filter(
                          (s) =>
                            s.serverRevision >= milestone.startRevision &&
                            s.serverRevision <= milestone.endRevision
                        )
                        .map((save) => (
                          <li
                            key={`save-${save.serverRevision}-${save.createdAt}`}
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-emerald-700"
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <BookmarkCheck className="h-3 w-3" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="truncate font-medium">Saved</span>
                              <span className="ml-1 text-xs text-slate-400">
                                {save.userName} · {formatTime(save.createdAt)}
                              </span>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
