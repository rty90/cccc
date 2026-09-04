import { create } from "zustand";
import i18n from "../../i18n";
import { normalizeLanguageCode } from "../../i18n/languages";

/** Meetings, role tags, votes, decision modes and harness state managed by the Knots moderator (knots_moderator.py). */
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
  final?: string | null;
};

export type HumanRuling = { option: string; reason?: string; ts?: string };

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
  source?: string;
  human?: HumanRuling | null;
  awaiting_human?: boolean;
};

export type MeetingMode = "agents" | "human";
export type MeetingKind = "meeting" | "harness";

export type Meeting = {
  id: string;
  topic: string;
  brief?: string;
  participants: string[];
  roles: Record<string, string>;
  status: "open" | "voting" | "closed";
  mode?: MeetingMode;
  kind?: MeetingKind;
  requested_by?: string;
  escalations?: string[];
  proposal?: { title?: string; kind?: string; fields?: Record<string, string> } | null;
  created_at: string;
  votes: Vote[];
  decision?: string | null;
  closed_at?: string | null;
  messages?: { id?: string; by: string; ts?: string; to?: string[]; preview: string }[];
};

export type HarnessSkill = {
  name: string;
  source: string;
  path?: string;
  ref?: string;
  installed_at?: string;
  target?: string;
  runtimes?: Record<string, string>;
};

export type HarnessHistory = { ts: string; meeting?: string; title: string; kind?: string; outcome: string; detail?: string };

export type Harness = {
  version: number;
  protocol_path?: string;
  skills: HarnessSkill[];
  history: HarnessHistory[];
  protocol?: string;
  changelog?: string;
  runtime_skill_dirs?: Record<string, string>;
};

export type ModeratorLogEntry = { ts: string; kind: string; text: string };

export type HelpTicket = {
  id: string;
  by: string;
  need: "takeover" | "permission" | "advice";
  text: string;
  status: "open" | "assigned" | "resolved";
  assignee?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolution?: string | null;
  outcome?: "granted" | "denied" | "done" | null;
  escalated?: boolean;
};

export type NoticeKind = "opened" | "vote_opened" | "vote_closed" | "needs_human" | "human_decided" | "closed" | "escalated" | "help";

/** Something the human should see now; rendered as a popup by MeetingPopups. */
export type Notice = { id: string; kind: NoticeKind; meetingId: string; voteId?: string; helpId?: string; ts: number };

export type SidebarTab = "meetings" | "harness" | "log";

export type ActorStatus = { status: "starting" | "online" | "offline" | "failed"; detail?: string; ts: string };

type MeetingState = {
  connected: boolean;
  meetings: Meeting[];
  log: ModeratorLogEntry[];
  harness: Harness | null;
  help: HelpTicket[];
  notices: Notice[];
  language: string;
  actorStatus: Record<string, ActorStatus>;
  ui: { sidebarOpen: boolean; tab: SidebarTab };
  connect: () => void;
  dismissNotice: (id: string) => void;
  fetchHarness: () => Promise<void>;
  setSidebar: (open: boolean, tab?: SidebarTab) => void;
};

const MODERATOR_URL_STORAGE_KEY = "knots.moderatorUrl";
const SEEN_STORAGE_KEY = "knots.popups.seen";
const SIDEBAR_STORAGE_KEY = "knots.sidebar";
const DEFAULT_MODERATOR_PORT = 18850;
const FRESH_WINDOW_MS = 15 * 60 * 1000;

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

function loadSeen(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(SEEN_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

const seen = loadSeen();

function markSeen(id: string) {
  seen.add(id);
  try {
    window.sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(seen).slice(-400)));
  } catch {
    // ignore
  }
}

function noticeId(kind: NoticeKind, meetingId: string, voteId?: string): string {
  return `${kind}:${meetingId}${voteId ? `:${voteId}` : ""}`;
}

