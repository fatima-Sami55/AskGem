const { getAiServerHeaders, getAiServerUrl } = require('../utils/aiServerClient');

/**
 * server/services/profileExtractorService.js
 * Pure JavaScript regex-based profile attribute extractor.
 */
function extractName(message, currentContext) {
  const msg = message.trim();
  const nonNameWords = new Set([
    'student', 'pakistani', 'from', 'currently', 'a', 'an', 'the',
    'going', 'planning', 'trying', 'here', 'in', 'at', 'doing',
    'working', 'living', 'studying', 'pursuing', 'looking', 'interested',
    'excited', 'happy', 'sad', 'passionate', 'applying', 'seeking', 'wanting',
    'ready', 'about', 'some', 'any', 'none', 'nothing', 'someone', 'somebody',
    'anyone', 'anybody', 'everyone', 'everybody', 'one', 'two', 'three',
    'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'major', 'gpa', 'cgpa', 'school', 'college', 'university', 'academic',
    'freshman', 'sophomore', 'junior', 'senior', 'grad', 'graduate', 'undergrad',
    'undergraduate', 'study', 'motivated', 'highly',
    'computer', 'science', 'engineering', 'business', 'medicine', 'law',
    'interested', 'passionate', 'about', 'studying', 'software', 'data',
    'artificial', 'intelligence', 'machine', 'learning', 'cybersecurity'
  ]);

  const patterns = [
    /(?:my\s+name\s+is|call\s+me|this\s+is)\s+([a-zA-Z\s]{2,50})/i,
    /(?:i\s+am|i'?m)\s+([a-zA-Z\s]{2,50})/i
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      const words = match[1].trim().split(/\s+/).filter(Boolean);
      const validWords = [];

      for (const w of words) {
        const lowerW = w.toLowerCase();
        if (nonNameWords.has(lowerW)) break;
        if (/^[a-zA-Z]{2,}$/.test(w)) {
          const capitalized = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          validWords.push(capitalized);
        } else {
          break;
        }
        if (validWords.length === 3) break;
      }

      if (validWords.length > 0) {
        const extractedName = validWords.join(' ');
        if (extractedName.length <= 50) {
          if (currentContext && currentContext.name) {
            const existingLower = currentContext.name.trim().toLowerCase();
            const newLower = extractedName.toLowerCase();

            // 1. If new name is a substring of existing name (and not identical) -> ignore (e.g. "Fatima" when context is "Fatima Sami")
            if (existingLower.includes(newLower) && existingLower !== newLower) {
              if (DEBUG_ASKPERI) console.log('[extractName] conflict: REJECTED (substring of existing name)');
              return undefined;
            }

            if (existingLower === newLower) {
              if (DEBUG_ASKPERI) console.log('[extractName] conflict: REJECTED (identical to existing name)');
              return undefined;
            }

            if (DEBUG_ASKPERI) console.log('[extractName] conflict: ALLOWED (replacing existing name)');
          } else {
            if (DEBUG_ASKPERI) console.log('[extractName] conflict: ALLOWED (new name)');
          }
          return extractedName;
        }
      }
    }
  }

  return undefined;
}

