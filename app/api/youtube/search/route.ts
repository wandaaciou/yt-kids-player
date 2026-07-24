import { NextRequest, NextResponse } from "next/server";
import type { Video } from "../../../demo-state";

type YouTubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        high?: {
          url?: string;
        };
        medium?: {
          url?: string;
        };
        default?: {
          url?: string;
        };
      };
    };
    contentDetails?: {
      duration?: string;
    };
    status?: {
      embeddable?: boolean;
    };
  }>;
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() || "佩佩豬";
  const maxMinutes = Number(request.nextUrl.searchParams.get("maxMinutes") ?? 30);
  const trustedOnly = request.nextUrl.searchParams.get("trustedOnly") === "true";

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "id");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("maxResults", "10");
  searchUrl.searchParams.set("safeSearch", "strict");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("regionCode", "TW");
  searchUrl.searchParams.set("relevanceLanguage", "zh-Hant");
  searchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(searchUrl);

  if (!searchResponse.ok) {
    return NextResponse.json(
      { error: "YouTube search failed." },
      { status: searchResponse.status },
    );
  }

  const searchData = (await searchResponse.json()) as YouTubeSearchResponse;
  const videoIds =
    searchData.items
      ?.map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];

  if (!videoIds.length) {
    return NextResponse.json({ videos: [] });
  }

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet,contentDetails,status");
  videosUrl.searchParams.set("id", videoIds.join(","));
  videosUrl.searchParams.set("key", apiKey);

  const videosResponse = await fetch(videosUrl);

  if (!videosResponse.ok) {
    return NextResponse.json(
      { error: "YouTube video details failed." },
      { status: videosResponse.status },
    );
  }

  const videosData = (await videosResponse.json()) as YouTubeVideosResponse;
  const videos =
    videosData.items
      ?.map((item) => {
        const durationSeconds = parseYouTubeDuration(
          item.contentDetails?.duration ?? "PT0S",
        );

        return {
          id: item.id ?? "",
          title: item.snippet?.title ?? "未命名影片",
          channel: item.snippet?.channelTitle ?? "未知頻道",
          duration: formatDuration(durationSeconds),
          durationMinutes: Math.ceil(durationSeconds / 60),
          thumbnail:
            item.snippet?.thumbnails?.high?.url ??
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            "",
          embeddable: item.status?.embeddable === true,
        };
      })
      .filter((video) => video.id && video.embeddable)
      .filter((video) => video.durationMinutes <= maxMinutes)
      .filter((video) => !trustedOnly || isTrustedChannel(video.channel))
      .map(({ embeddable, ...video }): Video => video) ?? [];

  return NextResponse.json({ videos });
}

function parseYouTubeDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return 0;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isTrustedChannel(channel: string) {
  const trustedWords = ["官方", "official", "peppa pig", "粉紅豬小妹"];

  return trustedWords.some((word) =>
    channel.toLowerCase().includes(word.toLowerCase()),
  );
}
