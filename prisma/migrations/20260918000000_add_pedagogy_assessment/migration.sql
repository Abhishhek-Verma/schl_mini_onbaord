-- CreateEnum
CREATE TYPE "PedagogySection" AS ENUM ('CLASSROOM_MANAGEMENT', 'TEACHING_METHODOLOGY', 'STUDENT_PSYCHOLOGY', 'ASSESSMENT_FEEDBACK', 'DIFFERENTIATED_INCLUSIVE', 'COMPLEX_SCENARIO', 'FOUNDATIONAL_KNOWLEDGE');

-- CreateEnum
CREATE TYPE "PedagogyQuestionType" AS ENUM ('MCQ', 'MSQ', 'SJT', 'CASE');

-- CreateEnum
CREATE TYPE "PedagogyAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "PedagogyQuestion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" "PedagogySection" NOT NULL,
    "type" "PedagogyQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "expertRanking" JSONB,
    "maxDistance" INTEGER,
    "caseGroup" TEXT,
    "casePart" INTEGER,
    "coherenceBonus" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedagogyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogyAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PedagogyAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionOrder" JSONB NOT NULL,
    "optionOrders" JSONB,
    "responses" JSONB,
    "sectionScores" JSONB,
    "overallScore" DOUBLE PRECISION,
    "band" TEXT,
    "flags" JSONB,
    "sectionMinMet" BOOLEAN,
    "durationSec" INTEGER,
    "perQuestionMs" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "PedagogyAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedagogyQuestion_code_key" ON "PedagogyQuestion"("code");
CREATE INDEX "PedagogyQuestion_section_idx" ON "PedagogyQuestion"("section");
CREATE INDEX "PedagogyQuestion_type_idx" ON "PedagogyQuestion"("type");
CREATE INDEX "PedagogyQuestion_caseGroup_idx" ON "PedagogyQuestion"("caseGroup");

-- CreateIndex
CREATE INDEX "PedagogyAttempt_userId_idx" ON "PedagogyAttempt"("userId");
CREATE INDEX "PedagogyAttempt_status_idx" ON "PedagogyAttempt"("status");

-- AddForeignKey
ALTER TABLE "PedagogyAttempt" ADD CONSTRAINT "PedagogyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
