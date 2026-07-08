#!/usr/bin/env node
/**
 * Seeds SQLite with realistic demo data for product video captures.
 * Run from repo root: node scripts/seed-demo-video.js
 */
const path = require('path');
const { randomUUID } = require('crypto');

const serverDir = path.join(__dirname, '..', 'server');
const {
  connectDB,
  updateUser,
  createSession,
  saveSession,
  getSessions,
  DB_PATH,
} = require(path.join(serverDir, 'db'));

const DEMO_PROFILE = {
  gpa: 3.42,
  educationLevel: 'FSc / A-Levels',
  maxBudget: 15000,
  residency: 'Pakistan',
  preferredCountries: ['Germany', 'Canada'],
  age: 21,
  major: 'Computer Science',
  englishTest: { testType: 'IELTS', score: 7.0 },
  workExperience: 0,
  researchExperience: false,
  publications: 0,
  targetDegree: 'Masters',
  profileScore: 78,
  admissionChance: 'Competitive',
};

const CHAT_MESSAGES = [
  {
    role: 'user',
    content: 'I want to study Computer Science in Germany on a tight budget. Where should I start?',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    role: 'assistant',
    content:
      "Great choice! With your 3.42 CGPA and IELTS 7.0, you're competitive for many German public universities — they charge no tuition, only a small semester fee.\n\nI'd start with:\n1. **APS certificate** — mandatory for Pakistani degrees (4–8 weeks)\n2. **Shortlist 4–6 programs** at TU Munich, RWTH Aachen, and Uni Stuttgart\n3. **Winter 2027 intake** — deadlines typically Apr–Jul\n\nWant me to pull honest match scores for your profile?",
    timestamp: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    role: 'user',
    content: 'Yes! Show me universities with real match scores, not fake percentages.',
    timestamp: new Date(Date.now() - 3400000).toISOString(),
  },
  {
    role: 'assistant',
    content:
      "On it! Head to the **Universities** tab — I'll compute match scores only when I have verified GPA requirements and program data. No inflated numbers.\n\nYour roadmap is ready too — check the **Roadmap** tab for a step-by-step plan from APS to application.",
    timestamp: new Date(Date.now() - 3300000).toISOString(),
  },
];

const DEMO_ROADMAP = {
  title: 'Germany Masters — Computer Science',
  summary: 'Step-by-step plan for Winter 2027 intake',
  phases: [
    {
      phase: 1,
      title: 'Exams, APS & eligibility — Computer Science',
      timeline: 'Months 1–2',
      description:
        'Set up English test, APS verification, and document prep before you shortlist universities. Your CGPA is 3.42 — prioritize RWTH, Stuttgart, and Dresden.',
      steps: [
        'Register and prepare for IELTS Academic.',
        'Start APS certificate application.',
        'Gather and attest academic documents.',
      ],
      stepDetails: [
        {
          title: 'Register for IELTS Academic',
          summary: 'German CS MSc programs typically require IELTS 6.5 (6.0 per band).',
          details: [
            'Go to ielts.org → Book a test → Choose IELTS Academic',
            'Target 6.5 overall, minimum 6.0 in each section',
          ],
          url: 'https://www.ielts.org/for-test-takers/book-a-test',
        },
        {
          title: 'Apply for APS Certificate',
          summary: 'Mandatory for Pakistani degrees. Processing takes 4–8 weeks.',
          details: [
            'Register at aps.org.pk with passport details',
            'Upload HEC-attested degrees and transcripts',
          ],
          url: 'https://www.aps.org.pk',
        },
      ],
    },
    {
      phase: 2,
      title: 'Shortlist universities & draft SOP — Computer Science',
      timeline: 'Months 2–4',
      description: 'Compare programs by GPA cutoffs, language requirements, and deadlines.',
      steps: [
        'Review match scores on the Universities page.',
        'Draft statement of purpose tailored to each program.',
        'Request reference letters from professors.',
      ],
      stepDetails: [],
    },
    {
      phase: 3,
      title: 'Applications & visa prep',
      timeline: 'Months 4–8',
      description: 'Submit applications before winter intake deadlines and prepare blocked account.',
      steps: [
        'Submit via university portals or uni-assist.',
        'Prepare blocked account (Sperrkonto) for visa.',
        'Book visa appointment at German embassy.',
      ],
      stepDetails: [],
    },
  ],
};

function main() {
  console.log('Seeding demo video data…');
  console.log(`Database: ${DB_PATH}`);

  connectDB();

  updateUser({
    name: 'Ayesha Khan',
    profile: DEMO_PROFILE,
  });

  let session = getSessions({ limit: 1 })[0];
  if (session) {
    session.messages = CHAT_MESSAGES;
    session.generatedRoadmap = DEMO_ROADMAP;
    session.isClosed = false;
    saveSession(session);
    console.log(`Updated session ${session.id}`);
  } else {
    session = createSession({
      messages: CHAT_MESSAGES,
      generatedRoadmap: DEMO_ROADMAP,
      isClosed: false,
    });
    console.log(`Created session ${session.id}`);
  }

  console.log('✓ Demo data ready');
  console.log('  Profile: Ayesha Khan, CS Masters, Germany + Canada');
  console.log(`  Chat: ${CHAT_MESSAGES.length} messages`);
  console.log(`  Roadmap: ${DEMO_ROADMAP.phases.length} phases`);
}

main();
