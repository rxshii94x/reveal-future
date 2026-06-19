import React, { useEffect, useRef } from "react";

interface ChromeGuardianProps {
  scrollProgress: any;
}

function usePingPongVideo(videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;
    let direction: "forward" | "backward" = "forward";
    let lastTime = performance.now();

    video.loop = false;

    const tick = (now: number) => {
      if (!video) return;
      const elapsed = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const duration = video.duration;
      if (duration && !isNaN(duration)) {
        if (direction === "forward") {
          if (video.paused) {
            video.play().catch(() => {});
          }
          if (video.currentTime >= duration - 0.05) {
            direction = "backward";
            video.pause();
          }
        } else {
          let nextTime = video.currentTime - elapsed;
          if (nextTime <= 0.05) {
            nextTime = 0.05;
            direction = "forward";
            video.play().catch(() => {});
          }
          video.currentTime = nextTime;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    const handlePlay = () => {
      lastTime = performance.now();
    };

    video.addEventListener("play", handlePlay);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (video) {
        video.removeEventListener("play", handlePlay);
      }
    };
  }, [videoRef]);
}

export default function ChromeGuardian({ scrollProgress: _ }: ChromeGuardianProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  usePingPongVideo(videoRef);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    console.error("[ChromeGuardian] Video failed to load.", {
      code: video.error?.code,
      message: video.error?.message,
      src: video.currentSrc,
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "black",
        pointerEvents: "none",
      }}
    >
      <video
        ref={videoRef}
        src="https://files.catbox.moe/82f0c8.mp4"
        autoPlay
        muted
        playsInline
        onError={handleError}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "black",
          display: "block",
          opacity: 1,
        }}
      />
    </div>
  );
}

