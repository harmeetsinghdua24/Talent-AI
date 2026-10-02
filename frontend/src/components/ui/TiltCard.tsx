"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Wraps any card in a subtle 3D tilt that follows the cursor - the card
 * rotates a few degrees toward the mouse position and lifts slightly,
 * then springs back to flat on mouse-leave. Kept intentionally subtle
 * (max ~6deg) so it reads as "premium tactile" rather than gimmicky.
 * Disabled automatically on touch devices (hover doesn't apply there).
 */
export function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 25 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 25 });
  const lift = useSpring(0, { stiffness: 300, damping: 25 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
    lift.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => lift.set(1)}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        translateY: useTransform(lift, [0, 1], [0, -4]),
        transformPerspective: 800,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