function pushNotice(kind: NoticeKind, meeting: Meeting, voteId?: string) {
  const id = noticeId(kind, meeting.id, voteId);
  // Pending human rulings keep coming back until decided; everything else pops once per browser session.
  if (kind !== "needs_human" && seen.has(id)) return;
  markSeen(id);
  useMeetingStore.setState((state) => ({
    notices: [...state.notices.filter((notice) => notice.id !== id), { id, kind, meetingId: meeting.id, voteId, ts: Date.now() }],
  }));
}

function upsertHelp(list: HelpTicket[], ticket: HelpTicket): HelpTicket[] {
  const next = list.filter((item) => item.id !== ticket.id);
  next.push(ticket);
  next.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return next;
}

function pushHelpNotice(ticket: HelpTicket) {
  const id = `help:${ticket.id}`;
  useMeetingStore.setState((state) => ({
    notices: [...state.notices.filter((notice) => notice.id !== id), { id, kind: "help", meetingId: "", helpId: ticket.id, ts: Date.now() }],
  }));
}

function dropNotices(predicate: (notice: Notice) => boolean) {
  useMeetingStore.setState((state) => ({ notices: state.notices.filter((notice) => !predicate(notice)) }));
}

function isFresh(iso: string): boolean {
  const ts = Date.parse(String(iso || ""));
  return Number.isFinite(ts) && Date.now() - ts < FRESH_WINDOW_MS;
}

function noticesFromSnapshot(meetings: Meeting[]) {
  for (const meeting of meetings) {
    if (meeting.status === "closed") continue;
    if (isFresh(meeting.created_at)) pushNotice("opened", meeting);
    for (const vote of meeting.votes) {
      if (vote.status === "open") pushNotice("vote_opened", meeting, vote.id);
      else if (vote.awaiting_human && !vote.human) pushNotice("needs_human", meeting, vote.id);
    }
  }
}

function applyMeetingEvent(meeting: Meeting, event: string, voteId?: string) {
  const vote = voteId ? meeting.votes.find((item) => item.id === voteId) : undefined;
  switch (event) {
    case "opened":
      pushNotice("opened", meeting);
      break;
    case "vote_opened":
      if (voteId) pushNotice("vote_opened", meeting, voteId);
      break;
    case "vote_closed":
      dropNotices((notice) => notice.kind === "vote_opened" && notice.voteId === voteId);
      if (vote?.awaiting_human && !vote.human) pushNotice("needs_human", meeting, voteId);
      else if (voteId) pushNotice("vote_closed", meeting, voteId);
      break;
    case "human_decided":
      dropNotices((notice) => notice.voteId === voteId && (notice.kind === "needs_human" || notice.kind === "vote_closed" || notice.kind === "vote_opened"));
      if (voteId) pushNotice("human_decided", meeting, voteId);
      break;
    case "closed":
      dropNotices((notice) => notice.meetingId === meeting.id && notice.kind !== "human_decided");
      pushNotice("closed", meeting);
      break;
    case "escalated":
      pushNotice("escalated", meeting);
      break;
    default:
      break;
  }
}

function loadSidebar(): { sidebarOpen: boolean; tab: SidebarTab } {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sidebarOpen?: boolean; tab?: SidebarTab };
      return { sidebarOpen: !!parsed.sidebarOpen, tab: parsed.tab === "harness" || parsed.tab === "log" ? parsed.tab : "meetings" };
    }
  } catch {
    // storage may be unavailable
  }
  return { sidebarOpen: false, tab: "meetings" };
}

let started = false;

