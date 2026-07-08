import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare, User, GraduationCap, Award, Compass, Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Chat', path: '/chat', icon: MessageSquare, accent: '#6366F1' },
  { label: 'My Profile', path: '/profile', icon: User, accent: '#818CF8' },
  { label: 'Universities', path: '/universities', icon: GraduationCap, accent: '#34D399' },
  { label: 'Scholarships', path: '/scholarships', icon: Award, accent: '#FBBF24' },
  { label: 'Roadmap', path: '/roadmap', icon: Compass, accent: '#60A5FA' },
  { label: 'Settings', path: '/settings', icon: Settings, accent: '#94A3B8' },
];

export function AppNavLinks({ className = '', onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <nav className={`space-y-1 ${className}`} aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => go(item.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-xs text-left transition-colors duration-150 ${
              isActive
                ? 'bg-[#6366F1] text-[#0f0f1a] font-semibold shadow-sm shadow-[#6366F1]/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? '#0f0f1a' : item.accent }} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileNavStrip() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="md:hidden px-2 py-2 border-b border-white/5 bg-[var(--bg-secondary)] overflow-x-auto">
      <div className="flex gap-1 min-w-max px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#6366F1] text-[#0f0f1a]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AppShell({ children, title, headerRight = null }) {
  return (
    <div className="h-screen flex overflow-hidden bg-[var(--bg-primary)] text-[var(--text-main)]">
      <aside
        className="hidden md:flex flex-col fixed top-0 left-0 z-30 h-screen w-52 border-r border-white/10 bg-[var(--bg-secondary)]"
        aria-label="App sidebar"
      >
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-2 flex-shrink-0">
          <img
            src="/favicon.png"
            alt="Peri"
            style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }}
          />
          <span className="text-sm font-extrabold text-[var(--text-main)]">
            Ask<span style={{ color: '#6366F1' }}>Peri</span>
          </span>
        </div>
        <div className="px-3 py-4 flex-1 overflow-y-auto min-h-0">
          <AppNavLinks />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden md:ml-52">
        <header className="flex-shrink-0 z-20 bg-[#16162a]/90 backdrop-blur border-b border-white/10 px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <div className="md:hidden flex items-center gap-2 min-w-0">
            <img src="/favicon.png" alt="" className="w-6 h-6 rounded" aria-hidden />
            <span className="text-sm font-bold truncate">{title}</span>
          </div>
          <h1 className="hidden md:block text-base font-bold tracking-tight text-white truncate">
            {title}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerRight}
          </div>
        </header>

        <MobileNavStrip />

        <main className="flex-1 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
