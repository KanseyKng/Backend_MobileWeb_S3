-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
