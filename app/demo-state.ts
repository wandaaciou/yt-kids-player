export type Video = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  durationMinutes: number;
  thumbnail: string;
};

export type PlayerStatus = "allowed" | "paused" | "locked";

export type PlayerControl = {
  approvedVideos: Video[];
  currentVideoId: string;
  status: PlayerStatus;
  timer: number;
};

export const searchResults: Video[] = [
  {
    id: "mEw1p7tR5o4",
    title: "佩佩豬中文 | 雨天小遊戲",
    channel: "Peppa Pig 中文官方頻道",
    duration: "11:20",
    durationMinutes: 11,
    thumbnail: "https://i.ytimg.com/vi/mEw1p7tR5o4/hqdefault.jpg",
  },
  {
    id: "3m2v1n8yQ2c",
    title: "佩佩豬中文 | 睡前故事合集",
    channel: "Peppa Pig 中文官方頻道",
    duration: "24:05",
    durationMinutes: 24,
    thumbnail: "https://i.ytimg.com/vi/3m2v1n8yQ2c/hqdefault.jpg",
  },
  {
    id: "GdVxO9sWq7Y",
    title: "佩佩豬中文 | 遊樂場的一天",
    channel: "Peppa Pig 中文官方頻道",
    duration: "19:48",
    durationMinutes: 20,
    thumbnail: "https://i.ytimg.com/vi/GdVxO9sWq7Y/hqdefault.jpg",
  },
  {
    id: "z2pWk1rT5Ko",
    title: "佩佩豬中文 | 超長馬拉松合集",
    channel: "兒童卡通合集",
    duration: "1:08:12",
    durationMinutes: 68,
    thumbnail: "https://i.ytimg.com/vi/z2pWk1rT5Ko/hqdefault.jpg",
  },
];

export const defaultControl: PlayerControl = {
  approvedVideos: [searchResults[0]],
  currentVideoId: searchResults[0].id,
  status: "allowed",
  timer: 15,
};

export const controlStorageKey = "yt-kids-player-control";

export function statusLabel(status: PlayerStatus) {
  if (status === "paused") {
    return "暫停中";
  }

  if (status === "locked") {
    return "已關閉";
  }

  return "可播放";
}
