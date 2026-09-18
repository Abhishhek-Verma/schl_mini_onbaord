-- AlterTable
ALTER TABLE "DemoEvaluation" ADD COLUMN IF NOT EXISTS "extractionMode" TEXT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "holisticScore" DOUBLE PRECISION;
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "holisticBand" TEXT;
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "holisticBreakdown" JSONB;
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "holisticComputedAt" TIMESTAMP(3);
