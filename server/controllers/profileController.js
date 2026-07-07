const { getUser, updateUser, userToMergedProfile } = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { calculateProfileScore } = require('../services/profileScoreService');
const recommendationsService = require('../services/recommendationsService');
const { assertAiAvailable } = require('../utils/aiServerClient');

const PKR_TO_USD = 280;

function validateProfileInput(body) {
  const errors = {};

  if (body.name !== undefined && body.name !== null && body.name !== '') {
    const nameStr = String(body.name).trim();
    if (nameStr.length < 2 || nameStr.length > 50 || !/^[a-zA-Z\s-]+$/.test(nameStr)) {
      errors.name = 'Name must be 2-50 characters, letters only';
    }
  }

  if (body.gpa !== undefined && body.gpa !== null && body.gpa !== '') {
    const gpaNum = Number(body.gpa);
    if (typeof body.gpa === 'boolean' || isNaN(gpaNum) || !isFinite(gpaNum)) {
      errors.gpa = 'GPA must be a valid number between 0.00 and 4.00';
    } else if (gpaNum < 0) {
      errors.gpa = 'GPA cannot be negative';
    } else if (gpaNum > 4.0) {
      errors.gpa = 'GPA cannot exceed 4.0';
    }
  }

  let computedUsd = null;
  if (body.budgetCurrency === 'PKR' || body.budgetInPkr !== undefined) {
    if (body.budgetInPkr !== undefined && body.budgetInPkr !== null && body.budgetInPkr !== '') {
      const pkrNum = Number(body.budgetInPkr);
      if (isNaN(pkrNum) || pkrNum < 0) {
        errors.maxBudget = 'Budget cannot be negative';
      } else if (pkrNum > 280000000) {
        errors.maxBudget = 'Budget cannot exceed 280,000,000 PKR ($1,000,000 USD)';
      } else {
        computedUsd = Math.round((pkrNum / PKR_TO_USD) * 100) / 100;
      }
    }
  } else if (body.maxBudget !== undefined && body.maxBudget !== null && body.maxBudget !== '') {
    const usdNum = Number(body.maxBudget);
    if (isNaN(usdNum) || usdNum < 0) {
      errors.maxBudget = 'Budget cannot be negative';
    } else if (usdNum > 1000000) {
      errors.maxBudget = 'Budget cannot exceed $1,000,000 USD';
    } else {
      computedUsd = Math.round(usdNum * 100) / 100;
    }
  }

  const validEduLevels = ['High School', 'Undergraduate', 'Postgraduate'];
  if (body.educationLevel && !validEduLevels.includes(body.educationLevel)) {
    errors.educationLevel = 'Please select a valid education level';
  }

  const validDegrees = ['Bachelors', 'Masters', 'PhD'];
  if (body.targetDegree && !validDegrees.includes(body.targetDegree)) {
    errors.targetDegree = 'Please select a valid target degree';
  }

  if (body.educationLevel === 'Postgraduate' && body.targetDegree === 'Bachelors') {
    errors.targetDegree = 'Target degree cannot be lower than current level';
  }

  if (body.major !== undefined && body.major !== null && body.major !== '') {
    const majorStr = String(body.major).trim();
    if (majorStr.length < 2 || majorStr.length > 100 || /^\d/.test(majorStr)) {
      errors.major = 'Please enter a valid field of study (2-100 characters, no starting numbers)';
    }
  }

  if (body.preferredCountries !== undefined && body.preferredCountries !== null) {
    if (!Array.isArray(body.preferredCountries)) {
      errors.preferredCountries = 'Preferred countries must be a list';
    } else if (body.preferredCountries.length > 10) {
      errors.preferredCountries = 'Maximum 10 countries allowed';
    }
  }

  if (body.englishTest !== undefined && body.englishTest !== null) {
    const et = body.englishTest;
    const validTests = ['IELTS', 'TOEFL', 'Duolingo', 'None'];
    if (et.testType && !validTests.includes(et.testType)) {
      errors.englishTestType = 'Invalid English test type selected';
    }

    if (et.testType && et.testType !== 'None' && et.score !== undefined && et.score !== null && et.score !== '') {
      const scoreNum = Number(et.score);
      if (isNaN(scoreNum)) {
        errors.englishTestScore = 'Score must be a number';
      } else if (et.testType === 'IELTS') {
        if (scoreNum < 0 || scoreNum > 9) errors.englishTestScore = 'IELTS score must be between 0.0 and 9.0';
      } else if (et.testType === 'TOEFL') {
        if (scoreNum < 0 || scoreNum > 120 || !Number.isInteger(scoreNum)) errors.englishTestScore = 'TOEFL score must be between 0 and 120';
      } else if (et.testType === 'Duolingo') {
        if (scoreNum < 10 || scoreNum > 160 || !Number.isInteger(scoreNum)) errors.englishTestScore = 'Duolingo score must be between 10 and 160';
      }
    }
  }

  if (body.workExperience !== undefined && body.workExperience !== null && body.workExperience !== '') {
    const expNum = Number(body.workExperience);
    if (isNaN(expNum) || expNum < 0 || expNum > 50 || (expNum * 2) % 1 !== 0) {
      errors.workExperience = 'Work experience must be between 0 and 50 years in 0.5 increments';
    }
  }

  if (body.publications !== undefined && body.publications !== null && body.publications !== '') {
    const pubNum = Number(body.publications);
    if (isNaN(pubNum) || pubNum < 0 || pubNum > 100 || !Number.isInteger(pubNum)) {
      errors.publications = 'Publications must be a number between 0 and 100';
    }
  }

  if (body.age !== undefined && body.age !== null && body.age !== '') {
    const ageNum = Number(body.age);
    if (isNaN(ageNum) || ageNum < 17 || ageNum > 45 || !Number.isInteger(ageNum)) {
      errors.age = 'Age must be between 17 and 45';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    computedUsd,
  };
}

exports.validateProfileInput = validateProfileInput;

function withComputedScores(user) {
  const evaluation = calculateProfileScore(user.profile);
  return {
    user: {
      ...user,
      profile: {
        ...user.profile,
        profileScore: evaluation.score,
        admissionChance: evaluation.admissionChance,
      },
    },
    breakdown: evaluation,
  };
}

exports.getProfileScore = catchAsync(async (req, res, next) => {
  const user = getUser();
  if (!user) {
    return next(new AppError('Profile not found', 404));
  }

  const evaluation = calculateProfileScore(user.profile);
  res.status(200).json({
    status: 'success',
    data: evaluation,
  });
});

exports.getProfile = catchAsync(async (req, res, next) => {
  const user = getUser();
  if (!user) {
    return next(new AppError('Profile not found', 404));
  }

  const { user: userWithScores, breakdown } = withComputedScores(user);
  res.status(200).json({
    status: 'success',
    data: { user: userWithScores, breakdown },
  });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  const user = getUser();
  if (!user) {
    return next(new AppError('Profile not found', 404));
  }

  const validation = validateProfileInput(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: validation.errors,
    });
  }

  const {
    name,
    gpa,
    educationLevel,
    residency,
    preferredCountries,
    avatar,
    age,
    major,
    englishTest,
    workExperience,
    researchExperience,
    publications,
    targetDegree,
  } = req.body;

  if (name !== undefined && name !== null) {
    user.name = String(name).trim();
  }

  if (!user.profile) user.profile = {};

  if (gpa !== undefined) {
    user.profile.gpa = (gpa === '' || gpa === null) ? null : Math.round(Number(gpa) * 100) / 100;
  }
  if (educationLevel !== undefined) user.profile.educationLevel = educationLevel || null;

  if (validation.computedUsd !== null) {
    user.profile.maxBudget = validation.computedUsd;
  } else if (req.body.maxBudget !== undefined) {
    user.profile.maxBudget = (req.body.maxBudget === '' || req.body.maxBudget === null)
      ? null
      : Math.round(Number(req.body.maxBudget) * 100) / 100;
  }

  if (residency !== undefined) user.profile.residency = residency || null;

  if (preferredCountries !== undefined && Array.isArray(preferredCountries)) {
    user.profile.preferredCountries = [...new Set(preferredCountries.map((c) => String(c).trim()).filter(Boolean))].slice(0, 10);
  }

  if (avatar !== undefined) user.profile.avatar = avatar;
  if (age !== undefined) user.profile.age = (age === '' || age === null) ? null : Number(age);

  if (major !== undefined && major !== null) {
    const mStr = String(major).trim();
    user.profile.major = mStr ? mStr.charAt(0).toUpperCase() + mStr.slice(1) : null;
  }

  if (englishTest !== undefined) {
    const testType = englishTest.testType || 'None';
    let scoreVal = null;
    if (testType !== 'None' && englishTest.score !== undefined && englishTest.score !== '' && englishTest.score !== null) {
      scoreVal = Number(englishTest.score);
    }
    user.profile.englishTest = { testType, score: scoreVal };
  }

  if (workExperience !== undefined) user.profile.workExperience = Number(workExperience || 0);

  if ('researchExperience' in req.body) {
    const resExp = Boolean(researchExperience);
    user.profile.researchExperience = resExp;
    if ('publications' in req.body) {
      const pubNum = Number(publications || 0);
      user.profile.publications = resExp ? pubNum : 0;
    } else if (!resExp) {
      user.profile.publications = 0;
    }
  } else if ('publications' in req.body) {
    const pubNum = Number(publications || 0);
    user.profile.publications = user.profile.researchExperience ? pubNum : 0;
  }

  if (targetDegree !== undefined) user.profile.targetDegree = targetDegree || null;

  const evaluation = calculateProfileScore(user.profile);
  user.profile.profileScore = evaluation.score;
  user.profile.admissionChance = evaluation.admissionChance;

  updateUser({ name: user.name, profile: user.profile });

  res.status(200).json({
    status: 'success',
    data: {
      user,
      breakdown: evaluation,
    },
  });
});

