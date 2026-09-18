import { EXPERIENCE_WEIGHTS, EXP } from "../config/experienceScore.js";

/**
 * Parses experience text such as "3 Years 6 Months" or "5 Years" into numeric years and months.
 */
export function parseExperienceString(str) {
  if (!str || typeof str !== "string") return { years: 0, months: 0, totalYears: 0 };
  const yearMatch = str.match(/(\d+)\s*(?:year|yr)/i);
  const monthMatch = str.match(/(\d+)\s*(?:month|mo)/i);

  const years = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  const months = monthMatch ? parseInt(monthMatch[1], 10) : 0;
  const totalMonths = years * 12 + months;
  const totalYears = Math.round((totalMonths / 12) * 10) / 10;

  return { years, months, totalYears };
}

/**
 * Maps teacher education, B.Ed/D.El.Ed, and qualifications to a rank (0..1).
 */
export function evaluateQualificationRank(profile = {}) {
  const textFields = [
    profile.education,
    profile.bed,
    profile.deled,
    profile.otherQualifications,
    profile.certifications,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!textFields.trim()) return EXP.qualificationRanks.DEFAULT;

  let highest = EXP.qualificationRanks.DEFAULT;

  if (/\b(phd|ph\.d|doctorate)\b/i.test(textFields)) {
    highest = Math.max(highest, EXP.qualificationRanks.PHD);
  }
  if (/\b(master|m\.sc|msc|m\.a|ma|m\.tech|mtech|post graduate|pg)\b/i.test(textFields)) {
    highest = Math.max(highest, EXP.qualificationRanks.MASTERS);
  }
  if (/\b(b\.ed|bed|m\.ed|med)\b/i.test(textFields)) {
    highest = Math.max(highest, EXP.qualificationRanks.BED);
  }
  if (/\b(bachelor|b\.sc|bsc|b\.a|ba|b\.tech|btech|graduate|undergraduate)\b/i.test(textFields)) {
    highest = Math.max(highest, EXP.qualificationRanks.BACHELORS);
  }
  if (/\b(diploma|deled|d\.el\.ed|dled)\b/i.test(textFields)) {
    highest = Math.max(highest, EXP.qualificationRanks.DIPLOMA);
  }

  return highest;
}

/**
 * Computes teacher relevance score (overlap of taught vs open-to preferences).
 */
export function evaluateRelevance(profile = {}) {
  const taughtSubjects = Array.isArray(profile.subjects)
    ? profile.subjects.map((s) => String(s).toUpperCase())
    : [];
  const openSubjects = Array.isArray(profile.openToSubjects)
    ? profile.openToSubjects.map((s) => String(s).toUpperCase())
    : [];

  const taughtClasses = Array.isArray(profile.classesTaught)
    ? profile.classesTaught.map(String)
    : [];
  const openClasses = Array.isArray(profile.openToClasses)
    ? profile.openToClasses.map(String)
    : [];

  // If no open preferences are specified, assume good baseline relevance
  if (openSubjects.length === 0 && openClasses.length === 0) {
    return taughtSubjects.length > 0 ? 80 : 60;
  }

  // Subject overlap
  let subjectOverlapScore = 70;
  if (openSubjects.length > 0 && taughtSubjects.length > 0) {
    const matched = openSubjects.filter((s) =>
      taughtSubjects.some((ts) => ts.includes(s) || s.includes(ts))
    );
    subjectOverlapScore = Math.round((matched.length / openSubjects.length) * 100);
  }

  // Class overlap
  let classOverlapScore = 70;
  if (openClasses.length > 0 && taughtClasses.length > 0) {
    const matched = openClasses.filter((c) => taughtClasses.includes(c));
    classOverlapScore = Math.round((matched.length / openClasses.length) * 100);
  }

  return Math.max(20, Math.min(100, Math.round((subjectOverlapScore + classOverlapScore) / 2)));
}

/**
 * Computes board experience matching score.
 */
export function evaluateBoardMatch(profile = {}) {
  const boardExp = Array.isArray(profile.boardExperience)
    ? profile.boardExperience.map((b) => String(b).toUpperCase())
    : [];
  const openBoard = profile.openToBoard ? String(profile.openToBoard).toUpperCase() : "NEUTRAL";

  if (!openBoard || openBoard === "NEUTRAL") {
    return boardExp.length > 0 ? 100 : 70;
  }

  if (boardExp.includes(openBoard)) {
    return 100;
  }

  if (boardExp.length > 0) {
    return 80;
  }

  return 50;
}

/**
 * Computes pure dynamic experience score from profile fields.
 * Returns { score, breakdown }
 */
export function computeExperienceScore(profile = {}) {
  // 1. Years score with saturating curve
  const parsedExp = parseExperienceString(profile.teachingExperience);
  const totalYears = parsedExp.totalYears;
  // Saturating curve: rapid growth in 0-3 years, diminishing returns toward 10+
  const saturatingRatio = Math.min(1, Math.pow(totalYears / EXP.yearsSaturationAt, 0.75));
  const yearsScore = Math.max(0, Math.min(100, Math.round(saturatingRatio * 100)));

  // 2. Qualification score
  const qualRank = evaluateQualificationRank(profile);
  const qualificationScore = Math.round(qualRank * 100);

  // 3. Relevance score
  const relevanceScore = evaluateRelevance(profile);

  // 4. Board match score
  const boardMatchScore = evaluateBoardMatch(profile);

  // Weighted total
  const rawScore =
    yearsScore * EXPERIENCE_WEIGHTS.years +
    qualificationScore * EXPERIENCE_WEIGHTS.qualification +
    relevanceScore * EXPERIENCE_WEIGHTS.relevance +
    boardMatchScore * EXPERIENCE_WEIGHTS.boardMatch;

  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  return {
    score,
    breakdown: {
      years: {
        score: yearsScore,
        totalYears,
        rawString: profile.teachingExperience || "0 Years",
        weight: EXPERIENCE_WEIGHTS.years,
      },
      qualification: {
        score: qualificationScore,
        rank: qualRank,
        weight: EXPERIENCE_WEIGHTS.qualification,
      },
      relevance: {
        score: relevanceScore,
        weight: EXPERIENCE_WEIGHTS.relevance,
      },
      boardMatch: {
        score: boardMatchScore,
        weight: EXPERIENCE_WEIGHTS.boardMatch,
      },
    },
  };
}
