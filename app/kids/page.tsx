"use client";

import { useEffect, useRef, useState } from "react";
import {
  defaultControl,
  type PlayerControl,
} from "../demo-state";

export default function KidsPage() {
  const [control, setControl] = useState<PlayerControl>(defaultControl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playerShellRef = useRef<HTMLElement>(null);
  const previousStatusRef = useRef(control.status);
  const controlsTimerRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef(false);
  const progressTimerRef = useRef<number | null>(null);
  const lastProgressSyncRef = useRef(0);
  const latestProgressRef = useRef({
    progressSeconds: 0,
    durationSeconds: 0,
  });

  useEffect(() => {
    readControl();

    const intervalId = window.setInterval(readControl, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  async function readControl() {
    try {
      const response = await fetch("/api/family/state", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Cloud state failed");
      }

      setControl((await response.json()) as PlayerControl);
    } catch {
      setControl(defaultControl);
    }
  }

  const currentVideo =
    control.approvedVideos.find((video) => video.id === control.currentVideoId) ??
    control.approvedVideos[0];
  const currentVideoIndex = Math.max(
    control.approvedVideos.findIndex((video) => video.id === currentVideo?.id),
    0,
  );
  const isLocked = control.status === "locked";
  const canPlay = currentVideo && control.status === "allowed" && !isLocked;
  const currentProgress = control.watchProgress?.find(
    (progress) => progress.videoId === currentVideo?.id,
  );

  useEffect(() => {
    if (!autoAdvanceRef.current) {
      setIsPlaying(false);
      revealControls();
      return;
    }

    autoAdvanceRef.current = false;
    const playNextId = window.setTimeout(() => {
      sendPlayerCommand("playVideo");
      setIsPlaying(true);
      revealControls(true);
    }, 650);

    return () => {
      window.clearTimeout(playNextId);
    };
  }, [control.currentVideoId]);

  useEffect(() => {
    if (isPlaying && control.status === "allowed") {
      revealControls(true);
      return;
    }

    revealControls();
  }, [isPlaying, control.status]);

  useEffect(() => {
    return () => {
      clearControlsTimer();
      clearProgressTimer();
    };
  }, []);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = control.status;

    if (!currentVideo || isLocked || control.status === "paused") {
      sendPlayerCommand("pauseVideo");
      saveCurrentProgress({ immediate: true });
      setIsPlaying(false);
      revealControls();
      return;
    }

    if (control.status === "allowed" && previousStatus === "paused") {
      const quickResumeId = window.setTimeout(() => {
        sendPlayerCommand("playVideo");
      }, 120);
      const fallbackResumeId = window.setTimeout(() => {
        sendPlayerCommand("playVideo");
        setIsPlaying(true);
        revealControls(true);
      }, 650);

      return () => {
        window.clearTimeout(quickResumeId);
        window.clearTimeout(fallbackResumeId);
      };
    }
  }, [control.status, currentVideo?.id, isLocked]);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === playerShellRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    function handlePlayerMessage(event: MessageEvent) {
      if (
        typeof event.origin !== "string" ||
        !event.origin.includes("youtube-nocookie.com")
      ) {
        return;
      }

      const data =
        typeof event.data === "string" ? safeParsePlayerEvent(event.data) : event.data;
      const playerState = data?.info?.playerState ?? data?.playerState;

      if (typeof data?.info?.currentTime === "number") {
        latestProgressRef.current.progressSeconds = data.info.currentTime;
      }

      if (typeof data?.info?.duration === "number") {
        latestProgressRef.current.durationSeconds = data.info.duration;
      }

      if (shouldMarkComplete()) {
        playNextVideo();
        return;
      }

      if (isPlaying && control.status === "allowed") {
        saveCurrentProgress();
      }

      if (playerState === 0) {
        playNextVideo();
      }
    }

    window.addEventListener("message", handlePlayerMessage);

    return () => {
      window.removeEventListener("message", handlePlayerMessage);
    };
  }, [control.status, currentVideo?.id, isPlaying]);

  useEffect(() => {
    if (!currentVideo || control.status !== "allowed") {
      clearProgressTimer();
      return;
    }

    clearProgressTimer();
    progressTimerRef.current = window.setInterval(() => {
      sendPlayerCommand("getCurrentTime");
      sendPlayerCommand("getDuration");
      saveCurrentProgress();
    }, 3000);

    return () => {
      clearProgressTimer();
    };
  }, [control.status, currentVideo?.id]);

  useEffect(() => {
    latestProgressRef.current = {
      progressSeconds: currentProgress?.progressSeconds ?? 0,
      durationSeconds: currentProgress?.durationSeconds ?? 0,
    };
  }, [
    currentProgress?.durationSeconds,
    currentProgress?.progressSeconds,
    currentVideo?.id,
  ]);

  useEffect(() => {
    if (!currentVideo || currentProgress?.completed) {
      return;
    }

    const resumeSeconds = currentProgress?.progressSeconds ?? 0;

    if (resumeSeconds < 5) {
      return;
    }

    const resumeId = window.setTimeout(() => {
      sendPlayerCommand("seekTo", [resumeSeconds, true]);
    }, 800);

    return () => {
      window.clearTimeout(resumeId);
    };
  }, [currentProgress?.completed, currentProgress?.progressSeconds, currentVideo?.id]);

  function sendPlayerCommand(
    command:
      | "playVideo"
      | "pauseVideo"
      | "seekTo"
      | "getCurrentTime"
      | "getDuration",
    args: unknown[] = [],
  ) {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: command,
        args,
      }),
      "*",
    );
  }

  function safeParsePlayerEvent(data: string) {
    try {
      return JSON.parse(data) as {
        info?: {
          currentTime?: number;
          duration?: number;
          playerState?: number;
        };
        playerState?: number;
      };
    } catch {
      return null;
    }
  }

  function clearControlsTimer() {
    if (controlsTimerRef.current === null) {
      return;
    }

    window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = null;
  }

  function clearProgressTimer() {
    if (progressTimerRef.current === null) {
      return;
    }

    window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }

  function revealControls(autoHide = false) {
    clearControlsTimer();
    setControlsVisible(true);

    if (!autoHide) {
      return;
    }

    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsTimerRef.current = null;
    }, 5000);
  }

  function togglePlayback() {
    if (!canPlay) {
      return;
    }

    const nextIsPlaying = !isPlaying;
    sendPlayerCommand(nextIsPlaying ? "playVideo" : "pauseVideo");
    if (!nextIsPlaying) {
      saveCurrentProgress({ immediate: true });
    }
    setIsPlaying(nextIsPlaying);
    revealControls(nextIsPlaying);
  }

  function chooseVideo(nextIndex: number, autoPlay = false) {
    const videoCount = control.approvedVideos.length;

    if (!videoCount || isLocked) {
      return;
    }

    const normalizedIndex = (nextIndex + videoCount) % videoCount;
    const nextVideo = control.approvedVideos[normalizedIndex];

    autoAdvanceRef.current = autoPlay;
    revealControls();
    updateControl({ currentVideoId: nextVideo.id });
  }

  function playNextVideo() {
    if (control.status !== "allowed" || !currentVideo) {
      setIsPlaying(false);
      revealControls();
      return;
    }

    saveCurrentProgress({ completed: true, immediate: true });
  }

  function shouldMarkComplete() {
    const { durationSeconds, progressSeconds } = latestProgressRef.current;

    return durationSeconds > 0 && progressSeconds >= durationSeconds * 0.9;
  }

  async function saveCurrentProgress({
    completed = false,
    immediate = false,
  }: {
    completed?: boolean;
    immediate?: boolean;
  } = {}) {
    if (!currentVideo) {
      return;
    }

    const now = Date.now();

    if (!completed && !immediate && now - lastProgressSyncRef.current < 10_000) {
      return;
    }

    lastProgressSyncRef.current = now;
    const response = await fetch("/api/family/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: currentVideo.id,
        progressSeconds: Math.floor(latestProgressRef.current.progressSeconds),
        durationSeconds: Math.floor(latestProgressRef.current.durationSeconds),
        completed,
      }),
    });

    if (response.ok) {
      const nextControl = (await response.json()) as PlayerControl;
      autoAdvanceRef.current =
        completed && nextControl.currentVideoId !== currentVideo.id;
      setControl(nextControl);
    }
  }

  async function updateControl(input: { currentVideoId: string }) {
    const response = await fetch("/api/family/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.ok) {
      setControl((await response.json()) as PlayerControl);
    }
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

  function handlePlayerFrameClick() {
    if (isPlaying && !controlsVisible) {
      revealControls(true);
    }
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
          </div>

          <div className="player-frame" onClick={handlePlayerFrameClick}>
            {currentVideo && !isLocked ? (
              <>
                <iframe
                  ref={playerRef}
                  title={currentVideo.title}
                  src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&iv_load_policy=3&controls=0`}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  onLoad={() => {
                    sendPlayerCommand("getCurrentTime");
                    sendPlayerCommand("getDuration");
                  }}
                />
                {control.status === "paused" ? (
                  <div className="lock-screen pause-screen">
                    <strong>暫停中</strong>
                    <span>等媽媽說可以再繼續</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="lock-screen">
                <strong>今天先休息</strong>
                <span>明天再一起選影片</span>
              </div>
            )}
          </div>

          <div
            className={
              controlsVisible
                ? "kid-big-controls"
                : "kid-big-controls controls-hidden"
            }
            aria-label="酸菜播放控制"
          >
            <button
              className="primary-kid-control"
              type="button"
              disabled={!canPlay}
              onClick={togglePlayback}
            >
              {isPlaying ? "暫停影片" : "播放影片"}
            </button>
            <button
              className="icon-kid-control"
              type="button"
              aria-label={isFullscreen ? "離開全螢幕" : "全螢幕"}
              title={isFullscreen ? "離開全螢幕" : "全螢幕"}
              onClick={toggleFullscreen}
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                {isFullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
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
              onClick={() => updateControl({ currentVideoId: video.id })}
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
