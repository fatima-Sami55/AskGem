import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { ChatProvider } from './context/ChatContext';
import { MascotProvider } from './context/MascotContext';
import SetupScreen from './pages/SetupScreen';
import OnboardingWizard from './pages/OnboardingWizard';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import UniversitiesPage from './pages/Universities';
import ScholarshipsPage from './pages/Scholarships';
import RoadmapPage from './pages/Roadmap';
import { needsOnboarding } from './utils/profileGates';

function ChatLayout() {
  return (
    <ChatProvider>
      <Outlet />
    </ChatProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useProfile();
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-400 text-sm">
        Loading profile…
      </div>
    );
  }

  const showOnboarding = !onboardingSkipped && needsOnboarding(user);

  if (showOnboarding) {
    return (
      <ChatProvider>
        <OnboardingWizard
          onComplete={() => {
            setOnboardingSkipped(true);
          }}
        />
      </ChatProvider>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />

      <Route element={<ChatLayout />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/universities" element={<UniversitiesPage />} />
        <Route path="/scholarships" element={<ScholarshipsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
      </Route>

      <Route path="/recommendations" element={<Navigate to="/roadmap" replace />} />
      <Route path="/login" element={<Navigate to="/chat" replace />} />
      <Route path="/register" element={<Navigate to="/chat" replace />} />
      <Route path="/auth/callback" element={<Navigate to="/chat" replace />} />

      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <SetupScreen onReady={() => setReady(true)} />;
  }

  return (
    <Router>
      <MascotProvider>
        <ProfileProvider>
          <AppRoutes />
        </ProfileProvider>
      </MascotProvider>
    </Router>
  );
}
