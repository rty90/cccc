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

export type SidebarTab = "overview" | "meetings" | "projects" | "harness" | "log";
export type RailFocusKind = "meeting" | "vote" | "help" | "project" | "lesson" | "update";
/** What the right rail shows in detail (a row the human clicked, or "view" on a post in the chat). */
export type RailFocus = { kind: RailFocusKind; id: string };

export type HarnessUpdate = {
  runtime: string;
  package: string;
  current: string;
  latest: string;
  status: "idle" | "available" | "ignored" | "updating" | "done" | "failed" | string;
  actors: string[];
  log?: string;
  checked_at?: string;
};

export type ActorStatus = { status: "starting" | "online" | "offline" | "failed" | "handoff"; detail?: string; ts: string };

export type ProjectStatus = "proposing" | "revising" | "debating" | "reviewing" | "awaiting_human" | "adopted" | "rejected" | "stopped";
export type ProjectPoints = { by: string; ts?: string; message_id?: string; points: string[] };
export type ProjectReview = { by: string; ts?: string; message_id?: string; verdict: "accept" | "revise" | "reject"; reason?: string; check?: string };
export type Project = {
  id: string;
  title: string;
  brief?: string;
  status: ProjectStatus;
  phase_since?: string;
  created_at: string;
  closed_at?: string | null;
  requested_by?: string;
  roles: { proposer: string; blue: string[]; red: string[]; reviewers: string[] };
  round: number;
  proposal?: { by?: string; ts?: string; message_id?: string; text?: string; summary?: string; steps?: string[]; risks?: string[]; evidence?: string } | null;
  pros: ProjectPoints[];
  cons: ProjectPoints[];
  reviews: ProjectReview[];
  digest?: string;
  suggestion?: string;
  rulings?: { ts: string; verdict: string; note?: string; by?: string; round?: number }[];
  tasks?: string[];
  debate_missing?: string[];
  review_missing?: string[];
};

export type Lesson = {
  id: string;
  principle: string;
  why?: string;
  apply?: string;
  by: string;
  message_id?: string;
  created_at: string;
  status: "candidate" | "kept" | "dropped";
  ruled_at?: string | null;
};

function upsertLesson(list: Lesson[], item: Lesson): Lesson[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index < 0) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function upsertProject(list: Project[], item: Project): Project[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index < 0) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

type MeetingState = {
  connected: boolean;
  meetings: Meeting[];
  projects: Project[];
  lessons: Lesson[];
  log: ModeratorLogEntry[];
  harness: Harness | null;
  help: HelpTicket[];
  notices: Notice[];
  language: string;
  actorStatus: Record<string, ActorStatus>;
  authRequired: boolean;
  updates: Record<string, HarnessUpdate>;
  ui: { sidebarOpen: boolean; tab: SidebarTab; focus: RailFocus | null };
  connect: () => void;
  dismissNotice: (id: string) => void;
  fetchHarness: () => Promise<void>;
  setSidebar: (open: boolean, tab?: SidebarTab, focus?: RailFocus | null) => void;
  setFocus: (focus: RailFocus | null) => void;
  setModeratorToken: (token: string) => void;
};

const MODERATOR_URL_STORAGE_KEY = "knots.moderatorUrl";
const SEEN_STORAGE_KEY = "knots.popups.seen";
const SIDEBAR_STORAGE_KEY = "knots.sidebar";
const TOKEN_STORAGE_KEY = "knots.moderatorToken";
const DEFAULT_MODERATOR_PORT = 18850;
const FRESH_WINDOW_MS = 15 * 60 * 1000;

