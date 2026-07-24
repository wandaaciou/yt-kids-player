"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  defaultControl,
  PlayerControl,
  PlayerStatus,
  searchResults,
  statusLabel,
  Video,
} from "../demo-state";

export default function ParentPage() {
  const [keyword, setKeyword] = useState("佩佩豬");
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [control, setControl] = useState<PlayerControl>(defaultControl);
  const [searchVideos, setSearchVideos] = useState<Video[]>(searchResults);
  const [searchStatus, setSearchStatus] = useState("搜尋 YouTube 中");
  const [searchNonce, setSearchNonce] = useState(0);
  const [cloudStatus, setCloudStatus] = useState("連線雲端中");
  const [pendingVideoIds, setPendingVideoIds] = useState<string[]>([]);
  const [pendingControl, setPendingControl] = useState(false);

  useEffect(() => {
    loadControl();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      searchYouTube(abortController.signal);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [keyword, maxMinutes, trustedOnly, searchNonce]);

  const filteredResults = searchVideos;

  const canAddMore = control.approvedVideos.length < 3;

  async function searchYouTube(signal?: AbortSignal) {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      setSearchVideos([]);
      setSearchStatus("請輸入關鍵字");
      return;
    }

    setSearchStatus("搜尋 YouTube 中");

    try {
      const params = new URLSearchParams({
        q: normalizedKeyword,
        maxMinutes: String(maxMinutes),
        trustedOnly: String(trustedOnly),
      });
      const response = await fetch(`/api/youtube/search?${params}`, {
        signal,
      });

      if (!response.ok) {
        throw new Error("YouTube search failed");
      }

      const data = (await response.json()) as { videos: Video[] };
      setSearchVideos(data.videos);
      setSearchStatus(
        data.videos.length ? "使用真 YouTube 搜尋結果" : "沒有找到符合條件的影片",
      );
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      const fallbackKeyword = keyword.trim().toLowerCase();
      const fallbackVideos = searchResults.filter((video) => {
        const matchesKeyword =
          !fallbackKeyword || video.title.toLowerCase().includes(fallbackKeyword);
        const matchesDuration = video.durationMinutes <= maxMinutes;
        const matchesTrust = !trustedOnly || video.channel.includes("官方");

        return matchesKeyword && matchesDuration && matchesTrust;
      });

      setSearchVideos(fallbackVideos);
      setSearchStatus("YouTube 搜尋失敗，暫用測試資料");
    }
  }

  async function loadControl() {
    try {
      const response = await fetch("/api/family/state");

      if (!response.ok) {
        throw new Error("Cloud state failed");
      }

      setControl((await response.json()) as PlayerControl);
      setCloudStatus("雲端同步中");
    } catch {
      setCloudStatus("尚未建立 Supabase 資料表");
    }
  }

  async function approveVideo(video: Video) {
    const alreadyApproved = control.approvedVideos.some(
      (item) => item.id === video.id,
    );

    if (alreadyApproved || !canAddMore || pendingVideoIds.includes(video.id)) {
      return;
    }

    setPendingVideoIds((ids) => [...ids, video.id]);
    setCloudStatus("加入影片中");

    try {
      const response = await fetch("/api/family/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(video),
      });

      if (response.ok) {
        setControl((await response.json()) as PlayerControl);
        setCloudStatus("雲端同步中");
      } else {
        setCloudStatus("雲端寫入失敗");
      }
    } finally {
      setPendingVideoIds((ids) => ids.filter((id) => id !== video.id));
    }
  }

  async function removeVideo(videoId: string) {
    if (pendingVideoIds.includes(videoId)) {
      return;
    }

    setPendingVideoIds((ids) => [...ids, videoId]);
    setCloudStatus("移除影片中");

    try {
      const response = await fetch(
        `/api/family/videos?id=${encodeURIComponent(videoId)}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        setControl((await response.json()) as PlayerControl);
        setCloudStatus("雲端同步中");
      } else {
        setCloudStatus("雲端移除失敗");
      }
    } finally {
      setPendingVideoIds((ids) => ids.filter((id) => id !== videoId));
    }
  }

  async function updateControl(input: {
    status?: PlayerStatus;
    currentVideoId?: string;
    timer?: number;
  }) {
    if (pendingControl) {
      return;
    }

    setPendingControl(true);
    setCloudStatus("更新控制中");

    try {
      const response = await fetch("/api/family/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        setControl((await response.json()) as PlayerControl);
        setCloudStatus("雲端同步中");
      } else {
        setCloudStatus("雲端更新失敗");
      }
    } finally {
      setPendingControl(false);
    }
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
        <Link className="nav-link-button" href="/kids">
          看酸菜頁
        </Link>
      </nav>

      <section className="hero-band">
        <div>
          <p className="eyebrow">家長設定頁</p>
          <h1>搜尋影片，核准酸菜今天可以看的內容。</h1>
        </div>
        <div className="status-strip" aria-live="polite">
          <span>已核准 {control.approvedVideos.length}/3</span>
          <span>{statusLabel(control.status)}</span>
          <span>倒數 {control.timer} 分鐘</span>
          <span>{cloudStatus}</span>
        </div>
      </section>

      <section className="workspace-grid parent-route">
        <div className="parent-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">家長手機</p>
              <h2>YouTube 搜尋審核</h2>
            </div>
            <span className="search-status">{searchStatus}</span>
          </div>

          <div className="search-row">
            <label htmlFor="keyword">關鍵字</label>
            <div className="search-input-group">
              <input
                id="keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <button type="button" onClick={() => setSearchNonce((value) => value + 1)}>
                重新搜尋
              </button>
            </div>
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
              const approved = control.approvedVideos.some(
                (item) => item.id === video.id,
              );
              const pending = pendingVideoIds.includes(video.id);

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
                    disabled={approved || !canAddMore || pending}
                    onClick={() => approveVideo(video)}
                  >
                    {pending ? "加入中" : approved ? "已加入" : "允許"}
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
            <button
              type="button"
              disabled={pendingControl}
              onClick={() => updateControl({ status: "allowed" })}
            >
              繼續
            </button>
            <button
              type="button"
              disabled={pendingControl}
              onClick={() => updateControl({ status: "paused" })}
            >
              暫停
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={pendingControl}
              onClick={() => updateControl({ status: "locked" })}
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
              value={control.timer}
              onChange={(event) =>
                updateControl({ timer: Number(event.target.value) })
              }
            />
            <strong>{control.timer}</strong>
          </label>

          <div className="approved-list">
            {control.approvedVideos.map((video) => (
              <article
                className={
                  video.id === control.currentVideoId
                    ? "approved-item active"
                    : "approved-item"
                }
                key={video.id}
              >
                <button
                  type="button"
                  disabled={pendingControl}
                  onClick={() => updateControl({ currentVideoId: video.id })}
                >
                  {video.title}
                </button>
                <button
                  type="button"
                  disabled={pendingVideoIds.includes(video.id)}
                  onClick={() => removeVideo(video.id)}
                >
                  {pendingVideoIds.includes(video.id) ? "移除中" : "移除"}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
