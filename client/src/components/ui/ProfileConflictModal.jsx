import React, { useState, useEffect, useRef, useCallback } from 'react';

const FIELD_LABELS = {
  name: 'Full Name',
  educationLevel: 'Current Education Level',
  targetDegree: 'Target Degree',
  major: 'Field of Study',
  gpa: 'CGPA',
  englishTest: 'English Test Type',
  englishTestScore: 'English Test Score',
  maxBudget: 'Annual Budget (USD)',
  preferredCountries: 'Preferred Countries',
};

const formatDisplayValue = (field, value) => {
  if (value === null || value === undefined || value === '(not set)') return '(not set)';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const scorePart = value.score != null ? ` (${value.score})` : '';
    return `${value.testType || 'None'}${scorePart}`;
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (field === 'gpa') return Number(value).toFixed(2);
  if (field === 'maxBudget') return `$${value}`;
  return String(value);
};

export default function ProfileConflictModal({ isOpen, conflicts, onClose, onResolve }) {
  const [choices, setChoices] = useState({});
  const dialogRef = useRef(null);
  const firstFocusRef = useRef(null);

  useEffect(() => {
    if (conflicts && conflicts.length > 0) {
      const initial = {};
      conflicts.forEach((c) => {
        initial[c.field] = 'keep';
      });
      setChoices(initial);
    }
  }, [conflicts]);

  const handleCancelAll = useCallback(() => {
    const revertAll = {};
    (conflicts || []).forEach((c) => {
      revertAll[c.field] = 'keep';
    });
    onResolve(revertAll);
    onClose?.();
  }, [conflicts, onResolve, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    firstFocusRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelAll();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancelAll]);

  if (!isOpen || !conflicts || conflicts.length === 0) return null;

  const handleChoiceChange = (field, choice) => {
    setChoices((prev) => ({ ...prev, [field]: choice }));
  };

  const handleConfirmSelected = () => {
    onResolve(choices);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleCancelAll}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-conflict-title"
        className="w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-6 animate-scale-up"
        style={{
          backgroundColor: '#1E2235',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="profile-conflict-title" className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚠️</span> Profile Update Detected
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Peri detected changes to your profile from your last message. Please confirm:
          </p>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
          {conflicts.map((conflict, index) => {
            const currentChoice = choices[conflict.field] || 'keep';
            const displayOld = formatDisplayValue(conflict.field, conflict.oldValue);
            const displayNew = formatDisplayValue(conflict.field, conflict.newValue);

            return (
              <div
                key={conflict.field}
                className="p-4 rounded-xl space-y-3"
                style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
              >
                <div className="text-sm font-semibold text-slate-300">
                  {conflict.label || FIELD_LABELS[conflict.field] || conflict.field}
                  {conflict.reason && (
                    <span className="text-xs text-indigo-400 font-normal block mt-0.5">
                      ({conflict.reason})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span style={{ color: '#94A3B8' }} className="font-medium">
                    {displayOld}
                  </span>
                  <span style={{ color: '#6366F1' }} className="font-bold">
                    →
                  </span>
                  <span style={{ color: '#34D399' }} className="font-semibold">
                    {displayNew}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    ref={index === 0 ? firstFocusRef : null}
                    type="button"
                    onClick={() => handleChoiceChange(conflict.field, 'keep')}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      border: '1px solid #6366F1',
                      color: currentChoice === 'keep' ? '#FFFFFF' : '#6366F1',
                      backgroundColor: currentChoice === 'keep' ? '#6366F1' : 'transparent',
                    }}
                  >
                    Keep {displayOld}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChoiceChange(conflict.field, 'update')}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: currentChoice === 'update' ? '#6366F1' : 'rgba(99, 102, 241, 0.15)',
                      color: currentChoice === 'update' ? '#FFFFFF' : '#94A3B8',
                      border: currentChoice === 'update' ? '1px solid #6366F1' : '1px solid transparent',
                    }}
                  >
                    Update to {displayNew}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <button
            type="button"
            onClick={handleCancelAll}
            className="text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:text-white"
            style={{ color: '#94A3B8' }}
          >
            Cancel all changes
          </button>

          <button
            type="button"
            onClick={handleConfirmSelected}
            className="text-xs font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:opacity-90 shadow-md"
            style={{ backgroundColor: '#6366F1' }}
          >
            Confirm selected changes
          </button>
        </div>
      </div>
    </div>
  );
}
