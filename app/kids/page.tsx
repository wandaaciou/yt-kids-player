"use client";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playerShellRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === playerShellRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

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

  async function toggleFullscreen() {
    if (!playerShellRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await playerShellRef.current.requestFullscreen();
  }

  return (
    <main className="app-shell kids-shell">
      <section className="kid-panel solo-kid-panel" ref={playerShellRef}>
        <div className="kid-player-stage">
          <div className="kid-player-header">
            <div>
              <p className="eyebrow">酸菜觀看頁</p>
              <h1>{currentVideo?.title ?? "今天沒有影片"}</h1>
            </div>
            <div className="kid-time-pill">
              <span>{statusLabel(control.status)}</span>
              <strong>剩 {control.timer} 分鐘</strong>
              <button type="button" onClick={toggleFullscreen}>
                {isFullscreen ? "離開全螢幕" : "全螢幕"}
              </button>
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
