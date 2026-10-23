import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/app-store';

interface CursorParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  isPixel: boolean;
}

interface SlashWave {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

const ROCKET_PARTICLE_COLORS = ['#FFD166', '#FF6B8A', '#38DDF8', '#FFF3B0', '#FB923C'];
const PIXEL_SWORD_COLORS = ['#38DDF8', '#FFD166', '#55E6A5', '#E0F2FE', '#FF6B8A'];

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, summary, [role="button"], [tabindex]:not([tabindex="-1"]), .cursor-pointer';

export const ArcadeCursor: React.FC = () => {
  const reducedMotion = useAppStore((s) => s.settings.reducedMotion);
  const [hasFinePointer, setHasFinePointer] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorIconRef = useRef<HTMLDivElement | null>(null);
  const rocketFlameRef = useRef<SVGGElement | null>(null);

  const stateRef = useRef<{
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    visible: boolean;
    isInteractive: boolean;
    isDown: boolean;
    slashSwingTimer: number;
    particles: CursorParticle[];
    slashes: SlashWave[];
    tick: number;
  }>({
    x: -100,
    y: -100,
    lastX: -100,
    lastY: -100,
    visible: false,
    isInteractive: false,
    isDown: false,
    slashSwingTimer: 0,
    particles: [],
    slashes: [],
    tick: 0,
  });

  const [cursorMode, setCursorMode] = useState<'rocket' | 'sword'>('rocket');
  const [isSlashing, setIsSlashing] = useState(false);

  // Enable custom cursor only on devices with a fine pointer (mouse / trackpad)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: fine)');
    const updatePointer = () => setHasFinePointer(mq.matches);
    updatePointer();
    mq.addEventListener?.('change', updatePointer);
    return () => {
      mq.removeEventListener?.('change', updatePointer);
    };
  }, []);

  // Toggle global CSS class to hide native system cursor when our custom cursor is active
  useEffect(() => {
    if (!hasFinePointer) {
      document.documentElement.classList.remove('lucky-custom-cursor');
      return;
    }
    document.documentElement.classList.add('lucky-custom-cursor');
    return () => {
      document.documentElement.classList.remove('lucky-custom-cursor');
    };
  }, [hasFinePointer]);

  useEffect(() => {
    if (!hasFinePointer) return;

    const st = stateRef.current;

    const checkInteractive = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      const el = target.closest(INTERACTIVE_SELECTOR);
      if (!el) return false;
      if (el instanceof HTMLButtonElement && el.disabled) return false;
      return true;
    };

    const spawnRocketDust = (x: number, y: number, count: number) => {
      if (reducedMotion || st.particles.length > 85) return;
      // Exhaust nozzle is located at (+30, +30) from the top-left rocket tip for our larger 56px rocket
      const nozzleX = x + 30;
      const nozzleY = y + 30;
      for (let i = 0; i < count; i++) {
        st.particles.push({
          x: nozzleX + (Math.random() - 0.5) * 7,
          y: nozzleY + (Math.random() - 0.5) * 7,
          vx: 0.4 + (Math.random() - 0.5) * 1.1,
          vy: 0.85 + Math.random() * 1.6, // Gently falls downward ("rơi rơi hạt li ti")
          size: 1.8 + Math.random() * 2.4,
          color: ROCKET_PARTICLE_COLORS[Math.floor(Math.random() * ROCKET_PARTICLE_COLORS.length)],
          life: 0,
          maxLife: 26 + Math.floor(Math.random() * 16),
          isPixel: false,
        });
      }
    };

    const spawnSwordPixels = (x: number, y: number, count: number, burst = false) => {
      if (reducedMotion || st.particles.length > 85) return;
      const originX = burst ? x + 4 : x + 12;
      const originY = burst ? y + 4 : y + 12;
      for (let i = 0; i < count; i++) {
        const angle = burst ? (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4 : 0;
        const speed = burst ? 1.6 + Math.random() * 2.6 : 0;
        st.particles.push({
          x: originX + (Math.random() - 0.5) * (burst ? 4 : 14),
          y: originY + (Math.random() - 0.5) * (burst ? 4 : 14),
          vx: burst ? Math.cos(angle) * speed : (Math.random() - 0.5) * 0.7,
          vy: burst ? Math.sin(angle) * speed : 0.55 + Math.random() * 0.95,
          size: burst ? 3.5 : 2.6,
          color: PIXEL_SWORD_COLORS[Math.floor(Math.random() * PIXEL_SWORD_COLORS.length)],
          life: 0,
          maxLife: burst ? 20 + Math.floor(Math.random() * 10) : 22 + Math.floor(Math.random() * 12),
          isPixel: true,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      st.x = e.clientX;
      st.y = e.clientY;
      st.visible = true;

      if (cursorIconRef.current) {
        cursorIconRef.current.style.transform = `translate3d(${st.x}px, ${st.y}px, 0)`;
        cursorIconRef.current.style.opacity = '1';
      }

      const hoveredInteractive = checkInteractive(e.target);
      if (hoveredInteractive !== st.isInteractive) {
        st.isInteractive = hoveredInteractive;
        setCursorMode(hoveredInteractive || st.isDown ? 'sword' : 'rocket');
      }

      const dist = Math.hypot(st.x - st.lastX, st.y - st.lastY);
      if (dist > 5) {
        st.lastX = st.x;
        st.lastY = st.y;
        if (st.isInteractive || st.isDown) {
          spawnSwordPixels(st.x, st.y, 1, false);
        } else {
          spawnRocketDust(st.x, st.y, 2);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      st.x = e.clientX;
      st.y = e.clientY;
      st.isDown = true;
      st.slashSwingTimer = 12;
      setCursorMode('sword');
      setIsSlashing(true);

      // Spawn Pixel Slash Arc + Pixel Spark Burst!
      st.slashes.push({
        x: st.x,
        y: st.y,
        life: 0,
        maxLife: 14,
      });
      spawnSwordPixels(st.x, st.y, 10, true);
    };

    const handleMouseUp = (e: MouseEvent) => {
      st.isDown = false;
      setIsSlashing(false);
      const hoveredInteractive = checkInteractive(e.target);
      st.isInteractive = hoveredInteractive;
      setCursorMode(hoveredInteractive ? 'sword' : 'rocket');
    };

    const handleMouseLeave = () => {
      st.visible = false;
      if (cursorIconRef.current) {
        cursorIconRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    let rafId = 0;
    let isMounted = true;

    const renderLoop = () => {
      if (!isMounted) return;
      st.tick++;

      // Flicker rocket thruster flame smoothly
      if (rocketFlameRef.current && st.visible && !st.isInteractive && !st.isDown) {
        const scale = 0.88 + Math.sin(st.tick * 0.45) * 0.16;
        rocketFlameRef.current.style.transform = `scale(${scale})`;
      }

      // Emit a gentle falling particle even when holding the mouse still
      if (st.visible && !reducedMotion && st.tick % 7 === 0) {
        if (st.isInteractive || st.isDown) {
          spawnSwordPixels(st.x, st.y, 1, false);
        } else {
          spawnRocketDust(st.x, st.y, 1);
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = window.innerWidth;
          const h = window.innerHeight;
          if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, w, h);

          // 1. Render Falling Stardust (Rocket) & Pixel Sparks (Sword)
          for (let i = st.particles.length - 1; i >= 0; i--) {
            const p = st.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.035; // gentle gravity pull downward
            p.life++;

            if (p.life >= p.maxLife) {
              st.particles.splice(i, 1);
              continue;
            }

            const prog = p.life / p.maxLife;
            const alpha = (1 - prog) * 0.92;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;

            if (p.isPixel) {
              // Crisp retro pixel square for the Pixel Sword
              const sz = Math.max(1.5, p.size * (1 - prog * 0.35));
              ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), Math.ceil(sz), Math.ceil(sz));
            } else {
              // Soft glowing micro-stardust for the Rocket
              const r = Math.max(0.6, p.size * (1 - prog * 0.5));
              ctx.beginPath();
              ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 2. Render Pixel Sword Slash Waves on Click
          for (let i = st.slashes.length - 1; i >= 0; i--) {
            const sl = st.slashes[i];
            sl.life++;
            if (sl.life >= sl.maxLife) {
              st.slashes.splice(i, 1);
              continue;
            }
            const prog = sl.life / sl.maxLife;
            ctx.save();
            ctx.globalAlpha = 1 - prog;
            ctx.translate(sl.x, sl.y);

            // Pixelated slash crescent steps
            const radius = 10 + prog * 18;
            ctx.strokeStyle = prog < 0.5 ? '#FFD166' : '#38DDF8';
            ctx.lineWidth = 3 * (1 - prog);
            ctx.beginPath();
            ctx.arc(4, 4, radius, -Math.PI * 0.85, Math.PI * 0.15);
            ctx.stroke();
            ctx.restore();
          }

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      isMounted = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasFinePointer, reducedMotion]);

  if (!hasFinePointer) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      {/* Particle Trail & Slash Wave Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Direct Hardware-Accelerated Cursor Icon Wrapper */}
      <div
        ref={cursorIconRef}
        style={{
          transform: 'translate3d(-100px, -100px, 0)',
          opacity: 0,
          willChange: 'transform',
        }}
        className="fixed top-0 left-0 pointer-events-none"
      >
        {cursorMode === 'rocket' ? (
          /* ==================== LARGE ROCKET CURSOR (Top-Left Tip at 0,0) ==================== */
          <div className="-translate-x-[10px] -translate-y-[10px] drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
            <svg width="56" height="56" viewBox="0 0 36 36" fill="none">
              <g transform="translate(18, 18) rotate(-45) translate(-18, -18)">
                {/* Thruster Exhaust Flame (3-Layer Animated) */}
                <g
                  ref={rocketFlameRef}
                  style={{ transformOrigin: '18px 26.5px' }}
                >
                  {/* Outer Magenta/Coral Flame */}
                  <path
                    d="M13.2 26.2C13.2 31.8 18 36 18 36C18 36 22.8 31.8 22.8 26.2H13.2Z"
                    fill="#FF6B8A"
                  />
                  {/* Middle Orange-Gold Flame */}
                  <path
                    d="M14.8 26.2C14.8 30.6 18 34.4 18 34.4C18 34.4 21.2 30.6 21.2 26.2H14.8Z"
                    fill="#F97316"
                  />
                  {/* Inner Bright Yellow-White Core Flame */}
                  <path
                    d="M16.2 26.2C16.2 29.4 18 32.5 18 32.5C18 32.5 19.8 29.4 19.8 26.2H16.2Z"
                    fill="#FEF08A"
                  />
                </g>

                {/* Left & Right Swept Booster Fins */}
                <path
                  d="M12.5 18L7 25L13 24.5Z"
                  fill="#FF6B8A"
                  stroke="#0A0D1C"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M23.5 18L29 25L23 24.5Z"
                  fill="#FF6B8A"
                  stroke="#0A0D1C"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />

                {/* Thruster Nozzle Base */}
                <rect
                  x="14.2"
                  y="23.8"
                  width="7.6"
                  height="3.2"
                  rx="1.2"
                  fill="#475569"
                  stroke="#0A0D1C"
                  strokeWidth="1.4"
                />

                {/* Main Rocket Body (Pointing Straight Up before -45deg rotation -> Tip at top-left!) */}
                <path
                  d="M18 2C12.5 8.5 12 16.5 12 24H24C24 16.5 23.5 8.5 18 2Z"
                  fill="#F8FAFC"
                  stroke="#0A0D1C"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                {/* Subtle Metallic Shading on Right Side of Rocket Fuselage */}
                <path
                  d="M18 2C20.5 8.5 21 16.5 21 23.2H23.2C23.2 16.2 22.8 8.5 18 2Z"
                  fill="#CBD5E1"
                />

                {/* Coral Red Nosecone */}
                <path
                  d="M18 2C15.2 5.4 13.7 8.8 13.2 11.4H22.8C22.3 8.8 20.8 5.4 18 2Z"
                  fill="#FF6B8A"
                  stroke="#0A0D1C"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />

                {/* Gold Trim Stripe below Nosecone */}
                <rect x="13.2" y="11.2" width="9.6" height="1.6" fill="#FFD166" />

                {/* Glowing Cyan Cockpit Window */}
                <circle
                  cx="18"
                  cy="16.8"
                  r="3.5"
                  fill="#38DDF8"
                  stroke="#0A0D1C"
                  strokeWidth="1.5"
                />
                <circle cx="16.9" cy="15.7" r="1.2" fill="#FFFFFF" />

                {/* Center Fin */}
                <rect
                  x="17.1"
                  y="20.5"
                  width="1.8"
                  height="4.5"
                  rx="0.9"
                  fill="#FF6B8A"
                  stroke="#0A0D1C"
                  strokeWidth="1"
                />
              </g>
            </svg>
          </div>
        ) : (
          /* ==================== 16-BIT PIXEL SWORD CURSOR (Hover / Click) ==================== */
          <div
            className={`-translate-x-[3px] -translate-y-[3px] transition-transform duration-100 drop-shadow-[0_0_10px_rgba(56,221,248,0.85)] ${
              isSlashing ? 'rotate-[-26deg] scale-95' : 'rotate-0 scale-100'
            }`}
            style={{ transformOrigin: '4px 4px' }}
          >
            <svg
              width="46"
              height="46"
              viewBox="0 0 16 16"
              fill="none"
              shapeRendering="crispEdges"
            >
              {/* Dark Navy Pixel Outline (High-contrast silhouette) */}
              <path
                d="M0 0H4V1H5V2H6V3H7V4H8V5H9V6H10V7H12V6H13V7H14V9H12V10H10V12H9V14H7V13H6V12H7V10H6V9H5V8H4V7H3V6H2V5H1V4H0V0Z"
                fill="#0A0D1C"
              />
              {/* Blade Tip & Glowing Diamond/Cyan Edge (Pointed at 0,0) */}
              <rect x="1" y="1" width="2" height="2" fill="#FFFFFF" />
              <rect x="2" y="2" width="2" height="2" fill="#E0F2FE" />
              <rect x="3" y="3" width="2" height="2" fill="#38DDF8" />
              <rect x="4" y="4" width="2" height="2" fill="#38DDF8" />
              <rect x="5" y="5" width="2" height="2" fill="#0284C7" />
              <rect x="6" y="6" width="2" height="2" fill="#0284C7" />
              <rect x="7" y="7" width="2" height="2" fill="#38DDF8" />
              {/* Blade Center Highlight */}
              <rect x="2" y="1" width="1" height="1" fill="#38DDF8" />
              <rect x="3" y="2" width="1" height="1" fill="#FFFFFF" />
              <rect x="4" y="3" width="1" height="1" fill="#FFFFFF" />
              <rect x="5" y="4" width="1" height="1" fill="#E0F2FE" />
              <rect x="6" y="5" width="1" height="1" fill="#E0F2FE" />
              <rect x="7" y="6" width="1" height="1" fill="#E0F2FE" />
              {/* Golden Pixel Crossguard */}
              <rect x="10" y="7" width="2" height="1" fill="#FFD166" />
              <rect x="11" y="8" width="2" height="1" fill="#F59E0B" />
              <rect x="8" y="8" width="2" height="2" fill="#FFD166" />
              <rect x="7" y="10" width="1" height="2" fill="#FFD166" />
              <rect x="8" y="11" width="1" height="2" fill="#F59E0B" />
              {/* Ruby Gem in Center of Crossguard */}
              <rect x="9" y="9" width="1" height="1" fill="#FF6B8A" />
              {/* Royal Purple Hilt Grip & Gold Pommel */}
              <rect x="10" y="10" width="1" height="1" fill="#8B5CF6" />
              <rect x="11" y="11" width="1" height="1" fill="#8B5CF6" />
              <rect x="12" y="12" width="2" height="2" fill="#FFD166" />
              <rect x="13" y="13" width="1" height="1" fill="#FF6B8A" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

