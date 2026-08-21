import React, { useEffect, useRef } from 'react';

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Create celestial stars
    const starCount = Math.floor((width * height) / 8000);
    const stars: Array<{
      x: number;
      y: number;
      radius: number;
      alpha: number;
      baseAlpha: number;
      twinkleSpeed: number;
      color: string;
    }> = [];

    const colors = ['#E5C98D', '#E2E8F0', '#C4B5FD', '#93C5FD', '#FDE047'];

    for (let i = 0; i < starCount; i++) {
      const baseAlpha = 0.2 + Math.random() * 0.6;
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.1 ? 1.5 + Math.random() * 1.2 : 0.5 + Math.random() * 1.0,
        alpha: baseAlpha,
        baseAlpha,
        twinkleSpeed: 0.005 + Math.random() * 0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Shooting stars
    interface ShootingStar {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      alpha: number;
      active: boolean;
    }

    let shootingStars: ShootingStar[] = [];

    const spawnShootingStar = () => {
      if (Math.random() < 0.015 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * (height * 0.4),
          length: 60 + Math.random() * 80,
          speed: 4 + Math.random() * 6,
          angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
          alpha: 1,
          active: true,
        });
      }
    };

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Deep space gradient
      const bgGradient = ctx.createRadialGradient(
        width / 2,
        height * 0.35,
        50,
        width / 2,
        height * 0.5,
        Math.max(width, height)
      );
      bgGradient.addColorStop(0, '#0E1428');
      bgGradient.addColorStop(0.5, '#090D1C');
      bgGradient.addColorStop(1, '#060810');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric nebula glow
      const nebulaGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.4,
        0,
        width * 0.5,
        height * 0.4,
        width * 0.45
      );
      nebulaGrad.addColorStop(0, 'rgba(49, 46, 129, 0.18)');
      nebulaGrad.addColorStop(0.5, 'rgba(30, 27, 75, 0.08)');
      nebulaGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw and twinkle stars
      for (const star of stars) {
        star.alpha = star.baseAlpha + Math.sin(tick * star.twinkleSpeed) * 0.25;
        if (star.alpha < 0.1) star.alpha = 0.1;
        if (star.alpha > 1) star.alpha = 1;

        ctx.save();
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        // Extra flare on brightest stars
        if (star.radius > 1.8 && star.alpha > 0.6) {
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(star.x - star.radius * 2.5, star.y);
          ctx.lineTo(star.x + star.radius * 2.5, star.y);
          ctx.moveTo(star.x, star.y - star.radius * 2.5);
          ctx.lineTo(star.x, star.y + star.radius * 2.5);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Handle shooting stars
      spawnShootingStar();
      shootingStars = shootingStars.filter((s) => s.active);

      for (const s of shootingStars) {
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.alpha -= 0.012;

        if (s.alpha <= 0 || s.x > width || s.y > height) {
          s.active = false;
          continue;
        }

        ctx.save();
        ctx.globalAlpha = s.alpha;
        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const starGrad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        starGrad.addColorStop(0, 'rgba(229, 201, 141, 0)');
        starGrad.addColorStop(0.8, 'rgba(229, 201, 141, 0.6)');
        starGrad.addColorStop(1, 'rgba(255, 255, 255, 1)');

        ctx.strokeStyle = starGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.95 }}
    />
  );
};
