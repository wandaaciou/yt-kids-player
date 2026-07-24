"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  controlStorageKey,
  defaultControl,
  PlayerControl,
  statusLabel,
} from "../demo-state";

export default function KidsPage() {
  const [control, setControl] = useState<PlayerControl>(defaultControl);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);

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
  const currentVideoIndex = Math.max(
    control.approvedVideos.findIndex((video) => video.id === currentVideo?.id),
    0,
  );
  const isLocked = control.status === "locked";
  const canPlay = currentVideo && control.status === "allowed" && !isLocked;
  const hasMultipleVideos = control.approvedVideos.length > 1;

  useEffect(() => {
    setIsPlaying(false);
  }, [control.currentVideoId, control.status]);

  function sendPlayerCommand(command: "playVideo" | "pauseVideo") {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: command,
        args: [],
      }),
      "*",
    );
  }

  function togglePlayback() {
    if (!canPlay) {
      return;
    }

    const nextIsPlaying = !isPlaying;
    sendPlayerCommand(nextIsPlaying ? "playVideo" : "pauseVideo");
    setIsPlaying(nextIsPlaying);
  }

  function chooseVideo(nextIndex: number) {
    const videoCount = control.approvedVideos.length;

    if (!videoCount || isLocked) {
      return;
    }

    const normalizedIndex = (nextIndex + videoCount) % videoCount;
    const nextVideo = control.approvedVideos[normalizedIndex];

    setControl((current) => {
      const nextControl = {
        ...current,
        currentVideoId: nextVideo.id,
      };

      window.localStorage.setItem(controlStorageKey, JSON.stringify(nextControl));

      return nextControl;
    });
  }

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
        <div className="kid-player-header">
          <div>
            <p className="eyebrow">酸菜觀看頁</p>
            <h1>{currentVideo?.title ?? "今天沒有影片"}</h1>
          </div>
          <div className="kid-time-pill">
            <span>{statusLabel(control.status)}</span>
            <strong>剩 {control.timer} 分鐘</strong>
          </div>
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
                ref={playerRef}
                title={currentVideo.title}
                src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&iv_load_policy=3&controls=0`}
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

        <div className="kid-big-controls" aria-label="酸菜播放控制">
          <button
            className="secondary-kid-control"
            type="button"
            disabled={!hasMultipleVideos || isLocked}
            onClick={() => chooseVideo(currentVideoIndex - 1)}
          >
            上一支
          </button>
          <button
            className="primary-kid-control"
            type="button"
            disabled={!canPlay}
            onClick={togglePlayback}
          >
            {isPlaying ? "暫停影片" : "播放影片"}
          </button>
          <button
            className="secondary-kid-control"
            type="button"
            disabled={!hasMultipleVideos || isLocked}
            onClick={() => chooseVideo(currentVideoIndex + 1)}
          >
            下一支
          </button>
        </div>

        <div className="kid-video-strip">
          {control.approvedVideos.map((video) => (
            <button
              className={video.id === control.currentVideoId ? "selected" : ""}
              key={video.id}
              type="button"
              disabled={isLocked}
              onClick={() =>
                setControl((current) => {
                  const nextControl = {
                    ...current,
                    currentVideoId: video.id,
                  };

                  window.localStorage.setItem(
                    controlStorageKey,
                    JSON.stringify(nextControl),
                  );

                  return nextControl;
                })
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
