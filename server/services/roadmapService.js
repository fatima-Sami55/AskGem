const searchService = require('./searchService');
const { getAiServerHeaders, getAiServerUrl } = require('../utils/aiServerClient');

const ROADMAP_TIMEOUT_MS = Number(process.env.ROADMAP_TIMEOUT_MS) || 600000;

/**
 * Executes E2E pipeline to generate a personalized roadmap based on student profile.
 * Coordinates web search and synthesis via the AskPeri Python AI Server.
 */
exports.generateRoadmap = async (profile) => {
  try {
    console.log('[RoadmapService] Contacting Python AI server for roadmap generation...');
    const aiServerUrl = getAiServerUrl();

    const payload = {
      profile: {
        nationality: String(profile.residency || 'Pakistani'),
        current_degree: profile.educationLevel ? String(profile.educationLevel) : '',
        target_degree: profile.targetDegree || null,
        cgpa: profile.gpa !== null && profile.gpa !== undefined ? Number(profile.gpa) : null,
        preferred_countries: Array.isArray(profile.preferredCountries) ? profile.preferredCountries : [],
        preferred_majors: profile.major ? [String(profile.major)] : [],
        budget: profile.maxBudget !== null && profile.maxBudget !== undefined ? Number(profile.maxBudget) : null,
        english_test: profile.englishTest?.testType ? {
          testType: String(profile.englishTest.testType),
          score: profile.englishTest.score !== null && profile.englishTest.score !== undefined ? Number(profile.englishTest.score) : null,
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
      const data = await aiResponse.json();
      console.log('[RoadmapService] Dynamic roadmap generated successfully from AI server.');
      return data;
    }

    throw new Error(`AI Server returned status ${aiResponse.status}`);
  } catch (err) {
    console.error('[RoadmapService] Failed to delegate roadmap generation to AI server, returning fallback:', err.message);

    const country = profile.preferredCountries?.[0] || 'Germany';
    const major = profile.major || 'Computer Science';
    const targetDegree = profile.targetDegree || 'Masters';
    const englishTestType = profile.englishTest?.testType || 'IELTS';

    const apsStep = country === 'Germany' ? ['Initiate APS Certificate application for German university verification.'] : [];
    const blockedAccountStep = country === 'Germany' ? ['Open German Blocked Bank Account (Fintiba/Expatrio).'] : [];

    return {
      title: `Preparation Strategy for ${targetDegree} in ${country}`,
      opportunities: [],
      overallTimeline: '12-Month Preparation Roadmap',
      phases: [
        {
          phase: 1,
          title: 'Profile Preparation & Exams',
          timeline: 'Months 1-2',
          description: 'Review target university lists, check specific requirements, and start exam preparation.',
          steps: [
            `Begin ${englishTestType} preparation and register for test dates.`,
            'Collect all official degree transcripts and syllabus descriptors.',
          ].concat(apsStep),
        },
        {
          phase: 2,
          title: 'Shortlisting & SOP Drafting',
          timeline: 'Months 3-4',
          description: 'Select target universities and draft Statement of Purpose (SOP) & academic CV.',
          steps: [
            `Shortlist 5-8 universities in ${country} for ${major}.`,
            'Complete first draft of SOP and update academic CV.',
            'Request academic reference letters from professors.',
          ],
        },
        {
          phase: 3,
          title: 'Application Submissions',
          timeline: 'Months 5-8',
          description: 'Submit official university portal applications and apply for merit scholarships.',
          steps: [
            'Submit official university portal applications before cutoffs.',
            `Apply for available ${country} merit scholarships.`,
            'Prepare financial proof bank statements.',
          ],
        },
        {
          phase: 4,
          title: 'Visa & Departure',
          timeline: 'Months 9-12',
          description: 'Secure admission letter, open blocked account if required, and book visa appointment.',
          steps: [
            'Receive formal university acceptance offer.',
            'Schedule embassy visa appointment at VFS Global / Consulate.',
          ].concat(blockedAccountStep),
        },
      ],
      gaps: [
        !profile.englishTest?.score ? `Needs verified ${englishTestType} score.` : `Confirm if ${profile.englishTest.score} meets target cuts.`,
        `Verify budget alignment for ${country} (requires bank proof).`,
      ],
      recommendations: [
        'Verify specific university deadlines directly on official portals.',
        'Ensure transcripts are translated and notarized.',
      ],
    };
  }
};
