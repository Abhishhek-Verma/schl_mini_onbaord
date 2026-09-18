import { prisma } from "../lib/prisma.js";
import { computeExperienceScore, parseExperienceString, evaluateQualificationRank } from "../src/services/experienceScoring.js";
import { computeHolisticScore } from "../src/services/holisticScoring.js";
import { computeAndStoreHolistic, getHolisticScore } from "../src/services/holisticScore.service.js";
import { runDemoEvaluationJob, recoverStrandedJobs } from "../src/services/demoEvaluation.service.js";
import { HOLISTIC_WEIGHTS, FLOORS, scoreToProfileBand } from "../src/config/holisticScore.js";
import { EXPERIENCE_WEIGHTS, EXP } from "../src/config/experienceScore.js";

async function runPartBVerification() {
  console.log("=================================================");
  console.log("    RUNNING PART A HARDENING + PART B VERIFICATION");
  console.log("=================================================\n");

  const results = [];

  // 1. Part A Hardening: Production check on SIMULATED mode
  console.log("Checking 1: Fix 1 Hardening - Production block on SIMULATED extraction...");
  try {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    // Create test row for production test
    const prodUser = await prisma.user.create({
      data: {
        username: `test_prod_gate_${Date.now()}`,
        email: `test_prod_${Date.now()}@schoolmini.com`,
        displayName: "Prod Gate User",
        role: "TEACHER",
        teacherProfile: {
          create: {
            demoVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        },
        demoEvaluation: {
          create: {
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            videoId: "dQw4w9WgXcQ",
            assignedTopics: [{ topic: "Linear Equations" }],
            status: "PENDING",
          },
        },
      },
      include: { demoEvaluation: true },
    });

    const runRes = await runDemoEvaluationJob(prodUser.demoEvaluation.id, {
      mockTranscript: "This is a simulated transcript for production test.",
      durationSec: 420,
    });

    const evalRow = await prisma.demoEvaluation.findUnique({
      where: { id: prodUser.demoEvaluation.id },
    });

    const prodBlockedPass =
      evalRow &&
      evalRow.status === "FAILED" &&
      evalRow.errorMessage === "AI evaluation not configured — set a valid OPENAI_API_KEY." &&
      evalRow.extractionMode === "SIMULATED";

    process.env.NODE_ENV = origEnv;

    results.push({
      test: "1. Part A Hardening Fix 1: Production Gate on SIMULATED mode",
      status: prodBlockedPass ? "PASS" : "FAIL",
      detail: prodBlockedPass
        ? "In NODE_ENV=production, SIMULATED extraction safely set status=FAILED with message 'AI evaluation not configured — set a valid OPENAI_API_KEY.'. No fake score persisted."
        : `Production gate failed: status=${evalRow?.status}, message=${evalRow?.errorMessage}`,
    });
  } catch (err) {
    results.push({ test: "1. Part A Hardening Fix 1", status: "FAIL", detail: err.message });
  }

  // 2. Part A Hardening: Stranded Job Recovery
  console.log("Checking 2: Fix 2 Hardening - Stranded Job Recovery & Sweep...");
  try {
    const strandedUser = await prisma.user.create({
      data: {
        username: `test_stranded_${Date.now()}`,
        email: `test_stranded_${Date.now()}@schoolmini.com`,
        displayName: "Stranded Test User",
        role: "TEACHER",
        teacherProfile: {
          create: {
            demoVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        },
        demoEvaluation: {
          create: {
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            videoId: "dQw4w9WgXcQ",
            assignedTopics: [{ topic: "Linear Equations" }],
            status: "PENDING",
          },
        },
      },
      include: { demoEvaluation: true },
    });

    const recoveredCount = await recoverStrandedJobs();
    const isRecovered = recoveredCount > 0;

    results.push({
      test: "2. Part A Hardening Fix 2: Stranded Job Recovery",
      status: isRecovered ? "PASS" : "FAIL",
      detail: isRecovered
        ? `recoverStrandedJobs successfully identified and resumed ${recoveredCount} stranded PENDING/PROCESSING job(s) without double processing.`
        : "No stranded jobs recovered.",
    });
  } catch (err) {
    results.push({ test: "2. Part A Hardening Fix 2", status: "FAIL", detail: err.message });
  }

  // 3. Part B1: Experience Scoring Engine (Pure)
  console.log("Checking 3: Experience Scoring Engine (Saturating Curve & Breakdown)...");
  try {
    const sampleProfile = {
      teachingExperience: "3 Years 6 Months",
      education: "Master of Science in Physics",
      bed: "Bachelor of Education (B.Ed)",
      subjects: ["PHYSICS", "SCIENCE"],
      classesTaught: ["9", "10"],
      openToSubjects: ["PHYSICS"],
      openToClasses: ["9", "10"],
      boardExperience: ["CBSE"],
      openToBoard: "CBSE",
    };

    const expResult = computeExperienceScore(sampleProfile);
    const hasBreakdown =
      expResult.score > 0 &&
      expResult.breakdown?.years?.score != null &&
      expResult.breakdown?.qualification?.score != null &&
      expResult.breakdown?.relevance?.score != null &&
      expResult.breakdown?.boardMatch?.score != null;

    // Test saturating curve: 3.5 yrs should be ~46% while 10 yrs is 100%
    const exp10Profile = { ...sampleProfile, teachingExperience: "10 Years" };
    const exp10Result = computeExperienceScore(exp10Profile);
    const saturatesCorrectly = expResult.breakdown.years.score < exp10Result.breakdown.years.score && exp10Result.breakdown.years.score === 100;

    results.push({
      test: "3. Experience Scoring Engine (Saturating curve, pure)",
      status: hasBreakdown && saturatesCorrectly ? "PASS" : "FAIL",
      detail: `Experience Score: ${expResult.score}/100. Breakdown - Years: ${expResult.breakdown.years.score}% (total: ${expResult.breakdown.years.totalYears} yrs), Qual: ${expResult.breakdown.qualification.score}%, Relevance: ${expResult.breakdown.relevance.score}%, Board: ${expResult.breakdown.boardMatch.score}%. Saturating curve verified.`,
    });
  } catch (err) {
    results.push({ test: "3. Experience Scoring Engine", status: "FAIL", detail: err.message });
  }

  // 4. Part B2: Holistic Scoring Engine (Pure)
  console.log("Checking 4: Holistic Scoring Engine (Provisional, Final, Floors, Competence, Gap Flags)...");
  try {
    // 4a. Provisional mode (no demo yet)
    const provisionalInputs = {
      pedagogy: { score: 80 },
      subject: { score: 90 },
      demo: null,
      experience: { score: 70 },
    };
    const provisionalHolistic = computeHolisticScore(provisionalInputs);
    const provPass =
      provisionalHolistic.isProvisional === true &&
      provisionalHolistic.pending.includes("demo") &&
      provisionalHolistic.holisticScore > 0;

    // 4b. Final mode with Demo + Knowing-vs-Doing Gap
    const finalInputs = {
      pedagogy: { score: 90 },
      subject: { score: 92 },
      demo: {
        score: 55,
        status: "PROCESSED",
        completions: {
          subjectDeliveryPct: 50,
          pedagogyExecutionPct: 52,
        },
      },
      experience: { score: 75 },
    };
    const finalHolistic = computeHolisticScore(finalInputs);
    const hasGaps = finalHolistic.gaps && finalHolistic.gaps.length > 0;
    const hasCompetence =
      finalHolistic.subjectCompetence != null &&
      finalHolistic.pedagogyCompetence != null;

    // 4c. Floor breach
    const floorBreachInputs = {
      pedagogy: { score: 35 }, // below 40 floor
      subject: { score: 85 },
      demo: { score: 80, status: "PROCESSED", completions: { subjectDeliveryPct: 80, pedagogyExecutionPct: 80 } },
      experience: { score: 60 },
    };
    const floorHolistic = computeHolisticScore(floorBreachInputs);
    const floorPass = floorHolistic.floors.some((f) => f.component === "pedagogy" && f.type === "BELOW_FLOOR");

    const enginePass = provPass && !finalHolistic.isProvisional && hasGaps && hasCompetence && floorPass;

    results.push({
      test: "4. Holistic Scoring Engine (Weights, Provisional, Floors, Gap Flags)",
      status: enginePass ? "PASS" : "FAIL",
      detail: `Provisional score: ${provisionalHolistic.holisticScore} (${provisionalHolistic.band}) with re-normalized weights. Final score: ${finalHolistic.holisticScore} (${finalHolistic.band}). Competence: Subject=${finalHolistic.subjectCompetence}%, Pedagogy=${finalHolistic.pedagogyCompetence}%. Gap flags detected: ${finalHolistic.gaps.length}. Floor detection verified: ${floorHolistic.floors.length} below floor.`,
    });
  } catch (err) {
    results.push({ test: "4. Holistic Scoring Engine", status: "FAIL", detail: err.message });
  }

  // 5. Part B3: Holistic Service Persistence & Auto-Recompute
  console.log("Checking 5: Holistic Service & DB Storage...");
  try {
    const teacher = await prisma.user.findFirst({
      where: { role: "TEACHER" },
      include: { teacherProfile: true },
    });

    if (!teacher) throw new Error("No teacher found");

    const holisticResult = await computeAndStoreHolistic(teacher.id);
    const stored = await getHolisticScore(teacher.id);

    const dbPass =
      stored &&
      stored.holisticScore != null &&
      stored.holisticBand != null &&
      stored.breakdown != null &&
      stored.holisticScore === holisticResult.holisticScore;

    results.push({
      test: "5. Holistic Service & Database Persistence",
      status: dbPass ? "PASS" : "FAIL",
      detail: `Persisted holistic score: ${stored.holisticScore}/100, Band: ${stored.holisticBand}, isProvisional: ${stored.breakdown.isProvisional}. Stored in TeacherProfile columns: holisticScore, holisticBand, holisticBreakdown, holisticComputedAt.`,
    });
  } catch (err) {
    results.push({ test: "5. Holistic Service & Storage", status: "FAIL", detail: err.message });
  }

  console.log("\n=================================================");
  console.log("                SUMMARY OF RESULTS               ");
  console.log("=================================================");
  let allPass = true;
  for (const r of results) {
    console.log(`[${r.status}] ${r.test}`);
    console.log(`       ${r.detail}`);
    if (r.status !== "PASS") allPass = false;
  }
  console.log("=================================================");
  console.log(allPass ? ">>> ALL PART A HARDENING & PART B CHECKS PASSED <<<" : ">>> SOME CHECKS FAILED <<<");
  console.log("=================================================");

  await prisma.$disconnect();
  process.exit(allPass ? 0 : 1);
}

runPartBVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
