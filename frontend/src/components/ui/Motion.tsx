"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

/** Fades + slides content in once, when it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  ...props
}: { children: ReactNode; delay?: number; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Parent that staggers its AnimatedItem children in as it scrolls into view. */
export function AnimatedSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Like AnimatedSection/AnimatedItem, but animates immediately on mount
 * instead of on scroll-into-view. Use this for above-the-fold content
 * (e.g. dashboard stat cards) where whileInView's IntersectionObserver can
 * fail to fire - notably when a parent uses `display: contents` for grid
 * layout, which removes the element's box entirely and breaks
 * intersection detection, leaving children stuck at opacity: 0.
 */
export function StaggerGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
