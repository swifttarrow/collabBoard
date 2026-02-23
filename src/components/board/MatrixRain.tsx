"use client";

import { useEffect, useRef } from "react";

// Classic Matrix characters: katakana, numbers, symbols
const MATRIX_CHARS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";

type Column = {
  x: number;
  y: number;
  speed: number;
  chars: string[];
};

const COLUMN_WIDTH = 14;
const FONT_SIZE = 14;
const BRIGHT = "rgba(0, 255, 65, 1)";
const DIM = "rgba(0, 180, 50, 0.35)";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationId: number;
    let columns: Column[] = [];
    let mounted = true;
    let lastT = 0;

    const resize = () => {
      if (!mounted || !canvas.parentElement) return;
      const { width, height } = canvas.parentElement.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;

      const numCols = Math.floor(width / COLUMN_WIDTH);
      columns = Array.from({ length: numCols }, (_, i) => ({
        x: i * COLUMN_WIDTH,
        y: Math.random() * -height,
        speed: 80 + Math.random() * 120,
        chars: Array.from(
          { length: Math.ceil(height / FONT_SIZE) + 5 },
          () => MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        ),
      }));
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement!);

    const animate = (deltaMs: number) => {
      if (!mounted || !ctx || !canvas) return;

      ctx.fillStyle = "rgba(0, 10, 0, 0.04)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px ui-monospace, monospace`;

      for (const col of columns) {
        col.y += (col.speed * deltaMs) / 1000;
        if (col.y > 0) col.y = -col.chars.length * FONT_SIZE;

        for (let i = 0; i < col.chars.length; i++) {
          const y = col.y + i * FONT_SIZE;
          if (y < -FONT_SIZE || y > canvas.height + FONT_SIZE) continue;

          const isLead = Math.abs(y - col.y) < FONT_SIZE * 2;
          ctx.fillStyle = isLead ? BRIGHT : DIM;
          ctx.fillText(col.chars[i], col.x, y);
        }
      }

      animationId = requestAnimationFrame((t) => {
        const delta = lastT ? t - lastT : 16;
        lastT = t;
        animate(delta);
      });
    };

    animationId = requestAnimationFrame((t) => animate(16));

    return () => {
      mounted = false;
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden
    />
  );
}
