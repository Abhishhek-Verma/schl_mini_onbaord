-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DemoEvalStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "demoEvaluationCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DemoEvaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "videoId" TEXT,
    "transcriptSource" TEXT,
    "assignedTopics" JSONB NOT NULL,
    "status" "DemoEvalStatus" NOT NULL DEFAULT 'PENDING',
    "transcript" TEXT,
    "facts" JSONB,
    "subScores" JSONB,
    "demoScore" DOUBLE PRECISION,
    "band" TEXT,
    "completions" JSONB,
    "flags" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "DemoEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DemoEvaluation_userId_key" ON "DemoEvaluation"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DemoEvaluation_status_idx" ON "DemoEvaluation"("status");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DemoEvaluation_userId_fkey'
  ) THEN
    ALTER TABLE "DemoEvaluation" ADD CONSTRAINT "DemoEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
