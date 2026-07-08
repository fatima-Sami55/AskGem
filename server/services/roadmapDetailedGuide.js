/**
 * Pre-researched roadmap step guides — used when AI server is unavailable
 * and merged into AI responses for consistent expandable detail.
 */

const GERMAN_UNIVERSITIES = [
  {
    name: 'Technical University of Munich (TUM)',
    url: 'https://www.tum.de/en/studies/degree-programs',
    program: 'M.Sc. Informatics / Computer Science',
    tuition: 'No tuition — ~€152 semester contribution + ~€99 student union fee',
    minGpa: '2.7 German grade (roughly 3.3/4.0 CGPA)',
    ielts: '6.5 overall (6.0 per band) or TOEFL iBT 88',
    deadline: 'Winter intake: apply by 31 May–15 Jul depending on program; check TUMonline portal',
    applyVia: 'TUMonline application portal (direct — no uni-assist for most TUM programs)',
  },
  {
    name: 'RWTH Aachen University',
    url: 'https://www.rwth-aachen.de/en/studies/study-programs',
    program: 'M.Sc. Computer Science',
    tuition: 'No tuition — semester contribution ~€300/semester',
    minGpa: '2.5 German grade (roughly 3.0/4.0 CGPA)',
    ielts: '6.5 overall or TOEFL iBT 90',
    deadline: 'Winter: 1 Mar–15 Jul; Summer: 1 Sep–15 Jan (verify on RWTH portal)',
    applyVia: 'RWTHonline portal (direct application)',
  },
  {
    name: 'Technical University of Berlin (TU Berlin)',
    url: 'https://www.tu.berlin/en/studies/study-programs',
    program: 'M.Sc. Computer Science',
    tuition: 'No tuition — semester fee ~€300',
    minGpa: '2.7 German grade; strong CS background required',
    ielts: '6.5 overall or TOEFL iBT 87',
    deadline: 'Winter: typically 1 Apr–31 May; always confirm on TU Berlin site',
    applyVia: 'uni-assist VPD + TU Berlin application portal',
  },
  {
    name: 'LMU Munich',
    url: 'https://www.lmu.de/en/study/all-degrees-and-programs/',
    program: 'M.Sc. Computer Science',
    tuition: 'No tuition — semester contribution ~€150',
    minGpa: '2.7 German grade (competitive — higher is better)',
    ielts: '6.5 overall',
    deadline: 'Winter: 1 Apr–15 Jul; check LMU online application portal',
    applyVia: 'Direct via LMU online portal',
  },
  {
    name: 'University of Stuttgart',
    url: 'https://www.uni-stuttgart.de/en/study/study-programs/',
    program: 'M.Sc. Computer Science',
    tuition: 'No tuition — semester contribution ~€170',
    minGpa: '2.5 German grade',
    ielts: '6.0–6.5 depending on program track',
    deadline: 'Winter: 15 Dec–15 Feb (early!) — verify current cycle on C@MPUS portal',
    applyVia: 'C@MPUS portal (direct)',
  },
  {
    name: 'TU Dresden',
    url: 'https://tu-dresden.de/studium/vor-dem-studium/studienangebot/sins/sins_studiengaenge?lang=en',
    program: 'M.Sc. Computer Science',
    tuition: 'No tuition — semester contribution ~€280',
    minGpa: '2.5 German grade',
    ielts: '6.5 overall or TOEFL iBT 79',
    deadline: 'Winter: 1 Apr–15 Jul via SELMA portal',
    applyVia: 'SELMA portal (direct)',
  },
];

function englishTestLabel(profile) {
  const t = profile?.englishTest?.testType;
  if (!t || t === 'None') return 'IELTS or TOEFL';
  return t;
}

function step(title, summary, details, url = null) {
  return { title, summary, details, url };
}

