import type { PlayerControl, PlayerStatus, Video } from "../../demo-state";
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

export async function getFamilyState() {
  const [videos, control] = await Promise.all([
    getAllowedVideos(),
    getPlayerControl(),
  ]);
  const safeVideos = videos.length ? videos : defaultControl.approvedVideos;
  const safeCurrentVideoId =
    control?.current_video_id ?? safeVideos[0]?.id ?? "";
  const normalizedStatus = normalizeStatus(control);

  return {
    approvedVideos: safeVideos,
    currentVideoId:
      safeVideos.find((video) => video.id === safeCurrentVideoId)?.id ??
      safeVideos[0]?.id ??
      "",
    status: normalizedStatus,
    timer: control?.timer_minutes ?? defaultControl.timer,
    stopAt: control?.stop_at ?? null,
    lockedUntil: control?.locked_until ?? null,
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
      patch.stop_at = new Date(Date.now() + timerMinutes * 60_000).toISOString();
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

function normalizeStatus(control: PlayerControlRow | null): PlayerStatus {
  if (!control) {
    return defaultControl.status;
  }

  const now = Date.now();
  const lockedUntil = control.locked_until
    ? new Date(control.locked_until).getTime()
    : null;
  const stopAt = control.stop_at ? new Date(control.stop_at).getTime() : null;

  if (lockedUntil && lockedUntil > now) {
    return "locked";
  }

  if (stopAt && stopAt <= now) {
    return "locked";
  }

  return control.status;
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