function resolveProfile() {
  const user = getUser();
  if (!user) {
    return { error: new AppError('Profile not found', 404) };
  }
  return { user, merged: userToMergedProfile(user) };
}

exports.getUniversityRecommendations = catchAsync(async (req, res, next) => {
  const result = resolveProfile();
  if (result.error) return next(result.error);

  try {
    await assertAiAvailable();
    const forceRefresh = req.query.refresh === 'true';
    console.info('[recommendations] universities start');
    const data = await recommendationsService.getUniversityRecommendations('local-user', result.merged, { forceRefresh });
    const universities = data.universities || [];
    const source = data.source || 'unknown';
    console.info(
      `[ProfileController] University recommendations: ${universities.length} items (source=${source})`,
    );
    res.status(200).json({
      status: 'success',
      data: {
        universities,
        profileSummary: data.profileSummary,
        disclaimer: data.disclaimer,
        profile: result.merged,
        source,
      },
    });
  } catch (err) {
    if (err.statusCode === 429 || err.status === 429) {
      return next(err);
    }
    console.error('[ProfileController] University recommendations failed:', err.message);
    if (err.cause?.code === 'TimeoutError' || err.name === 'TimeoutError' || /timeout/i.test(err.message)) {
      return next(new AppError(
        'Recommendations are taking longer than expected. Please wait a moment and refresh, or chat with Peri.',
        504,
      ));
    }
    return next(new AppError('Unable to fetch personalized university recommendations. Please try again or chat with Peri.', 503));
  }
});