function buildGermanyMastersPhases(profile) {
  const major = profile.major || 'Computer Science';
  const target = profile.targetDegree || 'Masters';
  const nationality = profile.residency || 'Pakistani';
  const testLabel = englishTestLabel(profile);
  const cgpa = profile.gpa != null ? profile.gpa : null;
  const gpaLine = cgpa != null
    ? `Your CGPA is ${cgpa} — prioritize RWTH Aachen, Stuttgart, and Dresden (2.5 grade scale) if below 3.3.`
    : 'Add your CGPA to your profile so Peri can flag which programs are realistic.';

  const uniSteps = GERMAN_UNIVERSITIES.map((u) => step(
    `${u.name} — ${u.program}`,
    `${u.tuition}. Minimum: ${u.minGpa}, ${u.ielts}.`,
    [
      `Official page: ${u.url}`,
      `Application deadline: ${u.deadline}`,
      `How to apply: ${u.applyVia}`,
      'Required docs: APS certificate, degree transcripts (English/German), CV, SOP, 2 reference letters, English test score',
      'If the program is restricted (Numerus Clausus), apply as early as possible within the window',
    ],
    u.url,
  ));

  return [
    {
      phase: 1,
      title: `Exams, APS & eligibility — ${major}`,
      timeline: 'Months 1–2',
      description: `Set up English test, APS verification, and document prep before you shortlist universities.${cgpa != null ? ` ${gpaLine}` : ''}`,
      steps: [
        `Register and prepare for ${testLabel}.`,
        'Start APS certificate application (Pakistani students).',
        'Gather and attest all academic documents.',
      ],
      stepDetails: [
        step(
          `Register for ${testLabel} Academic`,
          'German CS master\'s programs typically require IELTS 6.5 overall (6.0 per band) or TOEFL iBT 87–90.',
          [
            'Go to ielts.org → Book a test → Choose IELTS Academic (not General Training)',
            'Select a test center in Pakistan (British Council centers in Lahore, Islamabad, Karachi, etc.)',
            'Book 8–10 weeks before your earliest university deadline — seats fill quickly',
            'Target: 6.5 overall, minimum 6.0 in Listening, Reading, Writing, Speaking',
            'On test day bring passport; results arrive in ~13 days',
            'Use the TRF number to send scores electronically to each university during application',
          ],
          'https://www.ielts.org/for-test-takers/book-a-test',
        ),
        step(
          'Apply for APS Certificate (Pakistani degrees)',
          'Required by almost all German universities to verify Pakistani degrees. Processing takes weeks — start immediately.',
          [
            'Visit aps.org.pk and create an account',
            'Documents needed: passport copy, passport photo, HEC-attested degrees & transcripts, CV, optional German/English translations',
            'Complete the online form, upload scans, and pay the application fee (check current amount on site)',
            'Processing time: typically 4–8 weeks — apply in Month 1, not after admissions open',
            'You receive an APS certificate PDF to upload with every German university application',
            'Without APS, your application will be rejected regardless of grades',
          ],
          'https://www.aps.org.pk/',
        ),
        step(
          'Prepare academic documents',
          'German admissions require officially attested, translated documents.',
          [
            'Request official transcripts from your university registrar (sealed envelopes if required)',
            'Get HEC attestation for degrees and transcripts (hec.gov.pk)',
            'Translate documents to English or German via a certified translator if not already in English',
            'Prepare module descriptions / syllabus for each course (needed by uni-assist VPD for some universities)',
            'Draft a 1-page academic CV listing education, projects, skills, and any work experience',
          ],
        ),
        step(
          'Understand uni-assist vs direct applications',
          'Some universities use uni-assist for preliminary document verification (VPD); others accept direct applications.',
          [
            'uni-assist checks whether your foreign degree is equivalent to a German bachelor\'s (VPD)',
            'Fee: ~€75 for first university + ~€30 for each additional (check uni-assist.de for current fees)',
            'Processing: 4–6 weeks — submit early',
            'TUM, RWTH Aachen, LMU: usually direct portals; TU Berlin: often requires uni-assist VPD first',
            'Check each university\'s admissions page from Phase 2 before paying uni-assist fees',
          ],
          'https://www.uni-assist.de/en/',
        ),
      ],
    },
    {
      phase: 2,
      title: `Shortlist universities & draft SOP — ${major}`,
      timeline: 'Months 3–4',
      description: `Pick 5–6 programs matched to your profile and prepare application essays.${gpaLine}`,
      steps: [
        `Compare ${GERMAN_UNIVERSITIES.length} curated ${major} programs in Germany.`,
        'Write Statement of Purpose (800–1,000 words).',
        'Request 2–3 academic reference letters.',
      ],
      stepDetails: [
        ...uniSteps,
        step(
          'Write your Statement of Purpose (SOP)',
          'One SOP per university — tailor the last paragraph to each program.',
          [
            'Structure: (1) Hook — why CS and why now, (2) Academic background & key projects, (3) Research/work experience, (4) Why this specific program & university, (5) Career goals in 5 years',
            'Length: 800–1,000 words (check each portal\'s limit — some ask 500, some 1,500)',
            'Mention specific professors, labs, or courses at that university — shows genuine research',
            'Avoid generic praise; explain fit with the program\'s curriculum (e.g., TUM robotics track, RWTH HPC focus)',
            'Have a professor or senior colleague review before submission',
          ],
        ),
        step(
          'Request reference letters',
          'Most programs require 2 academic references from professors who know your work.',
          [
            'Choose professors from core CS courses where you earned strong grades',
            'Email 3–4 weeks before deadlines with: your CV, transcript, SOP draft, list of programs, and deadline dates',
            'Provide a template bullet list of projects they can mention (they often appreciate this)',
            'Follow up politely after 10 days if no response',
            'Some portals use online reference systems — register your referees\' emails early',
          ],
        ),
      ],
    },
    {
      phase: 3,
      title: `Submit applications & apply for funding — ${nationality} students`,
      timeline: 'Months 5–8',
      description: 'Submit each portal application before its deadline and track confirmations.',
      steps: [
        'Submit applications via official portals (TUMonline, RWTHonline, uni-assist, etc.).',
        'Apply for DAAD and university scholarships.',
        'Prepare financial proof documents.',
      ],
      stepDetails: [
        step(
          'Submit university applications',
          'Apply to 5–6 programs with staggered deadlines — start with the earliest (Stuttgart: Dec–Feb).',
          [
            'Create accounts on each portal (TUMonline, RWTHonline, SELMA, C@MPUS, etc.) before deadline week',
            'Upload: APS certificate, transcripts, CV, SOP, reference contacts, English score, passport',
            'Pay application fees where required (uni-assist ~€75+, some portals free)',
            'Save confirmation PDFs and application IDs for each submission',
            'Check portal status weekly; respond to any document requests within 48 hours',
            'Typical decision time: 4–12 weeks after deadline closes',
          ],
        ),
        step(
          'Apply for DAAD scholarships',
          'DAAD offers stipends for international graduates — competitive but worth applying.',
          [
            'Search DAAD scholarship database: daad.de → Scholarships → filter Pakistan + Masters + your field',
            'Common options: EPOS (development-related), Study Scholarships for graduates, university-specific DAAD awards',
            'Each scholarship has its own deadline — often 6–12 months before study start',
            'Prepare: SOP, CV, reference letters, sometimes a research proposal',
            'Apply through DAAD portal AND ensure your university admission application is also submitted',
          ],
          'https://www.daad.de/en/studying-in-germany/scholarships/',
        ),
        step(
          'Prepare financial proof (for visa later)',
          'Even if tuition-free, you must prove living costs for the visa.',
          [
            'Blocked account (Sperrkonto): ~€11,904/year (2024/25 figure — verify current amount on embassy site)',
            'Alternative: scholarship letter, formal sponsorship (Verpflichtungserklärung) from a German resident',
            'Bank statements: some embassies accept 6 months of personal savings history',
            'Start saving documentation now — you\'ll need it within weeks of receiving admission',
          ],
        ),
      ],
    },
    {
      phase: 4,
      title: 'Visa, blocked account & departure',
      timeline: 'Months 9–12',
      description: 'After receiving your Zulassung (admission letter), complete visa and enrollment steps.',
      steps: [
        'Receive Zulassung and open blocked bank account.',
        'Book visa appointment at German Embassy / VFS.',
        'Enroll at university and arrange housing.',
      ],
      stepDetails: [
        step(
          'Receive admission (Zulassung) and review conditions',
          'Your admission letter lists enrollment deadline and any conditions (e.g., missing document).',
          [
            'Download the Zulassung PDF from the university portal immediately',
            'Note the Immatrikulation (enrollment) deadline — usually 2–4 weeks after acceptance',
            'If conditional (e.g., pending final transcript), submit the missing item before the deadline',
            'Pay semester contribution fee to receive enrollment confirmation',
          ],
        ),
        step(
          'Open a blocked bank account (Sperrkonto)',
          'Required for student visa unless you have a full DAAD scholarship covering living costs.',
          [
            'Compare Fintiba (fintiba.com) and Expatrio (expatrio.com) — both are embassy-recognized',
            'You\'ll need: passport, admission letter, address; transfer the full blocked amount (~€11,904 + setup fee)',
            'Processing: 1–2 weeks for account opening + 1–2 weeks for embassy confirmation letter',
            'Download the Sperrbestätigung (blocked account confirmation) for your visa file',
          ],
          'https://www.fintiba.com/',
        ),
        step(
          'Apply for national visa (Type D) — student',
          'Apply at the German Embassy in Islamabad or via VFS Global.',
          [
            'Book appointment: pakistan.diplo.de → Visa → National visa → Study',
            'Documents: passport, biometric photos, Zulassung, APS, blocked account proof, travel health insurance, CV, motivation letter, accommodation proof if available',
            'Visa fee: ~€75 (check current fee); processing: 4–12 weeks',
            'Do NOT book one-way flights until visa is approved',
            'Register your address in Germany within 2 weeks of arrival (Anmeldung at Bürgeramt)',
          ],
          'https://pakistan.diplo.de/pk-en/service/visa-visa',
        ),
        step(
          'Pre-departure checklist',
          'Final steps before flying to Germany.',
          [
            'Get travel health insurance valid from arrival date until statutory insurance kicks in',
            'Book temporary housing (student dorm waitlists are long — try Studierendenwerk or WG-gesucht.de)',
            'Complete online enrollment (Immatrikulation) on the university portal before semester start',
            'Bring originals of all documents you uploaded (APS, degrees, transcripts, passport)',
            'Open a German bank account after Anmeldung for rent and daily expenses',
          ],
        ),
      ],
    },
  ];
}

