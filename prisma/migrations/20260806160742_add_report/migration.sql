-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('MONTHLY_SUMMARY', 'WEEKLY_HOTSPOTS');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_kind_createdAt_idx" ON "Report"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_kind_periodStart_key" ON "Report"("kind", "periodStart");
