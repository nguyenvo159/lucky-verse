import { useCallback, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';

export function useFullscreen() {
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const setIsFullscreen = useAppStore((s) => s.setIsFullscreen);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const hasFsElement = Boolean(document.fullscreenElement);
      setIsFullscreen(hasFsElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        // Fallback CSS fullscreen exit on Escape
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, setIsFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } else {
          // CSS Presentation Mode Fallback
          setIsFullscreen(true);
        }
        // Attempt landscape orientation lock on mobile if supported
        try {
          const orientation = screen.orientation as unknown as {
            lock?: (mode: string) => Promise<void>;
          };
          if (orientation?.lock && window.innerWidth < 900) {
            await orientation.lock('landscape');
          }
        } catch {
          // Ignore if browser does not allow orientation lock
        }
      } else {
        try {
          const orientation = screen.orientation as unknown as {
            unlock?: () => void;
          };
          orientation?.unlock?.();
        } catch {
          // Ignore
        }
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // Fallback if Fullscreen API blocked by permissions
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen, setIsFullscreen]);

  return {
    isFullscreen,
    toggleFullscreen,
  };
}

