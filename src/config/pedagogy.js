// Section weights must sum to 1.0
export const SECTION_WEIGHTS = {
  CLASSROOM_MANAGEMENT:     0.22,
  TEACHING_METHODOLOGY:     0.18,
  STUDENT_PSYCHOLOGY:       0.18,
  ASSESSMENT_FEEDBACK:      0.14,
  DIFFERENTIATED_INCLUSIVE: 0.14,
  COMPLEX_SCENARIO:         0.10,
  FOUNDATIONAL_KNOWLEDGE:   0.04,
};

export const SECTION_ORDER = [
  "CLASSROOM_MANAGEMENT",
  "TEACHING_METHODOLOGY",
  "STUDENT_PSYCHOLOGY",
  "ASSESSMENT_FEEDBACK",
  "DIFFERENTIATED_INCLUSIVE",
  "COMPLEX_SCENARIO",
  "FOUNDATIONAL_KNOWLEDGE",
];

export const SECTION_LABELS = {
  CLASSROOM_MANAGEMENT:     "Classroom Management",
  TEACHING_METHODOLOGY:     "Teaching Methodology",
  STUDENT_PSYCHOLOGY:       "Student Psychology & Motivation",
  ASSESSMENT_FEEDBACK:      "Assessment & Feedback",
  DIFFERENTIATED_INCLUSIVE: "Differentiated & Inclusive Teaching",
  COMPLEX_SCENARIO:         "Complex Evolving Scenario",
  FOUNDATIONAL_KNOWLEDGE:   "Foundational Knowledge",
};

export const SECTION_MIN_THRESHOLD = 40; // flag any section below this (normalized %)

// Overall score -> band
export function scoreToBand(score) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Competent";
  if (score >= 55) return "Developing";
  if (score >= 40) return "Below Threshold";
  return "Insufficient";
}
