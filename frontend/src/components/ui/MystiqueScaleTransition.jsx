import React, { useEffect, useRef } from "react";

/**
 * MystiqueScaleTransition
 * High-performance 60fps Canvas transition inspired by Mystique from X-Men.
 * Staggered diamond scales ripple across the screen, lifting and 3D-flipping
 * with cobalt blue, midnight obsidian, and golden iridescent textures.
 * 
 * At the midpoint of the scale wave sweep, the underlying theme toggles seamlessly
 * underneath the dense scale wavefront, eliminating any visual blink.
 */
export default function MystiqueScaleTransition({
  isActive,
  origin, // { x, y } coordinates of trigger button
  themeFrom, // "dark" | "light"
  themeTo, // "dark" | "light"
  onMidpoint, // Callback to switch DOM theme class under the scales
  onComplete, // Callback to unmount overlay
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    // Check reduced motion preference
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onMidpoint?.();
      onComplete?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext ? canvas.getContext("2d", { alpha: true }) : null;
    if (!ctx) {
      onMidpoint?.();
      onComplete?.();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Origin of the wave (center of screen fallback)
    const originX = origin?.x != null ? origin.x : width / 2;
    const originY = origin?.y != null ? origin.y : height / 2;

    // Compute max distance from origin to furthest viewport corner
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: width, y: height },
    ];
    const maxDist = Math.max(
      ...corners.map((c) => Math.hypot(c.x - originX, c.y - originY))
    );

    // Scale dimensions (optimized lattice)
    const scaleWidth = width > 1200 ? 46 : 38;
    const scaleHeight = width > 1200 ? 32 : 26;
    const stepX = scaleWidth * 0.85;
    const stepY = scaleHeight * 0.55;

    const cols = Math.ceil(width / stepX) + 2;
    const rows = Math.ceil(height / stepY) + 2;

    // Pre-calculate scale positions and wave triggers
    const scales = [];
    for (let r = -1; r < rows; r++) {
      const offsetX = (r % 2 === 0 ? 0 : stepX * 0.5);
      for (let c = -1; c < cols; c++) {
        const cx = c * stepX + offsetX;
        const cy = r * stepY;

        // Base distance
        const dist = Math.hypot(cx - originX, cy - originY);
        // Organic ripple noise variation
        const organicNoise = Math.sin(cx * 0.04 + cy * 0.03) * 22;
        const effectiveDist = Math.max(0, dist + organicNoise);

        scales.push({
          cx,
          cy,
          normDist: effectiveDist / maxDist,
        });
      }
    }

    // Animation timing constants (tuned for natural, responsive Mystique scale ripple)
    const waveSweepDuration = 540; // ms for wave to travel across screen
    const flipDuration = 280; // ms for each individual scale to 3D flip
    const totalDuration = waveSweepDuration + flipDuration;
    const midpointTime = waveSweepDuration * 0.52; // ms when wavefront covers center

    let startTime = null;
    let midpointFired = false;
    let animId = null;

    const render = (now) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;

      // Trigger midpoint DOM switch once when the wave reaches center coverage
      if (!midpointFired && elapsed >= midpointTime) {
        midpointFired = true;
        onMidpoint?.();
      }

      ctx.clearRect(0, 0, width, height);

      // Render each scale
      for (let i = 0; i < scales.length; i++) {
        const s = scales[i];
        const scaleStartTime = s.normDist * waveSweepDuration;
        const scaleElapsed = elapsed - scaleStartTime;

        if (scaleElapsed <= 0 || scaleElapsed >= flipDuration) {
          continue; // Scale is not currently flipping
        }

        const progress = scaleElapsed / flipDuration; // 0 to 1
        const flipAngle = progress * Math.PI; // 0 to 180 degrees
        const isPastHalf = progress > 0.5;

        // 3D pop effect (lifts toward camera then returns)
        const liftScale = 1 + Math.sin(flipAngle) * 0.35;
        const flipCos = Math.cos(flipAngle);

        ctx.save();
        ctx.translate(s.cx, s.cy);
        ctx.scale(flipCos * liftScale, liftScale);

        // Diamond scale path
        const hw = scaleWidth * 0.5;
        const hh = scaleHeight * 0.5;

        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(0, hh);
        ctx.lineTo(-hw, 0);
        ctx.closePath();

        // Shading: Mystique cobalt blue & iridescent amber
        const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
        if (!isPastHalf) {
          // Mutant scale exterior: Deep royal cobalt, midnight undertone, cyan sheen
          grad.addColorStop(0, "#1E40AF");
          grad.addColorStop(0.5, "#0F172A");
          grad.addColorStop(1, "#0284C7");
        } else {
          // Revealed underside matching destination theme
          if (themeTo === "dark") {
            grad.addColorStop(0, "#0F131A");
            grad.addColorStop(0.5, "#141923");
            grad.addColorStop(1, "#312E81");
          } else {
            grad.addColorStop(0, "#FFFFFF");
            grad.addColorStop(0.5, "#F1F5F9");
            grad.addColorStop(1, "#93C5FD");
          }
        }

        ctx.fillStyle = grad;
        ctx.fill();

        // Center spine / ridge line (tactile 3D texture)
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(0, hh);
        ctx.strokeStyle = !isPastHalf
          ? "#F59E0B" // Golden amber mutant accent
          : themeTo === "dark"
            ? "rgba(99, 102, 241, 0.4)"
            : "rgba(59, 130, 246, 0.3)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Specular edge highlight
        ctx.strokeStyle = !isPastHalf
          ? "rgba(251, 191, 36, 0.75)"
          : "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.restore();
      }

      if (elapsed < totalDuration) {
        animId = requestAnimationFrame(render);
      } else {
        if (!midpointFired) onMidpoint?.();
        ctx.clearRect(0, 0, width, height);
        onComplete?.();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isActive, origin, themeFrom, themeTo, onMidpoint, onComplete]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[99999]"
      style={{
        transform: "translate3d(0, 0, 0)",
        willChange: "transform",
      }}
    />
  );
}
