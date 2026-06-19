import React, { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { ambientSynth } from "../utils/audio";

const TOTAL_FRAMES = 257;
const FRAME_PATH_PREFIX = "/frames/ezgif-frame-";

function getFrameSrc(index: number): string {
  const padded = String(index).padStart(3, "0");
  return `${FRAME_PATH_PREFIX}${padded}.jpg`;
}

export default function ChromeGuardianSequence() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(ImageBitmap | HTMLImageElement)[]>([]);
  const currentFrameRef = useRef(0.0);
  const targetFrameRef = useRef(0.0);
  const lastDrawnFrameRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const scrollAnimRef = useRef<number>(0);
  const isNavigatingRef = useRef(false);
  const lastNavigatedTimeRef = useRef<number>(0);
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [introState, setIntroState] = useState<"inactive" | "revealing" | "dissolving" | "settling" | "completed">("inactive");

  const signatureTriggeredRef = useRef(false);
  const [showSignatureUI, setShowSignatureUI] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const lastScrollProgressRef = useRef(0);
  const scrollDirectionRef = useRef<"down" | "up">("down");
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down");
  const lastChapterRef = useRef(1);

  const triggerSignature = useCallback(() => {
    ambientSynth.playChime();
    ambientSynth.setVolume(0.01);
    setShowSignatureUI(true);

    setTimeout(() => {
      ambientSynth.setVolume(0.35);
    }, 6000);

    setTimeout(() => {
      setShowSignatureUI(false);
    }, 7000);
  }, []);

  // Clean up any body overflow settings
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
  }, []);

  // Concurrent preloader with createImageBitmap for GPU-accelerated drawing
  useEffect(() => {
    let isCancelled = false;
    let loadedCount = 0;
    const items = new Array(TOTAL_FRAMES);
    const MAX_CONCURRENT = 8;
    let currentIndex = 0;
    let activeWorkers = 0;

    const loadNext = async () => {
      if (isCancelled || currentIndex >= TOTAL_FRAMES) return;
      const i = currentIndex++;
      activeWorkers++;

      try {
        const url = getFrameSrc(i + 1);
        const res = await fetch(url, { cache: "force-cache" });
        const blob = await res.blob();

        if (window.createImageBitmap) {
          const bmp = await createImageBitmap(blob);
          if (!isCancelled) items[i] = bmp;
        } else {
          // Fallback for older browsers
          const img = new Image();
          img.src = URL.createObjectURL(blob);
          await img.decode();
          if (!isCancelled) items[i] = img;
        }
      } catch (e) {
        // Ignore individual frame errors, fallback will catch it
      }

      if (isCancelled) return;
      loadedCount++;

      activeWorkers--;
      loadNext();
    };

    for (let w = 0; w < MAX_CONCURRENT; w++) {
      loadNext();
    }

    imagesRef.current = items;
    return () => { isCancelled = true; };
  }, []);

  // Forced cinematic loading progression timing
  useEffect(() => {
    const startTime = performance.now();
    let animationId: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      let progress = 0;

      if (elapsed <= 800) {
        // 0 -> 50 in 0.8 seconds (0.625 ratio per ms)
        progress = (elapsed / 800) * 0.5;
      } else if (elapsed <= 1600) {
        // Hold at 50 for 0.8 seconds
        progress = 0.5;
      } else if (elapsed <= 2100) {
        // 50 -> 99 in 0.5 seconds (0.098 per ms)
        const t = (elapsed - 1600) / 500;
        progress = 0.5 + t * 0.49;
      } else if (elapsed <= 2600) {
        // Hold at 99 for 0.5 seconds
        progress = 0.99;
      } else {
        // 99 -> 100 and continue
        progress = 1.0;
      }

      setLoadProgress(progress);

      if (progress >= 1.0) {
        setAllLoaded(true);
        setIntroState("revealing");
        isNavigatingRef.current = true;
      } else {
        animationId = requestAnimationFrame(tick);
      }
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Intro chapter sequence timing state transitions
  useEffect(() => {
    if (introState === "revealing") {
      const timer = setTimeout(() => {
        setIntroState("dissolving");
      }, 4500); // Reveal and read duration
      return () => clearTimeout(timer);
    } else if (introState === "dissolving") {
      const timer = setTimeout(() => {
        setIntroState("settling");
      }, 1500); // Fade typography to 0 opacity
      return () => clearTimeout(timer);
    } else if (introState === "settling") {
      const timer = setTimeout(() => {
        setIntroState("completed");
        isNavigatingRef.current = false;
      }, 2500); // Overlay dissolves, revealing first frame of sequence
      return () => clearTimeout(timer);
    }
  }, [introState]);



  // Lock scrolling interaction during the introduction phase to secure gallery framing
  useEffect(() => {
    if (allLoaded && introState !== "completed") {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else if (allLoaded && introState === "completed") {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }
  }, [allLoaded, introState]);

  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const floorIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(frameIndex)));
    const ceilIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.ceil(frameIndex)));
    const weight = frameIndex - floorIndex;

    const isImageValid = (image: any) => {
      if (!image) return false;
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) return image.width > 0;
      if (image instanceof HTMLImageElement) return image.complete && image.naturalWidth > 0;
      return false;
    };

    const getValidImage = (index: number) => {
      let img = imagesRef.current[index];
      if (isImageValid(img)) return img;

      for (let i = index - 1; i >= 0; i--) {
        if (isImageValid(imagesRef.current[i])) return imagesRef.current[i];
      }
      for (let i = index + 1; i < TOTAL_FRAMES; i++) {
        if (isImageValid(imagesRef.current[i])) return imagesRef.current[i];
      }
      return null;
    };

    const imgFloor = getValidImage(floorIndex);
    const imgCeil = getValidImage(ceilIndex);

    if (!imgFloor) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth || window.innerWidth;
    const displayH = canvas.clientHeight || window.innerHeight;

    const targetW = displayW * dpr;
    const targetH = displayH * dpr;

    const sizeChanged = canvas.width !== targetW || canvas.height !== targetH;
    const frameDiff = Math.abs(frameIndex - lastDrawnFrameRef.current);

    if (frameDiff < 0.02 && !sizeChanged) {
      return;
    }

    lastDrawnFrameRef.current = frameIndex;

    if (sizeChanged) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const imgW = typeof ImageBitmap !== "undefined" && imgFloor instanceof ImageBitmap ? imgFloor.width : (imgFloor as HTMLImageElement).naturalWidth;
    const imgH = typeof ImageBitmap !== "undefined" && imgFloor instanceof ImageBitmap ? imgFloor.height : (imgFloor as HTMLImageElement).naturalHeight;
    const imgAspect = imgW / imgH;
    const canvasAspect = canvas.width / canvas.height;
    let drawW, drawH, drawX, drawY;

    if (imgAspect > canvasAspect) {
      drawH = canvas.height;
      drawW = canvas.height * imgAspect;
      drawX = (canvas.width - drawW) / 2;
      drawY = 0;
    } else {
      drawW = canvas.width;
      drawH = canvas.width / imgAspect;
      drawX = 0;
      drawY = (canvas.height - drawH) / 2;
    }

    if (imgCeil && floorIndex !== ceilIndex && weight > 0.01) {
      ctx.globalAlpha = 1.0 - weight;
      ctx.drawImage(imgFloor, drawX, drawY, drawW, drawH);

      ctx.globalAlpha = weight;
      ctx.drawImage(imgCeil, drawX, drawY, drawW, drawH);

      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalAlpha = 1.0;
      ctx.drawImage(imgFloor, drawX, drawY, drawW, drawH);
    }

    const roundedFrame = Math.round(frameIndex) + 1;
    const currentChapter = roundedFrame <= 70 ? 1 :
                           roundedFrame <= 135 ? 2 :
                           roundedFrame <= 200 ? 3 : 4;
    const chapterChanged = lastChapterRef.current !== currentChapter;
    lastChapterRef.current = currentChapter;

    if (!isNavigatingRef.current || chapterChanged) {
      flushSync(() => {
        setCurrentFrame(roundedFrame);
      });
    } else {
      setCurrentFrame(roundedFrame);
    }
  }, []);

  useEffect(() => {
    if (!allLoaded) return;

    const getScrollProgressFrame = () => {
      const section = sectionRef.current;
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return 0;
      const progressVal = Math.max(0, Math.min(1, -rect.top / scrollable));
      lastScrollProgressRef.current = progressVal;
      flushSync(() => {
        setScrollProgress(progressVal);
      });

      const frameThresholdProgress = 2000 / 2400;
      if (progressVal <= frameThresholdProgress) {
        const frameProgress = progressVal / frameThresholdProgress;
        return Math.max(0, Math.min(256, frameProgress * (TOTAL_FRAMES - 1)));
      }
      return 256;
    };

    const initialFrame = getScrollProgressFrame();
    currentFrameRef.current = initialFrame;
    targetFrameRef.current = initialFrame;
    drawFrame(initialFrame);

    let lastTime = performance.now();

    function renderLoop(time: number) {
      if (isNavigatingRef.current || Date.now() - lastNavigatedTimeRef.current < 100) {
        rafIdRef.current = 0;
        return;
      }
      const dt = Math.max(0.001, Math.min((time - lastTime) / 1000, 0.1));
      lastTime = time;

      const targetFrame = targetFrameRef.current;
      let currentFrame = currentFrameRef.current;

      const diff = Math.abs(currentFrame - targetFrame);
      const roundedFrame = Math.round(currentFrame);

      if (diff < 0.001) {
        const finalFrame = targetFrame;
        currentFrameRef.current = finalFrame;
        drawFrame(finalFrame);
        rafIdRef.current = 0;

        if (Math.round(finalFrame) >= 246 && !signatureTriggeredRef.current) {
          signatureTriggeredRef.current = true;
          triggerSignature();
        }
        return;
      }

      // Dynamic velocity-aware dampening tuned for premium, slow settling camera inertia
      const distance = Math.abs(targetFrame - currentFrame);
      let baseSpeed = 6.2;
      if (roundedFrame >= 242 && roundedFrame <= 253) {
        baseSpeed = 2.2;
      }

      const speedCoeff = baseSpeed / (1 + distance * 0.02);
      const dampFactor = 1 - Math.exp(-speedCoeff * dt);
      currentFrame += (targetFrame - currentFrame) * dampFactor;

      currentFrameRef.current = currentFrame;

      drawFrame(currentFrame);

      if (Math.round(currentFrame) >= 246 && !signatureTriggeredRef.current) {
        signatureTriggeredRef.current = true;
        triggerSignature();
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    }

    const onScroll = () => {
      if (isNavigatingRef.current) return;
      if (Date.now() - lastNavigatedTimeRef.current < 100) return;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const progressVal = Math.max(0, Math.min(1, -rect.top / scrollable));
      
      const isUpward = progressVal < lastScrollProgressRef.current;
      lastScrollProgressRef.current = progressVal;
      const newDir = isUpward ? "up" : "down";
      if (newDir !== scrollDirectionRef.current) {
        scrollDirectionRef.current = newDir;
        flushSync(() => {
          setScrollDirection(newDir);
        });
      }

      flushSync(() => {
        setScrollProgress(progressVal);
      });

      const frameThresholdProgress = 2000 / 2400;
      let targetFrame = 256;
      if (progressVal <= frameThresholdProgress) {
        const frameProgress = progressVal / frameThresholdProgress;
        targetFrame = Math.max(0, Math.min(256, frameProgress * (TOTAL_FRAMES - 1)));
      }
      targetFrameRef.current = targetFrame;

      if (!rafIdRef.current) {
        lastTime = performance.now();
        rafIdRef.current = requestAnimationFrame(renderLoop);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
      }
    };
  }, [allLoaded, drawFrame, triggerSignature]);

  const progress = currentFrame > 0 ? (currentFrame - 1) / (TOTAL_FRAMES - 1) : 0;

  const frameThresholdProgress = 2000 / 2400;
  const endingProgress = scrollProgress > frameThresholdProgress
    ? (scrollProgress - frameThresholdProgress) / (1 - frameThresholdProgress)
    : 0;

  const activeChapter = currentFrame <= 70 ? 1 :
                        currentFrame <= 135 ? 2 :
                        currentFrame <= 200 ? 3 : 4;

  const indicatorOpacity = (introState !== "completed" || showSignatureUI) 
    ? 0.0 
    : (endingProgress > 0 ? Math.max(0, 1 - endingProgress / 0.4) : 1.0);

  const navigateToChapter = (chapter: number) => {
    const section = sectionRef.current;
    if (!section) return;

    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;

    let targetFrame = 0;
    if (chapter === 1) targetFrame = 50;
    else if (chapter === 2) targetFrame = 130;
    else if (chapter === 3) targetFrame = 190;
    else if (chapter === 4) targetFrame = 245;

    const frameThresholdProgress = 2000 / 2400;
    const frameProgress = targetFrame / (TOTAL_FRAMES - 1);
    const progressVal = frameProgress * frameThresholdProgress;
    const targetScrollTop = progressVal * scrollable;

    // Custom smooth scroll animation
    const startY = window.scrollY;
    const distance = targetScrollTop - startY;

    // Adapting duration based on distance: short jumps feel elegant, long jumps feel cinematic
    const minDuration = 2400; // ms
    const maxDuration = 4800; // ms
    const distanceRatio = scrollable > 0 ? Math.min(1, Math.abs(distance) / scrollable) : 0;
    const duration = minDuration + distanceRatio * (maxDuration - minDuration);

    let startTime: number | null = null;

    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }

    // Bypass browser CSS smooth scroll override to make programmatic scrolling immediate and precise
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";

    isNavigatingRef.current = true;

    const handleUserInterrupt = () => {
      isNavigatingRef.current = false;
      lastNavigatedTimeRef.current = Date.now();
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = 0;
      }
      cleanupListeners();
    };

    const cleanupListeners = () => {
      document.documentElement.style.scrollBehavior = originalScrollBehavior;
      window.removeEventListener("wheel", handleUserInterrupt);
      window.removeEventListener("touchstart", handleUserInterrupt);
      window.removeEventListener("pointerdown", handleUserInterrupt);
      window.removeEventListener("keydown", handleUserInterrupt);
    };

    window.addEventListener("wheel", handleUserInterrupt, { passive: true });
    window.addEventListener("touchstart", handleUserInterrupt, { passive: true });
    window.addEventListener("pointerdown", handleUserInterrupt, { passive: true });
    window.addEventListener("keydown", handleUserInterrupt, { passive: true });

    const animateScroll = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: cubic ease-in-out for slow acceleration, natural momentum, and gradual deceleration
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentScrollY = startY + distance * easeProgress;
      window.scrollTo(0, currentScrollY);

      // Mathematically synchronize the exact frame display in the same render frame
      const currentProgressVal = Math.max(0, Math.min(1, currentScrollY / scrollable));
      
      const isUpward = currentProgressVal < lastScrollProgressRef.current;
      lastScrollProgressRef.current = currentProgressVal;
      const newDir = isUpward ? "up" : "down";
      if (newDir !== scrollDirectionRef.current) {
        scrollDirectionRef.current = newDir;
        flushSync(() => {
          setScrollDirection(newDir);
        });
      }

      // Avoid flushSync on every single frame during programmatic travel
      if (progress === 1) {
        flushSync(() => {
          setScrollProgress(currentProgressVal);
        });
      } else {
        setScrollProgress(currentProgressVal);
      }

      let currentTargetFrame = 256;
      if (currentProgressVal <= frameThresholdProgress) {
        const currentFrameProgress = currentProgressVal / frameThresholdProgress;
        currentTargetFrame = Math.max(0, Math.min(256, currentFrameProgress * (TOTAL_FRAMES - 1)));
      }

      currentFrameRef.current = currentTargetFrame;
      targetFrameRef.current = currentTargetFrame;
      drawFrame(currentTargetFrame);

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(animateScroll);
      } else {
        isNavigatingRef.current = false;
        lastNavigatedTimeRef.current = Date.now();
        scrollAnimRef.current = 0;
        cleanupListeners();
        // Force final drawFrame to synchronize target state
        drawFrame(currentTargetFrame);
      }
    };

    scrollAnimRef.current = requestAnimationFrame(animateScroll);
  };

  return (
    <div ref={sectionRef} style={{ position: "relative", width: "100%", height: "2400vh", background: "#000", display: "block" }}>
       <style>{`
        @keyframes navFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        .museum-navigation {
          animation: navFadeIn 2000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes spotlightReveal {
          0% {
            opacity: 1;
            background: radial-gradient(circle at 35% 35%, transparent 10%, rgba(0, 0, 0, 0.85) 45%, #000000 80%);
          }
          40% {
            opacity: 0.9;
            background: radial-gradient(circle at 50% 45%, transparent 25%, rgba(0, 0, 0, 0.7) 55%, #000000 90%);
          }
          100% {
            opacity: 0;
            background: radial-gradient(circle at 60% 50%, transparent 50%, rgba(0, 0, 0, 0) 80%, #000000 100%);
          }
        }
        .museum-spotlight-reveal {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 14;
          animation: spotlightReveal 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .stage-section {
          transition: opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1),
                      filter 1200ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, filter;
        }
        .narrative-step {
          transition: opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1),
                      filter 1000ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, filter;
        }
        .phase-heading {
          will-change: opacity, filter, transform;
          transition: filter 80ms linear;
          text-shadow:
            0 1px 2px rgba(0, 0, 0, 0.65),
            0 4px 12px rgba(0, 0, 0, 0.25),
            0 8px 32px rgba(0, 0, 0, 0.12);
        }
        .narrative-text-reveal {
          will-change: opacity, filter, transform;
          transition: filter 80ms linear;
          text-shadow:
            0 1px 2px rgba(0, 0, 0, 0.4),
            0 3px 8px rgba(0, 0, 0, 0.12);
        }
        @media (min-width: 768px) {
          .md-row-1 {
            grid-row-start: 1;
          }
        }

        /* Final phase cinematic focus system */
        .finale-focus-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 16;
          background: radial-gradient(
            ellipse 65% 60% at 75% 50%,
            transparent 0%,
            transparent 35%,
            rgba(0, 0, 0, 0.25) 70%,
            rgba(0, 0, 0, 0.5) 100%
          );
          transition: opacity 1800ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .finale-canvas-dim {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9;
          background: #000;
          transition: opacity 2000ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes signatureSweep {
          0% {
            background-position: -200% 0;
            opacity: 0;
          }
          15% {
            opacity: 0.45;
          }
          85% {
            opacity: 0.45;
          }
          100% {
            background-position: 200% 0;
            opacity: 0;
          }
        }
        .signature-sweep-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 15;
          mix-blend-mode: screen;
          background: linear-gradient(
            115deg,
            transparent 0%,
            transparent 42%,
            rgba(255, 255, 255, 0.12) 48%,
            rgba(255, 255, 255, 0.28) 50%,
            rgba(255, 255, 255, 0.12) 52%,
            transparent 58%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: signatureSweep 4.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .signature-alignment-line {
          width: 0%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12) 50%, transparent);
          transition: width 3500ms cubic-bezier(0.25, 1, 0.5, 1);
        }
        .signature-alignment-line.active {
          width: 100%;
        }
        .typo-depth-hero {
          text-shadow:
            0 1px 3px rgba(0, 0, 0, 0.7),
            0 4px 16px rgba(0, 0, 0, 0.22),
            0 8px 40px rgba(0, 0, 0, 0.1);
        }

        /* Premium Archive Progress Indicator */
        .archive-indicator {
          position: fixed;
          right: 32px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          z-index: 30;
          pointer-events: none;
          user-select: none;
          will-change: opacity;
        }
        @media (min-width: 768px) {
          .archive-indicator {
            right: 64px;
          }
        }
        .archive-indicator-title {
          font-family: "Cinzel", Georgia, serif;
          font-size: 9px;
          font-weight: 300;
          letter-spacing: 0.35em;
          color: rgba(255, 255, 255, 0.22);
          text-transform: uppercase;
          margin-bottom: 24px;
          display: block;
          text-align: right;
        }
        .archive-indicator-list {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 16px;
          pointer-events: auto;
        }
        .archive-indicator-item {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          position: relative;
          cursor: pointer;
        }
        .archive-indicator-number {
          font-family: "Space Grotesk", sans-serif;
          font-size: 11px;
          font-weight: 300;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.15);
          transition: color 1200ms cubic-bezier(0.22, 1, 0.36, 1);
          display: block;
          position: relative;
          z-index: 2;
        }
        .archive-indicator-line {
          width: 1px;
          height: 14px;
          background-color: rgba(255, 255, 255, 0.85);
          opacity: 0;
          transform: scaleY(0);
          transform-origin: center;
          transition: opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1),
                      transform 1200ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .archive-indicator-glow {
          position: absolute;
          right: -10px;
          top: 50%;
          transform: translate(50%, -50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0) 70%);
          opacity: 0;
          transition: opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
          z-index: 1;
        }
        .archive-indicator-item.active .archive-indicator-number {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 400;
        }
        .archive-indicator-item.active .archive-indicator-line {
          opacity: 0.85;
          transform: scaleY(1);
        }
        .archive-indicator-item.active .archive-indicator-glow {
          opacity: 1;
        }
        .archive-indicator-item:hover .archive-indicator-number {
          color: rgba(255, 255, 255, 0.45);
        }
        .archive-indicator-item.active:hover .archive-indicator-number {
          color: rgba(255, 255, 255, 0.9);
        }

        /* Cinematic Introduction Styles */
        .intro-black-overlay {
          position: fixed;
          inset: 0;
          background-color: #000000;
          z-index: 44;
          pointer-events: none;
        }
        .intro-text-container {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          z-index: 45;
          max-width: 480px;
          pointer-events: none;
          user-select: none;
        }
        @keyframes introLineReveal {
          0% {
            opacity: 0;
            filter: blur(10px);
            transform: scale(0.97);
          }
          100% {
            opacity: 1;
            filter: blur(0px);
            transform: scale(1);
          }
        }
        .intro-title-line {
          font-family: "Cinzel", Georgia, serif;
          font-size: 24px;
          font-weight: 300;
          letter-spacing: 0.3em;
          color: rgba(255, 255, 255, 0.9);
          text-transform: uppercase;
          opacity: 0;
          animation: introLineReveal 2000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 200ms;
        }
        @media (min-width: 768px) {
          .intro-title-line {
            font-size: 32px;
          }
        }
        .intro-body-line {
          font-family: "Cinzel", Georgia, serif;
          font-style: italic;
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.15em;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.8;
          opacity: 0;
          animation: introLineReveal 2000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 1100ms;
        }
        @media (min-width: 768px) {
          .intro-body-line {
            font-size: 15px;
          }
        }

        /* Left Annotation Styles */
        .archive-annotation {
          position: fixed;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          gap: 16px;
          z-index: 35;
          max-width: 360px;
          pointer-events: none;
          user-select: none;
        }
        @media (min-width: 768px) {
          .archive-annotation {
            left: 64px;
          }
        }
        .annotation-header {
          font-family: "Space Grotesk", sans-serif;
          font-size: 10px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          opacity: 0;
          animation: annotationHeaderReveal 2.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 0.2s;
        }
        .annotation-title {
          font-family: "Cinzel", Georgia, serif;
          font-size: 24px;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.9);
          text-transform: uppercase;
          margin: 0;
          opacity: 0;
          animation: annotationTitleReveal 2.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 0.7s;
        }
        @media (min-width: 768px) {
          .annotation-title {
            font-size: 32px;
          }
        }
        .annotation-body {
          font-family: "Cinzel", Georgia, serif;
          font-style: italic;
          font-size: 13px;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          opacity: 0;
          animation: annotationBodyReveal 2.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 1.2s;
        }
        @media (min-width: 768px) {
          .annotation-body {
            font-size: 15px;
          }
        }

        /* Museum-style scroll cue */
        .archive-scroll-cue-container {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          opacity: 0;
          animation: scrollCueFadeIn 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 2.4s;
        }
        .archive-scroll-cue-line {
          position: relative;
          width: 1px;
          height: 48px;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.05) 100%);
        }
        .archive-scroll-cue-dot {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.8);
          animation: scrollCueDotMovement 5s cubic-bezier(0.25, 0, 0.25, 1) infinite;
        }

        @keyframes annotationHeaderReveal {
          0% {
            opacity: 0;
            filter: blur(6px);
            letter-spacing: 0.55em;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            letter-spacing: 0.4em;
            transform: translateY(0);
          }
        }
        @keyframes annotationTitleReveal {
          0% {
            opacity: 0;
            filter: blur(8px);
            letter-spacing: 0.35em;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            letter-spacing: 0.2em;
            transform: translateY(0);
          }
        }
        @keyframes annotationBodyReveal {
          0% {
            opacity: 0;
            filter: blur(8px);
            letter-spacing: 0.2em;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            letter-spacing: 0.1em;
            transform: translateY(0);
          }
        }
        @keyframes scrollCueFadeIn {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scrollCueDotMovement {
          0% {
            top: 0px;
            opacity: 0;
          }
          15% {
            opacity: 0.8;
          }
          85% {
            opacity: 0.8;
          }
          100% {
            top: 44px;
            opacity: 0;
          }
        }
      `}</style>
      {allLoaded && (
        <>
          {introState === "completed" && (
            <nav className="museum-navigation fixed top-8 left-8 right-8 md:top-12 md:left-12 md:right-12 z-40 pointer-events-none flex justify-between items-center select-none">
              {/* Left Side: Brand mark */}
              <div 
                onClick={() => navigateToChapter(1)}
                className="pointer-events-auto font-serif text-[12.5px] tracking-[0.5em] text-white/35 hover:text-white/75 transition-opacity duration-500 cursor-pointer"
              >
                R:F
              </div>
              {/* Right Side: Links */}
              <div className="pointer-events-auto flex gap-8 md:gap-12 font-mono text-[11.25px] tracking-[0.4em] uppercase text-white/35">
                <span 
                  onClick={() => navigateToChapter(1)} 
                  className="hover:text-white/80 transition-colors duration-500 cursor-pointer"
                >
                  ARCHIVE
                </span>
                <span 
                  onClick={() => navigateToChapter(2)} 
                  className="hover:text-white/80 transition-colors duration-500 cursor-pointer"
                >
                  INSTALLATION
                </span>
                <span 
                  onClick={() => navigateToChapter(3)} 
                  className="hover:text-white/80 transition-colors duration-500 cursor-pointer"
                >
                  RESONANCE
                </span>
                <span 
                  onClick={() => navigateToChapter(4)} 
                  className="hover:text-white/80 transition-colors duration-500 cursor-pointer"
                >
                  FUTURE
                </span>
              </div>
            </nav>
          )}
          <div className="museum-spotlight-reveal" />
          {showSignatureUI && (
            <div className="signature-sweep-overlay" />
          )}

          {introState !== "inactive" && (
            <div 
              className="intro-text-container"
              style={{
                opacity: introState === "revealing" ? 1.0 : 0.0,
                transition: "opacity 1500ms cubic-bezier(0.22, 1, 0.36, 1)",
                display: (introState === "settling" || introState === "completed") ? "none" : "flex"
              }}
            >
              <h1 className="intro-title-line">THE RECORD ENDURES</h1>
              <p className="intro-body-line">
                Every fragment<br />
                still remembers.
              </p>
            </div>
          )}

          <div 
            className="intro-black-overlay" 
            style={{ 
              opacity: (introState === "revealing" || introState === "dissolving") ? 1.0 : 0.0,
              transition: "opacity 2500ms cubic-bezier(0.22, 1, 0.36, 1)",
              display: introState === "completed" ? "none" : "block"
            }} 
          />

          {introState === "completed" && activeChapter === 1 && scrollProgress * 120 < 1 && (
            <div 
              className="archive-annotation"
              style={{
                opacity: Math.max(0, 1 - scrollProgress * 120),
                transition: "opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1)"
              }}
            >
              <span className="annotation-header">[ ARCHIVE INITIALIZED ]</span>
              <h2 className="annotation-title">THE RECORD ENDURES</h2>
              <p className="annotation-body">Every fragment still remembers.</p>
              <div className="archive-scroll-cue-container">
                <div className="archive-scroll-cue-line">
                  <div className="archive-scroll-cue-dot" />
                </div>
              </div>
            </div>
          )}
          <div 
            className="archive-indicator"
            style={{
              opacity: indicatorOpacity,
              transition: "opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1)"
            }}
          >
            <span className="archive-indicator-title">ARCHIVE</span>
            <div className="archive-indicator-list">
              <div 
                className={`archive-indicator-item ${activeChapter === 1 ? "active" : ""}`}
                onClick={() => navigateToChapter(1)}
              >
                <span className="archive-indicator-number">01</span>
                <div className="archive-indicator-line" />
                <div className="archive-indicator-glow" />
              </div>
              <div 
                className={`archive-indicator-item ${activeChapter === 2 ? "active" : ""}`}
                onClick={() => navigateToChapter(2)}
              >
                <span className="archive-indicator-number">02</span>
                <div className="archive-indicator-line" />
                <div className="archive-indicator-glow" />
              </div>
              <div 
                className={`archive-indicator-item ${activeChapter === 3 ? "active" : ""}`}
                onClick={() => navigateToChapter(3)}
              >
                <span className="archive-indicator-number">03</span>
                <div className="archive-indicator-line" />
                <div className="archive-indicator-glow" />
              </div>
              <div 
                className={`archive-indicator-item ${activeChapter === 4 ? "active" : ""}`}
                onClick={() => navigateToChapter(4)}
              >
                <span className="archive-indicator-number">04</span>
                <div className="archive-indicator-line" />
                <div className="archive-indicator-glow" />
              </div>
            </div>
          </div>
        </>
      )}
      {!allLoaded && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            background: "#000",
            gap: "32px",
          }}
        >
          <span
            style={{
              fontFamily: '"Cinzel", Georgia, serif',
              fontSize: "21px",
              fontWeight: 300,
              letterSpacing: "0.65em",
              color: "rgba(255, 255, 255, 0.85)",
              textTransform: "uppercase" as const,
            }}
          >
            REVEAL:FUTURE
          </span>
          <span
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "15px",
              fontWeight: 400,
              letterSpacing: "0.50em",
              color: "rgba(255, 255, 255, 0.75)",
              textTransform: "uppercase" as const,
            }}
          >
            LOADING SEQUENCE ({Math.round(loadProgress * 100)}%)
          </span>
        </div>
      )}
      {/* Canvas container */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          transform: `scale(${1.002 + progress * 0.006}) translateY(${progress * -6}px)`,
          willChange: "transform"
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover"
          style={{ display: "block" }}
        />
      </div>
      {/* Finale cinematic focus — vignette and canvas dim for Phase 4 */}
      {allLoaded && (() => {
        const finaleProgress = currentFrame >= 195 ? Math.min(1, (currentFrame - 195) / 20) : 0;
        const finaleFade = currentFrame >= 248 ? Math.max(0, 1 - (currentFrame - 248) / 9) : 1;
        const finaleOpacity = finaleProgress * finaleFade;
        return finaleOpacity > 0.001 ? (
          <>
            <div
              className="finale-focus-vignette"
              style={{ opacity: finaleOpacity * 0.7 }}
            />
            <div
              className="finale-canvas-dim"
              style={{ opacity: finaleOpacity * 0.25 }}
            />
          </>
        ) : null;
      })()}
      <div className="fixed inset-0 pointer-events-none z-20 grid grid-cols-1 md:grid-cols-12 grid-rows-[auto_1fr_auto] md:grid-rows-1 p-8 md:p-16 font-sans text-white">
        {/* Phase 1: CHROME GUARDIAN (Frames 1-70) */}
        {currentFrame >= 1 && currentFrame <= 70 && (
          <>
            <div
              className="row-start-1 md:row-start-1 col-span-12 md:col-span-4 flex flex-col justify-start md:justify-center items-center md:items-start text-center md:text-left"
              style={{ opacity: Math.min(1, (70 - currentFrame) / 5) }}
            >
              <h2
                className="font-serif text-4xl md:text-6xl tracking-tight leading-none uppercase phase-heading"
                style={{
                  opacity: Math.max(0, Math.min(1, (currentFrame - 1) / 10)),
                  transform: `translateY(${Math.max(0, 10 * (1 - Math.min(1, (currentFrame - 1) / 10)))}px)`,
                  filter: `blur(${Math.max(0, 6 * (1 - Math.min(1, (currentFrame - 1) / 10)))}px)`,
                }}
              >
                CHROME<br />GUARDIAN
              </h2>
            </div>

            <div
              className="row-start-3 md:row-start-1 col-span-12 md:col-start-9 md:col-span-4 flex flex-col justify-end md:justify-center items-center md:items-start text-center md:text-left font-serif text-xs md:text-sm tracking-wide text-white/75 gap-6 mt-12 md:mt-0 max-w-[360px]"
              style={{ opacity: Math.min(1, (70 - currentFrame) / 5) }}
            >
              <p
                style={{
                  opacity: Math.max(0, Math.min(1, (currentFrame - 15) / 10)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 15) / 10)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 15) / 10)))}px)`,
                }}
                className="leading-relaxed narrative-text-reveal"
              >
                Recovered from the deepest layer of the archive,
                the Chrome Guardian remains one of the earliest
                synthetic sentinels ever documented.
              </p>
              <p
                style={{
                  opacity: Math.max(0, Math.min(1, (currentFrame - 25) / 10)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 25) / 10)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 25) / 10)))}px)`,
                }}
                className="leading-relaxed narrative-text-reveal"
              >
                Its chrome surface preserves traces of a forgotten
                memory network long abandoned by its creators.
              </p>
            </div>
          </>
        )}

        {/* Phase 2: SILENT RESONANCE (Frames 71-135) */}
        {currentFrame >= 71 && currentFrame <= 135 && (
          <>
            {/* LEFT SIDE: Archive narrative block */}
            <div
              className="row-start-3 md:row-start-1 col-span-12 md:col-span-4 flex flex-col justify-end md:justify-center items-center md:items-start text-center md:text-left font-serif text-xs md:text-sm tracking-wide text-white gap-6 mt-12 md:mt-0 max-w-[360px]"
            >
              <p
                style={{
                  opacity: Math.max(0, Math.min(0.75, 0.75 * (currentFrame - 85) / 15)) * Math.max(0, Math.min(1, (135 - currentFrame) / 5)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 85) / 15)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 85) / 15)))}px)`,
                }}
                className="leading-relaxed narrative-text-reveal"
              >
                Within the core of silence,<br />
                a hidden frequency remains.
              </p>
              <p
                style={{
                  opacity: Math.max(0, Math.min(0.75, 0.75 * (currentFrame - 100) / 15)) * Math.max(0, Math.min(1, (135 - currentFrame) / 5)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 100) / 15)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 100) / 15)))}px)`,
                }}
                className="leading-relaxed narrative-text-reveal"
              >
                Though the blade emits no sound,<br />
                its structure carries vibrations<br />
                beyond human perception.
              </p>
              <p
                style={{
                  opacity: Math.max(0, Math.min(0.75, 0.75 * (currentFrame - 115) / 15)) * Math.max(0, Math.min(1, (135 - currentFrame) / 5)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 115) / 15)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 115) / 15)))}px)`,
                }}
                className="leading-relaxed narrative-text-reveal"
              >
                Every reflection stores a trace.<br />
                Every trace becomes a memory.
              </p>
            </div>

            {/* RIGHT SIDE: Large section title */}
            <div
              className="row-start-1 md:row-start-1 col-span-12 md:col-start-9 md:col-span-4 flex flex-col justify-start md:justify-center items-center md:items-start text-center md:text-left"
            >
              <h2
                className="font-serif text-4xl md:text-6xl tracking-tight leading-none uppercase phase-heading"
                style={{
                  opacity: Math.max(0, Math.min(1, (currentFrame - 71) / 4)) * Math.max(0, Math.min(1, (135 - currentFrame) / 5)),
                  filter: `blur(${Math.max(0, 6 * (1 - Math.min(1, (currentFrame - 71) / 4)))}px)`,
                  transform: `translateY(${Math.max(0, 10 * (1 - Math.min(1, (currentFrame - 71) / 4)))}px)`,
                }}
              >
                SILENT<br />RESONANCE
              </h2>
            </div>
          </>
        )}

        {/* Phase 3: SYNTHETIC SYMMETRY (Frames 136-200) */}
        {currentFrame >= 136 && currentFrame <= 200 && (
          <div
            className="row-start-1 md:row-start-1 col-span-12 md:col-start-9 md:col-span-4 flex flex-col justify-start md:justify-center items-center md:items-start text-center md:text-left gap-8"
          >
            {/* Title */}
            <h2
              className="font-serif text-4xl md:text-6xl tracking-tight leading-none uppercase phase-heading"
              style={{
                opacity: Math.max(0, Math.min(1, (currentFrame - 136) / 4)) * Math.max(0, Math.min(1, (200 - currentFrame) / 5)),
                filter: `blur(${Math.max(0, 6 * (1 - Math.min(1, (currentFrame - 136) / 4)))}px)`,
                transform: `translateY(${Math.max(0, 10 * (1 - Math.min(1, (currentFrame - 136) / 4)))}px)`,
              }}
            >
              SYNTHETIC<br />SYMMETRY
            </h2>

            {/* Narrative archive block */}
            <div
              className="flex flex-col gap-6 text-xs md:text-sm tracking-wide text-white font-serif max-w-[360px]"
            >
              {/* First narrative lines */}
              <div
                style={{
                  opacity: 0.75 * Math.max(0, Math.min(1, (currentFrame - 150) / 15)) * Math.max(0, Math.min(1, (200 - currentFrame) / 5)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 150) / 15)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 150) / 15)))}px)`,
                }}
                className="flex flex-col gap-6 narrative-text-reveal"
              >
                <p className="leading-relaxed">Every curve is calculated.</p>
                <p className="leading-relaxed">Every angle is intentional.</p>
                <p className="leading-relaxed">Every reflection serves a purpose.</p>
              </div>

              {/* Additional narrative lines */}
              <div
                style={{
                  opacity: 0.75 * Math.max(0, Math.min(1, (currentFrame - 165) / 15)) * Math.max(0, Math.min(1, (200 - currentFrame) / 5)),
                  filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 165) / 15)))}px)`,
                  transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 165) / 15)))}px)`,
                }}
                className="flex flex-col gap-6 narrative-text-reveal"
              >
                <p className="leading-relaxed">
                  The structure follows a perfect balance<br />
                  between preservation and strength.
                </p>
                <p className="leading-relaxed">Nothing exists by chance.</p>
                <p className="leading-relaxed">Everything follows a precise synthetic order.</p>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: FUTURE (Frames 201-257) — cinematic finale */}
        {currentFrame >= 201 && currentFrame <= 257 && endingProgress < 0.3 && (() => {
          // Slower, more deliberate reveal for the final phase
          const headingReveal = Math.max(0, Math.min(1, (currentFrame - 201) / 20));
          const phase4Fade = endingProgress <= 0.3 ? 1.0 - (endingProgress / 0.3) : 0.0;
          const isEndingActive = endingProgress > 0.001;
          
          // If ending chapter is active, use scroll-driven fade. Otherwise, fade out if signature UI is visible.
          const targetOpacity = isEndingActive ? phase4Fade : (showSignatureUI ? 0.0 : 1.0);
          const transitionStyle = isEndingActive 
            ? "opacity 10ms linear" 
            : "opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1)";

          return (
            <div
              className="row-start-1 md:row-start-1 col-span-12 md:col-start-9 md:col-span-4 flex flex-col justify-start md:justify-center items-center md:items-start text-center md:text-left gap-8"
              style={{
                opacity: headingReveal * targetOpacity,
                transition: transitionStyle,
                display: (headingReveal * targetOpacity) <= 0.001 ? "none" : "flex"
              }}
            >
              {/* Title — arrives with deliberate weight */}
              <h2
                className="font-serif text-4xl md:text-6xl tracking-tight leading-none uppercase phase-heading"
                style={{
                  filter: `blur(${Math.max(0, 8 * (1 - headingReveal))}px)`,
                  transform: `translateY(${Math.max(0, 12 * (1 - headingReveal))}px)`,
                  color: `rgba(255, 255, 255, ${0.92 + 0.08 * headingReveal})`,
                }}
              >
                FUTURE
              </h2>

              {/* Narrative archive block — wider stagger for conclusive cadence */}
              <div
                className="flex flex-col gap-6 text-xs md:text-sm tracking-wide text-white font-serif max-w-[360px]"
              >
                <p
                  style={{
                    opacity: 0.8 * Math.max(0, Math.min(1, (currentFrame - 218) / 6)),
                    filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 218) / 6)))}px)`,
                    transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 218) / 6)))}px)`,
                  }}
                  className="leading-relaxed narrative-text-reveal"
                >
                  The archive remains unfinished.
                </p>
                <p
                  style={{
                    opacity: 0.8 * Math.max(0, Math.min(1, (currentFrame - 225) / 6)),
                    filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 225) / 6)))}px)`,
                    transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 225) / 6)))}px)`,
                  }}
                  className="leading-relaxed narrative-text-reveal"
                >
                  Every preserved fragment points forward.
                </p>
                <p
                  style={{
                    opacity: 0.8 * Math.max(0, Math.min(1, (currentFrame - 232) / 6)),
                    filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 232) / 6)))}px)`,
                    transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 232) / 6)))}px)`,
                  }}
                  className="leading-relaxed narrative-text-reveal"
                >
                  The guardian does not mark an ending.
                </p>
                <p
                  style={{
                    opacity: 0.85 * Math.max(0, Math.min(1, (currentFrame - 239) / 6)),
                    filter: `blur(${Math.max(0, 4 * (1 - Math.min(1, (currentFrame - 239) / 6)))}px)`,
                    transform: `translateY(${Math.max(0, 8 * (1 - Math.min(1, (currentFrame - 239) / 6)))}px)`,
                  }}
                  className="leading-relaxed narrative-text-reveal"
                >
                  It marks the beginning of what comes next.
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {allLoaded && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-30 transition-opacity duration-[2000ms]"
          style={{
            opacity: (showSignatureUI && endingProgress <= 0.001) ? 1.0 : 0.0
          }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`signature-alignment-line ${showSignatureUI ? 'active' : ''}`} />
          </div>
        </div>
      )}

      {/* Cinematic dark veil (overlay) for final ending chapter */}
      {allLoaded && (
        <div 
          className="fixed inset-0 bg-black pointer-events-none z-20"
          style={{
            opacity: Math.min(1.0, endingProgress / 0.5),
            transition: "opacity 10ms linear"
          }}
        />
      )}

      {/* Cinematic final chapter typography overlay */}
      {allLoaded && endingProgress > 0.5 && (() => {
        const typoProgress = (endingProgress - 0.5) / 0.5;
        
        // Progressive, staggered fade and blur values
        const subTagOpacity = Math.max(0, Math.min(1, typoProgress / 0.5));
        const subTagBlur = (1 - subTagOpacity) * 8;
        
        const titleOpacity = typoProgress >= 0.3 ? Math.max(0, Math.min(1, (typoProgress - 0.3) / 0.5)) : 0.0;
        const titleBlur = (1 - titleOpacity) * 12;
        
        const lineOpacity = typoProgress >= 0.75 ? Math.max(0, Math.min(1, (typoProgress - 0.75) / 0.25)) : 0.0;
        const lineWidth = lineOpacity * 80;

        return (
          <div 
            className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none text-center"
            style={{
              transform: `translateY(${(1 - typoProgress) * 15}px)`,
              transition: "transform 10ms linear"
            }}
          >
            <div className="flex flex-col gap-5 max-w-2xl px-8">
              {scrollDirection === "down" && (
                <div 
                  className="text-[10px] font-mono tracking-[0.6em] text-white/40 uppercase"
                  style={{
                    opacity: subTagOpacity,
                    filter: `blur(${subTagBlur}px)`,
                    transition: "opacity 10ms linear, filter 10ms linear"
                  }}
                >
                  [ ARCHIVE RESONANCE DETECTED ]
                </div>
              )}
              <h1 
                className="font-serif text-4xl md:text-6xl font-light tracking-[0.25em] text-white uppercase typo-depth-hero leading-tight"
                style={{
                  opacity: titleOpacity,
                  filter: `blur(${titleBlur}px)`,
                  transition: "opacity 10ms linear, filter 10ms linear"
                }}
              >
                THE GUARDIAN REMEMBERS
              </h1>
              <div 
                className="h-[1px] bg-white/20 mx-auto mt-2"
                style={{
                  width: `${lineWidth}px`,
                  opacity: lineOpacity * 0.8,
                  transition: "width 10ms linear, opacity 10ms linear"
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}