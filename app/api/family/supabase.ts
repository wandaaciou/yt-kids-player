import type {
  PlayerControl,
  PlayerStatus,
  Video,
  WatchProgress,
} from "../../demo-state";
import { defaultControl } from "../../demo-state";

const familyId = "sauncai";

type AllowedVideoRow = {
  youtube_video_id: string;
  title: string;
  channel: string;
  duration: string;
  duration_minutes: number;
  thumbnail: string;
  sort_order: number;
};

type PlayerControlRow = {
  family_id: string;
  status: PlayerStatus;
  current_video_id: string | null;
  timer_minutes: number;
  stop_at: string | null;
  locked_until: string | null;
  updated_at: string;
};

type WatchProgressRow = {
  family_id: string;
  watch_date: string;
  youtube_video_id: string;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
};

export async function getFamilyState() {
  const watchDate = todayInTaipei();
  const [videos, control, watchProgress] = await Promise.all([
    getAllowedVideos(),
    getPlayerControl(),
    getTodayWatchProgress(watchDate),
  ]);
  const safeVideos = videos.length ? videos : defaultControl.approvedVideos;
  const completedVideoIds = new Set(
    watchProgress.filter((progress) => progress.completed).map((progress) => progress.videoId),
  );
  const firstPlayableVideo = safeVideos.find(
    (video) => !completedVideoIds.has(video.id),
  );
  const safeCurrentVideoId =
    control?.current_video_id ?? safeVideos[0]?.id ?? "";
  const normalizedStatus = normalizeStatus(control);
  const completedCount = safeVideos.filter((video) =>
    completedVideoIds.has(video.id),
  ).length;
  const allVideosCompleted =
    safeVideos.length > 0 && completedCount >= safeVideos.length;

  return {
    approvedVideos: safeVideos,
    currentVideoId:
      (completedVideoIds.has(safeCurrentVideoId) ? firstPlayableVideo?.id : null) ??
      safeVideos.find((video) => video.id === safeCurrentVideoId)?.id ??
      safeVideos[0]?.id ??
      "",
    status: allVideosCompleted ? "locked" : normalizedStatus,
    timer: control?.timer_minutes ?? defaultControl.timer,
    stopAt: control?.stop_at ?? null,
    lockedUntil: control?.locked_until ?? null,
    watchDate,
    watchProgress,
    completedCount,
  } satisfies PlayerControl;
}

export async function patchPlayerControl(input: {
  status?: PlayerStatus;
  currentVideoId?: string;
  timer?: number;
}) {
  const current = await getPlayerControl();
  const timerMinutes = input.timer ?? current?.timer_minutes ?? defaultControl.timer;
  const patch: Partial<PlayerControlRow> & { family_id: string } = {
    family_id: familyId,
    timer_minutes: timerMinutes,
    updated_at: new Date().toISOString(),
  };

  if (input.currentVideoId !== undefined) {
    patch.current_video_id = input.currentVideoId;
  }

  if (input.status !== undefined) {
    patch.status = input.status;

    if (input.status === "allowed") {
      patch.stop_at = null;
      patch.locked_until = null;
    }

    if (input.status === "paused") {
      patch.stop_at = null;
    }

    if (input.status === "locked") {
      patch.stop_at = null;
      patch.locked_until = nextTaipeiMidnight().toISOString();
    }
  }

  await supabaseFetch("player_control", {
    method: "POST",
    query: "on_conflict=family_id",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: patch,
  });

  return getFamilyState();
}

export async function saveWatchProgress(input: {
  videoId?: string;
  progressSeconds?: number;
  durationSeconds?: number;
  completed?: boolean;
}) {
  if (!input.videoId) {
    throw new Error("Missing video id.");
  }

  const watchDate = todayInTaipei();
  const existingProgress = await getVideoWatchProgress(watchDate, input.videoId);
  const progressSeconds = Math.max(0, Math.floor(input.progressSeconds ?? 0));
  const durationSeconds = Math.max(0, Math.floor(input.durationSeconds ?? 0));
  const safeProgressSeconds = Math.max(
    progressSeconds,
    existingProgress?.progress_seconds ?? 0,
  );
  const safeDurationSeconds = Math.max(
    durationSeconds,
    existingProgress?.duration_seconds ?? 0,
  );
  const reachedCompletionThreshold =
    safeDurationSeconds > 0 &&
    safeProgressSeconds >= Math.floor(safeDurationSeconds * 0.9);
  const completed =
    existingProgress?.completed === true ||
    input.completed === true ||
    reachedCompletionThreshold;
  const completedAt =
    existingProgress?.completed_at ??
    (completed ? new Date().toISOString() : null);

  await supabaseFetch("family_watch_progress", {
    method: "POST",
    query: "on_conflict=family_id,watch_date,youtube_video_id",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: {
      family_id: familyId,
      watch_date: watchDate,
      youtube_video_id: input.videoId,
      progress_seconds: safeProgressSeconds,
      duration_seconds: safeDurationSeconds,
      completed,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    },
  });

  const state = await getFamilyState();
  const nextVideo = state.approvedVideos.find(
    (video) =>
      !state.watchProgress?.some(
        (progress) => progress.videoId === video.id && progress.completed,
      ),
  );

  if (completed && nextVideo && state.currentVideoId !== nextVideo.id) {
    return patchPlayerControl({ currentVideoId: nextVideo.id });
  }

  return state;
}

