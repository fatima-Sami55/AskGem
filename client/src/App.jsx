import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { ChatProvider } from './context/ChatContext';
import { MascotProvider } from './context/MascotContext';
import MascotLoader from './components/mascot/MascotLoader';
import SetupScreen from './pages/SetupScreen';
import OnboardingWizard from './pages/OnboardingWizard';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import UniversitiesPage from './pages/Universities';
import ScholarshipsPage from './pages/Scholarships';
import RoadmapPage from './pages/Roadmap';
import { needsOnboarding } from './utils/profileGates';

const SETUP_COMPLETE_KEY = 'askperi_setup_complete';

function hasCompletedSetup() {
  try {
    return localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markSetupComplete() {
  try {
    localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

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
    return <MascotLoader message="Loading your profile..." />;
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

      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default function App() {
  const [ready, setReady] = useState(hasCompletedSetup);

  if (!ready) {
    return (
      <SetupScreen
        onReady={() => {
          markSetupComplete();
          setReady(true);
        }}
      />
    );
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
