ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "currentLocation" JSONB;
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "preferredLocations" JSONB;
