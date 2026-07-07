/** Returns true when profile has enough data for recommendations API calls. */
export function isProfileReadyForRecommendations(user) {
  const profile = user?.profile;
  if (!profile) return false;
  if (profile.gpa == null || profile.gpa === '') return false;
  if (!profile.targetDegree) return false;
  if (!Array.isArray(profile.preferredCountries) || profile.preferredCountries.length === 0) return false;
  return true;
}

/** Returns true when onboarding wizard should run (first launch / incomplete basics). */
export function needsOnboarding(user) {
  if (!user) return true;
  const name = (user.name || '').trim();
  const isDefaultName = !name || name === 'Student';
  const gpaMissing = user.profile?.gpa == null || user.profile?.gpa === '';
  return isDefaultName || gpaMissing;
}
