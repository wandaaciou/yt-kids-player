"use client";

import { useEffect, useRef, useState } from "react";
import { defaultControl, type PlayerControl } from "../demo-state";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeConstructor = new (
  element: HTMLElement,
  options: {
    host: string;
    videoId: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: {
      Player: YouTubeConstructor;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        resolve();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }

  return youtubeApiPromise;
}

export default function KidsPage() {
  const [control, setControl] = useState<PlayerControl>(defaultControl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerShellRef = useRef<HTMLElement>(null);
  const ytPlayerRef = useRef<YouTubePlayer | null>(null);
  const playerReadyRef = useRef(false);
  const previousStatusRef = useRef(control.status);
  const controlsTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const lastProgressSyncRef = useRef(0);
  const autoPlayAfterLoadRef = useRef(false);
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
  const isLocked = control.status === "locked";
  const canPlay = currentVideo && control.status === "allowed" && !isLocked;
  const currentProgress = control.watchProgress?.find(
    (progress) => progress.videoId === currentVideo?.id,
  );

  useEffect(() => {
    if (!currentVideo || !playerContainerRef.current || isLocked) {
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
      playerReadyRef.current = false;
      setIsPlaying(false);
      revealControls();
      return;
    }

    let cancelled = false;
    playerReadyRef.current = false;
    ytPlayerRef.current?.destroy();
    ytPlayerRef.current = null;
    playerContainerRef.current.innerHTML = "";
    setIsPlaying(false);
    revealControls();

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player || !playerContainerRef.current) {
        return;
      }

      ytPlayerRef.current = new window.YT.Player(playerContainerRef.current, {
        host: "https://www.youtube-nocookie.com",
        videoId: currentVideo.id,
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            const resumeSeconds = currentProgress?.completed
              ? 0
              : currentProgress?.progressSeconds ?? 0;

            latestProgressRef.current = {
              progressSeconds: resumeSeconds,
              durationSeconds: currentProgress?.durationSeconds ?? 0,
            };

            if (resumeSeconds >= 5) {
              ytPlayerRef.current?.seekTo(resumeSeconds, true);
            }

            if (autoPlayAfterLoadRef.current && control.status === "allowed") {
              autoPlayAfterLoadRef.current = false;
              ytPlayerRef.current?.playVideo();
              setIsPlaying(true);
              revealControls(true);
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED) {
              markCurrentVideoCompleted();
              return;
            }

            if (event.data === window.YT?.PlayerState.PLAYING) {
              setIsPlaying(true);
              revealControls(true);
              syncLatestProgress();
              return;
            }

            if (event.data === window.YT?.PlayerState.PAUSED) {
              syncLatestProgress();
              saveCurrentProgress({ immediate: true });
              setIsPlaying(false);
              revealControls();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
      playerReadyRef.current = false;
    };
  }, [currentVideo?.id, isLocked]);

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
      syncLatestProgress();
      saveCurrentProgress({ immediate: true });
      ytPlayerRef.current?.pauseVideo();
      setIsPlaying(false);
      revealControls();
      return;
    }

    if (control.status === "allowed" && previousStatus === "paused") {
      ytPlayerRef.current?.playVideo();
      setIsPlaying(true);
      revealControls(true);
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
    if (!currentVideo || control.status !== "allowed" || !isPlaying) {
      clearProgressTimer();
      return;
    }

    clearProgressTimer();
    progressTimerRef.current = window.setInterval(() => {
      syncLatestProgress();

      if (shouldMarkComplete()) {
        markCurrentVideoCompleted();
        return;
      }

      saveCurrentProgress();
    }, 3000);

    return () => {
      clearProgressTimer();
    };
  }, [control.status, currentVideo?.id, isPlaying]);

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

  function syncLatestProgress() {
    if (!ytPlayerRef.current || !playerReadyRef.current) {
      return;
    }

    const progressSeconds = ytPlayerRef.current.getCurrentTime();
    const durationSeconds = ytPlayerRef.current.getDuration();

    latestProgressRef.current = {
      progressSeconds: Number.isFinite(progressSeconds) ? progressSeconds : 0,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    };
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

    if (nextIsPlaying) {
      ytPlayerRef.current?.playVideo();
    } else {
      syncLatestProgress();
      saveCurrentProgress({ immediate: true });
      ytPlayerRef.current?.pauseVideo();
    }

    setIsPlaying(nextIsPlaying);
    revealControls(nextIsPlaying);
  }

  function shouldMarkComplete() {
    const { durationSeconds, progressSeconds } = latestProgressRef.current;

    return durationSeconds > 0 && progressSeconds >= durationSeconds * 0.9;
  }

  function markCurrentVideoCompleted() {
    if (!currentVideo) {
      return;
    }

    syncLatestProgress();
    saveCurrentProgress({ completed: true, immediate: true });
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
      autoPlayAfterLoadRef.current =
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
                <div className="youtube-player-slot" ref={playerContainerRef} />
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