function buildPersonalizedGaps(profile) {
  const testLabel = englishTestLabel(profile);
  const score = profile?.englishTest?.score;
  const cgpa = profile.gpa;
  const countries = profile.preferredCountries?.length ? profile.preferredCountries : ['Germany'];
  const countryStr = countries.slice(0, 3).join(', ');
  const target = profile.targetDegree || 'Masters';
  const major = profile.major || 'Computer Science';
  const gaps = [];

  if (!score) {
    gaps.push(`No ${testLabel} score yet — most ${target} ${major} programs in ${countryStr} require IELTS 6.5 or TOEFL ~88+.`);
  } else {
    gaps.push(`Confirm whether your ${testLabel} score (${score}) meets each shortlisted program's minimum.`);
  }

  if (cgpa != null && cgpa < 3.3) {
    gaps.push(`CGPA ${cgpa} may be below competitive cutoffs at TUM/LMU — prioritize RWTH, Stuttgart, and Dresden.`);
  } else if (cgpa != null) {
    gaps.push(`CGPA ${cgpa} is competitive for most public universities in ${countryStr}.`);
  }

  if (profile.maxBudget == null) {
    gaps.push('Budget not set — plan ~€934/month living costs (blocked account amount) plus semester fees.');
  }

  if (countries.includes('Germany') && (profile.residency || 'Pakistani') === 'Pakistani') {
    gaps.push('APS certificate not started — required for all German applications; processing takes 4–8 weeks.');
  }

  return gaps.slice(0, 5);
}

