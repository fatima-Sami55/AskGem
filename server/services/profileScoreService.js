/**
 * server/services/profileScoreService.js
 * Pure deterministic logic for student Profile Scoring and Admission Chance calculation.
 */

function calculateProfileScore(profile = {}) {
  const gpa = profile.gpa !== undefined && profile.gpa !== null ? Number(profile.gpa) : null;
  const englishTest = profile.englishTest || {};
  const testType = englishTest.testType || 'None';
  const engScore = englishTest.score !== undefined && englishTest.score !== null ? Number(englishTest.score) : null;
  const workExperience = Number(profile.workExperience || 0);
  const researchExperience = Boolean(profile.researchExperience);
  const publications = Number(profile.publications || 0);
  const maxBudget = profile.maxBudget !== undefined && profile.maxBudget !== null ? Number(profile.maxBudget) : null;

  // 1. GPA (35 points)
  let gpaScore = 0;
  let gpaFeedback = "No GPA provided";
  if (gpa !== null) {
    if (gpa >= 3.7) { gpaScore = 35; gpaFeedback = "Strong GPA, highly competitive"; }
    else if (gpa >= 3.5) { gpaScore = 28; gpaFeedback = "Good GPA, competitive for most programs"; }
    else if (gpa >= 3.3) { gpaScore = 22; gpaFeedback = "Above average GPA, solid baseline"; }
    else if (gpa >= 3.0) { gpaScore = 15; gpaFeedback = "Average GPA, meets minimum requirements"; }
    else if (gpa >= 2.7) { gpaScore = 8; gpaFeedback = "Below average GPA, may limit options"; }
    else { gpaScore = 3; gpaFeedback = "Low GPA, requires compensating factors"; }
  }

  // 2. English Test (25 points)
  let engScoreVal = 0;
  let engFeedback = "No English language proficiency test taken";
  if (testType === 'IELTS') {
    if (engScore !== null) {
      if (engScore >= 7.5) { engScoreVal = 25; engFeedback = "Excellent IELTS score"; }
      else if (engScore >= 7.0) { engScoreVal = 20; engFeedback = "Strong IELTS score"; }
      else if (engScore >= 6.5) { engScoreVal = 14; engFeedback = "Good IELTS score, meets standard requirements"; }
      else if (engScore >= 6.0) { engScoreVal = 8; engFeedback = "Satisfactory IELTS score"; }
      else { engScoreVal = 3; engFeedback = "Below standard IELTS score"; }
    } else {
      engFeedback = "IELTS selected but no score recorded";
    }
  } else if (testType === 'TOEFL') {
    if (engScore !== null) {
      if (engScore >= 100) { engScoreVal = 25; engFeedback = "Excellent TOEFL score"; }
      else if (engScore >= 90) { engScoreVal = 20; engFeedback = "Strong TOEFL score"; }
      else if (engScore >= 80) { engScoreVal = 14; engFeedback = "Good TOEFL score"; }
      else if (engScore >= 70) { engScoreVal = 8; engFeedback = "Satisfactory TOEFL score"; }
      else { engScoreVal = 3; engFeedback = "Below standard TOEFL score"; }
    } else {
      engFeedback = "TOEFL selected but no score recorded";
    }
  } else if (testType === 'Duolingo') {
    if (engScore !== null) {
      if (engScore >= 120) { engScoreVal = 20; engFeedback = "Strong Duolingo score"; }
      else if (engScore >= 100) { engScoreVal = 14; engFeedback = "Good Duolingo score"; }
      else { engScoreVal = 8; engFeedback = "Basic Duolingo score"; }
    } else {
      engFeedback = "Duolingo selected but no score recorded";
    }
  }

  // 3. Work Experience (15 points)
  let expScore = 0;
  let expFeedback = "No professional work experience";
  if (workExperience >= 3) { expScore = 15; expFeedback = "3+ years experience, highly valued"; }
  else if (workExperience >= 1) { expScore = 10; expFeedback = "1-2 years experience, good practical background"; }
  else if (workExperience > 0) { expScore = 5; expFeedback = "Less than 1 year experience"; }

  // 4. Research Experience (15 points)
  let researchScore = 0;
  let researchFeedback = "No research experience";
  if (researchExperience && publications > 0) {
    researchScore = 15;
    researchFeedback = `Active research with ${publications} publication(s)`;
  } else if (researchExperience) {
    researchScore = 10;
    researchFeedback = "Active research experience";
  }

  // 5. Budget (10 points)
  let budgetScore = 2;
  let budgetFeedback = "Very limited budget";
  if (maxBudget !== null) {
    if (maxBudget >= 20000) { budgetScore = 10; budgetFeedback = "Healthy budget for tuition and living costs"; }
    else if (maxBudget >= 10000) { budgetScore = 7; budgetFeedback = "Moderate budget, sufficient for public universities"; }
    else if (maxBudget >= 5000) { budgetScore = 4; budgetFeedback = "Tight budget, requires low-tuition or scholarship options"; }
  }

  const totalScore = Math.min(100, gpaScore + engScoreVal + expScore + researchScore + budgetScore);
  const rawChance = Math.round(totalScore * 0.85 + 5);
  const admissionChance = Math.min(95, Math.max(5, rawChance));

  // Identify Weak Areas & Improvements (Categories under 50% max)
  const weakAreas = [];
  const improvements = [];

  if (gpaScore < 17.5) {
    weakAreas.push("Low or missing GPA");
    improvements.push("Aim to raise GPA or highlight strong subject trends");
  }
  if (engScoreVal < 12.5) {
    weakAreas.push("No English test taken or score below standard");
    improvements.push("Take IELTS and target a score of 7.0+ or TOEFL 90+");
  }
  if (expScore < 7.5) {
    weakAreas.push("Limited or no work experience");
    improvements.push("Gain relevant internship or industry work experience");
  }
  if (researchScore < 7.5) {
    weakAreas.push("No research experience or publications");
    improvements.push("Join a university research lab or publish a paper");
  }
  if (budgetScore < 5) {
    weakAreas.push("Annual budget below $10,000 USD");
    improvements.push("Apply for fully-funded scholarships or target low-tuition countries like Germany");
  }

  // Expected improvement calculation
  const potentialGpa = gpaScore < 17.5 ? 35 : gpaScore;
  const potentialEng = engScoreVal < 12.5 ? 25 : engScoreVal;
  const potentialExp = expScore < 7.5 ? 15 : expScore;
  const potentialRes = researchScore < 7.5 ? 15 : researchScore;
  const potentialBud = budgetScore < 5 ? 10 : budgetScore;
  const potentialTotal = Math.min(100, potentialGpa + potentialEng + potentialExp + potentialRes + potentialBud);
  const afterChance = Math.min(95, Math.max(5, Math.round(potentialTotal * 0.85 + 5)));

  return {
    score: totalScore,
    admissionChance,
    breakdown: {
      gpa: { score: gpaScore, max: 35, feedback: gpaFeedback },
      englishTest: { score: engScoreVal, max: 25, feedback: engFeedback },
      experience: { score: expScore, max: 15, feedback: expFeedback },
      research: { score: researchScore, max: 15, feedback: researchFeedback },
      budget: { score: budgetScore, max: 10, feedback: budgetFeedback }
    },
    weakAreas,
    improvements,
    expectedImprovement: {
      current: admissionChance,
      afterImprovements: afterChance
    }
  };
}

module.exports = {
  calculateProfileScore
};
