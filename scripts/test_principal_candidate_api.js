import { prisma } from "../lib/prisma.js";
import { getCandidateEvaluation, updateCandidateDecision, listCandidates } from "../src/services/principal.service.js";

async function testPrincipalEndpoints() {
  console.log("Testing Principal candidate endpoints...");

  // 1. Create or find Principal User
  let principal = await prisma.user.findFirst({
    where: { role: "PRINCIPAL" },
  });

  if (!principal) {
    principal = await prisma.user.create({
      data: {
        username: "test_principal_eval",
        email: "test_principal_eval@schoolmini.com",
        displayName: "Dr. Test Principal",
        role: "PRINCIPAL",
      },
    });
  }

  // 2. Find Candidate Teacher
  const teacher = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacherProfile: true, demoEvaluation: true },
  });

  if (!teacher) {
    throw new Error("No teacher candidate found to test evaluation.");
  }

  // 3. Test listCandidates
  const candidatesList = await listCandidates(principal.id);
  console.log(`[PASS] listCandidates returned ${candidatesList.candidates.length} candidates.`);

  // 4. Test getCandidateEvaluation
  const evalData = await getCandidateEvaluation(principal.id, teacher.id);
  console.log(`[PASS] getCandidateEvaluation returned candidate: ${evalData.candidate.displayName}, Demo Evaluation status: ${evalData.demoEvaluation?.status || "None"}`);

  // 5. Test updateCandidateDecision
  const decisionResult = await updateCandidateDecision(principal.id, teacher.id, "ACCEPTED", "Strong demo performance in pedagogy and engagement.");
  console.log(`[PASS] updateCandidateDecision succeeded: ${decisionResult.message}`);

  await prisma.$disconnect();
  console.log("All principal candidate service tests passed successfully!");
}

testPrincipalEndpoints().catch((err) => {
  console.error("Principal candidate test failed:", err);
  process.exit(1);
});
