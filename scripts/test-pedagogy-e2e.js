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

  console.log(`👤 Using teacher user: ${user.id} (${user.email})`);

  // 2. Test startPedagogyAssessment
  console.log("▶ Calling startPedagogyAssessment(userId)...");
  const session = await startPedagogyAssessment(user.id);

  assert.ok(session.attemptId, "session must have attemptId");
  assert.equal(session.durationMinutes, 35, "durationMinutes should be 35");
  assert.ok(Array.isArray(session.questions), "questions must be an array");
  assert.ok(session.questions.length > 0, "questions must not be empty");

  console.log(`  ✔ Returned ${session.questions.length} questions for attempt ${session.attemptId}`);

  // 3. Verify payload sanitization (CRITICAL SECURITY REQUIREMENT)
  const forbiddenFields = ["score", "correct", "orientation", "expertRanking", "coherenceBonus"];
  for (const q of session.questions) {
    assert.ok(!("expertRanking" in q), `Question ${q.code} leaked expertRanking!`);
    assert.ok(!("coherenceBonus" in q), `Question ${q.code} leaked coherenceBonus!`);

    for (const opt of q.options) {
      assert.ok(!("score" in opt), `Question ${q.code} option ${opt.key} leaked score!`);
      assert.ok(!("correct" in opt), `Question ${q.code} option ${opt.key} leaked correct!`);
      assert.ok(!("orientation" in opt), `Question ${q.code} option ${opt.key} leaked orientation!`);
    }
  }
  console.log("  ✔ Verified: ALL questions and options are strictly sanitized. No answers or weights leaked!");

  // 4. Formulate responses
  const responses = {};
  const perQuestionMs = {};
  for (const q of session.questions) {
    perQuestionMs[q.id] = 5000; // 5 seconds per question
    if (q.type === "MCQ" || q.type === "CASE") {
      responses[q.id] = q.options[0]?.key || "A";
    } else if (q.type === "MSQ") {
      responses[q.id] = [q.options[0]?.key, q.options[1]?.key].filter(Boolean);
    } else if (q.type === "SJT") {
      responses[q.id] = q.options.map((o) => o.key);
    }
  }

  // 5. Test submitPedagogyAssessment
  console.log("▶ Calling submitPedagogyAssessment(userId, input)...");
  const submission = await submitPedagogyAssessment(user.id, {
    attemptId: session.attemptId,
    responses,
    perQuestionMs,
    durationSec: 650,
  });

  assert.ok(submission.result, "Submission must return result object");
  assert.ok(typeof submission.result.overallScore === "number", "overallScore must be numeric");
  assert.ok(submission.result.band, "band must be returned");
  assert.ok(submission.profile, "profile must be returned");
  assert.equal(submission.profile.skillAssessmentCompleted, true, "skillAssessmentCompleted must be true");

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
  await prisma.pedagogyAttempt.delete({ where: { id: session.attemptId } });
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
