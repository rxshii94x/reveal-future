import React, { useEffect, useState, useRef } from "react";
import ChromeGuardianSequence from "./components/ChromeGuardianSequence";
import { useMagnetic } from "./hooks/useMagnetic";
import { ambientSynth } from "./utils/audio";

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

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [exhibitionTime, setExhibitionTime] = useState("");
  
  const auraRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const currentRef = useRef({ x: -1000, y: -1000 });
  const videoRef = useRef<HTMLVideoElement>(null);

  usePingPongVideo(videoRef);


  // Magnetic proximity — content block and CTA
  const contentMagRef = useMagnetic({ maxShift: 4, radius: 250, ease: 0.06 });
  const buttonMagRef = useMagnetic({ maxShift: 8, radius: 180, ease: 0.08 });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setExhibitionTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let rafId: number;
    const updatePosition = () => {
      if (auraRef.current) {
        const target = mouseRef.current;
        const current = currentRef.current;
        
        if (target.x !== -1000) {
          if (current.x === -1000) {
            current.x = target.x;
            current.y = target.y;
          } else {
            current.x += (target.x - current.x) * 0.08;
            current.y += (target.y - current.y) * 0.08;
          }
          auraRef.current.style.transform = `translate3d(${current.x - 50}px, ${current.y - 50}px, 0)`;
        }
      }
      rafId = requestAnimationFrame(updatePosition);
    };
    rafId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      {/* Brand signature watermark — persistent subliminal REVEAL:FUTURE presence */}
      <div className="brand-watermark" aria-hidden="true">REVEAL:FUTURE</div>
      <style>{`
        @keyframes brandMonogramFlash {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); filter: blur(8px); }
          35% { opacity: 0.12; transform: translate(-50%, -50%) scale(1); filter: blur(0px); }
          65% { opacity: 0.08; transform: translate(-50%, -50%) scale(1); filter: blur(0px); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.02); filter: blur(4px); }
        }
        .brand-monogram-flash {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: "Cinzel", Georgia, serif;
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.8em;
          color: rgba(255, 255, 255, 0.12);
          pointer-events: none;
          z-index: 100000;
          animation: brandMonogramFlash 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          user-select: none;
        }
        .film-grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9998;
          opacity: 0.015;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          animation: grainDrift 40s linear infinite;
        }
        @keyframes grainDrift {
          0%   { background-position: 0px 0px; }
          25%  { background-position: -60px 40px; }
          50%  { background-position: 30px -50px; }
          75%  { background-position: -40px -20px; }
          100% { background-position: 0px 0px; }
        }

        /* Living atmosphere system — environmental presence */
        @keyframes ambientLuminanceBreathe {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.025; }
        }
        .atmosphere-luminance {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9996;
          background: #000;
          animation: ambientLuminanceBreathe 50s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        @keyframes colorTemperatureDrift {
          0%, 100% {
            background: rgba(180, 155, 120, 0.018);
          }
          33% {
            background: rgba(160, 165, 180, 0.018);
          }
          66% {
            background: rgba(150, 160, 170, 0.018);
          }
        }
        .atmosphere-temperature {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9995;
          mix-blend-mode: soft-light;
          animation: colorTemperatureDrift 120s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        @keyframes atmosphericDepthMigrate {
          0%, 100% {
            background: radial-gradient(ellipse 90% 70% at 30% 40%, rgba(255, 255, 255, 0.025) 0%, transparent 60%);
          }
          25% {
            background: radial-gradient(ellipse 70% 90% at 65% 35%, rgba(255, 255, 255, 0.02) 0%, transparent 55%);
          }
          50% {
            background: radial-gradient(ellipse 80% 60% at 55% 65%, rgba(255, 255, 255, 0.022) 0%, transparent 60%);
          }
          75% {
            background: radial-gradient(ellipse 60% 80% at 35% 55%, rgba(255, 255, 255, 0.018) 0%, transparent 55%);
          }
        }
        .atmosphere-depth {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9994;
          mix-blend-mode: soft-light;
          animation: atmosphericDepthMigrate 75s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        @keyframes transitionOverlay {
          0% {
            opacity: 0;
            visibility: visible;
          }
          50% {
            opacity: 0.95;
            visibility: visible;
          }
          100% {
            opacity: 0;
            visibility: hidden;
          }
        }
        .transition-overlay-test {
          animation: transitionOverlay 1400ms cubic-bezier(0.45, 0, 0.55, 1) forwards;
        }
      `}</style>
      <div className="film-grain" />
      {/* Living atmosphere — environmental presence layers */}
      <div className="atmosphere-luminance" />
      <div className="atmosphere-temperature" />
      <div className="atmosphere-depth" />
      <div
        ref={auraRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9999,
          background: "radial-gradient(circle, rgba(255, 248, 240, 0.055) 0%, rgba(255, 245, 235, 0.02) 35%, rgba(255, 255, 255, 0) 70%)",
          transform: "translate3d(-1000px, -1000px, 0)",
          willChange: "transform",
        }}
      />
      {!hasEntered ? (
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between p-8 md:p-16 text-white select-none">
          <style>{`
            @keyframes charFadeIn {
              0% {
                opacity: 0;
                filter: blur(6px);
                transform: translateY(10px);
              }
              60% {
                filter: blur(1px);
              }
              100% {
                opacity: 1;
                filter: blur(0px);
                transform: translateY(0px);
              }
            }
            .char-fade {
              opacity: 0;
              filter: blur(6px);
              transform: translateY(10px);
              animation: charFadeIn 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
              will-change: opacity, filter, transform;
            }
            .btn-premium-cta {
              transition: background-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
                          color 220ms cubic-bezier(0.22, 1, 0.36, 1),
                          border-color 220ms cubic-bezier(0.22, 1, 0.36, 1),
                          box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
                          transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
              will-change: transform;
              box-shadow: inset 0 0 0px rgba(0, 0, 0, 0);
            }
            .btn-premium-cta:hover {
              border-color: rgba(255, 255, 255, 0.42);
              box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1);
            }
            .btn-premium-cta:active {
              transform: scale(0.985);
            }

            @keyframes baseOverlayIntro {
              0% { 
                opacity: 0.98; 
                animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
              }
              23% { 
                opacity: 0.98; 
                animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
              }
              41% { 
                opacity: 0.55; 
                animation-timing-function: linear;
              }
              48% { 
                opacity: 0.55; 
                animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
              }
              62% { 
                opacity: 0.80; 
              }
              100% { 
                opacity: 0.80; 
              }
            }
            .base-overlay-anim {
              animation: baseOverlayIntro 11s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }

            @keyframes vignetteIntro {
              0% { 
                opacity: 0; 
                animation-timing-function: linear;
              }
              48% { 
                opacity: 0; 
                animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
              }
              62% { 
                opacity: 1.0; 
              }
              100% { 
                opacity: 1.0; 
              }
            }
            .vignette-anim {
              animation: vignetteIntro 11s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }

            @keyframes swordIntro {
              0% { opacity: 0; }
              11% { opacity: 0.75; } /* 1.2s */
              23% { opacity: 0.20; } /* 2.5s */
              41% { opacity: 0; }
              100% { opacity: 0; }
            }
            .sword-light-anim {
              animation: swordIntro 11s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }

            @keyframes chestIntro {
              0% { opacity: 0; }
              11% { opacity: 0; }
              23% { opacity: 0.65; } /* 2.5s */
              41% { opacity: 0.10; } /* 4.5s */
              50% { opacity: 0; }
              100% { opacity: 0; }
            }
            .chest-light-anim {
              animation: chestIntro 11s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }

            @keyframes elementFadeIn {
              0% {
                opacity: 0;
                filter: blur(4px);
                transform: translateY(8px);
              }
              50% {
                filter: blur(1.5px);
              }
              100% {
                opacity: 1;
                filter: blur(0px);
                transform: translateY(0px);
              }
            }
            @keyframes labelFadeIn {
              0% {
                opacity: 0;
                filter: blur(5px);
                transform: translateY(10px);
              }
              55% {
                filter: blur(1px);
              }
              100% {
                opacity: 1;
                filter: blur(0px);
                transform: translateY(0px);
              }
            }
            @keyframes buttonFadeIn {
              0% {
                opacity: 0;
                filter: blur(3px);
                transform: translateY(8px);
              }
              60% {
                filter: blur(0.5px);
              }
              100% {
                opacity: 1;
                filter: blur(0px);
                transform: translateY(0px);
              }
            }
            .fade-in-ui-metadata {
              opacity: 0;
              filter: blur(4px);
              transform: translateY(8px);
              animation: elementFadeIn 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
              animation-delay: 8.8s;
              will-change: opacity, filter, transform;
            }
            .fade-in-subtitle {
              opacity: 0;
              filter: blur(4px);
              transform: translateY(8px);
              animation: elementFadeIn 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
              animation-delay: 8.8s;
              will-change: opacity, filter, transform;
            }
            .fade-in-button {
              opacity: 0;
              filter: blur(3px);
              transform: translateY(8px);
              animation: buttonFadeIn 1000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
              animation-delay: 9.8s;
              will-change: opacity, filter, transform;
            }
            .fade-in-label {
              opacity: 0;
              filter: blur(5px);
              transform: translateY(10px);
              animation: labelFadeIn 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
              animation-delay: 6.8s;
              will-change: opacity, filter, transform;
            }

            /* Typographic depth system — cinematic shadow layering */
            .typo-depth-hero {
              text-shadow:
                0 1px 3px rgba(0, 0, 0, 0.7),
                0 4px 16px rgba(0, 0, 0, 0.22),
                0 8px 40px rgba(0, 0, 0, 0.1);
            }
            .typo-depth-label {
              text-shadow:
                0 1px 2px rgba(0, 0, 0, 0.4),
                0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .typo-depth-body {
              text-shadow:
                0 1px 2px rgba(0, 0, 0, 0.3),
                0 2px 6px rgba(0, 0, 0, 0.08);
            }
            .typo-depth-meta {
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }
          `}</style>
          <video
            ref={videoRef}
            src="https://files.catbox.moe/82f0c8.mp4"
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ zIndex: -5 }}
          />
          <div className="absolute inset-0 bg-black pointer-events-none base-overlay-anim" style={{ zIndex: -4 }} />
          <div
            className="absolute inset-0 pointer-events-none vignette-anim"
            style={{
              zIndex: -3,
              background: "radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 65%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none sword-light-anim"
            style={{
              zIndex: -2,
              mixBlendMode: "screen",
              background: "radial-gradient(ellipse 60px 220px at 50% 55%, rgba(255, 255, 255, 0.32) 0%, transparent 100%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none chest-light-anim"
            style={{
              zIndex: -1,
              mixBlendMode: "screen",
              background: "radial-gradient(ellipse 160px 100px at 50% 48%, rgba(255, 255, 255, 0.28) 0%, transparent 100%)",
            }}
          />

          <div className="flex justify-between items-center w-full font-mono text-[9px] text-neutral-500 relative z-10 fade-in-ui-metadata typo-depth-meta">
            <span>REVEAL:FUTURE — MUSEUM OF COGNITIVE MEMORY</span>
            <span>R:F — INIT_SEQ // v2.6.16</span>
          </div>
          <div className="max-w-2xl mx-auto text-center flex flex-col items-center justify-center gap-10 relative z-10">
            <div ref={contentMagRef} className="flex flex-col gap-4" style={{ willChange: 'transform' }}>
              <div className="text-[10px] font-mono tracking-[0.6em] text-white/40 uppercase fade-in-label typo-depth-label">[ DIGITAL INSTALLATION ]</div>
              <h1 className="font-serif text-5xl md:text-7xl font-light tracking-[0.25em] text-white uppercase typo-depth-hero">
                {"REVEAL:FUTURE".split("").map((char, index) => (
                  <span
                    key={index}
                    className="char-fade"
                    style={{
                      animationDelay: `${7800 + index * 35}ms`,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </h1>
              <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto fade-in-subtitle typo-depth-body">Enter the silent resonance of the Chrome Guardian.</p>
            </div>
            <div ref={buttonMagRef} style={{ willChange: 'transform' }}>
              <button onClick={() => { setHasEntered(true); ambientSynth.start(); }} className="px-12 py-5 border border-white/10 text-[11px] tracking-[0.5em] text-white/85 uppercase hover:bg-white hover:text-black btn-premium-cta rounded-sm cursor-pointer fade-in-button typo-depth-label">
                INITIALIZE ARCHIVE
              </button>
            </div>
          </div>
          <div className="flex justify-between text-neutral-600 font-mono text-[9px] w-full relative z-10 fade-in-ui-metadata typo-depth-meta">
            <span>R:F // LOC_COORDS // [45.109, 15.180]</span>
            <span>EST. TIME // {exhibitionTime}</span>
          </div>
        </div>
      ) : (
        <div className="relative w-full bg-black min-h-screen block">
          <div className="fixed inset-0 bg-black pointer-events-none z-[99999] transition-overlay-test" />
          <div className="brand-monogram-flash" aria-hidden="true">REVEAL:FUTURE</div>
          <ChromeGuardianSequence />
        </div>
      )}
    </>
  );
}