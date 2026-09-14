import { create } from "zustand";

/**
 * Live reasoning / tool-call traces per actor, streamed from the Knots trace source
 * (room_monitor.py): a small local service that tails each runtime's own transcript and
 * binds the steps to the chat message that ended them (matched by ledger event id).
 */
export type TraceEvent = {
  ts: string;
  kind: string;
  summary: string;
  full?: string; // complete text when the summary was shortened
  tool?: string;
  opaque?: boolean;
};

export type TraceSteps = { thinking: number; tool: number; text: number };

export type MessageTrace = {
  message_id: string;
  actor: string;
  message_ts: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  steps: TraceSteps;
  events: TraceEvent[];
  to?: string[];
  preview?: string;
};

export type LiveTrace = {
  actor: string;
  phase: string;
  since: string;
  started_at: string;
  working: boolean;
  last: string;
  steps: TraceSteps;
  events: TraceEvent[];
  model?: string;
  effort?: string;
  runtime?: string;
};

type TraceState = {
  connected: boolean;
  traces: Record<string, MessageTrace>;
  live: Record<string, LiveTrace>;
  connect: () => void;
};

const TRACE_URL_STORAGE_KEY = "knots.traceUrl";
const DEFAULT_TRACE_PORT = 18849;

export function traceBaseUrl(): string {
  try {
    const stored = String(window.localStorage.getItem(TRACE_URL_STORAGE_KEY) || "").trim();
    if (stored) return stored.replace(/\/+$/, "");
  } catch {
    // storage may be unavailable
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_TRACE_PORT}`;
}

let started = false;

function openStream(): void {
  const source = new EventSource(`${traceBaseUrl()}/api/events`);
  source.onopen = () => useTraceStore.setState({ connected: true });
  source.onerror = () => useTraceStore.setState({ connected: false });
  source.onmessage = (message) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(message.data || "{}")) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(data.type || "");
    if (type === "snapshot") {
      const traces: Record<string, MessageTrace> = {};
      for (const trace of (data.traces as MessageTrace[] | undefined) || []) {
        if (trace?.message_id) traces[trace.message_id] = trace;
      }
      useTraceStore.setState({
        traces,
        live: (data.live as Record<string, LiveTrace> | undefined) || {},
        connected: true,
      });
      return;
    }
    if (type === "trace") {
      const trace = data.trace as MessageTrace | undefined;
      if (!trace?.message_id) return;
      useTraceStore.setState((state) => ({ traces: { ...state.traces, [trace.message_id]: trace } }));
      return;
    }
    if (type === "event" || type === "live") {
      const actor = String(data.actor || "");
      const live = data.live as LiveTrace | undefined;
      if (!actor || !live) return;
      useTraceStore.setState((state) => ({ live: { ...state.live, [actor]: live } }));
    }
  };
}

export const useTraceStore = create<TraceState>(() => ({
  connected: false,
  traces: {},
  live: {},
  connect: () => {
    if (started || typeof window === "undefined" || typeof EventSource === "undefined") return;
    started = true;
    openStream();
  },
}));

export function formatTraceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function traceEventGlyph(kind: string): string {
  switch (kind) {
    case "thinking":
      return "◆";
    case "tool":
      return "⚙";
    case "text":
      return "✎";
    case "received":
      return "↓";
    case "error":
      return "!";
    default:
      return "·";
  }
}
