import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { Header } from '../components/layout/Header';
import { GameSelectorBar } from '../components/layout/GameSelectorBar';
import { FullscreenFloatingBar } from '../components/layout/FullscreenFloatingBar';
import { ParticipantDrawer } from '../components/participants/ParticipantDrawer';
import { WinnerOverlay } from '../components/winners/WinnerOverlay';
import { WinnerHistoryModal } from '../components/winners/WinnerHistoryModal';
import { SettingsModal } from '../components/settings/SettingsModal';
import { StageStatusGuard } from '../components/shared/StageStatusGuard';
import { LuckyMascot } from '../components/shared/LuckyMascot';
import { AmbientBackground } from '../components/shared/AmbientBackground';
import { ArcadeCursor } from '../components/shared/ArcadeCursor';

// Lazy-load game modules for fast initial load & clean modular boundaries
const LuckyWheelGame = lazy(() =>
  import('../games/lucky-wheel/LuckyWheelGame').then((m) => ({ default: m.LuckyWheelGame }))
);
const LuckyLotteryGame = lazy(() =>
  import('../games/lottery/LuckyLotteryGame').then((m) => ({ default: m.LuckyLotteryGame }))
);
const MysteryBoxGame = lazy(() =>
  import('../games/mystery-box/MysteryBoxGame').then((m) => ({ default: m.MysteryBoxGame }))
);
const DuckRaceGame = lazy(() =>
  import('../games/duck-race/DuckRaceGame').then((m) => ({ default: m.DuckRaceGame }))
);
const JackpotGame = lazy(() =>
  import('../games/jackpot/JackpotGame').then((m) => ({ default: m.JackpotGame }))
);
const UfoAbductionGame = lazy(() =>
  import('../games/ufo-abduction/UfoAbductionGame').then((m) => ({ default: m.UfoAbductionGame }))
);

export const App: React.FC = () => {
  const activeGameId = useAppStore((s) => s.activeGameId);
  const storageWarning = useAppStore((s) => s.storageWarning);
  const dismissStorageWarning = useAppStore((s) => s.dismissStorageWarning);

  const renderActiveGame = () => {
    switch (activeGameId) {
      case 'lucky-wheel':
        return <LuckyWheelGame />;
      case 'lottery':
        return <LuckyLotteryGame />;
      case 'mystery-box':
        return <MysteryBoxGame />;
      case 'duck-race':
        return <DuckRaceGame />;
      case 'jackpot':
        return <JackpotGame />;
      case 'ufo-abduction':
        return <UfoAbductionGame />;
      default:
        return <LuckyWheelGame />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#10152B] text-white relative selection:bg-purple-500 selection:text-white">
      {/* Ambient Background & Stars */}
      <AmbientBackground />

      {/* Top Compact Header (Hidden in Fullscreen Presentation Mode) */}
      <Header />

      {/* Storage Recovery Warning Banner if applicable */}
      {storageWarning && (
        <div className="relative z-30 mx-auto mt-2 max-w-2xl px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{storageWarning}</span>
          <button
            onClick={dismissStorageWarning}
            className="ml-auto font-bold hover:text-white px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Game Selector Cards (Hidden in Fullscreen Presentation Mode) */}
      <GameSelectorBar />

      {/* Floating Presentation Bar when in Fullscreen */}
      <FullscreenFloatingBar />

      {/* Main Game Stage Area */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0">
        <StageStatusGuard>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGameId}
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="px-6 py-4 rounded-2xl arcade-glass text-sm text-sky-300 font-semibold animate-pulse">
                      Đang tải sân khấu trò chơi...
                    </div>
                  </div>
                }
              >
                {renderActiveGame()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </StageStatusGuard>
      </main>

      {/* Interactive Corner Mascot */}
      <LuckyMascot />

      {/* Drawers & Modals */}
      <ParticipantDrawer />
      <WinnerOverlay />
      <WinnerHistoryModal />
      <SettingsModal />

      {/* Custom Interactive Rocket & Pixel Sword Cursor */}
      <ArcadeCursor />
    </div>
  );
};

export default App;

