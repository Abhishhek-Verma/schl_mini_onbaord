export const SUBJECTS = ["MATH", "SCIENCE"]; // starter set; extend later
export const CLASS_MIN = 6;
export const CLASS_MAX = 10; // starter range; extend later
export const BOARDS = ["CBSE", "ICSE", "STATE", "NEUTRAL"];

// Test generation
export const GEN = {
  perClassPerSubject: 5, // questions drawn from each (subject,class) bucket
  minPerSubject: 5, // floor per subject
  maxPerSubject: 15, // cap per subject
  higherClassWeighting: true, // weight draws toward higher classes
  difficultyMix: { EASY: 0.3, MEDIUM: 0.5, HARD: 0.2 }, // target mix per subject
};

export const SUBJECT_LABELS = { MATH: "Mathematics", SCIENCE: "Science" };

export const TIMING = {
  durationMinutes: 30, // Global hard test limit (30 mins)
  softPerQuestionSeconds: 60, // Advisory pace per question (60 sec)
  hardPerQuestion: false,
};

export function scoreToSubjectBand(score) {
  if (score >= 85) return "Distinguished";
  if (score >= 70) return "Proficient";
  if (score >= 50) return "Developing";
  return "Insufficient";
}
