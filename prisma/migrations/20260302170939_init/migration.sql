-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SUBSCRIBER',
    "bio" TEXT,
    "socialLinks" TEXT,
    "education" TEXT,
    "goals" TEXT,
    "previousWork" TEXT,
    "isAfdaStudent" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "videoUrl" TEXT,
    "trailerUrl" TEXT,
    "category" TEXT,
    "tags" TEXT,
    "language" TEXT,
    "country" TEXT,
    "ageRating" TEXT,
    "year" INTEGER,
    "duration" INTEGER,
    "episodes" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "Content_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BtsVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT,
    "thumbnail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId" TEXT NOT NULL,
    CONSTRAINT "BtsVideo_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "durationSeconds" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    CONSTRAINT "WatchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchSession_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rating_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchlistItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "audioUrl" TEXT,
    "coverUrl" TEXT,
    "genre" TEXT,
    "mood" TEXT,
    "bpm" INTEGER,
    "key" TEXT,
    "duration" INTEGER,
    "description" TEXT,
    "tags" TEXT,
    "isrc" TEXT,
    "language" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "licenseType" TEXT NOT NULL DEFAULT 'SYNC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "MusicTrack_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId" TEXT NOT NULL,
    "musicTrackId" TEXT NOT NULL,
    CONSTRAINT "SyncDeal_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncDeal_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "MusicTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformRevenue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PendingCreatorSignup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bio" TEXT,
    "socialLinks" TEXT,
    "education" TEXT,
    "goals" TEXT,
    "previousWork" TEXT,
    "isAfdaStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "userName" TEXT,
    "role" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "contactUrl" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,
    CONSTRAINT "EquipmentListing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "paymentTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "EquipmentRequest_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "requestId" TEXT,
    "syncRequestId" TEXT,
    "locationBookingId" TEXT,
    "crewTeamRequestId" TEXT,
    "castingInquiryId" TEXT,
    "cateringBookingId" TEXT,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_syncRequestId_fkey" FOREIGN KEY ("syncRequestId") REFERENCES "SyncRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_locationBookingId_fkey" FOREIGN KEY ("locationBookingId") REFERENCES "LocationBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_crewTeamRequestId_fkey" FOREIGN KEY ("crewTeamRequestId") REFERENCES "CrewTeamRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_castingInquiryId_fkey" FOREIGN KEY ("castingInquiryId") REFERENCES "CastingInquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_cateringBookingId_fkey" FOREIGN KEY ("cateringBookingId") REFERENCES "CateringBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "projectName" TEXT,
    "projectType" TEXT,
    "usageType" TEXT,
    "budget" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "trackId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "musicCreatorId" TEXT NOT NULL,
    CONSTRAINT "SyncRequest_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MusicTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncRequest_musicCreatorId_fkey" FOREIGN KEY ("musicCreatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId" TEXT NOT NULL,
    CONSTRAINT "CrewMember_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditionPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "AuditionPost_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditionPost_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OriginalProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "synopsis" TEXT,
    "type" TEXT NOT NULL,
    "genre" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "phase" TEXT NOT NULL DEFAULT 'CONCEPT',
    "budget" REAL,
    "targetDate" TEXT,
    "posterUrl" TEXT,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OriginalPitch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "synopsis" TEXT,
    "type" TEXT NOT NULL,
    "genre" TEXT,
    "scriptUrl" TEXT,
    "treatmentUrl" TEXT,
    "lookbookUrl" TEXT,
    "budgetEst" REAL,
    "targetAudience" TEXT,
    "references" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    "projectId" TEXT,
    CONSTRAINT "OriginalPitch_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OriginalPitch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OriginalMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "OriginalMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OriginalMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "capacity" INTEGER,
    "dailyRate" REAL,
    "amenities" TEXT,
    "photoUrls" TEXT,
    "rules" TEXT,
    "availability" TEXT,
    "contactUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" TEXT,
    CONSTRAINT "LocationListing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "shootType" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "crewSize" INTEGER,
    "paymentTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "LocationBooking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationBooking_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocationBooking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "location" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "specializations" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "logoUrl" TEXT,
    "pastWorkSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CrewTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewTeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "bio" TEXT,
    "skills" TEXT,
    "pastWork" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "crewTeamId" TEXT NOT NULL,
    CONSTRAINT "CrewTeamMember_crewTeamId_fkey" FOREIGN KEY ("crewTeamId") REFERENCES "CrewTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorCrewRoster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "department" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "pastProjects" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "CreatorCrewRoster_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorCastRoster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roleType" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "pastWork" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "CreatorCastRoster_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewTeamRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectName" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    "crewTeamId" TEXT NOT NULL,
    CONSTRAINT "CrewTeamRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewTeamRequest_crewTeamId_fkey" FOREIGN KEY ("crewTeamId") REFERENCES "CrewTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CastingAgency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agencyName" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "location" TEXT,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CastingAgency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CastingTalent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "cvUrl" TEXT,
    "headshotUrl" TEXT,
    "ageRange" TEXT,
    "ethnicity" TEXT,
    "gender" TEXT,
    "skills" TEXT,
    "pastWork" TEXT,
    "reelUrl" TEXT,
    "contactEmail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "castingAgencyId" TEXT NOT NULL,
    CONSTRAINT "CastingTalent_castingAgencyId_fkey" FOREIGN KEY ("castingAgencyId") REFERENCES "CastingAgency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CastingInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectName" TEXT,
    "roleName" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "talentId" TEXT,
    "paymentTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creatorId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    CONSTRAINT "CastingInquiry_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CastingInquiry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "CastingAgency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewerSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trialEndsAt" DATETIME,
    "currentPeriodEnd" DATETIME,
    "deviceCount" INTEGER NOT NULL DEFAULT 1,
    "externalPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ViewerSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "viewerSubscriptionId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL,
    "paidAt" DATETIME,
    "externalPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPayment_viewerSubscriptionId_fkey" FOREIGN KEY ("viewerSubscriptionId") REFERENCES "ViewerSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL,
    "bankReference" TEXT,
    "paidAt" DATETIME,
    "period" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatorPayout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorBanking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "branchCode" TEXT,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorBanking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "feeAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CateringCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "city" TEXT,
    "country" TEXT,
    "specializations" TEXT,
    "minOrder" REAL,
    "contactEmail" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CateringCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CateringBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cateringCompanyId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "eventDate" TEXT,
    "headCount" INTEGER,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CateringBooking_cateringCompanyId_fkey" FOREIGN KEY ("cateringCompanyId") REFERENCES "CateringCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CateringBooking_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyType" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" DATETIME,
    "externalPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanySubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorDistributionLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "yearlyExpiresAt" DATETIME,
    "externalPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorDistributionLicense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "contentId" TEXT,
    "musicTrackId" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetitionPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetitionPeriod_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voterId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "competitionPeriodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatorVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorVote_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreatorVote_competitionPeriodId_fkey" FOREIGN KEY ("competitionPeriodId") REFERENCES "CompetitionPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "theme" TEXT DEFAULT 'dark',
    "accentColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WatchSession_userId_idx" ON "WatchSession"("userId");

-- CreateIndex
CREATE INDEX "WatchSession_contentId_idx" ON "WatchSession"("contentId");

-- CreateIndex
CREATE INDEX "WatchSession_startedAt_idx" ON "WatchSession"("startedAt");

-- CreateIndex
CREATE INDEX "Rating_contentId_idx" ON "Rating"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_contentId_key" ON "Rating"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_contentId_key" ON "WatchlistItem"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDeal_contentId_musicTrackId_key" ON "SyncDeal"("contentId", "musicTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingCreatorSignup_email_key" ON "PendingCreatorSignup"("email");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_role_idx" ON "ActivityLog"("role");

-- CreateIndex
CREATE INDEX "EquipmentListing_companyId_idx" ON "EquipmentListing"("companyId");

-- CreateIndex
CREATE INDEX "EquipmentRequest_requesterId_idx" ON "EquipmentRequest"("requesterId");

-- CreateIndex
CREATE INDEX "EquipmentRequest_companyId_idx" ON "EquipmentRequest"("companyId");

-- CreateIndex
CREATE INDEX "EquipmentRequest_equipmentId_idx" ON "EquipmentRequest"("equipmentId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_requestId_idx" ON "Message"("requestId");

-- CreateIndex
CREATE INDEX "Message_syncRequestId_idx" ON "Message"("syncRequestId");

-- CreateIndex
CREATE INDEX "Message_locationBookingId_idx" ON "Message"("locationBookingId");

-- CreateIndex
CREATE INDEX "Message_crewTeamRequestId_idx" ON "Message"("crewTeamRequestId");

-- CreateIndex
CREATE INDEX "Message_castingInquiryId_idx" ON "Message"("castingInquiryId");

-- CreateIndex
CREATE INDEX "Message_cateringBookingId_idx" ON "Message"("cateringBookingId");

-- CreateIndex
CREATE INDEX "SyncRequest_trackId_idx" ON "SyncRequest"("trackId");

-- CreateIndex
CREATE INDEX "SyncRequest_requesterId_idx" ON "SyncRequest"("requesterId");

-- CreateIndex
CREATE INDEX "SyncRequest_musicCreatorId_idx" ON "SyncRequest"("musicCreatorId");

-- CreateIndex
CREATE INDEX "CrewMember_contentId_idx" ON "CrewMember"("contentId");

-- CreateIndex
CREATE INDEX "AuditionPost_contentId_idx" ON "AuditionPost"("contentId");

-- CreateIndex
CREATE INDEX "AuditionPost_creatorId_idx" ON "AuditionPost"("creatorId");

-- CreateIndex
CREATE INDEX "OriginalProject_status_idx" ON "OriginalProject"("status");

-- CreateIndex
CREATE INDEX "OriginalPitch_creatorId_idx" ON "OriginalPitch"("creatorId");

-- CreateIndex
CREATE INDEX "OriginalPitch_status_idx" ON "OriginalPitch"("status");

-- CreateIndex
CREATE INDEX "OriginalPitch_projectId_idx" ON "OriginalPitch"("projectId");

-- CreateIndex
CREATE INDEX "OriginalMember_userId_idx" ON "OriginalMember"("userId");

-- CreateIndex
CREATE INDEX "OriginalMember_projectId_idx" ON "OriginalMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "OriginalMember_userId_projectId_key" ON "OriginalMember"("userId", "projectId");

-- CreateIndex
CREATE INDEX "LocationListing_companyId_idx" ON "LocationListing"("companyId");

-- CreateIndex
CREATE INDEX "LocationListing_type_idx" ON "LocationListing"("type");

-- CreateIndex
CREATE INDEX "LocationListing_city_idx" ON "LocationListing"("city");

-- CreateIndex
CREATE INDEX "LocationBooking_locationId_idx" ON "LocationBooking"("locationId");

-- CreateIndex
CREATE INDEX "LocationBooking_requesterId_idx" ON "LocationBooking"("requesterId");

-- CreateIndex
CREATE INDEX "LocationBooking_ownerId_idx" ON "LocationBooking"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewTeam_userId_key" ON "CrewTeam"("userId");

-- CreateIndex
CREATE INDEX "CrewTeam_userId_idx" ON "CrewTeam"("userId");

-- CreateIndex
CREATE INDEX "CrewTeam_city_idx" ON "CrewTeam"("city");

-- CreateIndex
CREATE INDEX "CrewTeam_country_idx" ON "CrewTeam"("country");

-- CreateIndex
CREATE INDEX "CrewTeamMember_crewTeamId_idx" ON "CrewTeamMember"("crewTeamId");

-- CreateIndex
CREATE INDEX "CreatorCrewRoster_creatorId_idx" ON "CreatorCrewRoster"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorCastRoster_creatorId_idx" ON "CreatorCastRoster"("creatorId");

-- CreateIndex
CREATE INDEX "CrewTeamRequest_creatorId_idx" ON "CrewTeamRequest"("creatorId");

-- CreateIndex
CREATE INDEX "CrewTeamRequest_crewTeamId_idx" ON "CrewTeamRequest"("crewTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "CastingAgency_userId_key" ON "CastingAgency"("userId");

-- CreateIndex
CREATE INDEX "CastingAgency_userId_idx" ON "CastingAgency"("userId");

-- CreateIndex
CREATE INDEX "CastingAgency_city_idx" ON "CastingAgency"("city");

-- CreateIndex
CREATE INDEX "CastingAgency_country_idx" ON "CastingAgency"("country");

-- CreateIndex
CREATE INDEX "CastingTalent_castingAgencyId_idx" ON "CastingTalent"("castingAgencyId");

-- CreateIndex
CREATE INDEX "CastingInquiry_creatorId_idx" ON "CastingInquiry"("creatorId");

-- CreateIndex
CREATE INDEX "CastingInquiry_agencyId_idx" ON "CastingInquiry"("agencyId");

-- CreateIndex
CREATE INDEX "ViewerSubscription_userId_idx" ON "ViewerSubscription"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_viewerSubscriptionId_idx" ON "SubscriptionPayment"("viewerSubscriptionId");

-- CreateIndex
CREATE INDEX "CreatorPayout_creatorId_idx" ON "CreatorPayout"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorBanking_userId_key" ON "CreatorBanking"("userId");

-- CreateIndex
CREATE INDEX "CreatorBanking_userId_idx" ON "CreatorBanking"("userId");

-- CreateIndex
CREATE INDEX "Transaction_payerId_idx" ON "Transaction"("payerId");

-- CreateIndex
CREATE INDEX "Transaction_payeeId_idx" ON "Transaction"("payeeId");

-- CreateIndex
CREATE INDEX "Transaction_referenceId_idx" ON "Transaction"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CateringCompany_userId_key" ON "CateringCompany"("userId");

-- CreateIndex
CREATE INDEX "CateringCompany_userId_idx" ON "CateringCompany"("userId");

-- CreateIndex
CREATE INDEX "CateringCompany_city_idx" ON "CateringCompany"("city");

-- CreateIndex
CREATE INDEX "CateringCompany_country_idx" ON "CateringCompany"("country");

-- CreateIndex
CREATE INDEX "CateringBooking_cateringCompanyId_idx" ON "CateringBooking"("cateringCompanyId");

-- CreateIndex
CREATE INDEX "CateringBooking_creatorId_idx" ON "CateringBooking"("creatorId");

-- CreateIndex
CREATE INDEX "CompanySubscription_userId_idx" ON "CompanySubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorDistributionLicense_userId_key" ON "CreatorDistributionLicense"("userId");

-- CreateIndex
CREATE INDEX "CreatorDistributionLicense_userId_idx" ON "CreatorDistributionLicense"("userId");

-- CreateIndex
CREATE INDEX "UploadPayment_userId_idx" ON "UploadPayment"("userId");

-- CreateIndex
CREATE INDEX "CompetitionPeriod_status_idx" ON "CompetitionPeriod"("status");

-- CreateIndex
CREATE INDEX "CompetitionPeriod_winnerId_idx" ON "CompetitionPeriod"("winnerId");

-- CreateIndex
CREATE INDEX "CreatorVote_competitionPeriodId_idx" ON "CreatorVote"("competitionPeriodId");

-- CreateIndex
CREATE INDEX "CreatorVote_creatorId_idx" ON "CreatorVote"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorVote_voterId_competitionPeriodId_key" ON "CreatorVote"("voterId", "competitionPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");
