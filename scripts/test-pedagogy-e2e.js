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

  // Clean any previous attempts for clean test run
  await prisma.pedagogyAttempt.deleteMany({
    where: { userId: user.id },
  });

  // Ensure TeacherProfile exists
  await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: { skillAssessmentCompleted: false },
    create: {
      userId: user.id,
      basicInformationCompleted: true,
      profileCompletionCompleted: true,
      documentsCompleted: true,
      availabilityCompleted: true,
      onboardingCompleted: true,
      skillAssessmentCompleted: false,
    },
  });

  console.log(`👤 Using teacher user: ${user.id} (${user.email})`);

  // 2. Test startPedagogyAssessment (New Attempt)
  console.log("▶ Calling startPedagogyAssessment(userId)...");
  const session1 = await startPedagogyAssessment(user.id);

  assert.ok(session1.attemptId, "session must have attemptId");
  assert.equal(session1.durationMinutes, 35, "durationMinutes should be 35");
  assert.equal(session1.softPerQuestionSeconds, 75, "softPerQuestionSeconds should be 75");
  assert.equal(session1.hardPerQuestion, false, "hardPerQuestion should be false");
  assert.ok(Array.isArray(session1.questions), "questions must be an array");
  assert.equal(session1.questions.length, 30, "production bank must have exactly 30 questions");

  console.log(`  ✔ Returned ${session1.questions.length} questions for attempt ${session1.attemptId}`);

  // Test In-Progress Resumption: calling start again resumes same attempt without re-rolling
  console.log("▶ Calling startPedagogyAssessment again while IN_PROGRESS to verify resumption...");
  const session2 = await startPedagogyAssessment(user.id);
  assert.equal(session2.attemptId, session1.attemptId, "Resumed session must have identical attemptId");
  assert.deepEqual(
    session2.questions.map((q) => q.id),
    session1.questions.map((q) => q.id),
    "Resumed session questions must preserve exact order"
  );
  for (let i = 0; i < session1.questions.length; i++) {
    const q1Opts = session1.questions[i].options.map((o) => o.key);
    const q2Opts = session2.questions[i].options.map((o) => o.key);
    assert.deepEqual(q1Opts, q2Opts, `Question ${session1.questions[i].code} option order must match`);
  }
  console.log("  ✔ Verified: In-progress attempt resumed without re-rolling questions or options!");

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
  console.log("  ✔ Verified: ALL questions and options are strictly sanitized. No answers, scores, or keys leaked!");

  // 4. Formulate responses with an untouched SJT
  const responses = {};
  const perQuestionMs = {};
  for (const q of activeSession.questions) {
    perQuestionMs[q.id] = 5000;
    if (q.type === "MCQ" || q.type === "CASE") {
      responses[q.id] = q.options[0]?.key || "A";
    } else if (q.type === "MSQ") {
      responses[q.id] = [q.options[0]?.key, q.options[1]?.key].filter(Boolean);
    } else if (q.type === "SJT") {
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
  assert.ok(submission.result.sectionScores, "sectionScores breakdown must be returned");
  assert.ok(submission.profile, "profile must be returned");
  assert.equal(submission.profile.skillAssessmentCompleted, true, "skillAssessmentCompleted must be true");

  console.log(`  ✔ Assessment evaluated! Overall Score: ${submission.result.overallScore}, Band: ${submission.result.band}`);
  console.log(`  ✔ TeacherProfile.skillAssessmentCompleted is now TRUE.`);

  // 6. Test Idempotent Re-submission
  console.log("▶ Testing idempotent re-submission of the same attempt...");
  const resubmission = await submitPedagogyAssessment(user.id, {
    attemptId: activeSession.attemptId,
  });
  assert.equal(resubmission.result.overallScore, submission.result.overallScore, "Idempotent score matches");
  assert.equal(resubmission.result.band, submission.result.band, "Idempotent band matches");
  console.log("  ✔ Verified: Idempotent re-submission succeeds!");

  // 7. Test Strict Lifetime Single Attempt: start after submission must throw 409
  console.log("▶ Verifying startPedagogyAssessment rejects with 409 after completion...");
  let startRejected = false;
  try {
    await startPedagogyAssessment(user.id);
  } catch (err) {
    startRejected = true;
    assert.equal(err.statusCode, 409, "Error must have 409 status code");
    console.log(`  ✔ Verified: startPedagogyAssessment rejected with HTTP 409: "${err.message}"`);
  }
  assert.ok(startRejected, "startPedagogyAssessment should have rejected");

  // 8. Test getPedagogyResult
  console.log("▶ Calling getPedagogyResult(userId)...");
  const result = await getPedagogyResult(user.id);
  assert.ok(result, "Result must exist");
  assert.equal(result.overallScore, submission.result.overallScore, "Stored overallScore matches");
  assert.equal(result.band, submission.result.band, "Stored band matches");

  console.log(`  ✔ Retrieved latest result successfully.`);

  // 9. Clean up test attempt
  await prisma.pedagogyAttempt.delete({ where: { id: activeSession.attemptId } });
  await prisma.teacherProfile.update({
    where: { userId: user.id },
    data: { skillAssessmentCompleted: false },
  });
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
