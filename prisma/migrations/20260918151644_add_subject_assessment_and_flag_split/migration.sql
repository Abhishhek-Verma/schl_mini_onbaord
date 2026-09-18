-- CreateEnum (guarded)
DO $$ BEGIN
  CREATE TYPE "SubjectDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubjectAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add subject-assessment tracking columns to TeacherProfile
ALTER TABLE "TeacherProfile"
  ADD COLUMN IF NOT EXISTS "openToSubjects"             JSONB,
  ADD COLUMN IF NOT EXISTS "openToClasses"              JSONB,
  ADD COLUMN IF NOT EXISTS "openToBoard"                TEXT,
  ADD COLUMN IF NOT EXISTS "demoAssignedTopics"         JSONB,
  ADD COLUMN IF NOT EXISTS "pedagogyCompleted"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subjectAssessmentCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: SubjectQuestion
CREATE TABLE IF NOT EXISTS "SubjectQuestion" (
    "id"         TEXT    NOT NULL,
    "code"       TEXT    NOT NULL,
    "subject"    TEXT    NOT NULL,
    "classLevel" INTEGER NOT NULL,
    "board"      TEXT    NOT NULL DEFAULT 'NEUTRAL',
    "topic"      TEXT    NOT NULL,
    "difficulty" "SubjectDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "type"       TEXT    NOT NULL,
    "prompt"     TEXT    NOT NULL,
    "options"    JSONB   NOT NULL,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubjectAttempt
CREATE TABLE IF NOT EXISTS "SubjectAttempt" (
    "id"            TEXT    NOT NULL,
    "userId"        TEXT    NOT NULL,
    "status"        "SubjectAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "blueprint"     JSONB   NOT NULL,
    "questionOrder" JSONB   NOT NULL,
    "optionOrders"  JSONB,
    "responses"     JSONB,
    "sectionScores" JSONB,
    "overallScore"  DOUBLE PRECISION,
    "band"          TEXT,
    "flags"         JSONB,
    "sectionMinMet" BOOLEAN,
    "durationSec"   INTEGER,
    "perQuestionMs" JSONB,
    "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt"   TIMESTAMP(3),

    CONSTRAINT "SubjectAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubjectQuestion_code_key" ON "SubjectQuestion"("code");
CREATE INDEX IF NOT EXISTS "SubjectQuestion_subject_classLevel_board_isActive_idx" ON "SubjectQuestion"("subject", "classLevel", "board", "isActive");
CREATE INDEX IF NOT EXISTS "SubjectQuestion_subject_isActive_idx" ON "SubjectQuestion"("subject", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubjectAttempt_userId_idx" ON "SubjectAttempt"("userId");
CREATE INDEX IF NOT EXISTS "SubjectAttempt_status_idx" ON "SubjectAttempt"("status");

-- AddForeignKey (guarded)
DO $$ BEGIN
  ALTER TABLE "SubjectAttempt"
    ADD CONSTRAINT "SubjectAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Teachers who already passed pedagogy should have pedagogyCompleted = true
UPDATE "TeacherProfile"
SET "pedagogyCompleted" = "skillAssessmentCompleted"
WHERE "skillAssessmentCompleted" = true;

-- Recompute the combined skillAssessmentCompleted flag
-- (true only when BOTH pedagogy AND subject assessment are done)
UPDATE "TeacherProfile"
SET "skillAssessmentCompleted" =
  ("pedagogyCompleted" AND "subjectAssessmentCompleted");
