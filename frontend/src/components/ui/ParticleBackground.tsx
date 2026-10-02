"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

const BRAND_RGB = "67, 56, 202"; // matches --brand (#4338CA)

export function ParticleBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let lastSpawn = 0;
    let rafId = 0;

    function resize() {
      const parent = canvas!.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      canvas!.width = width * devicePixelRatio;
      canvas!.height = height * devicePixelRatio;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    function spawnAmbient() {
      particles.push({
        x: Math.random() * width,
        y: height + 10,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.25 - Math.random() * 0.35,
        size: 1.5 + Math.random() * 2.5,
        life: 0,
        maxLife: 500 + Math.random() * 400,
      });
    }

    function spawnBurst(x: number, y: number) {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6 - 0.2,
          size: 1 + Math.random() * 2,
          life: 0,
          maxLife: 90 + Math.random() * 60,
        });
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const now = performance.now();
      if (now - lastSpawn > 60 && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        spawnBurst(mouseX, mouseY);
        lastSpawn = now;
      }
    }

    function tick() {
      ctx!.clearRect(0, 0, width, height);

      if (Math.random() < 0.06 && particles.length < 140) spawnAmbient();

      particles = particles.filter((p) => p.life < p.maxLife);
      for (const p of particles) {
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        const lifeRatio = p.life / p.maxLife;
        const opacity = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1 - (lifeRatio - 0.15) / 0.85;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${BRAND_RGB}, ${Math.max(0, opacity) * 0.35})`;
        ctx!.fill();
      }

      rafId = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden="true" />;
}
