/*
  Warnings:

  - You are about to drop the column `storedPath` on the `Upload` table. All the data in the column will be lost.
  - Added the required column `uploadId` to the `DailyMetric` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawContent` to the `Upload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadId` to the `VideoMetric` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "views" INTEGER,
    "watchTimeHours" REAL,
    "subscribersGained" INTEGER,
    "subscribersLost" INTEGER,
    "impressions" INTEGER,
    "impressionsCtr" REAL,
    "averageViewDuration" INTEGER,
    "averageViewPercentage" REAL,
    "estimatedRevenue" REAL,
    CONSTRAINT "DailyMetric_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyMetric_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyMetric" ("averageViewDuration", "averageViewPercentage", "date", "estimatedRevenue", "id", "impressions", "impressionsCtr", "periodId", "subscribersGained", "subscribersLost", "views", "watchTimeHours") SELECT "averageViewDuration", "averageViewPercentage", "date", "estimatedRevenue", "id", "impressions", "impressionsCtr", "periodId", "subscribersGained", "subscribersLost", "views", "watchTimeHours" FROM "DailyMetric";
DROP TABLE "DailyMetric";
ALTER TABLE "new_DailyMetric" RENAME TO "DailyMetric";
CREATE INDEX "DailyMetric_periodId_idx" ON "DailyMetric"("periodId");
CREATE UNIQUE INDEX "DailyMetric_uploadId_date_key" ON "DailyMetric"("uploadId", "date");
CREATE TABLE "new_Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "validRowCount" INTEGER NOT NULL DEFAULT 0,
    "metricsAvailable" TEXT NOT NULL,
    "metricsMissing" TEXT NOT NULL,
    "errors" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Upload_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Upload" ("createdAt", "errors", "fileType", "hash", "id", "metricsAvailable", "metricsMissing", "originalName", "parserVersion", "periodId", "rowCount", "status", "userId", "validRowCount", "warnings") SELECT "createdAt", "errors", "fileType", "hash", "id", "metricsAvailable", "metricsMissing", "originalName", "parserVersion", "periodId", "rowCount", "status", "userId", "validRowCount", "warnings" FROM "Upload";
DROP TABLE "Upload";
ALTER TABLE "new_Upload" RENAME TO "Upload";
CREATE INDEX "Upload_periodId_fileType_idx" ON "Upload"("periodId", "fileType");
CREATE INDEX "Upload_hash_idx" ON "Upload"("hash");
CREATE TABLE "new_VideoMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "videoId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" DATETIME,
    "durationSeconds" INTEGER,
    "views" INTEGER,
    "watchTimeHours" REAL,
    "averageViewDuration" INTEGER,
    "averageViewPercentage" REAL,
    "impressions" INTEGER,
    "impressionsCtr" REAL,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "subscribersGained" INTEGER,
    "subscribersLost" INTEGER,
    "estimatedRevenue" REAL,
    CONSTRAINT "VideoMetric_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoMetric_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoMetric" ("averageViewDuration", "averageViewPercentage", "comments", "durationSeconds", "estimatedRevenue", "id", "impressions", "impressionsCtr", "likes", "periodId", "publishedAt", "shares", "subscribersGained", "subscribersLost", "title", "url", "videoId", "views", "watchTimeHours") SELECT "averageViewDuration", "averageViewPercentage", "comments", "durationSeconds", "estimatedRevenue", "id", "impressions", "impressionsCtr", "likes", "periodId", "publishedAt", "shares", "subscribersGained", "subscribersLost", "title", "url", "videoId", "views", "watchTimeHours" FROM "VideoMetric";
DROP TABLE "VideoMetric";
ALTER TABLE "new_VideoMetric" RENAME TO "VideoMetric";
CREATE INDEX "VideoMetric_periodId_idx" ON "VideoMetric"("periodId");
CREATE INDEX "VideoMetric_uploadId_idx" ON "VideoMetric"("uploadId");
CREATE INDEX "VideoMetric_periodId_videoId_idx" ON "VideoMetric"("periodId", "videoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
