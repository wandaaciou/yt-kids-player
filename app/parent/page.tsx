"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  controlStorageKey,
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(controlStorageKey);

    if (stored) {
      setControl(JSON.parse(stored) as PlayerControl);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    window.localStorage.setItem(controlStorageKey, JSON.stringify(control));
  }, [control, ready]);

  const filteredResults = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return searchResults.filter((video) => {
      const matchesKeyword =
        !normalizedKeyword ||
        video.title.toLowerCase().includes(normalizedKeyword);
      const matchesDuration = video.durationMinutes <= maxMinutes;
      const matchesTrust = !trustedOnly || video.channel.includes("官方");

      return matchesKeyword && matchesDuration && matchesTrust;
    });
  }, [keyword, maxMinutes, trustedOnly]);

  const canAddMore = control.approvedVideos.length < 3;

  function approveVideo(video: Video) {
    const alreadyApproved = control.approvedVideos.some(
      (item) => item.id === video.id,
    );

    if (alreadyApproved || !canAddMore) {
      return;
    }

    setControl((current) => ({
      ...current,
      approvedVideos: [...current.approvedVideos, video],
      currentVideoId: video.id,
      status: "allowed",
    }));
  }

  function removeVideo(videoId: string) {
    setControl((current) => {
      const nextVideos = current.approvedVideos.filter(
        (video) => video.id !== videoId,
      );
      const nextCurrentVideoId =
        current.currentVideoId === videoId
          ? nextVideos[0]?.id ?? ""
          : current.currentVideoId;

      return {
        ...current,
        approvedVideos: nextVideos,
        currentVideoId: nextCurrentVideoId,
      };
    });
  }

  function setStatus(status: PlayerStatus) {
    setControl((current) => ({ ...current, status }));
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
        </div>
      </section>

      <section className="workspace-grid parent-route">
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
              const approved = control.approvedVideos.some(
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
              value={control.timer}
              onChange={(event) =>
                setControl((current) => ({
                  ...current,
                  timer: Number(event.target.value),
                }))
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
                  onClick={() =>
                    setControl((current) => ({
                      ...current,
                      currentVideoId: video.id,
                    }))
                  }
                >
                  {video.title}
                </button>
                <button type="button" onClick={() => removeVideo(video.id)}>
                  移除
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