export const useMeetingStore = create<MeetingState>(() => ({
  connected: false,
  meetings: [],
  log: [],
  harness: null,
  help: [],
  notices: [],
  language: "",
  actorStatus: {},
  ui: typeof window === "undefined" ? { sidebarOpen: false, tab: "meetings" } : loadSidebar(),
  connect: () => {
    if (started || typeof window === "undefined" || typeof EventSource === "undefined") return;
    started = true;
    const source = new EventSource(`${moderatorBaseUrl()}/api/events`);
    source.onopen = () => {
      useMeetingStore.setState({ connected: true });
      void syncLanguage();
    };
    i18n.on("languageChanged", () => {
      void syncLanguage();
    });
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
        const meetings = ((data.meetings as Meeting[] | undefined) || []).slice();
        useMeetingStore.setState((state) => ({
          connected: true,
          meetings,
          log: ((data.log as ModeratorLogEntry[] | undefined) || []).slice(),
          harness: (data.harness as Harness | undefined) ? { ...(state.harness || {}), ...(data.harness as Harness) } : state.harness,
        }));
        noticesFromSnapshot(meetings);
        const help = ((data.help as HelpTicket[] | undefined) || []).slice();
        useMeetingStore.setState({
          help,
          language: String(data.language || ""),
          actorStatus: (data.actor_status as Record<string, ActorStatus> | undefined) || {},
        });
        void syncLanguage();
        for (const ticket of help) if (ticket.status !== "resolved") pushHelpNotice(ticket);
      } else if (type === "language") {
        useMeetingStore.setState({ language: String(data.language || "") });
      } else if (type === "actor") {
        const actor = String(data.actor || "");
        if (actor) {
          useMeetingStore.setState((state) => ({
            actorStatus: {
              ...state.actorStatus,
              [actor]: { status: data.status as ActorStatus["status"], detail: String(data.detail || ""), ts: String(data.ts || new Date().toISOString()) },
            },
          }));
        }
      } else if (type === "help") {
        const ticket = data.ticket as HelpTicket | undefined;
        if (ticket?.id) {
          useMeetingStore.setState((state) => ({ help: upsertHelp(state.help, ticket) }));
          if (ticket.status === "resolved") dropNotices((notice) => notice.kind === "help" && notice.helpId === ticket.id);
          else pushHelpNotice(ticket);
        }
      } else if (type === "meeting") {
        const meeting = data.meeting as Meeting | undefined;
        if (meeting?.id) {
          useMeetingStore.setState((state) => ({ meetings: upsert(state.meetings, meeting) }));
          applyMeetingEvent(meeting, String(data.event || ""), data.vote ? String(data.vote) : undefined);
        }
      } else if (type === "harness") {
        const harness = data.harness as Harness | undefined;
        if (harness) useMeetingStore.setState((state) => ({ harness: { ...(state.harness || {}), ...harness } }));
      } else if (type === "log") {
        const entry = data.entry as ModeratorLogEntry | undefined;
        if (entry) useMeetingStore.setState((state) => ({ log: [...state.log, entry].slice(-100) }));
      }
    };
  },
  dismissNotice: (id: string) => {
    useMeetingStore.setState((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) }));
  },
  setSidebar: (open: boolean, tab?: SidebarTab) => {
    useMeetingStore.setState((state) => {
      const ui = { sidebarOpen: open, tab: tab || state.ui.tab };
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(ui));
      } catch {
        // ignore
      }
      return { ui };
    });
  },
  fetchHarness: async () => {
    try {
      const response = await fetch(`${moderatorBaseUrl()}/api/harness`);
      const harness = (await response.json()) as Harness;
      useMeetingStore.setState({ harness });
    } catch {
      // moderator offline
    }
  },
}));

/** Tell the moderator which language the UI shows, so the agents write their messages in it. */
async function syncLanguage() {
  const wanted = normalizeLanguageCode(i18n.language);
  if (useMeetingStore.getState().language === wanted) return;
  try {
    await moderatorPost("/api/language", { language: wanted, by: "the human moderator" });
    useMeetingStore.setState({ language: wanted });
  } catch {
    // moderator offline
  }
}

export async function setActorEnabled(actorId: string, enabled: boolean): Promise<void> {
  await moderatorPost(`/api/actors/${encodeURIComponent(actorId)}/${enabled ? "enable" : "disable"}`, {});
}

export async function moderatorPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${moderatorBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await response.json()) as T;
}

/** Live tally for a vote: the server result when closed, otherwise counted from the ballots seen so far. */
export function voteCounts(vote: Vote): Record<string, number> {
  if (vote.result?.counts) return vote.result.counts;
  const counts = vote.options.reduce<Record<string, number>>((acc, option) => ({ ...acc, [option]: 0 }), {});
  for (const ballot of Object.values(vote.ballots)) counts[ballot.option] = (counts[ballot.option] || 0) + 1;
  return counts;
}
