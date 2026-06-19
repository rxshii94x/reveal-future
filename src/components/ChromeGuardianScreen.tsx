import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ChromeGuardianScreenProps {
  onExit?: () => void;
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

export default function ChromeGuardianScreen({ onExit }: ChromeGuardianScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  usePingPongVideo(videoRef);

  // Track whether the user has scrolled at all
  const [hasScrolled, setHasScrolled] = useState(false);
  // Reveal text line by line
  const [line1Opacity, setLine1Opacity] = useState(0);
  const [line2Opacity, setLine2Opacity] = useState(0);
  const [line3Opacity, setLine3Opacity] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // We listen on the container's wheel event (it's a fixed fullscreen)
    // and also on window scroll for touch / trackpad
    let scrollAccum = 0;
    const MAX_SCROLL = 600; // px of accumulated delta to reach full opacity

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!hasScrolled) setHasScrolled(true);

      scrollAccum = Math.max(0, Math.min(MAX_SCROLL, scrollAccum + e.deltaY));
      const progress = scrollAccum / MAX_SCROLL; // 0 → 1

      // Stagger line reveals
      // Line 1: 0 → 0.35
      // Line 2: 0.3 → 0.65
      // Line 3: 0.6 → 1.0
      const l1 = Math.max(0, Math.min(1, progress / 0.35));
      const l2 = Math.max(0, Math.min(1, (progress - 0.3) / 0.35));
      const l3 = Math.max(0, Math.min(1, (progress - 0.6) / 0.4));

      setLine1Opacity(l1);
      setLine2Opacity(l2);
      setLine3Opacity(l3);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [hasScrolled]);

  // Attempt autoplay when mounted
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const playAttempt = video.play();
    if (playAttempt !== undefined) {
      playAttempt.catch(() => {
        // autoplay blocked — still muted so will work on next interaction
      });
    }
  }, []);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(12px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 bg-black z-[60] overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {/* ── VIDEO LAYER ── */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src="https://files.catbox.moe/82f0c8.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
            background: "black",
          }}
        />
      </div>

      {/* ── TEXT REVEAL LAYER (behind nothing, above video via z-index) ── */}
      {/* Text sits BEHIND the video conceptually — but since video has transparent
          bg and fills a contained box, we place text in a separate centered layer
          that is overlaid. Per spec: "reveal text behind the guardian" means the
          guardian (video) stays dominant; text appears at reduced opacity. */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <div className="text-center select-none">
          {/* Line 1 */}
          <motion.p
            style={{ opacity: line1Opacity }}
            transition={{ ease: "easeOut" }}
            className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-light tracking-[0.3em] text-white uppercase leading-none"
          >
            THE FUTURE
          </motion.p>

          {/* Line 2 */}
          <motion.p
            style={{ opacity: line2Opacity }}
            transition={{ ease: "easeOut" }}
            className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-light tracking-[0.3em] text-white uppercase leading-none mt-4"
          >
            HAS A
          </motion.p>

          {/* Line 3 */}
          <motion.p
            style={{ opacity: line3Opacity }}
            transition={{ ease: "easeOut" }}
            className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-light tracking-[0.3em] text-white/80 uppercase leading-none mt-4 italic"
          >
            MEMORY
          </motion.p>
        </div>
      </div>

      {/* ── SCROLL INVITATION (fades out once user starts scrolling) ── */}
      <AnimatePresence>
        {!hasScrolled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ delay: 2.5, duration: 1.5, ease: "easeOut" }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <span className="font-mono text-[9px] tracking-[0.5em] text-white/25 uppercase">
              SCROLL TO REVEAL
            </span>
            {/* Minimal animated line */}
            <motion.div
              animate={{ scaleY: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-[1px] h-8 bg-white/20 origin-top"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP-LEFT BACK BUTTON (minimal, appears after a delay) ── */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        onClick={onExit}
        className="absolute top-8 left-8 font-mono text-[9px] tracking-[0.4em] text-white/20 hover:text-white/60 uppercase transition-colors duration-500 cursor-pointer select-none z-20"
        id="btn-guardian-back"
      >
        ← ARCHIVE
      </motion.button>
    </motion.div>
  );
}