function gpaOwnershipScore(message, matchIndex, matchedLength) {
  const windowStart = Math.max(0, matchIndex - 40);
  const windowEnd = Math.min(message.length, matchIndex + matchedLength + 40);
  const contextText = message.slice(windowStart, windowEnd).toLowerCase();
  let score = 0;
  if (/\b(?:my|mine|i\s+have|i\s+got|i\s+scored)\b/.test(contextText)) score += 3;
  if (/\b(?:friend'?s?|his|her|their|brother|sister|classmate|roommate)\b/.test(contextText)) score -= 2;
  return score;
}

function finalizeGpaCandidate(gpa, message, matchIndex, matchedLength, currentContext) {
  if (currentContext && currentContext.gpa !== null && currentContext.gpa !== undefined) {
    const diff = Math.abs(gpa - currentContext.gpa);
    if (diff < 0.05) return null;
  }
  return { gpa, score: gpaOwnershipScore(message, matchIndex, matchedLength) };
}

function extractGpa(message, currentContext) {
  const msg = message.toLowerCase();
  const candidates = [];

  const pctMatch = msg.match(/(?:percentage|c?gpa\s*percentage)\s*(?:is|of|=|:)?\s*(?:around|about)?\s*(\d+(?:[.,]\d+)?)/i) ||
                   msg.match(/(?:c?gpa|scored|score|got|marks)\s*(?:is|of|=|:)?\s*(?:around|about)?\s*(\d+(?:[.,]\d+)?)\s*(?:%|percent|marks)/i) ||
                   msg.match(/(\d+(?:[.,]\d+)?)\s*(?:%|percent)\s*(?:in|for|my|marks|fsc|matric|board)?/i) ||
                   msg.match(/(\d+(?:[.,]\d+)?)\s*%\s*marks/i);

  if (pctMatch) {
    const rawValStr = pctMatch[1].replace(',', '.');
    const val = parseFloat(rawValStr);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const gpa = Math.round((val / 100) * 4 * 100) / 100;
      const result = finalizeGpaCandidate(gpa, message, pctMatch.index, pctMatch[0].length, currentContext);
      if (result) candidates.push(result);
    }
  }

  const scale5Match = msg.match(/(?:c?gpa|scored|score)?\s*(?:is|of|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:out of|\/)\s*5\b/i);
  if (scale5Match) {
    const val = parseFloat(scale5Match[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0 && val <= 5) {
      const gpa = Math.round((val / 5) * 4 * 100) / 100;
      const result = finalizeGpaCandidate(gpa, message, scale5Match.index, scale5Match[0].length, currentContext);
      if (result) candidates.push(result);
    }
  }

  const scale4Match = msg.match(/(\d+(?:[.,]\d+)?)\s*(?:out of|\/)\s*4\b/i);
  if (scale4Match) {
    const val = parseFloat(scale4Match[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0 && val <= 4) {
      const result = finalizeGpaCandidate(val, message, scale4Match.index, scale4Match[0].length, currentContext);
      if (result) candidates.push(result);
    }
  }

  const stdPatterns = [
    /(?:my\s+)?(?:c?gpa|scored)\s*(?:is|of|=|:)?\s*(-?\d+(?:[.,]\d+)?)/gi,
    /\b(-?\d+(?:[.,]\d+)?)\s*c?gpa\b/gi,
  ];

  for (const pattern of stdPatterns) {
    let stdMatch;
    while ((stdMatch = pattern.exec(msg)) !== null) {
      const matchIndex = stdMatch.index;
      const matchedText = stdMatch[0];
      const windowStart = Math.max(0, matchIndex - 25);
      const windowEnd = Math.min(msg.length, matchIndex + matchedText.length + 25);
      const contextText = msg.slice(windowStart, windowEnd);
      if (/(?:ielts|toefl|duolingo|gre|sat|speaking|listening|reading|writing|band|test)/i.test(contextText)) {
        continue;
      }

      const rawStr = stdMatch[1].replace(',', '.');
      const val = parseFloat(rawStr);
      if (isNaN(val) || val < 0 || val > 4.0) continue;

      const gpa = Math.round(val * 100) / 100;
      const result = finalizeGpaCandidate(gpa, message, matchIndex, matchedText.length, currentContext);
      if (result) candidates.push(result);
    }
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].gpa;
}

const ENGLISH_TEST_NEGATION = /(?:haven'?t\s+taken|have\s+not\s+taken|not\s+yet|no\s+(?:ielts|toefl|duolingo|english\s+test)|not\s+taken|planning\s+to\s+take|plan\s+to\s+take)/i;

function extractEnglishTest(message, currentContext) {
  const msg = message.toLowerCase();

  if (ENGLISH_TEST_NEGATION.test(msg)) {
    if (currentContext && currentContext.englishTest && currentContext.englishTest.testType && currentContext.englishTest.testType !== 'None') {
      return undefined;
    }
    return { testType: 'None', score: null };
  }

  const candidates = [];

  // IELTS (flexible gap matching up to 40 chars)
  const ieltsMatch = msg.match(/ielts(?:[\s\w,'-]{0,40}?(?:score|band|got|of|is|=|:|\s))+(\d+(?:[.,]\d+)?)/i) ||
                     msg.match(/(?:i\s+got|score|band|scored)?\s*(\d+(?:[.,]\d+)?)(?:[\s\w,'-]{0,40}?)ielts/i);
  if (ieltsMatch) {
    const score = parseFloat(ieltsMatch[1].replace(',', '.'));
    if (score > 9.0) {
      candidates.push({ testType: 'IELTS', score: null });
    } else {
      candidates.push({ testType: 'IELTS', score: Math.round(score * 10) / 10 });
    }
  } else if (/\bielts\b/i.test(msg)) {
    candidates.push({ testType: 'IELTS', score: null });
  }

  // TOEFL
  const toeflMatch = msg.match(/toefl(?:[\s\w,'-]{0,40}?(?:score|got|of|is|=|:|\s))+(\d+)/i) ||
                     msg.match(/(?:scored|got|score)?\s*(\d+)(?:[\s\w,'-]{0,40}?)toefl/i);
  if (toeflMatch) {
    const score = parseInt(toeflMatch[1], 10);
    if (score > 120) {
      candidates.push({ testType: 'TOEFL', score: null });
    } else {
      candidates.push({ testType: 'TOEFL', score });
    }
  } else if (/\btoefl\b/i.test(msg)) {
    candidates.push({ testType: 'TOEFL', score: null });
  }

  // Duolingo
  const duoMatch = msg.match(/(?:duolingo|dpt)(?:[\s\w,'-]{0,40}?(?:english\s+test|score|got|of|is|=|:|\s))+(\d+)/i) ||
                   msg.match(/(\d+)(?:[\s\w,'-]{0,40}?)(?:duolingo|dpt)/i);
  if (duoMatch) {
    const score = parseInt(duoMatch[1], 10);
    if (score < 10 || score > 160) {
      candidates.push({ testType: 'Duolingo', score: null });
    } else {
      candidates.push({ testType: 'Duolingo', score });
    }
  } else if (/\bduolingo\b/i.test(msg)) {
    candidates.push({ testType: 'Duolingo', score: null });
  }

  if (candidates.length > 0) {
    // Pick highest valid score or first candidate
    let best = candidates[0];
    for (const c of candidates) {
      if (c.score !== null) {
        if (best.score === null || c.score > best.score) {
          best = c;
        }
      }
    }

    // Conflict detection (update if diff >= 0.5 in either direction)
    if (currentContext && currentContext.englishTest && currentContext.englishTest.testType) {
      const oldType = currentContext.englishTest.testType;
      const oldScore = currentContext.englishTest.score;
      if (best.testType === oldType && best.score !== null && oldScore !== null && oldScore !== undefined) {
        const scoreDiff = Math.abs(best.score - oldScore);
        if (scoreDiff < 0.5) {
          return undefined;
        }
      }
    }
    return best;
  }

  return undefined;
}

function extractCountries(message, currentContext) {
  const msg = message.toLowerCase();

  const knownList = [
    'Germany', 'France', 'Italy', 'Netherlands', 'Belgium',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Austria',
    'Switzerland', 'UK', 'USA', 'Canada', 'Australia',
    'New Zealand', 'Japan', 'South Korea', 'China',
    'Singapore', 'Malaysia', 'Turkey', 'Czech Republic',
    'Poland', 'Hungary',
  ];

  const countryAliases = {
    USA: /\b(united\s+states|the\s+us|america|\busa\b|the\s+usa|\bus\b)\b/i,
    UK: /\b(united\s+kingdom|britain|england|\buk\b|the\s+uk)\b/i,
    Netherlands: /\b(holland|netherlands|the\s+netherlands)\b/i,
    'South Korea': /\b(south\s+korea|korea)\b/i,
  };

  const detectMentioned = () => {
    const found = new Set();
    if (/english\s+speaking\s+countries/i.test(msg)) {
      ['UK', 'USA', 'Canada', 'Australia'].forEach((c) => found.add(c));
    }
    if (/european\s+countries|\beurope\b/i.test(msg)) {
      ['Germany', 'France', 'Netherlands', 'Belgium', 'Sweden', 'Austria', 'Italy'].forEach((c) => found.add(c));
    }
    Object.entries(countryAliases).forEach(([country, regex]) => {
      if (regex.test(msg)) found.add(country);
    });
    knownList.forEach((country) => {
      const regex = new RegExp(`\\b${country.replace(' ', '\\s+')}\\b`, 'i');
      if (regex.test(msg)) found.add(country);
    });
    return found;
  };

  const existing = currentContext && Array.isArray(currentContext.preferredCountries)
    ? currentContext.preferredCountries
    : [];

  const remove = [];
  knownList.forEach((country) => {
    const escaped = country.replace(' ', '\\s+');
    const removalPatterns = [
      new RegExp(`not\\s+interested\\s+in\\s+(?:the\\s+)?${escaped}(?:\\s+anymore|\\s+now)?\\b`, 'i'),
      new RegExp(`no\\s+longer\\s+interested\\s+in\\s+(?:the\\s+)?${escaped}\\b`, 'i'),
      new RegExp(`don'?t\\s+want\\s+(?:to\\s+go\\s+to\\s+)?(?:the\\s+)?${escaped}(?:\\s+anymore|\\s+now)?\\b`, 'i'),
      new RegExp(`(?:remove|drop)\\s+(?:the\\s+)?${escaped}\\b`, 'i'),
    ];
    if (removalPatterns.some((pattern) => pattern.test(msg))) {
      remove.push(country);
    }
  });

  const onlyMatch = msg.match(/\bonly\s+(?:interested\s+in\s+|want(?:\s+to\s+go\s+to)?\s+|(?:going\s+to\s+)?)?(.+)/i);
  const replaceOnly = Boolean(onlyMatch);
  const mentioned = detectMentioned();
  const add = Array.from(mentioned).filter((country) => !remove.includes(country));

  if (add.length === 0 && remove.length === 0) return undefined;

  let merged;
  if (replaceOnly && add.length > 0) {
    merged = add.slice(0, 10);
  } else if (remove.length > 0) {
    merged = existing.filter((c) => !remove.includes(c));
    merged = Array.from(new Set([...merged, ...add])).slice(0, 10);
  } else {
    merged = Array.from(new Set([...existing, ...add])).slice(0, 10);
  }

  return {
    preferredCountries: merged,
    _countryOps: { add, remove, replaceOnly },
  };
}

function extractBudget(message, currentContext) {
  const msg = message.toLowerCase();

  if (/fully\s+funded\s+only|zero\s+budget|no\s+budget(?![\w\s]*constraints)/i.test(msg)) {
    return 0;
  }

  if (/no\s+budget\s+constraints|unlimited\s+budget/i.test(msg)) {
    return 999999;
  }

  // 1. Check for explicit lac/lakh patterns e.g. "14 lac pkr", "around 14 lac", "10 lakh pkr" (BUG 2 fix)
  const lacMatch = msg.match(/(\d+(?:[.,]\d+)?)\s*(lac|lakh)\s*(pkr|rs|rupees|dollars|usd)?/i);
  if (lacMatch) {
    const num = parseFloat(lacMatch[1].replace(',', '.'));
    // lac/lakh is a South Asian unit (100,000). Even if user says "dollars", treat as PKR lac.
    const pkrVal = num * 100000;
    return Math.round(pkrVal / 280);
  }

  // 2. Check for currency symbol before number e.g. $15,000, €8000, £12000
  const symMatch = msg.match(/([$€£])\s*(\d+(?:[.,]\d+)?)\s*(k)?/i);
  if (symMatch) {
    const sym = symMatch[1];
    let num = parseFloat(symMatch[2].replace(',', ''));
    if (symMatch[3] === 'k') num *= 1000;

    let usdVal = num;
    if (sym === '€') usdVal = num * 1.1;
    else if (sym === '£') usdVal = num * 1.27;

    return Math.round(usdVal);
  }

  // 3. Check for explicit budget phrase or number with k / currency suffix
  const budgetMatch = msg.match(/(?:budget|annual\s+budget)\s*(?:is|of|=|:)?\s*(?:around|about|approx|approximately)?\s*(\d+(?:[.,]\d+)?)\s*(k)?\s*(dollars|usd|pkr|eur|gbp)?/i) ||
                      msg.match(/(\d+(?:[.,]\d+)?)\s*(k)\s*(dollars|usd|pkr|eur|gbp)?/i) ||
                      msg.match(/(\d+(?:[.,]\d+)?)\s+(dollars|usd|pkr|eur|gbp)\b/i);

  if (budgetMatch) {
    let num = parseFloat(budgetMatch[1].replace(',', ''));
    if (isNaN(num)) return undefined;

    if (budgetMatch[2] === 'k') num *= 1000;

    const curr = (budgetMatch[3] || budgetMatch[2] || '').toLowerCase();
    let usdVal = num;

    const isExplicitUsd = (curr === 'dollars' || curr === 'usd' || msg.includes('usd') || msg.includes('dollar') || msg.includes('$'));
    const isExplicitEur = (curr === 'eur' || msg.includes('eur') || msg.includes('€'));
    const isExplicitGbp = (curr === 'gbp' || msg.includes('gbp') || msg.includes('£'));
    const isExplicitPkr = (curr === 'pkr' || msg.includes('pkr') || msg.includes('rs') || msg.includes('rupees'));

    if (isExplicitEur) {
      usdVal = num * 1.1;
    } else if (isExplicitGbp) {
      usdVal = num * 1.27;
    } else if (isExplicitPkr) {
      usdVal = num / 280;
    } else if (!isExplicitUsd) {
      // If no explicit currency was provided, and the number is 20,000 or greater,
      // or if message/profile has a Pakistani context, we assume it's PKR.
      if (num >= 20000 || msg.includes('pakistan') || msg.includes('pakistani') || (currentContext && currentContext.residency === 'Pakistan')) {
        usdVal = num / 280;
      }
    }

    usdVal = Math.round(usdVal);
    if (usdVal >= 0 && usdVal <= 999999) {
      return usdVal;
    }
  }

  return undefined;
}

function extractEducationLevel(message) {
  // Strip target degree intent phrases so target intent isn't confused with current education level
  const msg = message.toLowerCase().replace(/(?:want\s+to\s+do|pursue|pursuing|applying?\s+for|target|goal\s+is)\s+(?:a\s+)?(?:masters?|phd|doctoral|bachelors?|ms|bs)(?:\s+degree)?(?:\s+abroad)?/gi, '');

  if (/doing\s+(?:my\s+)?masters|ms\s+student|postgrad|master'?s\s+student|in\s+my\s+ms|doing\s+msc|final\s+year\s+of\s+(?:my\s+)?masters|masters?\s+degree|in\s+(?:my\s+)?masters|completing\s+(?:my\s+)?masters|finishing\s+(?:my\s+)?masters|msc\s+student|my\s+ms\s+degree/i.test(msg)) {
    return 'Postgraduate';
  }

  if (/high\s+school|\bfsc\b|doing\s+(?:my\s+)?fsc|in\s+fsc|a\s*levels?|a\s+level\s+student|doing\s+a\s*levels?|12th\s+grade|matric|o\s*levels?|a-levels|f\.sc|intermediate|doing\s+intermediate/i.test(msg)) {
    return 'High School';
  }

  if (/doing\s+(?:my\s+)?bachelors|undergraduate|in\s+uni|doing\s+bs|doing\s+be|\bbscs\b|b\.s\.|b\.e\.|completed\s+my\s+bachelors|have\s+a\s+bs\s+degree|bachelor'?s\s+done|final\s+year|final\s+year\s+undergraduate|final\s+year\s+of\s+my\s+bachelors|completing\s+(?:my\s+)?bachelors|finishing\s+my\s+degree|[678]th\s+semester/i.test(msg)) {
    return 'Undergraduate';
  }

  return undefined;
}

function extractTargetDegree(message) {
  const msg = message.toLowerCase();

  if (/want\s+to\s+do\s+(?:a\s+)?phd|doctoral(?:\s+degree)?|doctorate(?:\s+abroad)?|phd\s+programs?|pursue\s+(?:a\s+)?phd(?:\s+degree)?|(?:a\s+)?phd\s+degree(?:\s+abroad)?|do\s+a\s+phd|go\s+for\s+(?:a\s+)?phd|apply\s+for\s+(?:a\s+)?phd(?:\s+programs?)?/i.test(msg)) {
    return 'PhD';
  }

  if (/want\s+(?:a\s+)?masters\b|want\s+to\s+do\s+(?:a\s+)?masters|ms\s+in|master'?s\s+degree|\bmsc\b|\bmba\b|pursue?\s+(?:a\s+)?masters?(?:\s+degree)?|pursuing\s+(?:a\s+)?masters?(?:\s+degree)?|apply\s+for\s+ms|masters?\s+abroad|ms\s+abroad|(?:a\s+)?masters?\s+degree(?:\s+abroad)?|do\s+a\s+masters|go\s+for\s+(?:a\s+)?masters|msc\s+abroad/i.test(msg)) {
    return 'Masters';
  }

  if (/bachelors\s+abroad|undergraduate\s+abroad|bs\s+abroad|want\s+to\s+do\s+(?:my\s+)?bachelors|pursue\s+(?:a\s+)?bachelors|(?:a\s+)?bachelors?\s+degree|do\s+my\s+bs\s+abroad|undergraduate\s+degree\s+abroad/i.test(msg)) {
    return 'Bachelors';
  }

  return undefined;
}

function extractMajor(message) {
  const msg = message.toLowerCase();

  const mappings = [
    { keys: ['computer science', 'cs'], name: 'Computer Science' },
    { keys: ['software engineering', 'software engeeinering', 'software engneering', 'software enginnering', 'software engg', 'se'], name: 'Software Engineering' },
    { keys: ['artificial intelligence', 'ai'], name: 'Artificial Intelligence' },
    { keys: ['machine learning', 'ml'], name: 'Machine Learning' },
    { keys: ['data science'], name: 'Data Science' },
    { keys: ['cybersecurity', 'cyber security'], name: 'Cybersecurity' },
    { keys: ['electrical engineering', 'electrical engeeinering', 'electrical engneering', 'electrical enginnering', 'electrical engg', 'ee'], name: 'Electrical Engineering' },
    { keys: ['mechanical engineering', 'mechanical engeeinering', 'mechanical engneering', 'mechanical enginnering', 'mechanical engg', 'mech eng', 'mech'], name: 'Mechanical Engineering' },
    { keys: ['civil engineering', 'civil engeeinering', 'civil engneering', 'civil enginnering', 'civil engg'], name: 'Civil Engineering' },
    { keys: ['chemical engineering', 'chemical engeeinering', 'chemical engneering', 'chemical enginnering', 'chemical engg'], name: 'Chemical Engineering' },
    { keys: ['biomedical engineering', 'biomedical engeeinering', 'biomedical engneering', 'biomedical enginnering', 'biomedical engg', 'bme'], name: 'Biomedical Engineering' },
    { keys: ['information technology', 'info tech', 'information tech', 'infotech'], name: 'Information Technology' },
    { keys: ['telecommunication engineering', 'telecom engineering', 'telecommunication engeeinering', 'telecom engg'], name: 'Telecommunication Engineering' },
    { keys: ['environmental engineering', 'environmental engeeinering', 'environmental engg'], name: 'Environmental Engineering' },
    { keys: ['business administration', 'bba', 'mba', 'business'], name: 'Business Administration' },
    { keys: ['economics'], name: 'Economics' },
    { keys: ['mathematics', 'maths', 'math'], name: 'Mathematics' },
    { keys: ['physics'], name: 'Physics' },
    { keys: ['biology'], name: 'Biology' },
    { keys: ['medicine', 'mbbs'], name: 'Medicine' },
    { keys: ['law', 'llb'], name: 'Law' },
    { keys: ['finance'], name: 'Finance' },
    { keys: ['accounting'], name: 'Accounting' }
  ];

  const contextRegex = /(?:studying|study|want\s+to\s+do|my\s+field\s+is|interested\s+in|major\s+in|pursuing|student|background\s+in|degree\s+in|bachelors?\s+in|masters?\s+in|phd\s+in|bs\s+in|ms\s+in|enrolled\s+in)\b/i;
  if (!contextRegex.test(msg)) {
    return undefined;
  }

  for (const item of mappings) {
    for (const key of item.keys) {
      const regex = new RegExp(`\\b${key.replace(' ', '\\s+')}\\b`, 'i');
      if (regex.test(msg)) {
        return item.name;
      }
    }
  }

  return undefined;
}

function extractWorkExperience(message) {
  const msg = message.toLowerCase();

  if (/no\s+work\s+experience|fresher|no\s+experience|just\s+graduated|fresh\s+graduate|no\s+job|i\s+am\s+a\s+student/i.test(msg)) {
    return 0;
  }

  const yearMatch = msg.match(/(\d+(?:\.\d+)?)\s*years?\s+(?:of\s+)?(?:[\w-]+\s+)?experience/i) ||
                    msg.match(/worked\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*years?/i) ||
                    msg.match(/(\d+(?:\.\d+)?)\s*year\s+(?:work\s+)?experience/i) ||
                    msg.match(/(\d+(?:\.\d+)?)\s*years?\s+internship/i);
  if (yearMatch) {
    return parseFloat(yearMatch[1]);
  }

  const monthMatch = msg.match(/(\d+)\s*months?\s+(?:of\s+)?(?:[\w-]+\s+)?experience/i) ||
                     msg.match(/(\d+)\s*months?\s+internship/i) ||
                     msg.match(/worked\s+(?:for\s+)?(\d+)\s*months?/i);
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    return Math.round((months / 12) * 2) / 2;
  }

  return undefined;
}

function extractResearchExperience(message) {
  const msg = message.toLowerCase();

  if (/no\s+research|haven'?t\s+done\s+research|no\s+research\s+experience|never\s+done\s+research/i.test(msg)) {
    return false;
  }

  if (/done\s+(?:some\s+)?research|research\s+experience|worked\s+in\s+a\s+lab|published\s+a\s+paper|have\s+publications|research\s+background|worked\s+with\s+professor|thesis\s+research|fyp\s+research/i.test(msg)) {
    return true;
  }

  return undefined;
}

function extractPublications(message) {
  const msg = message.toLowerCase();

  if (/haven'?t\s+published\s+(?:any\s+papers?|anything)|no\s+publications|zero\s+publications|no\s+papers\s+published|don'?t\s+have\s+any\s+publications/i.test(msg)) {
    return 0;
  }

  const numMatch = msg.match(/published\s+(\d+|one|two)\s+papers?/i) ||
                   msg.match(/(\d+|one|two)\s+publications?/i) ||
                   msg.match(/(\d+|one|two)\s+research\s+papers?/i);

  if (numMatch) {
    const str = numMatch[1];
    if (str === 'one') return 1;
    if (str === 'two') return 2;
    const val = parseInt(str, 10);
    return isNaN(val) ? undefined : val;
  }

  return undefined;
}

function extractAge(message) {
  const msg = message.toLowerCase();

  const match = msg.match(/i\s+am\s+(\d+)(?:\s+years?)?(?:\s+old)?\b/i) ||
                msg.match(/i'?m\s+(\d+)(?:\s+years?)?(?:\s+old)?\b/i) ||
                msg.match(/(?:my\s+)?age\s+(?:is\s+)?(\d+)\b/i) ||
                msg.match(/(\d+)\s+years?\s+old\b/i) ||
                msg.match(/(\d+)\s+year\s+old\b/i);

  if (match) {
    const age = parseInt(match[1], 10);
    if (age >= 15 && age <= 40) {
      return age;
    }
  }

  return undefined;
}

/**
 * Main export function: extractFromMessage
 */
function extractFromMessage(message, currentContext = {}) {
  const result = {};

  const name = extractName(message, currentContext);
  if (name !== undefined) result.name = name;

  const gpa = extractGpa(message, currentContext);
  if (gpa !== undefined) result.gpa = gpa;

  const englishTest = extractEnglishTest(message, currentContext);
  if (englishTest !== undefined) result.englishTest = englishTest;

  const preferredCountries = extractCountries(message, currentContext);
  if (preferredCountries !== undefined) {
    result.preferredCountries = preferredCountries.preferredCountries;
    if (preferredCountries._countryOps) {
      result._countryOps = preferredCountries._countryOps;
    }
  }

  const maxBudget = extractBudget(message, currentContext);
  if (maxBudget !== undefined) result.maxBudget = maxBudget;

  const educationLevel = extractEducationLevel(message);
  if (educationLevel !== undefined) result.educationLevel = educationLevel;

  const targetDegree = extractTargetDegree(message);
  if (targetDegree !== undefined) result.targetDegree = targetDegree;

  const major = extractMajor(message);
  if (major !== undefined) result.major = major;

  const workExperience = extractWorkExperience(message);
  if (workExperience !== undefined) result.workExperience = workExperience;

  const researchExperience = extractResearchExperience(message);
  if (researchExperience !== undefined) {
    result.researchExperience = researchExperience;
  }

  const publications = extractPublications(message);
  if (publications !== undefined) {
    result.publications = publications;
    if (publications > 0) {
      result.researchExperience = true;
    } else if (publications === 0 && result.researchExperience === undefined) {
      result.researchExperience = false;
    }
  }

  const age = extractAge(message);
  if (age !== undefined) result.age = age;

  const keys = Object.keys(result);
  if (keys.length > 0 && DEBUG_ASKPERI) {
    console.log(`[ProfileExtractorService] Extracted fields: ${keys.join(', ')}`);
  }

  return result;
}

const CONFIDENCE_THRESHOLD = 0.75;
const EXTRACT_TIMEOUT_MS = Number(process.env.EXTRACT_TIMEOUT_MS) || 120000;
const DEBUG_ASKPERI = Boolean(process.env.DEBUG_ASKPERI);

function applyValidatedFields(currentContext, regexDraft, validationFields) {
  const merged = {};
  const conflicted = {};
  const fields = validationFields || {};

  if (!Object.keys(fields).length) {
    return { merged, conflicted };
  }

  Object.entries(fields).forEach(([fieldName, meta]) => {
    if (!meta || typeof meta !== 'object') return;
    const action = String(meta.action || 'skip').toLowerCase();
    const confidence = Number(meta.confidence || 0);
    const value = meta.value;

    if (action === 'conflict') {
      if (value !== null && value !== undefined) {
        conflicted[fieldName] = value;
      }
      return;
    }

    if (action === 'skip' || confidence < CONFIDENCE_THRESHOLD) return;
    if (value === null || value === undefined) {
      if (!['englishTest', 'researchExperience', 'workExperience', 'publications'].includes(fieldName)) {
        return;
      }
    }

    if (fieldName === 'preferredCountries' && Array.isArray(value)) {
      const existing = Array.isArray(currentContext?.preferredCountries)
        ? currentContext.preferredCountries
        : [];
      merged.preferredCountries = Array.from(new Set([...existing, ...value])).slice(0, 10);
    } else {
      merged[fieldName] = value;
    }
  });

  return { merged, conflicted };
}

/**
 * Hybrid extraction: regex draft → LLM validation via FastAPI → merge high-confidence fields.
 */
async function extractAndValidateFromMessage(message, currentContext = {}) {
  const regexDraft = extractFromMessage(message, currentContext);
  const draftKeys = Object.keys(regexDraft).filter((k) => !k.startsWith('_'));

  // Short messages with nothing to validate should not block chat for 2 minutes on LLM.
  if (draftKeys.length === 0 && (message || '').trim().length < 100) {
    return { extracted: regexDraft, validationMeta: {}, source: 'regex_fast' };
  }

  try {
    const aiServerUrl = getAiServerUrl();
    const res = await fetch(`${aiServerUrl}/profile/extract`, {
      method: 'POST',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
      body: JSON.stringify({
        message,
        current_context: currentContext || {},
        regex_draft: regexDraft,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const { merged, conflicted } = applyValidatedFields(currentContext, regexDraft, data.fields || {});
      const validated = { ...merged, ...conflicted };
      if (regexDraft?._countryOps) {
        validated._countryOps = regexDraft._countryOps;
      }
      const keys = Object.keys(validated).filter((k) => !k.startsWith('_'));
      if (keys.length > 0 && DEBUG_ASKPERI) {
        console.log(`[ProfileExtractor] LLM-validated fields: ${keys.join(', ')}`);
      }
      return {
        extracted: validated,
        validationMeta: data.fields || {},
        conflicted,
        source: 'llm',
      };
    }

    console.warn(`[ProfileExtractor] FastAPI /profile/extract returned ${res.status}, falling back to regex`);
  } catch (err) {
    console.warn('[ProfileExtractor] LLM validation unavailable, falling back to regex:', err.message);
  }

  return { extracted: regexDraft, validationMeta: {}, source: 'regex_fallback' };
}

module.exports = {
  extractFromMessage,
  extractAndValidateFromMessage,
  applyValidatedFields,
};