/** The human token from ~/.knots/moderator.token, pasted once into the UI; never sent anywhere but the moderator. */
export function moderatorToken(): string {
  try {
    return String(window.localStorage.getItem(TOKEN_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

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
      else if (voteNeedsRuling(vote, meeting)) pushNotice("needs_human", meeting, vote.id);
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
      if (vote && voteNeedsRuling(vote, meeting)) pushNotice("needs_human", meeting, voteId);
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

function loadSidebar(): { sidebarOpen: boolean; tab: SidebarTab; focus: RailFocus | null } {
  // Only whether the rail is open survives a reload; it always reopens on the overview.
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sidebarOpen?: boolean };
      return { sidebarOpen: !!parsed.sidebarOpen, tab: "overview", focus: null };
    }
  } catch {
    // storage may be unavailable
  }
  return { sidebarOpen: false, tab: "overview", focus: null };
}

let started = false;

export const useMeetingStore = create<MeetingState>(() => ({
  connected: false,
  meetings: [],
  projects: [],
  lessons: [],
  log: [],
  harness: null,
  help: [],
  notices: [],
  language: "",
  actorStatus: {},
  authRequired: false,
  updates: {},
  ui: typeof window === "undefined" ? { sidebarOpen: false, tab: "overview", focus: null } : loadSidebar(),
  connect: () => {
    if (started || typeof window === "undefined" || typeof EventSource === "undefined") return;
    started = true;
    const token = moderatorToken();
    if (!token) {
      // Same machine: the moderator hands the token to loopback browsers, so nobody has to paste it.
      useMeetingStore.setState({ authRequired: true });
      void fetch(`${moderatorBaseUrl()}/api/token`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { token?: string } | null) => {
          const fetched = String(data?.token || "").trim();
          if (!fetched) return;
          try {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, fetched);
          } catch {
            // ignore
          }
          useMeetingStore.setState({ authRequired: false, connected: false });
          started = false; // let connect() run again, now with the token
          useMeetingStore.getState().connect();
        })
        .catch(() => {
          started = false;
        });
      return;
    }
    const source = new EventSource(`${moderatorBaseUrl()}/api/events?token=${encodeURIComponent(token)}`);
    source.onopen = () => {
      useMeetingStore.setState({ connected: true, authRequired: false });
      void syncLanguage();
      void moderatorGet<{ updates?: Record<string, HarnessUpdate> }>("/api/updates")
        .then((data) => useMeetingStore.setState({ updates: data?.updates || {} }))
        .catch(() => undefined);
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
        const projects = ((data.projects as Project[] | undefined) || []).slice();
        const lessons = ((data.lessons as Lesson[] | undefined) || []).slice();
        useMeetingStore.setState({
          help,
          projects,
          lessons,
          language: String(data.language || ""),
          actorStatus: (data.actor_status as Record<string, ActorStatus> | undefined) || {},
        });
        void syncLanguage();
        for (const ticket of help) if (ticket.status !== "resolved") pushHelpNotice(ticket);
      } else if (type === "updates") {
        useMeetingStore.setState({ updates: (data.updates as Record<string, HarnessUpdate> | undefined) || {} });
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
      } else if (type === "lesson") {
        const lesson = data.lesson as Lesson | undefined;
        if (lesson?.id) useMeetingStore.setState((state) => ({ lessons: upsertLesson(state.lessons, lesson) }));
      } else if (type === "project") {
        const project = data.project as Project | undefined;
        if (project?.id) useMeetingStore.setState((state) => ({ projects: upsertProject(state.projects, project) }));
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
  setModeratorToken: (token: string) => {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } catch {
      // ignore
    }
    useMeetingStore.setState({ authRequired: !token.trim() });
    window.setTimeout(() => window.location.reload(), 150);
  },
  setSidebar: (open: boolean, tab?: SidebarTab, focus?: RailFocus | null) => {
    useMeetingStore.setState((state) => {
      const ui = {
        sidebarOpen: open,
        tab: tab || state.ui.tab,
        focus: focus !== undefined ? focus : tab ? null : state.ui.focus,
      };
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ sidebarOpen: open }));
      } catch {
        // ignore
      }
      return { ui };
    });
  },
  setFocus: (focus: RailFocus | null) => {
    useMeetingStore.setState((state) => ({ ui: { ...state.ui, focus } }));
  },
  fetchHarness: async () => {
    try {
      const harness = await moderatorGet<Harness>("/api/harness");
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

export function moderatorHeaders(): Record<string, string> {
  const token = moderatorToken();
  return token ? { "Content-Type": "application/json", "X-Knots-Token": token } : { "Content-Type": "application/json" };
}

/** Never throws: a network failure or a non-JSON reply comes back as `{ ok: false, error }` so buttons recover. */
export async function moderatorPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`${moderatorBaseUrl()}${path}`, {
      method: "POST",
      headers: moderatorHeaders(),
      body: JSON.stringify(body ?? {}),
    });
    if (response.status === 401) useMeetingStore.setState({ authRequired: true });
    try {
      return (await response.json()) as T;
    } catch {
      return { ok: false, error: `moderator replied ${response.status} without JSON` } as unknown as T;
    }
  } catch (error) {
    useMeetingStore.setState({ connected: false });
    return { ok: false, error: `network: ${error instanceof Error ? error.message : String(error)}` } as unknown as T;
  }
}

export async function moderatorGet<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${moderatorBaseUrl()}${path}`, { headers: moderatorHeaders() });
    if (response.status === 401) useMeetingStore.setState({ authRequired: true });
    try {
      return (await response.json()) as T;
    } catch {
      return { ok: false, error: `moderator replied ${response.status} without JSON` } as unknown as T;
    }
  } catch (error) {
    useMeetingStore.setState({ connected: false });
    return { ok: false, error: `network: ${error instanceof Error ? error.message : String(error)}` } as unknown as T;
  }
}

/**
 * A vote needs the human's ruling only while its meeting is alive: a closed meeting, a superseded or stopped vote,
 * or one already ruled is read-only. Shared by the cards, the pending strip, the badge and the notices.
 */
export function voteNeedsRuling(vote: Vote, meeting: Meeting): boolean {
  if (vote.status !== "closed" || vote.human) return false;
  if (meeting.status === "closed") return false;
  const final = String(vote.result?.final || "");
  if (final === "superseded" || final === "stopped") return false;
  return Boolean(vote.awaiting_human) || (meeting.mode || "agents") === "human";
}

/** Live tally for a vote: the server result when closed, otherwise counted from the ballots seen so far. */
export function voteCounts(vote: Vote): Record<string, number> {
  if (vote.result?.counts) return vote.result.counts;
  const counts = vote.options.reduce<Record<string, number>>((acc, option) => ({ ...acc, [option]: 0 }), {});
  for (const ballot of Object.values(vote.ballots)) counts[ballot.option] = (counts[ballot.option] || 0) + 1;
  return counts;
}
