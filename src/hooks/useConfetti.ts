import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../stores/app-store';

export function useConfetti() {
  const confettiEnabled = useAppStore((s) => s.settings.confettiEnabled);
  const reducedMotion = useAppStore((s) => s.settings.reducedMotion);

  const fireWinnerConfetti = useCallback(() => {
    if (!confettiEnabled || reducedMotion) return;

    const colors = ['#8B5CF6', '#38DDF8', '#FF6B8A', '#FFD166', '#55E6A5'];

    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
      colors,
      zIndex: 9999,
    });

    setTimeout(() => {
      confetti({
        particleCount: 55,
        angle: 60,
        spread: 55,
        origin: { x: 0.05, y: 0.65 },
        colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 55,
        angle: 120,
        spread: 55,
        origin: { x: 0.95, y: 0.65 },
        colors,
        zIndex: 9999,
      });
    }, 240);
  }, [confettiEnabled, reducedMotion]);

  return { fireWinnerConfetti };
}

