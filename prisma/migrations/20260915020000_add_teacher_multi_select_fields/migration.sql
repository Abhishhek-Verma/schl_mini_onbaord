ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "preferredTeachingLocations" JSONB;
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "employmentPreferences" JSONB;