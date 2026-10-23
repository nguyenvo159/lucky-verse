import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UserPlus,
  Upload,
  Download,
  Trash2,
  Search,
  Edit2,
  Check,
  Sparkles,
  FileText,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Hash,
} from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import {
  expandNumberRangeLine,
  exportParticipantsToCsv,
  generateNumberRangeLines,
  MAX_PARTICIPANTS,
  parseParticipantLines,
} from '../../services/import-export-service';
import { ParticipantAvatarSvg } from '../shared/ParticipantAvatarSvg';
import { audioService } from '../../services/audio-service';

const PAGE_SIZE = 50;

export const ParticipantDrawer: React.FC = () => {
  const isOpen = useAppStore((s) => s.isParticipantDrawerOpen);
  const setOpen = useAppStore((s) => s.setParticipantDrawerOpen);
  const eventName = useAppStore((s) => s.eventName);
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.settings);

  const addSingleParticipant = useAppStore((s) => s.addSingleParticipant);
  const updateParticipantName = useAppStore((s) => s.updateParticipantName);
  const removeParticipant = useAppStore((s) => s.removeParticipant);
  const importParticipantsFromText = useAppStore((s) => s.importParticipantsFromText);
  const loadSampleList = useAppStore((s) => s.loadSampleList);
  const clearAllParticipants = useAppStore((s) => s.clearAllParticipants);
  const resetEligibilityPool = useAppStore((s) => s.resetEligibilityPool);

  const [activeTab, setActiveTab] = useState<'list' | 'bulk'>('list');
  const [singleName, setSingleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Number range quick generator state (e.g. 1 - 120)
  const [rangeStart, setRangeStart] = useState<string>('1');
  const [rangeEnd, setRangeEnd] = useState<string>('120');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Bulk import states
  const [bulkText, setBulkText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [pendingImportText, setPendingImportText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);

  const filteredParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.displayCode.toLowerCase().includes(q)
    );
  }, [participants, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedParticipants = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredParticipants.slice(start, start + PAGE_SIZE);
  }, [filteredParticipants, safePage]);

  // Live preview stats for bulk textarea (including expanded ranges like "1 - 120")
  const bulkPreviewStats = useMemo(() => {
    if (!bulkText.trim()) return { valid: 0, ignored: 0, truncated: 0 };
    const res = parseParticipantLines(bulkText, 0, MAX_PARTICIPANTS);
    return {
      valid: res.validParticipants.length,
      ignored: res.ignoredLinesCount,
      truncated: res.truncatedCount,
    };
  }, [bulkText]);

  if (!isOpen) return null;

  const triggerImportDecision = (rawText: string) => {
    const preview = parseParticipantLines(rawText);
    if (preview.validParticipants.length === 0) {
      setImportFeedback('Không tìm thấy dòng hợp lệ nào để nhập. Danh sách hiện tại được giữ nguyên.');
      return;
    }

    if (participants.length > 0) {
      setPendingImportText(rawText);
    } else {
      executeImport(rawText, 'replace');
    }
  };

  const executeImport = (rawText: string, mode: 'replace' | 'append') => {
    const res = importParticipantsFromText(rawText, mode);
    audioService.playClick();
    setPendingImportText(null);
    setBulkText('');
    setSingleName('');
    setActiveTab('list');
    setCurrentPage(1);
    setImportFeedback(
      `Đã nhập thành công ${res.validParticipants.length} mục (${
        res.ignoredLinesCount > 0 ? `bỏ qua ${res.ignoredLinesCount} dòng trống` : '0 dòng lỗi'
      }${res.truncatedCount > 0 ? `, giới hạn tối đa ${MAX_PARTICIPANTS}` : ''}).`
    );
  };

  const handleAddSingleOrRange = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = singleName.trim();
    if (!trimmed) return;

    // Check if the user typed a number range like "1 - 120" or "Số 1 - 120"
    const expandedRange = expandNumberRangeLine(trimmed);
    if (expandedRange && expandedRange.length > 1) {
      triggerImportDecision(trimmed);
      return;
    }

    const res = addSingleParticipant(trimmed);
    if (res.ok) {
      audioService.playClick();
      setSingleName('');
      setImportFeedback(null);
    } else if (res.reason) {
      setImportFeedback(res.reason);
    }
  };

  const handleGenerateNumberRange = (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = parseInt(rangeStart, 10);
    const endNum = parseInt(rangeEnd, 10);
    if (isNaN(startNum) || isNaN(endNum) || startNum < 0 || endNum < 0) {
      setImportFeedback('Vui lòng nhập khoảng số thứ tự hợp lệ (Ví dụ: từ 1 đến 120).');
      return;
    }
    const generatedText = generateNumberRangeLines(startNum, endNum, '', 3);
    triggerImportDecision(generatedText);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setBulkText(content);
        triggerImportDecision(content);
      }
    };
    reader.onerror = () => {
      setImportFeedback('Không thể đọc file. Danh sách hiện tại vẫn an toàn.');
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="relative w-full max-w-2xl h-full bg-[#121833] border-l border-white/15 flex flex-col shadow-2xl"
        >
          {/* Drawer Header */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#10152B]">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>Quản Lý Danh Sách</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {participants.length} / {MAX_PARTICIPANTS}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Hỗ trợ nhập theo tên, theo khoảng Số Thứ Tự (VD: <code className="text-sky-300">1 - 120</code>) hoặc file CSV/TXT.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-navigation & Quick Actions */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-white/10 bg-[#151C39] flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-xl bg-[#0D1226] p-1 border border-white/10">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'list'
                    ? 'bg-[#8B5CF6] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Danh sách ({participants.length})
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'bulk'
                    ? 'bg-[#8B5CF6] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Nhập hàng loạt / Dãy số
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-sky-300"
                title="Nhập từ file .TXT hoặc .CSV"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nhập TXT/CSV</span>
              </button>

              <button
                onClick={() => exportParticipantsToCsv(participants, eventName)}
                disabled={participants.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-emerald-300 disabled:opacity-40"
                title="Xuất danh sách hiện tại ra CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV</span>
              </button>
            </div>
          </div>

          {/* Quick Number Sequence Generator (VD: 1 - 120) */}
          <form
            onSubmit={handleGenerateNumberRange}
            className="px-4 sm:px-6 py-2.5 bg-[#0E142B] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
              <Hash className="w-4 h-4 text-[#38DDF8]" />
              <span>Tạo theo Số Thứ Tự:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400">Từ</span>
              <input
                type="number"
                min={0}
                max={9999}
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-16 rounded-lg bg-[#182042] border border-white/15 px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-[#38DDF8]"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                min={1}
                max={9999}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-20 rounded-lg bg-[#182042] border border-white/15 px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-[#38DDF8]"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-[#38DDF8] hover:bg-sky-300 text-slate-950 font-bold transition-colors"
              >
                Tạo dãy số
              </button>
            </div>
          </form>

          {/* Sample Presets & Eligibility Bar */}
          <div className="px-4 sm:px-6 py-2 bg-[#10152B]/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#FFD166]" /> Mẫu tên:
              </span>
              <button
                onClick={() => {
                  loadSampleList(24);
                  setCurrentPage(1);
                  setImportFeedback('Đã nạp danh sách mẫu 24 người.');
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-400/20"
              >
                24 người
              </button>
              <button
                onClick={() => {
                  loadSampleList(120);
                  setCurrentPage(1);
                  setImportFeedback('Đã nạp danh sách mẫu 120 người.');
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-400/20"
              >
                120 người
              </button>
              <button
                onClick={() => {
                  loadSampleList(1000);
                  setCurrentPage(1);
                  setImportFeedback('Đã nạp danh sách mẫu tối đa 1.000 người!');
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-400/20"
              >
                1.000 người
              </button>
            </div>

            {excludedIds.length > 0 && !settings.allowRepeatWinner && (
              <button
                onClick={() => {
                  resetEligibilityPool();
                  setImportFeedback('Đã khôi phục tư cách tham gia cho tất cả người từng thắng.');
                }}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Khôi phục {excludedIds.length} người đã thắng</span>
              </button>
            )}
          </div>

          {/* Feedback Banner */}
          {importFeedback && (
            <div className="mx-4 sm:mx-6 mt-2.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-xs text-indigo-200 flex items-center justify-between">
              <span>{importFeedback}</span>
              <button onClick={() => setImportFeedback(null)} className="text-indigo-300 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* Replace vs Append Confirmation Dialog */}
          {pendingImportText !== null && (
            <div className="mx-4 sm:mx-6 mt-2.5 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-200 space-y-1">
                  <p className="font-bold text-amber-200 text-sm">
                    Danh sách hiện tại đang có {participants.length} mục.
                  </p>
                  <p>
                    Bạn muốn <strong>Thay thế hoàn toàn</strong> danh sách cũ hay{' '}
                    <strong>Thêm nối tiếp</strong> vào danh sách hiện tại?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end flex-wrap">
                <button
                  onClick={() => setPendingImportText(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300"
                >
                  Hủy
                </button>
                <button
                  onClick={() => executeImport(pendingImportText, 'append')}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-xs font-bold text-slate-950"
                >
                  Thêm vào danh sách hiện tại
                </button>
                <button
                  onClick={() => executeImport(pendingImportText, 'replace')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-bold text-slate-950"
                >
                  Thay thế danh sách mới
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          {activeTab === 'bulk' ? (
            <div className="flex-1 p-4 sm:p-6 flex flex-col gap-3.5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex flex-wrap items-center justify-between gap-1">
                  <span>Nhập danh sách tên hoặc khoảng Số Thứ Tự (VD: 1 - 120)</span>
                  <span className="font-mono text-slate-400">
                    Số mục sẽ tạo:{' '}
                    <strong className="text-emerald-400">{bulkPreviewStats.valid}</strong> | Dòng trống:{' '}
                    <strong className="text-amber-300">{bulkPreviewStats.ignored}</strong>
                  </span>
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Bạn có thể nhập:\n1 - 120\n\nHoặc nhập từng dòng:\nNguyễn Văn An\nTrần Thị Bình\n001\n002`}
                  className="w-full h-60 sm:h-68 rounded-2xl bg-[#0A0D1C] border border-white/15 p-4 text-sm text-white font-sans focus:outline-none focus:border-[#38DDF8] resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#38DDF8]" /> Hỗ trợ cú pháp thông minh:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                  <li>
                    Gõ <code className="text-sky-300">1 - 120</code> (hoặc{' '}
                    <code className="text-sky-300">Số 1 - 120</code>,{' '}
                    <code className="text-sky-300">001 - 120</code>) để tự động sinh đủ 120 số thứ tự từ 001 đến 120.
                  </li>
                  <li>Giữ nguyên những người trùng tên với mã ID nội bộ độc lập.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 mt-auto pt-2">
                <button
                  onClick={() => setBulkText('')}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
                >
                  Xóa ô nhập
                </button>
                <button
                  onClick={() => triggerImportDecision(bulkText)}
                  disabled={bulkPreviewStats.valid === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#38DDF8] hover:opacity-95 text-sm font-bold text-white shadow-lg disabled:opacity-40"
                >
                  Nạp {bulkPreviewStats.valid} mục vào danh sách
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Single / Range Quick Input & Search Filter */}
              <div className="px-4 sm:px-6 py-2.5 border-b border-white/10 space-y-2">
                <form onSubmit={handleAddSingleOrRange} className="flex gap-2">
                  <input
                    type="text"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="Nhập tên 1 người HOẶC gõ '1 - 120' để tạo dãy số..."
                    className="flex-1 rounded-xl bg-[#0A0D1C] border border-white/15 px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-400"
                  />
                  <button
                    type="submit"
                    disabled={!singleName.trim()}
                    className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-purple-500 text-xs sm:text-sm font-bold text-white transition-colors disabled:opacity-40 shrink-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Thêm</span>
                  </button>
                </form>

                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Tìm theo tên hoặc số thứ tự (VD: 005)..."
                      className="w-full rounded-xl bg-[#0A0D1C]/80 border border-white/10 pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  {confirmClearAll ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-xl">
                      <span className="text-[11px] text-rose-200 font-semibold">Xóa hết?</span>
                      <button
                        onClick={() => {
                          clearAllParticipants();
                          setConfirmClearAll(false);
                          setImportFeedback('Đã xóa toàn bộ danh sách.');
                        }}
                        className="px-2 py-0.5 rounded bg-rose-500 text-white text-xs font-bold"
                      >
                        Đồng ý
                      </button>
                      <button
                        onClick={() => setConfirmClearAll(false)}
                        className="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-xs"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClearAll(true)}
                      disabled={participants.length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-medium text-rose-300 disabled:opacity-35 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa hết</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Participant List (Paginated) */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 divide-y divide-white/5">
                {filteredParticipants.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
                    <p className="text-sm font-semibold text-slate-300">
                      {participants.length === 0
                        ? 'Danh sách đang trống'
                        : 'Không tìm thấy kết quả phù hợp'}
                    </p>
                    <p className="text-xs mt-1 max-w-xs">
                      {participants.length === 0
                        ? 'Bạn có thể bấm "Tạo dãy số (1 - 120)" ở ngay thanh bên trên để bắt đầu!'
                        : 'Thử từ khóa tìm kiếm khác.'}
                    </p>
                  </div>
                ) : (
                  paginatedParticipants.map((person) => {
                    const isExcluded = !settings.allowRepeatWinner && excludedSet.has(person.id);
                    const isEditing = editingId === person.id;

                    return (
                      <div
                        key={person.id}
                        className={`py-2 flex items-center justify-between gap-3 group ${
                          isExcluded ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <ParticipantAvatarSvg seed={person.avatarSeed} size={34} className="shrink-0" />
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 text-sky-300 border border-white/10 shrink-0">
                            #{person.displayCode}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateParticipantName(person.id, editingValue);
                                    setEditingId(null);
                                  }
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                autoFocus
                                className="flex-1 bg-[#0A0D1C] border border-sky-400 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  updateParticipantName(person.id, editingValue);
                                  setEditingId(null);
                                }}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-100 truncate">
                                {person.name}
                              </span>
                              {isExcluded && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                  Đã trúng
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingId(person.id);
                              setEditingValue(person.name);
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-sky-300"
                            title="Sửa tên"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeParticipant(person.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300"
                            title="Xóa mục này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="px-4 sm:px-6 py-2.5 border-t border-white/10 bg-[#10152B] flex items-center justify-between text-xs text-slate-300">
                  <span>
                    Hiển thị {(safePage - 1) * PAGE_SIZE + 1} –{' '}
                    {Math.min(safePage * PAGE_SIZE, filteredParticipants.length)} /{' '}
                    {filteredParticipants.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-35"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono px-2">
                      {safePage}/{totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-35"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Privacy Footer Note */}
          <div className="px-4 sm:px-6 py-2.5 bg-[#0A0D1C] border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>🔒 Dữ liệu lưu trực tiếp trên trình duyệt của bạn.</span>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