export async function addAllowedVideo(video: Video) {
  const videos = await getAllowedVideos();

  if (videos.some((item) => item.id === video.id)) {
    return getFamilyState();
  }

  if (videos.length >= 3) {
    throw new Error("Only three approved videos are allowed.");
  }

  await supabaseFetch("allowed_videos", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    query: "on_conflict=family_id,youtube_video_id",
    body: {
      family_id: familyId,
      youtube_video_id: video.id,
      title: video.title,
      channel: video.channel,
      duration: video.duration,
      duration_minutes: video.durationMinutes,
      thumbnail: video.thumbnail,
      enabled: true,
      sort_order: videos.length,
    },
  });

  await patchPlayerControl({
    status: "allowed",
    currentVideoId: video.id,
  });

  return getFamilyState();
}

export async function removeAllowedVideo(videoId: string) {
  await supabaseFetch("allowed_videos", {
    method: "PATCH",
    query: `family_id=eq.${encodeURIComponent(familyId)}&youtube_video_id=eq.${encodeURIComponent(videoId)}`,
    body: {
      enabled: false,
    },
  });

  const state = await getFamilyState();

  if (state.currentVideoId === videoId) {
    await patchPlayerControl({
      currentVideoId: state.approvedVideos[0]?.id ?? "",
    });
  }

  return getFamilyState();
}

async function getAllowedVideos() {
  const rows = await supabaseFetch<AllowedVideoRow[]>("allowed_videos", {
    query: `family_id=eq.${encodeURIComponent(familyId)}&enabled=eq.true&select=youtube_video_id,title,channel,duration,duration_minutes,thumbnail,sort_order&order=sort_order.asc`,
  });

  return rows.map(
    (row): Video => ({
      id: row.youtube_video_id,
      title: row.title,
      channel: row.channel,
      duration: row.duration,
      durationMinutes: row.duration_minutes,
      thumbnail: row.thumbnail,
    }),
  );
}

async function getPlayerControl() {
  const rows = await supabaseFetch<PlayerControlRow[]>("player_control", {
    query: `family_id=eq.${encodeURIComponent(familyId)}&select=*`,
  });

  return rows[0] ?? null;
}

async function getTodayWatchProgress(watchDate: string) {
  try {
    const rows = await supabaseFetch<WatchProgressRow[]>("family_watch_progress", {
      query: `family_id=eq.${encodeURIComponent(familyId)}&watch_date=eq.${encodeURIComponent(watchDate)}&select=*`,
    });

    return rows.map(
      (row): WatchProgress => ({
        videoId: row.youtube_video_id,
        progressSeconds: row.progress_seconds,
        durationSeconds: row.duration_seconds,
        completed: row.completed,
        completedAt: row.completed_at,
      }),
    );
  } catch {
    return [];
  }
}

async function getVideoWatchProgress(watchDate: string, videoId: string) {
  try {
    const rows = await supabaseFetch<WatchProgressRow[]>("family_watch_progress", {
      query: `family_id=eq.${encodeURIComponent(familyId)}&watch_date=eq.${encodeURIComponent(watchDate)}&youtube_video_id=eq.${encodeURIComponent(videoId)}&select=*`,
    });

    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function normalizeStatus(control: PlayerControlRow | null): PlayerStatus {
  if (!control) {
    return defaultControl.status;
  }

  const now = Date.now();
  const lockedUntil = control.locked_until
    ? new Date(control.locked_until).getTime()
    : null;

  if (lockedUntil && lockedUntil > now) {
    return "locked";
  }

  return control.status;
}

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nextTaipeiMidnight() {
  const now = new Date();
  const taipeiNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
  );
  taipeiNow.setDate(taipeiNow.getDate() + 1);
  taipeiNow.setHours(0, 0, 0, 0);
  const offsetMs = 8 * 60 * 60 * 1000;

  return new Date(taipeiNow.getTime() - offsetMs);
}

async function supabaseFetch<T = unknown>(
  table: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    query?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const endpoint = new URL(`/rest/v1/${table}`, url);

  if (options.query) {
    endpoint.search = options.query;
  }

  const response = await fetch(endpoint, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
