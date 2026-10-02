"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  // Ring trails behind the raw position with a soft spring; the dot (below)
  // tracks the raw position directly for a precise/responsive feel.
  const ringX = useSpring(x, { stiffness: 300, damping: 30, mass: 0.5 });
  const ringY = useSpring(y, { stiffness: 300, damping: 30, mass: 0.5 });

  useEffect(() => {
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!supportsHover || reducedMotion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability detection on mount, not a reactive sync
    setEnabled(true);
    document.body.classList.add("custom-cursor-active");

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const down = () => setClicking(true);
    const up = () => setClicking(false);

    const isInteractive = (el: EventTarget | null) =>
      el instanceof Element && !!el.closest("a, button, input, textarea, [role='button']");

    const over = (e: MouseEvent) => setHovering(isInteractive(e.target));

    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mouseover", over);
      document.body.classList.remove("custom-cursor-active");
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      {/* Precise inner dot */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[100] rounded-full bg-brand"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
        animate={{ width: clicking ? 6 : 8, height: clicking ? 6 : 8 }}
        transition={{ duration: 0.15 }}
      />
      {/* Trailing ring, scales up over interactive elements */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[100] rounded-full border-2 border-brand/50"
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: hovering ? 56 : 32,
          height: hovering ? 56 : 32,
          borderColor: hovering ? "rgba(67,56,202,0.7)" : "rgba(67,56,202,0.35)",
          scale: clicking ? 0.85 : 1,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      />
    </>
  );
}
