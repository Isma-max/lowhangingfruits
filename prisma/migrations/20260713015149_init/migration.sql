-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Channel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "comparisonMode" TEXT NOT NULL DEFAULT 'PREVIOUS_PERIOD',
    "comparePeriodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Period_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ColumnMappingPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT,
    "fileType" TEXT NOT NULL,
    "mapping" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
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
    CONSTRAINT "DailyMetric_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
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
    CONSTRAINT "VideoMetric_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conclusions" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "pdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_clientId_name_key" ON "Channel"("clientId", "name");

-- CreateIndex
CREATE INDEX "Period_channelId_idx" ON "Period"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnMappingPreset_channelId_fileType_key" ON "ColumnMappingPreset"("channelId", "fileType");

-- CreateIndex
CREATE INDEX "Upload_periodId_fileType_idx" ON "Upload"("periodId", "fileType");

-- CreateIndex
CREATE INDEX "Upload_hash_idx" ON "Upload"("hash");

-- CreateIndex
CREATE INDEX "DailyMetric_periodId_idx" ON "DailyMetric"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_periodId_date_key" ON "DailyMetric"("periodId", "date");

-- CreateIndex
CREATE INDEX "VideoMetric_periodId_idx" ON "VideoMetric"("periodId");

-- CreateIndex
CREATE INDEX "VideoMetric_periodId_videoId_idx" ON "VideoMetric"("periodId", "videoId");

-- CreateIndex
CREATE INDEX "Report_periodId_idx" ON "Report"("periodId");
