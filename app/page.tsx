"use client";

import { useMemo, useState } from "react";

type Video = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  durationMinutes: number;
  thumbnail: string;
};

type PlayerStatus = "allowed" | "paused" | "locked";

const searchResults: Video[] = [
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

export default function Home() {
  const [keyword, setKeyword] = useState("佩佩豬");
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [approvedVideos, setApprovedVideos] = useState<Video[]>([
    searchResults[0],
  ]);
  const [currentVideoId, setCurrentVideoId] = useState(searchResults[0].id);
  const [status, setStatus] = useState<PlayerStatus>("allowed");
  const [timer, setTimer] = useState(15);

  const filteredResults = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return searchResults.filter((video) => {
      const matchesKeyword =
        !normalizedKeyword ||
        video.title.toLowerCase().includes(normalizedKeyword);
      const matchesDuration = video.durationMinutes <= maxMinutes;
      const matchesTrust =
        !trustedOnly || video.channel.includes("官方");

      return matchesKeyword && matchesDuration && matchesTrust;
    });
  }, [keyword, maxMinutes, trustedOnly]);

  const currentVideo =
    approvedVideos.find((video) => video.id === currentVideoId) ??
    approvedVideos[0];
  const canAddMore = approvedVideos.length < 3;
  const isLocked = status === "locked";

  function approveVideo(video: Video) {
    const alreadyApproved = approvedVideos.some((item) => item.id === video.id);

    if (alreadyApproved || !canAddMore) {
      return;
    }

    setApprovedVideos((videos) => [...videos, video]);
    setStatus("allowed");
    setCurrentVideoId(video.id);
  }

  function removeVideo(videoId: string) {
    setApprovedVideos((videos) => {
      const nextVideos = videos.filter((video) => video.id !== videoId);

      if (currentVideoId === videoId) {
        setCurrentVideoId(nextVideos[0]?.id ?? "");
      }

      return nextVideos;
    });
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="主導覽">
        <div className="brand-mark">
          <span className="play-badge" aria-hidden="true" />
          <strong>Sauncai Kids</strong>
        </div>
        <div className="topbar-search" aria-hidden="true">
          <span>{keyword}</span>
        </div>
        <button className="profile-button" type="button">
          家長
        </button>
      </nav>

      <section className="hero-band">
        <div>
          <p className="eyebrow">酸菜播放器</p>
          <h1>家長選片，孩子只看核准清單。</h1>
        </div>
        <div className="status-strip" aria-live="polite">
          <span>已核准 {approvedVideos.length}/3</span>
          <span>{statusLabel(status)}</span>
          <span>倒數 {timer} 分鐘</span>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="parent-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">家長手機</p>
              <h2>YouTube 搜尋審核</h2>
            </div>
            <button className="ghost-button" type="button">
              登入家長帳號
            </button>
          </div>

          <div className="search-row">
            <label htmlFor="keyword">關鍵字</label>
            <input
              id="keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>

          <div className="filter-bar" aria-label="搜尋篩選">
            <label>
              <span>長度</span>
              <select
                value={maxMinutes}
                onChange={(event) => setMaxMinutes(Number(event.target.value))}
              >
                <option value={10}>10 分鐘內</option>
                <option value={20}>20 分鐘內</option>
                <option value={30}>30 分鐘內</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={trustedOnly}
                onChange={(event) => setTrustedOnly(event.target.checked)}
              />
              <span>只看官方頻道</span>
            </label>
          </div>

          <div className="result-list">
            {filteredResults.map((video) => {
              const approved = approvedVideos.some(
                (item) => item.id === video.id,
              );

              return (
                <article className="video-row" key={video.id}>
                  <img src={video.thumbnail} alt="" />
                  <div>
                    <h3>{video.title}</h3>
                    <p>{video.channel}</p>
                    <span>{video.duration}</span>
                  </div>
                  <button
                    type="button"
                    disabled={approved || !canAddMore}
                    onClick={() => approveVideo(video)}
                  >
                    {approved ? "已加入" : "允許"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div className="control-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">即時控制</p>
              <h2>播放狀態</h2>
            </div>
          </div>

          <div className="button-grid">
            <button type="button" onClick={() => setStatus("allowed")}>
              繼續
            </button>
            <button type="button" onClick={() => setStatus("paused")}>
              暫停
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => setStatus("locked")}
            >
              今天結束
            </button>
          </div>

          <label className="timer-control">
            <span>倒數分鐘</span>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={timer}
              onChange={(event) => setTimer(Number(event.target.value))}
            />
            <strong>{timer}</strong>
          </label>

          <div className="approved-list">
            {approvedVideos.map((video) => (
              <article
                className={
                  video.id === currentVideoId
                    ? "approved-item active"
                    : "approved-item"
                }
                key={video.id}
              >
                <button type="button" onClick={() => setCurrentVideoId(video.id)}>
                  {video.title}
                </button>
                <button type="button" onClick={() => removeVideo(video.id)}>
                  移除
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="kid-panel">
          <div className="kid-topbar">
            <div>
              <p className="eyebrow">酸菜平板</p>
              <h2>今天可以看</h2>
            </div>
            <span>{statusLabel(status)}</span>
          </div>

          <div className="player-frame">
            {currentVideo && !isLocked ? (
              status === "paused" ? (
                <div className="lock-screen">
                  <strong>暫停中</strong>
                  <span>等媽媽說可以再繼續</span>
                </div>
              ) : (
                <iframe
                  title={currentVideo.title}
                  src={`https://www.youtube.com/embed/${currentVideo.id}?rel=0&modestbranding=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <div className="lock-screen">
                <strong>今天先休息</strong>
                <span>明天再一起選影片</span>
              </div>
            )}
          </div>

          <div className="kid-video-strip">
            {approvedVideos.map((video) => (
              <button
                className={video.id === currentVideoId ? "selected" : ""}
                key={video.id}
                type="button"
                disabled={isLocked}
                onClick={() => setCurrentVideoId(video.id)}
              >
                <img src={video.thumbnail} alt="" />
                <span>{video.title}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: PlayerStatus) {
  if (status === "paused") {
    return "暫停中";
  }

  if (status === "locked") {
    return "已關閉";
  }

  return "可播放";
}
