import { useEffect, useRef } from 'react';

interface MagneticConfig {
  /** Maximum displacement in pixels (4–12px recommended) */
  maxShift?: number;
  /** Proximity detection radius in pixels */
  radius?: number;
  /** Interpolation smoothing factor (lower = slower/smoother, 0.04–0.15) */
  ease?: number;
}

/**
 * Attaches an ultra-subtle magnetic proximity effect to an element.
 * The element gently shifts toward the cursor when within the
 * detection radius, creating a premium, physically-present feel.
 *
 * Returns a ref to attach to the target element (or wrapper div).
 * Uses requestAnimationFrame for butter-smooth 60fps interpolation
 * and a single passive mousemove listener per instance.
 */
export function useMagnetic<T extends HTMLElement = HTMLDivElement>(
  config: MagneticConfig = {}
) {
  const {
    maxShift = 8,
    radius = 200,
    ease = 0.08,
  } = config;

  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let mouseX = -9999;
    let mouseY = -9999;
    let curX = 0;
    let curY = 0;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const tick = () => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let tx = 0;
      let ty = 0;

      if (dist < radius) {
        // Linear pull proportional to displacement, capped at maxShift
        // at the proximity boundary. The element shifts toward the cursor.
        const pull = maxShift / radius;
        tx = dx * pull;
        ty = dy * pull;
      }

      // Smooth interpolation — buttery spring-back
      curX += (tx - curX) * ease;
      curY += (ty - curY) * ease;

      // Apply transform only when there's meaningful displacement
      if (Math.abs(curX) > 0.02 || Math.abs(curY) > 0.02) {
        el.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      } else if (curX !== 0 || curY !== 0) {
        curX = 0;
        curY = 0;
        el.style.transform = '';
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
      el.style.transform = '';
    };
  }, [maxShift, radius, ease]);

  return ref;
}
