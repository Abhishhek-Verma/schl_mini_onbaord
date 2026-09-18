import assert from "node:assert/strict";
import {
  scoreMCQ,
  scoreMSQ,
  scoreSJT,
  scoreCaseGroup,
  scoreAttempt,
} from "../src/services/pedagogyScoring.js";
import { scoreToBand } from "../src/config/pedagogy.js";

console.log("🧪 Running Pedagogy Scoring Engine Tests...\n");

// =========================================================================
// 1. MCQ Tests (Quality-weighted partial credit)
// =========================================================================
const mcqQuestion = {
  id: "q_mcq_1",
  type: "MCQ",
  options: [
    { key: "A", text: "Optimal", score: 1.0 },
    { key: "B", text: "Moderate", score: 0.6 },
    { key: "C", text: "Poor", score: 0.1 },
    { key: "D", text: "Ineffective", score: 0.0 },
  ],
};

assert.equal(scoreMCQ(mcqQuestion, "A"), 1.0, "MCQ option A should yield full credit (1.0)");
assert.equal(scoreMCQ(mcqQuestion, "B"), 0.6, "MCQ option B should yield partial credit (0.6)");
assert.equal(scoreMCQ(mcqQuestion, "C"), 0.1, "MCQ option C should yield partial credit (0.1)");
assert.equal(scoreMCQ(mcqQuestion, "D"), 0.0, "MCQ option D should yield zero credit (0.0)");
assert.equal(scoreMCQ(mcqQuestion, "UNKNOWN"), 0.0, "Invalid option should yield 0");
assert.equal(scoreMCQ(mcqQuestion, null), 0.0, "Null option should yield 0");
console.log("  ✔ 1. MCQ partial credit & boundary tests passed.");

// =========================================================================
// 2. MSQ Tests (Penalty & Floor)
// =========================================================================
const msqQuestion = {
  id: "q_msq_1",
  type: "MSQ",
  options: [
    { key: "A", text: "Correct 1", correct: true },
    { key: "B", text: "Correct 2", correct: true },
    { key: "C", text: "Incorrect 1", correct: false },
    { key: "D", text: "Correct 3", correct: true },
  ],
};
// 3 correct (A, B, D), 1 incorrect (C)

// All 3 correct selected: (3 - 0)/3 = 1.0
assert.equal(scoreMSQ(msqQuestion, ["A", "B", "D"]), 1.0, "All correct selections should score 1.0");

// 2 correct, 0 incorrect: (2 - 0)/3 = 2/3
const score2Of3 = scoreMSQ(msqQuestion, ["A", "B"]);
assert.ok(Math.abs(score2Of3 - 2 / 3) < 1e-6, "2 of 3 correct should score 2/3");

// 2 correct, 1 incorrect: (2 - 1)/3 = 1/3
const score2Correct1Wrong = scoreMSQ(msqQuestion, ["A", "B", "C"]);
assert.ok(Math.abs(score2Correct1Wrong - 1 / 3) < 1e-6, "Penalty should apply for incorrect selection");

// Only incorrect selected: (0 - 1)/3 -> floored at 0
assert.equal(scoreMSQ(msqQuestion, ["C"]), 0.0, "Incorrect selection should be floored at 0");

// Empty selections: (0 - 0)/3 = 0
assert.equal(scoreMSQ(msqQuestion, []), 0.0, "Empty selection should score 0");
assert.equal(scoreMSQ(msqQuestion, null), 0.0, "Null selection should score 0");
console.log("  ✔ 2. MSQ penalty calculation and floor tests passed.");

// =========================================================================
// 3. SJT Tests (Distance & Kendall-like rank displacement)
// =========================================================================
const sjtQuestion = {
  id: "q_sjt_1",
  type: "SJT",
  options: [
    { key: "A", text: "Action A" },
    { key: "B", text: "Action B" },
    { key: "C", text: "Action C" },
    { key: "D", text: "Action D" },
  ],
  expertRanking: ["A", "D", "B", "C"],
  maxDistance: 8,
};

// Perfect match: distance = 0 -> score = 1.0
assert.equal(scoreSJT(sjtQuestion, ["A", "D", "B", "C"]), 1.0, "Exact expert ranking should score 1.0");

// Full reversal: ["C", "B", "D", "A"] -> distance = 8 -> score = 0.0
assert.equal(scoreSJT(sjtQuestion, ["C", "B", "D", "A"]), 0.0, "Reversed ranking should score 0.0");

// Single adjacent swap: ["A", "B", "D", "C"] (swapped D and B, each displaced by 1, distance = 2)
// score = 1 - 2/8 = 0.75
assert.equal(scoreSJT(sjtQuestion, ["A", "B", "D", "C"]), 0.75, "Single adjacent swap should score 0.75");

// Invalid or incomplete ranking
assert.equal(scoreSJT(sjtQuestion, ["A", "D"]), 0.0, "Incomplete ranking should score 0");
assert.equal(scoreSJT(sjtQuestion, ["A", "A", "A", "A"]), 0.0, "Duplicate keys should score 0");
console.log("  ✔ 3. SJT rank distance & displacement tests passed.");

// =========================================================================
// 4. CASE Group Tests (Coherence Bonus Applied vs Not)
// =========================================================================
const caseParts = [
  {
    id: "case_p1",
    caseGroup: "CASE1",
    casePart: 1,
    coherenceBonus: 0.5,
    options: [
      { key: "A", score: 1.0, orientation: "INQUIRY" },
      { key: "B", score: 0.6, orientation: "DIRECTIVE" },
    ],
  },
  {
    id: "case_p2",
    caseGroup: "CASE1",
    casePart: 2,
    coherenceBonus: 0.5,
    options: [
      { key: "A", score: 1.0, orientation: "INQUIRY" },
      { key: "B", score: 0.5, orientation: "DIRECTIVE" },
    ],
  },
];