function buildPersonalizedRecommendations(profile) {
  const testLabel = englishTestLabel(profile);
  const countries = profile.preferredCountries?.length ? profile.preferredCountries : ['Germany'];
  const countryStr = countries.slice(0, 3).join(', ');
  const target = profile.targetDegree || 'Masters';
  const major = profile.major || 'Computer Science';

  return [
    `Book ${testLabel} for Month 1 if you don't have a valid score — winter intake deadlines start as early as December (Stuttgart).`,
    `Apply to 5–6 ${major} programs across ${countryStr} with a mix of reach (TUM) and match (RWTH, Dresden) schools.`,
    'Start APS at aps.org.pk this week — it blocks every German application until complete.',
    'Draft your SOP using the structure in Phase 2 and customize the final paragraph per university.',
    'Open a blocked account within 2 weeks of receiving admission — visa appointments fill up fast.',
  ].slice(0, 5);
}

function buildDetailedRoadmap(profile) {
  const countries = profile.preferredCountries?.length ? profile.preferredCountries : ['Germany'];
  const countryStr = countries.slice(0, 3).join(', ');
  const target = profile.targetDegree || 'Masters';
  const major = profile.major || 'Computer Science';

  const phases = countries.includes('Germany')
    ? buildGermanyMastersPhases(profile)
    : buildGermanyMastersPhases(profile); // default to Germany guide until more countries added

  return {
    title: `${target} in ${countryStr} — Step-by-Step Plan (${major})`,
    overallTimeline: '12-month preparation roadmap with actionable details',
    phases,
    gaps: buildPersonalizedGaps(profile),
    recommendations: buildPersonalizedRecommendations(profile),
    opportunities: GERMAN_UNIVERSITIES.map((u, i) => ({
      name: u.name,
      type: 'program',
      country: 'Germany',
      url: u.url,
      matchScore: null,
      keyDeadline: u.deadline.split(';')[0],
      fundingType: 'Tuition-Free (Semester Fee Only)',
      whyItFits: `${u.program}. ${u.tuition}. ${u.minGpa}, ${u.ielts}.`,
      summary: `${u.program} at ${u.name}.`,
    })),
  };
}

