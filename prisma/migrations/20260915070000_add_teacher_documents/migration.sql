CREATE TYPE "TeacherDocumentType" AS ENUM ('AADHAAR', 'TENTH', 'TWELFTH', 'GRADUATION', 'BED', 'DLED');

CREATE TABLE "TeacherDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "TeacherDocumentType" NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherDocument_storageKey_key" ON "TeacherDocument"("storageKey");
CREATE UNIQUE INDEX "TeacherDocument_userId_documentType_slot_key" ON "TeacherDocument"("userId", "documentType", "slot");
CREATE INDEX "TeacherDocument_userId_idx" ON "TeacherDocument"("userId");

ALTER TABLE "TeacherDocument"
ADD CONSTRAINT "TeacherDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;