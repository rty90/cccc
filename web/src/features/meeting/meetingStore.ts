import { create } from "zustand";

/** Meetings, role tags and votes managed by the Knots moderator service (knots_moderator.py). */
export type Ballot = {
  option: string;
  raw?: string;
  reason?: string;
  confidence?: number | null;
  ts?: string;
  message_id?: string;
};

export type VoteResult = {
  counts: Record<string, number>;
  winner: string | null;
  tie: boolean;
  total: number;
};

export type Vote = {
  id: string;
  meeting: string;
  summary: string;
  options: string[];
  created_at: string;
  deadline_s: number;
  ballots: Record<string, Ballot>;
  status: "open" | "closed";
  result: VoteResult | null;
  announced?: boolean;
  closed_at?: string;
};

export type Meeting = {
  id: string;
  topic: string;
  brief?: string;
  participants: string[];
  roles: Record<string, string>;
  status: "open" | "voting" | "closed";
  created_at: string;
  votes: Vote[];
  decision?: string | null;
  closed_at?: string | null;
  messages?: { id?: string; by: string; ts?: string; to?: string[]; preview: string }[];
};

export type ModeratorLogEntry = { ts: string; kind: string; text: string };

type MeetingState = {
  connected: boolean;
  meetings: Meeting[];
  log: ModeratorLogEntry[];
  connect: () => void;
};

const MODERATOR_URL_STORAGE_KEY = "knots.moderatorUrl";
const DEFAULT_MODERATOR_PORT = 18850;

export function moderatorBaseUrl(): string {
  try {
    const stored = String(window.localStorage.getItem(MODERATOR_URL_STORAGE_KEY) || "").trim();
    if (stored) return stored.replace(/\/+$/, "");
  } catch {
    // storage may be unavailable
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_MODERATOR_PORT}`;
}

function upsert(list: Meeting[], meeting: Meeting): Meeting[] {
  const next = list.filter((item) => item.id !== meeting.id);
  next.push(meeting);
  next.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return next;
}

let started = false;

export const useMeetingStore = create<MeetingState>(() => ({
  connected: false,
  meetings: [],
  log: [],
  connect: () => {
    if (started || typeof window === "undefined" || typeof EventSource === "undefined") return;
    started = true;
    const source = new EventSource(`${moderatorBaseUrl()}/api/events`);
    source.onopen = () => useMeetingStore.setState({ connected: true });
    source.onerror = () => useMeetingStore.setState({ connected: false });
    source.onmessage = (message) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(String(message.data || "{}")) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(data.type || "");
      if (type === "snapshot") {
        useMeetingStore.setState({
          connected: true,
          meetings: ((data.meetings as Meeting[] | undefined) || []).slice(),
          log: ((data.log as ModeratorLogEntry[] | undefined) || []).slice(),
        });
      } else if (type === "meeting") {
        const meeting = data.meeting as Meeting | undefined;
        if (meeting?.id) useMeetingStore.setState((state) => ({ meetings: upsert(state.meetings, meeting) }));
      } else if (type === "log") {
        const entry = data.entry as ModeratorLogEntry | undefined;
        if (entry) useMeetingStore.setState((state) => ({ log: [...state.log, entry].slice(-100) }));
      }
    };
  },
}));

export async function moderatorPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${moderatorBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await response.json()) as T;
}