function mergeDetailedIntoRoadmap(roadmap, profile) {
  const detailed = buildDetailedRoadmap(profile);
  const detailedByPhase = Object.fromEntries(detailed.phases.map((p) => [p.phase, p]));

  const phases = (roadmap?.phases?.length ? roadmap.phases : detailed.phases).map((phase, idx) => {
    const num = phase.phase || idx + 1;
    const rich = detailedByPhase[num];
    if (!rich) return phase;
    return {
      ...phase,
      title: rich.title || phase.title,
      description: rich.description || phase.description,
      steps: rich.steps?.length ? rich.steps : phase.steps,
      stepDetails: rich.stepDetails || phase.stepDetails || [],
    };
  });

  return {
    ...roadmap,
    title: detailed.title || roadmap.title,
    overallTimeline: roadmap.overallTimeline || detailed.overallTimeline,
    phases,
    gaps: roadmap.gaps?.length >= 2 ? roadmap.gaps : detailed.gaps,
    recommendations: roadmap.recommendations?.length >= 2 ? roadmap.recommendations : detailed.recommendations,
    opportunities: roadmap.opportunities?.length ? roadmap.opportunities : detailed.opportunities,
  };
}

module.exports = {
  buildDetailedRoadmap,
  mergeDetailedIntoRoadmap,
  englishTestLabel,
};
