import { HOLISTIC_WEIGHTS, FLOORS, scoreToProfileBand } from "../config/holisticScore.js";

/**
 * Pure holistic scoring engine.
 * Combines Pedagogy, Subject Knowledge, Demo Class, and Experience into a unified profile score.
 * Handles provisional scoring when demo is missing or in-progress by re-normalizing present weights.
 * Applies eligibility floors and extracts knowing-vs-doing gap flags.
 *
 * @param {Object} inputs - { pedagogy, subject, demo, experience }
 * @returns {Object} { holisticScore, band, isProvisional, components, subjectCompetence, pedagogyCompetence, floors, gaps, pending }
 */
export function computeHolisticScore(inputs = {}) {
  const { pedagogy, subject, demo, experience } = inputs;

  const pending = [];
  const floors = [];
  const gaps = [];

  // Determine present components
  const hasPedagogy = pedagogy && typeof pedagogy.score === "number";
  const hasSubject = subject && typeof subject.score === "number";
  const hasExperience = experience && typeof experience.score === "number";
  const hasDemo = demo && typeof demo.score === "number" && demo.status === "PROCESSED";

  if (!hasDemo) {
    pending.push("demo");
  }
  if (!hasPedagogy) {
    pending.push("pedagogy");
  }
  if (!hasSubject) {
    pending.push("subject");
  }

  // Calculate sum of weights for present components
  let totalPresentWeight = 0;
  if (hasDemo) totalPresentWeight += HOLISTIC_WEIGHTS.demo;
  if (hasSubject) totalPresentWeight += HOLISTIC_WEIGHTS.subject;
  if (hasPedagogy) totalPresentWeight += HOLISTIC_WEIGHTS.pedagogy;
  if (hasExperience) totalPresentWeight += HOLISTIC_WEIGHTS.experience;

  // Fallback if no components are present
  if (totalPresentWeight === 0) {
    return {
      holisticScore: 0,
      band: "Not Recommended",
      isProvisional: true,
      components: {},
      subjectCompetence: null,
      pedagogyCompetence: null,
      floors: [],
      gaps: [],
      pending: ["pedagogy", "subject", "demo"],
    };
  }

  // Re-normalize weights so they always sum to 1.0
  const normalizedWeights = {
    demo: hasDemo ? HOLISTIC_WEIGHTS.demo / totalPresentWeight : 0,
    subject: hasSubject ? HOLISTIC_WEIGHTS.subject / totalPresentWeight : 0,
    pedagogy: hasPedagogy ? HOLISTIC_WEIGHTS.pedagogy / totalPresentWeight : 0,
    experience: hasExperience ? HOLISTIC_WEIGHTS.experience / totalPresentWeight : 0,
  };

  // Compute contributions
  const components = {
    pedagogy: {
      score: hasPedagogy ? pedagogy.score : null,
      weight: normalizedWeights.pedagogy,
      baseWeight: HOLISTIC_WEIGHTS.pedagogy,
      contribution: hasPedagogy ? Math.round(pedagogy.score * normalizedWeights.pedagogy * 10) / 10 : 0,
      details: pedagogy?.details || null,
    },
    subject: {
      score: hasSubject ? subject.score : null,
      weight: normalizedWeights.subject,
      baseWeight: HOLISTIC_WEIGHTS.subject,
      contribution: hasSubject ? Math.round(subject.score * normalizedWeights.subject * 10) / 10 : 0,
      details: subject?.details || null,
    },
    demo: {
      score: hasDemo ? demo.score : null,
      weight: normalizedWeights.demo,
      baseWeight: HOLISTIC_WEIGHTS.demo,
      contribution: hasDemo ? Math.round(demo.score * normalizedWeights.demo * 10) / 10 : 0,
      status: demo?.status || (hasDemo ? "PROCESSED" : "NOT_SUBMITTED"),
      extractionMode: demo?.extractionMode || null,
    },
    experience: {
      score: hasExperience ? experience.score : null,
      weight: normalizedWeights.experience,
      baseWeight: HOLISTIC_WEIGHTS.experience,
      contribution: hasExperience ? Math.round(experience.score * normalizedWeights.experience * 10) / 10 : 0,
      breakdown: experience?.breakdown || null,
    },
  };

  // Weighted raw sum
  const rawScore =
    components.pedagogy.contribution +
    components.subject.contribution +
    components.demo.contribution +
    components.experience.contribution;

  const holisticScore = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));
  const band = scoreToProfileBand(holisticScore);

  // Check Eligibility Floors
  if (hasPedagogy && pedagogy.score < FLOORS.pedagogy) {
    floors.push({
      type: "BELOW_FLOOR",
      component: "pedagogy",
      label: "Pedagogical Knowledge",
      score: pedagogy.score,
      floor: FLOORS.pedagogy,
    });
  }
  if (hasSubject && subject.score < FLOORS.subject) {
    floors.push({
      type: "BELOW_FLOOR",
      component: "subject",
      label: "Subject Knowledge",
      score: subject.score,
      floor: FLOORS.subject,
    });
  }
  if (hasDemo && demo.score < FLOORS.demo) {
    floors.push({
      type: "BELOW_FLOOR",
      component: "demo",
      label: "Demo Class Execution",
      score: demo.score,
      floor: FLOORS.demo,
    });
  }

  // Completion Pairing: knowing + delivering, judgment + execution
  const subjectWritten = hasSubject ? subject.score : null;
  const demoSubjectDelivery = demo?.completions?.subjectDeliveryPct ?? (hasDemo ? demo.score : null);

  let subjectCompetence = null;
  if (subjectWritten != null && demoSubjectDelivery != null) {
    subjectCompetence = Math.round((subjectWritten * 0.5 + demoSubjectDelivery * 0.5) * 10) / 10;
  } else if (subjectWritten != null) {
    subjectCompetence = subjectWritten;
  } else if (demoSubjectDelivery != null) {
    subjectCompetence = demoSubjectDelivery;
  }

  const pedagogyWritten = hasPedagogy ? pedagogy.score : null;
  const demoPedExecution = demo?.completions?.pedagogyExecutionPct ?? (hasDemo ? demo.score : null);

  let pedagogyCompetence = null;
  if (pedagogyWritten != null && demoPedExecution != null) {
    pedagogyCompetence = Math.round((pedagogyWritten * 0.5 + demoPedExecution * 0.5) * 10) / 10;
  } else if (pedagogyWritten != null) {
    pedagogyCompetence = pedagogyWritten;
  } else if (demoPedExecution != null) {
    pedagogyCompetence = demoPedExecution;
  }

  // Knowing vs Doing Gap Flags (threshold difference >= 25 points)
  if (subjectWritten != null && demoSubjectDelivery != null && subjectWritten - demoSubjectDelivery >= 25) {
    gaps.push({
      type: "KNOWING_VS_DOING_GAP",
      area: "Subject Competence",
      writtenScore: subjectWritten,
      demoScore: demoSubjectDelivery,
      difference: Math.round(subjectWritten - demoSubjectDelivery),
      description: "Subject test score significantly exceeds demonstration delivery in video lesson.",
    });
  }

  if (pedagogyWritten != null && demoPedExecution != null && pedagogyWritten - demoPedExecution >= 25) {
    gaps.push({
      type: "KNOWING_VS_DOING_GAP",
      area: "Pedagogy Execution",
      writtenScore: pedagogyWritten,
      demoScore: demoPedExecution,
      difference: Math.round(pedagogyWritten - demoPedExecution),
      description: "Pedagogy written score significantly exceeds practical teaching execution in video lesson.",
    });
  }

  return {
    holisticScore,
    band,
    isProvisional: pending.includes("demo"),
    components,
    subjectCompetence,
    pedagogyCompetence,
    floors,
    gaps,
    pending,
  };
}
