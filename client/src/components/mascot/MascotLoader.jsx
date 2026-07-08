import React, { useEffect } from 'react';
import InteractiveMascot from './InteractiveMascot';
import { useMascot } from '../../context/MascotContext';
import './InteractiveMascot.css';

function formatElapsed(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * MascotLoader — reusable full-screen loading overlay.
 * Uses the same Peri + dot animation already in use on the auth redirect screen.
 *
 * Props:
 *   message          {string}   Optional label below the dots. Defaults to 'Loading...'.
 *   title            {string}   Optional heading above the mascot.
 *   subtitle         {string}   Optional expectation copy (e.g. CPU ETA).
 *   elapsedSeconds   {number}   Optional elapsed timer value in seconds.
 *   etaLabel         {string}   Optional typical total time label.
 *   steps            {string[]} Optional step labels for phased progress.
 *   currentStepIndex {number}   Active step index (0-based).
 *   onCancel         {function} Optional cancel/back handler.
 *   cancelLabel      {string}   Cancel button label.
 *   size             {number}   Mascot size in px. Defaults to 160.
 */
export default function MascotLoader({
  message = 'Loading...',
  title,
  subtitle,
  elapsedSeconds,
  etaLabel,
  steps,
  currentStepIndex = 0,
  onCancel,
  cancelLabel = 'Cancel',
  size = 160,
}) {
  const { setAction, clearSpeech } = useMascot();
  const hasProgress = steps?.length > 0;
  const progressPct = hasProgress
    ? Math.min(100, Math.round(((currentStepIndex + 1) / steps.length) * 100))
    : 0;

  useEffect(() => {
    setAction('thinking');
    return () => {
      setAction('idle');
      clearSpeech();
    };
  }, [setAction, clearSpeech]);

  return (
    <div className="mascot-loader-overlay">
      {title && <h2 className="mascot-loader-title">{title}</h2>}
      {subtitle && <p className="mascot-loader-subtitle">{subtitle}</p>}

      <InteractiveMascot size={size} interactive={false} />

      <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
        {['#6366F1', '#2DD4BF', '#F6850C', '#DE3E3E'].map((color, i) => (
          <span
            key={color}
            className="mascot-loader-dot"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              animationDelay: `${i * 0.15}s`,
              display: 'inline-block',
            }}
          />
        ))}
      </div>

      {message && (
        <p className="mascot-loader-label">{message}</p>
      )}

      {hasProgress && (
        <div className="mascot-loader-progress-card">
          <p className="mascot-loader-progress-heading">
            Step {currentStepIndex + 1} of {steps.length}
            {' — '}
            {steps[currentStepIndex]}
          </p>
          <div className="mascot-loader-progress-track">
            <div
              className="mascot-loader-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {(elapsedSeconds != null || etaLabel) && (
            <p className="mascot-loader-progress-meta">
              {elapsedSeconds != null && (
                <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
              )}
              {elapsedSeconds != null && etaLabel && <span> · </span>}
              {etaLabel && <span>Typical total: {etaLabel}</span>}
            </p>
          )}
          <div className="mascot-loader-steps">
            {steps.map((label, idx) => {
              let statusClass = 'mascot-loader-step-pending';
              if (idx < currentStepIndex) statusClass = 'mascot-loader-step-done';
              else if (idx === currentStepIndex) statusClass = 'mascot-loader-step-active';
              return (
                <span key={label} className={`mascot-loader-step ${statusClass}`}>
                  {label}
                </span>
              );
            })}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mascot-loader-cancel"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