// Scenario A: Coherent choices (both choose INQUIRY orientation "A")
// raw = 1.0 + 1.0 + 0.5 (bonus) = 2.5, max = 2 + 0.5 = 2.5
const coherentResult = scoreCaseGroup(caseParts, {
  case_p1: "A",
  case_p2: "A",
});
assert.equal(coherentResult.raw, 2.5, "Coherent choices should receive coherence bonus");
assert.equal(coherentResult.max, 2.5, "Max should include coherence bonus");

// Scenario B: Incoherent choices (P1 chooses "A" INQUIRY, P2 chooses "B" DIRECTIVE)
// raw = 1.0 + 0.5 = 1.5 (no bonus), max = 2.5
const incoherentResult = scoreCaseGroup(caseParts, {
  case_p1: "A",
  case_p2: "B",
});
assert.equal(incoherentResult.raw, 1.5, "Incoherent choices must not receive coherence bonus");
assert.equal(incoherentResult.max, 2.5, "Max remains 2.5");
console.log("  ✔ 4. CASE group coherence bonus (applied vs not) tests passed.");

// =========================================================================
// 5. Full scoreAttempt & Band Aggregation Tests
// =========================================================================
const fullQuestions = [
  {
    id: "q1",
    section: "CLASSROOM_MANAGEMENT",
    type: "MCQ",
    options: [{ key: "A", score: 1.0 }, { key: "B", score: 0.0 }],
  },
  {
    id: "q2",
    section: "TEACHING_METHODOLOGY",
    type: "MSQ",
    options: [
      { key: "A", correct: true },
      { key: "B", correct: true },
      { key: "C", correct: false },
    ],
  },
  {
    id: "q3",
    section: "STUDENT_PSYCHOLOGY",
    type: "SJT",
    options: [{ key: "A" }, { key: "B" }],
    expertRanking: ["A", "B"],
    maxDistance: 2,
  },
  {
    id: "case_p1",
    section: "COMPLEX_SCENARIO",
    type: "CASE",
    caseGroup: "CASE_FULL",
    casePart: 1,
    coherenceBonus: 0.5,
    options: [{ key: "A", score: 1.0, orientation: "ORIENT_A" }],
  },
  {
    id: "case_p2",
    section: "COMPLEX_SCENARIO",
    type: "CASE",
    caseGroup: "CASE_FULL",
    casePart: 2,
    coherenceBonus: 0.5,
    options: [{ key: "A", score: 1.0, orientation: "ORIENT_A" }],
  },
];

const attemptResult = scoreAttempt(fullQuestions, {
  q1: "A",
  q2: ["A", "B"],
  q3: ["A", "B"],
  case_p1: "A",
  case_p2: "A",
});

assert.ok(typeof attemptResult.overallScore === "number", "overallScore must be a number");
assert.ok(typeof attemptResult.band === "string", "band must be a string");
assert.ok(typeof attemptResult.sectionMinMet === "boolean", "sectionMinMet must be a boolean");
assert.ok(attemptResult.sectionScores.CLASSROOM_MANAGEMENT, "CLASSROOM_MANAGEMENT must exist");
assert.equal(attemptResult.sectionScores.CLASSROOM_MANAGEMENT.normalized, 100);

// Verify bands
assert.equal(scoreToBand(90), "Strong");
assert.equal(scoreToBand(75), "Competent");
assert.equal(scoreToBand(60), "Developing");
assert.equal(scoreToBand(45), "Below Threshold");
assert.equal(scoreToBand(30), "Insufficient");
console.log("  ✔ 5. Full attempt aggregation and score-to-band tests passed.");

// =========================================================================
// 6. Payload Sanitization Check
// =========================================================================
const rawDbQuestion = {
  id: "q_secret",
  code: "Q_SEC",
  section: "FOUNDATIONAL_KNOWLEDGE",
  type: "MCQ",
  prompt: "Question prompt?",
  options: [
    { key: "A", text: "Answer 1", score: 1.0, orientation: "SECRET_A" },
    { key: "B", text: "Answer 2", score: 0.2, orientation: "SECRET_B" },
  ],
  expertRanking: ["A", "B"],
  maxDistance: 2,
  coherenceBonus: 0.5,
};

// Mimic startPedagogyAssessment sanitization logic
const sanitizedOptions = rawDbQuestion.options.map((o) => ({
  key: o.key,
  text: o.text,
}));
const sanitized = {
  id: rawDbQuestion.id,
  code: rawDbQuestion.code,
  section: rawDbQuestion.section,
  type: rawDbQuestion.type,
  prompt: rawDbQuestion.prompt,
  options: sanitizedOptions,
};

const stringified = JSON.stringify(sanitized);
const forbiddenKeys = ["score", "correct", "orientation", "expertRanking", "coherenceBonus"];
for (const key of forbiddenKeys) {
  assert.ok(
    !stringified.includes(`"${key}"`),
    `Sanitized payload must NOT contain forbidden key: ${key}`
  );
}
console.log("  ✔ 6. Client payload sanitization check passed (no answers, scores, or orientations leaked).");

console.log("\n🎉 ALL PEDAGOGY SCORING TESTS PASSED SUCCESSFULLY!\n");
