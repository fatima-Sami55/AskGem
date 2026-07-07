import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProfile } from '../../context/ProfileContext';

function TypingIndicator() {
  return (
    <div className="message-row-container assistant-message-row">
      <img src="/favicon.png" alt="Peri" className="msg-bubble-avatar" />
      <div className="bubble" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderRadius: '4px 12px 12px 12px' }}>
        <div className="flex items-center gap-3 py-1">
          <div className="typing-container">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span className="text-xs font-medium text-muted-foreground animate-pulse">
            Peri is thinking
          </span>
        </div>
      </div>
    </div>
  );
}

function formatProfessionalMarkdown(content) {
  if (!content) return '';

  let text = content;

  // 1. Strip raw JSON metadata & raw source dumps
  text = text.replace(/\{"type":\s*"search_metadata"[\s\S]*?\}/g, '');
  text = text.replace(/\{"type":"search_metadata"[\s\S]*?\}/g, '');
  text = text.replace(/\[?\s*\{"title":[\s\S]*?\}\s*\]?/g, '');
  text = text.replace(/\{"title":[\s\S]*?\}/g, '');

  // 2. Cleanup leftover stray symbols like trailing commas, braces or brackets
  text = text.replace(/,\s*\}/g, '');
  text = text.replace(/[\}\]\}]\s*$/g, '');
  text = text.replace(/,\s*,\s*/g, ', ');
  text = text.replace(/aiming for3\.0/g, 'aiming for 3.0');

  // 3. Convert single leading asterisks before headers (e.g. *Technical University -> ### Technical University)
  text = text.replace(/^\*([A-Z0-9].*)$/gm, '### $1');
  text = text.replace(/\n\*([A-Z0-9].*)/g, '\n### $1');

  // 4. Ensure extra blank line before headings for clean Markdown block separation
  text = text.replace(/([^\n])\n(##+ )/g, '$1\n\n$2');

  return text.trim();
}

export default function MessageBubble({ message, isThinking }) {
  const { user } = useProfile();

  if (isThinking) return <TypingIndicator />;

  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <p className="text-xs text-slate-400 italic px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/5">
          {message.content}
        </p>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const userAvatar = user?.profile?.avatar ? `/${user.profile.avatar}` : '/default-pfp.png';

  const cleanContent = formatProfessionalMarkdown(message.content);

  return (
    <div className={`message-row-container ${isUser ? 'user-message-row' : 'assistant-message-row'}`}>
      {!isUser && (
        <img src="/favicon.png" alt="Peri" className="msg-bubble-avatar" />
      )}

      <div className="bubble">
        {isUser ? (
          <p className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
            {cleanContent}
          </p>
        ) : (
          <div className="bubble-text markdown-content">
            {message.isStreaming ? (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.65', color: '#E2E8F0' }}>
                {cleanContent}
                <span style={{ display: 'inline-block', width: '8px', height: '16px', marginLeft: '2px', backgroundColor: 'currentColor', verticalAlign: 'middle', animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 style={{ color: '#818CF8', fontSize: '1.25rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.35rem' }} {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 style={{ color: '#818CF8', fontSize: '1.15rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.6rem' }} {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 style={{ color: '#A5B4FC', fontSize: '1rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.4rem', backgroundColor: 'rgba(99,102,241,0.08)', padding: '0.35rem 0.6rem', borderRadius: '6px', borderLeft: '3px solid #6366F1', display: 'inline-block' }} {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', marginBottom: '0.85rem', listStyleType: 'disc' }} {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', marginBottom: '0.85rem', listStyleType: 'decimal' }} {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li style={{ marginBottom: '0.4rem', color: '#CBD5E1', lineHeight: '1.65' }} {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong style={{ color: '#F8FAFC', fontWeight: 600 }} {...props} />
                  ),
                  a: ({ node, ...props }) => (
                    <a style={{ color: '#6366F1', textDecoration: 'underline', fontWeight: 500 }} target="_blank" rel="noopener noreferrer" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p style={{ marginBottom: '0.85rem', lineHeight: '1.65', color: '#E2E8F0' }} {...props} />
                  )
                }}
              >
                {cleanContent}
              </ReactMarkdown>
            )}
          </div>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Sources</p>
            <ul className="space-y-1">
              {message.sources.slice(0, 4).map((source, idx) => (
                <li key={source.url || idx}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#6366F1] hover:underline"
                  >
                    {source.title || source.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isUser && (
        <img src={userAvatar} alt="You" className="msg-bubble-avatar" style={{ marginLeft: 'var(--space-md)' }} />
      )}
    </div>
  );
}
