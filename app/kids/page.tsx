"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  controlStorageKey,
  defaultControl,
  PlayerControl,
  statusLabel,
} from "../demo-state";

export default function KidsPage() {
  const [control, setControl] = useState<PlayerControl>(defaultControl);

  useEffect(() => {
    function readControl() {
      const stored = window.localStorage.getItem(controlStorageKey);
      setControl(stored ? (JSON.parse(stored) as PlayerControl) : defaultControl);
    }

    readControl();

    const intervalId = window.setInterval(readControl, 1000);

    window.addEventListener("storage", readControl);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", readControl);
    };
  }, []);

  const currentVideo =
    control.approvedVideos.find((video) => video.id === control.currentVideoId) ??
    control.approvedVideos[0];
  const isLocked = control.status === "locked";

  return (
    <main className="app-shell kids-shell">
      <nav className="topbar" aria-label="主導覽">
        <div className="brand-mark">
          <span className="play-badge" aria-hidden="true" />
          <strong>Sauncai Kids</strong>
        </div>
        <div className="topbar-search" aria-hidden="true">
          <span>酸菜觀看頁</span>
        </div>
        <Link className="nav-link-button" href="/parent">
          家長設定
        </Link>
      </nav>

      <section className="kid-panel solo-kid-panel">
        <div className="kid-topbar">
          <div>
            <p className="eyebrow">酸菜觀看頁</p>
            <h2>今天可以看</h2>
          </div>
          <span>{statusLabel(control.status)}</span>
        </div>

        <div className="player-frame">
          {currentVideo && !isLocked ? (
            control.status === "paused" ? (
              <div className="lock-screen">
                <strong>暫停中</strong>
                <span>等媽媽說可以再繼續</span>
              </div>
            ) : (
              <iframe
                title={currentVideo.title}
                src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&iv_load_policy=3`}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation"
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
          {control.approvedVideos.map((video) => (
            <button
              className={video.id === control.currentVideoId ? "selected" : ""}
              key={video.id}
              type="button"
              disabled={isLocked}
              onClick={() =>
                setControl((current) => ({
                  ...current,
                  currentVideoId: video.id,
                }))
              }
            >
              <img src={video.thumbnail} alt="" />
              <span>{video.title}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
