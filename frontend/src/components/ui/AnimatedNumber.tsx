"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

/**
 * Animates a number counting up from 0 to its target value. Accepts either
 * a plain number or a string like "67.5%" / "$12,000" - numeric strings are
 * parsed, animated, then re-formatted with their original prefix/suffix.
 */
export function AnimatedNumber({ value }: { value: string | number }) {
  const raw = String(value);
  const match = raw.match(/^([^\d.-]*)([\d,.-]+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const numeric = match ? parseFloat(match[2].replace(/,/g, "")) : NaN;
  const suffix = match?.[3] ?? "";
  const decimals = match?.[2].includes(".") ? match[2].split(".")[1].length : 0;

  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isNaN(numeric)) spring.set(numeric);
  }, [numeric, spring]);

  useEffect(() => {
    return spring.on("change", (v) => {
      setDisplay(v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    });
  }, [spring, decimals]);

  if (isNaN(numeric)) return <>{raw}</>;

  return (
    <motion.span>
      {prefix}
      {display}
      {suffix}
    </motion.span>
  );
}
