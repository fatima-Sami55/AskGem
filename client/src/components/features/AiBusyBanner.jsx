import { getAiQueueBannerMessage } from '../../utils/aiQueue';

export default function AiBusyBanner({ currentTask, statusMessage, showDots = true, className = '' }) {
  const message = statusMessage || getAiQueueBannerMessage(currentTask);

  return (
    <div
      className={`px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 text-center font-medium flex items-center justify-center gap-2.5 flex-wrap ${className}`}
      role="status"
      aria-live="polite"
    >
      {showDots && (
        <div className="typing-container" style={{ padding: 0 }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      )}
      <span>{message}</span>
    </div>
  );
}
