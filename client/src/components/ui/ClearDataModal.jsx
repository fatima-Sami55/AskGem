import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';

const CONFIRM_WORD = 'DELETE';

const CONSEQUENCES = [
  'Profile, GPA, budget, and preferences',
  'All chat sessions and Peri\'s memory (Chroma)',
  'Bookmarks and cached university/scholarship matches',
  'Tavily API key in ai/.env',
  'Local profile drafts and setup progress',
  'You\'ll return to the setup + onboarding wizard',
];

export default function ClearDataModal({
  isOpen,
  onClose,
  onConfirm,
  onExport,
  clearing = false,
}) {
  const [confirmText, setConfirmText] = useState('');
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  const handleClose = useCallback(() => {
    if (clearing) return;
    setConfirmText('');
    onClose?.();
  }, [clearing, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      return undefined;
    }

    inputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const canConfirm = confirmText === CONFIRM_WORD && !clearing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-data-title"
        className="w-full max-w-lg rounded-2xl shadow-2xl border-2 border-red-500/50 bg-[#16162a] p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <h3 id="clear-data-title" className="text-xl font-bold text-red-300">
            Delete all local data?
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            This cannot be undone. Export your profile first if you want a backup.
          </p>
        </div>

        <div className="bg-[#0f0f1a] rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-300">You will lose:</p>
          <ul className="space-y-1">
            {CONSEQUENCES.map((item) => (
              <li key={item} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={clearing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#34D399]/40 text-[#34D399] hover:bg-[#34D399]/10 disabled:opacity-50 text-sm font-semibold transition-colors"
        >
          <Download className="w-4 h-4" />
          Export profile JSON first
        </button>

        <div className="space-y-2">
          <label htmlFor="clear-data-confirm" className="text-xs text-slate-400">
            Type <span className="font-mono text-slate-200">{CONFIRM_WORD}</span> to confirm
          </label>
          <input
            ref={inputRef}
            id="clear-data-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={clearing}
            autoComplete="off"
            spellCheck={false}
            placeholder={CONFIRM_WORD}
            className="w-full bg-[#0f0f1a] border border-slate-600 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-400 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={clearing}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {clearing ? (
              'Clearing…'
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Clear everything
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