exports.getScholarshipRecommendations = catchAsync(async (req, res, next) => {
  const result = resolveProfile();
  if (result.error) return next(result.error);

  try {
    await assertAiAvailable();
    const forceRefresh = req.query.refresh === 'true';
    console.info('[recommendations] scholarships start');
    const data = await recommendationsService.getScholarshipRecommendations('local-user', result.merged, { forceRefresh });
    const scholarships = data.scholarships || [];
    const source = data.source || 'unknown';
    console.info(
      `[ProfileController] Scholarship recommendations: ${scholarships.length} items (source=${source})`,
    );
    res.status(200).json({
      status: 'success',
      data: {
        scholarships,
        profileSummary: data.profileSummary,
        disclaimer: data.disclaimer,
        profile: result.merged,
        source,
      },
    });
  } catch (err) {
    if (err.statusCode === 429 || err.status === 429) {
      return next(err);
    }
    console.error('[ProfileController] Scholarship recommendations failed:', err.message);
    if (err.cause?.code === 'TimeoutError' || err.name === 'TimeoutError' || /timeout/i.test(err.message)) {
      return next(new AppError(
        'Scholarship recommendations are taking longer than expected. Please wait a moment and refresh, or chat with Peri.',
        504,
      ));
    }
    return next(new AppError('Unable to fetch personalized scholarship recommendations. Please try again or chat with Peri.', 503));
  }
});
