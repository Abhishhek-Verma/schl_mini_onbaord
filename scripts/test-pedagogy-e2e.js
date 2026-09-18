import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.js";
import {
  startPedagogyAssessment,
  submitPedagogyAssessment,
  getPedagogyResult,
} from "../src/services/pedagogy.service.js";

async function runE2ETest() {
  console.log("🚀 Starting Pedagogy Assessment E2E Integration Test...\n");

  // 1. Find or create a teacher user
  let user = await prisma.user.findFirst({
    where: { role: "TEACHER" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: `teacher_test_${Date.now()}`,
        email: `teacher_test_${Date.now()}@example.com`,
        displayName: "Test Teacher",
        role: "TEACHER",
      },
    });
  }

  // Ensure TeacherProfile exists
  await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      basicInformationCompleted: true,
      profileCompletionCompleted: true,
      documentsCompleted: true,
      availabilityCompleted: true,
      onboardingCompleted: true,
    },
  });

  console.log(`👤 Using teacher user: ${user.id} (${user.email})`);

  // 2. Test startPedagogyAssessment
  console.log("▶ Calling startPedagogyAssessment(userId)...");
  const session1 = await startPedagogyAssessment(user.id);

  assert.ok(session1.attemptId, "session must have attemptId");
  assert.equal(session1.durationMinutes, 35, "durationMinutes should be 35");
  assert.equal(session1.softPerQuestionSeconds, 75, "softPerQuestionSeconds should be 75");
  assert.equal(session1.hardPerQuestion, false, "hardPerQuestion should be false");
  assert.ok(Array.isArray(session1.questions), "questions must be an array");
  assert.ok(session1.questions.length > 0, "questions must not be empty");

  console.log(`  ✔ Returned ${session1.questions.length} questions for attempt ${session1.attemptId}`);

  // Test Task 4: Starting another attempt should clear the prior IN_PROGRESS attempt
  console.log("▶ Calling startPedagogyAssessment again to verify stale IN_PROGRESS clearance (Task 4)...");
  const session2 = await startPedagogyAssessment(user.id);
  const oldAttempt = await prisma.pedagogyAttempt.findUnique({
    where: { id: session1.attemptId },
  });
  assert.equal(oldAttempt, null, "Prior IN_PROGRESS attempt must be cleared upon starting a new one");
  console.log("  ✔ Verified: Stale IN_PROGRESS attempt was automatically cleared!");

  const activeSession = session2;

  // 3. Verify payload sanitization (CRITICAL SECURITY REQUIREMENT)
  const forbiddenFields = ["score", "correct", "orientation", "expertRanking", "coherenceBonus"];
  for (const q of activeSession.questions) {
    assert.ok(!("expertRanking" in q), `Question ${q.code} leaked expertRanking!`);
    assert.ok(!("coherenceBonus" in q), `Question ${q.code} leaked coherenceBonus!`);

    for (const opt of q.options) {
      assert.ok(!("score" in opt), `Question ${q.code} option ${opt.key} leaked score!`);
      assert.ok(!("correct" in opt), `Question ${q.code} option ${opt.key} leaked correct!`);
      assert.ok(!("orientation" in opt), `Question ${q.code} option ${opt.key} leaked orientation!`);
    }
  }
  console.log("  ✔ Verified: ALL questions and options are strictly sanitized. No answers or weights leaked!");

  // 4. Formulate responses with an untouched SJT (Task 1 verification)
  const responses = {};
  const perQuestionMs = {};
  for (const q of activeSession.questions) {
    perQuestionMs[q.id] = 5000;
    if (q.type === "MCQ" || q.type === "CASE") {
      responses[q.id] = q.options[0]?.key || "A";
    } else if (q.type === "MSQ") {
      responses[q.id] = [q.options[0]?.key, q.options[1]?.key].filter(Boolean);
    } else if (q.type === "SJT") {
      // Untouched SJT: sent as null
      responses[q.id] = null;
    }
  }

  // 5. Test submitPedagogyAssessment
  console.log("▶ Calling submitPedagogyAssessment(userId, input)...");
  const submission = await submitPedagogyAssessment(user.id, {
    attemptId: activeSession.attemptId,
    responses,
    perQuestionMs,
    durationSec: 650,
  });

  assert.ok(submission.result, "Submission must return result object");
  assert.ok(typeof submission.result.overallScore === "number", "overallScore must be numeric");
  assert.ok(submission.result.band, "band must be returned");
  assert.ok(submission.profile, "profile must be returned");
  assert.equal(submission.profile.skillAssessmentCompleted, true, "skillAssessmentCompleted must be true");

  // Untouched SJT scores 0 in its section
  const sjtQuestion = activeSession.questions.find((q) => q.type === "SJT");
  if (sjtQuestion) {
    const sjtSecScore = submission.result.sectionScores[sjtQuestion.section];
    assert.equal(sjtSecScore.raw, 0, "Untouched SJT should score 0");
    console.log("  ✔ Verified: Untouched SJT scored 0 (Task 1).");
  }

  console.log(`  ✔ Assessment evaluated! Overall Score: ${submission.result.overallScore}, Band: ${submission.result.band}`);
  console.log(`  ✔ TeacherProfile.skillAssessmentCompleted is now TRUE.`);

  // 6. Test getPedagogyResult
  console.log("▶ Calling getPedagogyResult(userId)...");
  const result = await getPedagogyResult(user.id);
  assert.ok(result, "Result must exist");
  assert.equal(result.overallScore, submission.result.overallScore, "Stored overallScore matches");
  assert.equal(result.band, submission.result.band, "Stored band matches");

  console.log(`  ✔ Retrieved latest result successfully.`);

  // 7. Clean up test attempt
  await prisma.pedagogyAttempt.delete({ where: { id: activeSession.attemptId } });
  console.log(`  ✔ Cleaned up test attempt.`);

  console.log("\n🎉 ALL E2E INTEGRATION TESTS PASSED!\n");
}

runE2ETest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
