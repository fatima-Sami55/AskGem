const searchService = require('./searchService');
const { getAiServerHeaders, getAiServerUrl } = require('../utils/aiServerClient');
const { buildDetailedRoadmap, mergeDetailedIntoRoadmap } = require('./roadmapDetailedGuide');

const ROADMAP_TIMEOUT_MS = Number(process.env.ROADMAP_TIMEOUT_MS) || 600000;

/**
 * Executes E2E pipeline to generate a personalized roadmap based on student profile.
 * Coordinates web search and synthesis via the AskPeri Python AI Server.
 * Always merges pre-researched step details so phases are expandable with actionable guidance.
 */
exports.generateRoadmap = async (profile) => {
  let roadmap = null;

  try {
    console.log('[RoadmapService] Contacting Python AI server for roadmap generation...');
    const aiServerUrl = getAiServerUrl();

    const testType = profile.englishTest?.testType;
    const payload = {
      profile: {
        nationality: String(profile.residency || 'Pakistani'),
        current_degree: profile.educationLevel ? String(profile.educationLevel) : '',
        target_degree: profile.targetDegree || null,
        cgpa: profile.gpa !== null && profile.gpa !== undefined ? Number(profile.gpa) : null,
        preferred_countries: Array.isArray(profile.preferredCountries) ? profile.preferredCountries : [],
        preferred_majors: profile.major ? [String(profile.major)] : [],
        budget: profile.maxBudget !== null && profile.maxBudget !== undefined ? Number(profile.maxBudget) : null,
        english_test: testType && testType !== 'None' ? {
          testType: String(testType),
          score: profile.englishTest.score !== null && profile.englishTest.score !== undefined
            ? Number(profile.englishTest.score)
            : null,
        } : {},
        work_experience: profile.workExperience !== null && profile.workExperience !== undefined ? Number(profile.workExperience) : 0,
        research_experience: profile.researchExperience || false,
        publications: profile.publications || 0,
      },
    };

    const aiResponse = await fetch(`${aiServerUrl}/roadmap`, {
      method: 'POST',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(ROADMAP_TIMEOUT_MS),
      body: JSON.stringify(payload),
    });

    if (aiResponse.ok) {
      roadmap = await aiResponse.json();
      console.log('[RoadmapService] Dynamic roadmap generated successfully from AI server.');
    } else {
      throw new Error(`AI Server returned status ${aiResponse.status}`);
    }
  } catch (err) {
    console.error('[RoadmapService] AI server unavailable, using detailed step-by-step guide:', err.message);
    roadmap = buildDetailedRoadmap(profile);
  }

  return mergeDetailedIntoRoadmap(roadmap || buildDetailedRoadmap(profile), profile);
};
