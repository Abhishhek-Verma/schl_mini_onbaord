ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEACHER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRINCIPAL';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;

DO $$ BEGIN
  CREATE TYPE "TeacherEmploymentPreference" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'SUBSTITUTE', 'TEMPORARY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "TeacherProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "location" TEXT,
  "contactInformation" TEXT,
  "languages" JSONB,
  "preferredTeachingLocation" TEXT,
  "preferredSalary" INTEGER,
  "expectedJoiningDate" TIMESTAMP(3),
  "employmentPreference" "TeacherEmploymentPreference",
  "aboutMe" TEXT,
  "education" TEXT,
  "bed" TEXT,
  "deled" TEXT,
  "otherQualifications" TEXT,
  "certifications" TEXT,
  "teachingExperience" TEXT,
  "previousSchools" JSONB,
  "subjects" JSONB,
  "classesTaught" JSONB,
  "boardExperience" JSONB,
  "teachingMethodology" TEXT,
  "skills" JSONB,
  "achievements" TEXT,
  "awards" TEXT,
  "basicInformationCompleted" BOOLEAN NOT NULL DEFAULT false,
  "profileCompletionCompleted" BOOLEAN NOT NULL DEFAULT false,
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");
CREATE INDEX "TeacherProfile_basicInformationCompleted_idx" ON "TeacherProfile"("basicInformationCompleted");
CREATE INDEX "TeacherProfile_profileCompletionCompleted_idx" ON "TeacherProfile"("profileCompletionCompleted");
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;