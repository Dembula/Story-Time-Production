-- DropForeignKey
ALTER TABLE "ProjectIdea" DROP CONSTRAINT "ProjectIdea_projectId_fkey";

-- DropIndex
DROP INDEX "ProjectIdea_userId_idx";

-- AlterTable
ALTER TABLE "ActivityLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditionPost" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BtsVideo" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CastingAgency" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CastingInquiry" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CastingTalent" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CateringBooking" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CateringCompany" ALTER COLUMN "minOrder" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CompanySubscription" ALTER COLUMN "currentPeriodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CompetitionPeriod" ALTER COLUMN "startDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "endDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Content" ALTER COLUMN "submittedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreatorBanking" ALTER COLUMN "verifiedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreatorCastRoster" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreatorCrewRoster" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreatorDistributionLicense" ALTER COLUMN "yearlyExpiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreatorPayout" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreatorVote" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CrewMember" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CrewTeam" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CrewTeamMember" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CrewTeamRequest" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EquipmentListing" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EquipmentRequest" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "LocationBooking" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LocationListing" ALTER COLUMN "dailyRate" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MusicTrack" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OriginalMember" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OriginalPitch" ALTER COLUMN "budgetEst" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OriginalProject" ALTER COLUMN "budget" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentRecord" ALTER COLUMN "provider" SET DEFAULT 'STITCH';

-- AlterTable
ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "provider" SET DEFAULT 'STITCH';

-- AlterTable
ALTER TABLE "PendingCreatorSignup" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformRevenue" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectIdea" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PromoCode" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Rating" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ShootDay" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StreamAsset" ALTER COLUMN "lastWebhookAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubscriptionPayment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SyncDeal" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SyncRequest" ALTER COLUMN "budget" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TestPayment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "feeAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UploadPayment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserPreference" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ViewerPaymentMethod" ALTER COLUMN "provider" SET DEFAULT 'STITCH',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ViewerSubscription" ALTER COLUMN "trialEndsAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "currentPeriodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WatchSession" ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WatchlistItem" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AdminRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedRights" JSONB,
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,

    CONSTRAINT "AdminRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT,
    "imageUrls" TEXT,
    "contentId" TEXT,
    "projectId" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'TEXT_UPDATE',
    "videoUrls" TEXT,
    "metadata" TEXT,
    "sceneId" TEXT,
    "productionPhase" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPortfolioItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "sceneId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkPortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPostSave" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPostSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkCollaborationApplication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "NetworkCollaborationApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkConversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVisualAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectVisualAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScript" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScriptVersion" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "versionLabel" TEXT,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoSavedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectScriptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT,
    "number" TEXT NOT NULL,
    "heading" TEXT,
    "storyDay" INTEGER,
    "intExt" TEXT,
    "timeOfDay" TEXT,
    "summary" TEXT,
    "pageCount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "primaryLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptReviewRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptVersionId" TEXT,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW',
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentId" TEXT,
    "feedbackUrl" TEXT,
    "feedbackNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ScriptReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownCharacter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "importance" TEXT,
    "castable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownProp" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "special" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownProp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownLocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "locationListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownWardrobe" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "character" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownWardrobe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownExtra" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownVehicle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "stuntRelated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownStunt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "safetyNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownStunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownSfx" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "practical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownSfx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownMakeup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "notes" TEXT NOT NULL,
    "character" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownMakeup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "totalPlanned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION DEFAULT 1,
    "unitCost" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "ProjectBudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionExpense" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetLineId" TEXT,
    "department" TEXT,
    "vendor" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShootDayScene" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShootDayScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "notes" TEXT,
    "castJson" TEXT,
    "crewJson" TEXT,
    "locationsJson" TEXT,
    "scheduleJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CastingRole" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "breakdownCharacterId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastingRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CastingInvitation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "castingAgencyId" TEXT,
    "talentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CastingInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewRoleNeed" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT NOT NULL,
    "seniority" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewRoleNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewInvitation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "crewTeamId" TEXT,
    "crewMemberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CrewInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "counterpartyUserId" TEXT,
    "castingTalentId" TEXT,
    "crewTeamId" TEXT,
    "locationListingId" TEXT,
    "vendorName" TEXT,
    "subject" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "changeNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSignature" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "role" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "ProjectSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'ZAR',
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchDeck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchDeckSlide" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "body" TEXT,
    "mediaUrl" TEXT,

    CONSTRAINT "PitchDeckSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChatThread" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "channel" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT,
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT,
    "shootDayId" TEXT,
    "sceneId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableReadSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptVersionId" TEXT,
    "name" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "notesLog" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableReadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableReadParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "characterName" TEXT,

    CONSTRAINT "TableReadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableReadNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableReadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentPlanItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "department" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "equipmentListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskChecklistItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "shootDayId" TEXT,
    "body" TEXT NOT NULL,
    "photoUrls" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuityNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailiesBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "shootDayId" TEXT,
    "title" TEXT,
    "videoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailiesBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailiesNote" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailiesNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootageAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FootageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicSelection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "usage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostProductionReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cutAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostProductionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewNote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "timestampMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalDelivery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "masterAssetId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionSubmission" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "territories" TEXT,
    "rights" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWorkspaceLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "secretToken" TEXT,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWorkspaceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptReviewNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AdminRequest_requestedById_idx" ON "AdminRequest"("requestedById");

-- CreateIndex
CREATE INDEX "AdminRequest_status_idx" ON "AdminRequest"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "CreatorFollow_followerId_idx" ON "CreatorFollow"("followerId");

-- CreateIndex
CREATE INDEX "CreatorFollow_followingId_idx" ON "CreatorFollow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorFollow_followerId_followingId_key" ON "CreatorFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "ConnectionRequest_fromId_idx" ON "ConnectionRequest"("fromId");

-- CreateIndex
CREATE INDEX "ConnectionRequest_toId_idx" ON "ConnectionRequest"("toId");

-- CreateIndex
CREATE INDEX "ConnectionRequest_status_idx" ON "ConnectionRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRequest_fromId_toId_key" ON "ConnectionRequest"("fromId", "toId");

-- CreateIndex
CREATE INDEX "NetworkPost_authorId_idx" ON "NetworkPost"("authorId");

-- CreateIndex
CREATE INDEX "NetworkPost_createdAt_idx" ON "NetworkPost"("createdAt");

-- CreateIndex
CREATE INDEX "NetworkPost_contentId_idx" ON "NetworkPost"("contentId");

-- CreateIndex
CREATE INDEX "NetworkPost_projectId_idx" ON "NetworkPost"("projectId");

-- CreateIndex
CREATE INDEX "NetworkPost_postType_idx" ON "NetworkPost"("postType");

-- CreateIndex
CREATE INDEX "NetworkPost_sceneId_idx" ON "NetworkPost"("sceneId");

-- CreateIndex
CREATE INDEX "NetworkPortfolioItem_userId_idx" ON "NetworkPortfolioItem"("userId");

-- CreateIndex
CREATE INDEX "NetworkPortfolioItem_projectId_idx" ON "NetworkPortfolioItem"("projectId");

-- CreateIndex
CREATE INDEX "NetworkPostComment_postId_idx" ON "NetworkPostComment"("postId");

-- CreateIndex
CREATE INDEX "NetworkPostComment_authorId_idx" ON "NetworkPostComment"("authorId");

-- CreateIndex
CREATE INDEX "NetworkPostLike_postId_idx" ON "NetworkPostLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPostLike_postId_userId_key" ON "NetworkPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "NetworkPostSave_userId_idx" ON "NetworkPostSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPostSave_postId_userId_key" ON "NetworkPostSave"("postId", "userId");

-- CreateIndex
CREATE INDEX "NetworkCollaborationApplication_postId_idx" ON "NetworkCollaborationApplication"("postId");

-- CreateIndex
CREATE INDEX "NetworkCollaborationApplication_applicantId_idx" ON "NetworkCollaborationApplication"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkCollaborationApplication_postId_applicantId_key" ON "NetworkCollaborationApplication"("postId", "applicantId");

-- CreateIndex
CREATE INDEX "NetworkConversationParticipant_conversationId_idx" ON "NetworkConversationParticipant"("conversationId");

-- CreateIndex
CREATE INDEX "NetworkConversationParticipant_userId_idx" ON "NetworkConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkConversationParticipant_conversationId_userId_key" ON "NetworkConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "NetworkMessage_conversationId_idx" ON "NetworkMessage"("conversationId");

-- CreateIndex
CREATE INDEX "NetworkMessage_senderId_idx" ON "NetworkMessage"("senderId");

-- CreateIndex
CREATE INDEX "NetworkMessage_createdAt_idx" ON "NetworkMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectVisualAsset_projectId_idx" ON "ProjectVisualAsset"("projectId");

-- CreateIndex
CREATE INDEX "ProjectVisualAsset_projectId_category_idx" ON "ProjectVisualAsset"("projectId", "category");

-- CreateIndex
CREATE INDEX "ProjectScript_projectId_idx" ON "ProjectScript"("projectId");

-- CreateIndex
CREATE INDEX "ProjectScriptVersion_scriptId_idx" ON "ProjectScriptVersion"("scriptId");

-- CreateIndex
CREATE INDEX "ProjectScriptVersion_createdById_idx" ON "ProjectScriptVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScene_primaryLocationId_key" ON "ProjectScene"("primaryLocationId");

-- CreateIndex
CREATE INDEX "ProjectScene_projectId_idx" ON "ProjectScene"("projectId");

-- CreateIndex
CREATE INDEX "ProjectScene_scriptId_idx" ON "ProjectScene"("scriptId");

-- CreateIndex
CREATE INDEX "ProjectActivity_projectId_idx" ON "ProjectActivity"("projectId");

-- CreateIndex
CREATE INDEX "ProjectActivity_userId_idx" ON "ProjectActivity"("userId");

-- CreateIndex
CREATE INDEX "ProjectActivity_createdAt_idx" ON "ProjectActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ScriptReviewRequest_projectId_idx" ON "ScriptReviewRequest"("projectId");

-- CreateIndex
CREATE INDEX "ScriptReviewRequest_requesterId_idx" ON "ScriptReviewRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ScriptReviewRequest_reviewerId_idx" ON "ScriptReviewRequest"("reviewerId");

-- CreateIndex
CREATE INDEX "ScriptReviewRequest_status_idx" ON "ScriptReviewRequest"("status");

-- CreateIndex
CREATE INDEX "BreakdownCharacter_projectId_idx" ON "BreakdownCharacter"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownCharacter_sceneId_idx" ON "BreakdownCharacter"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownProp_projectId_idx" ON "BreakdownProp"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownProp_sceneId_idx" ON "BreakdownProp"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownLocation_projectId_idx" ON "BreakdownLocation"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownLocation_sceneId_idx" ON "BreakdownLocation"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownLocation_locationListingId_idx" ON "BreakdownLocation"("locationListingId");

-- CreateIndex
CREATE INDEX "BreakdownWardrobe_projectId_idx" ON "BreakdownWardrobe"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownWardrobe_sceneId_idx" ON "BreakdownWardrobe"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownExtra_projectId_idx" ON "BreakdownExtra"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownExtra_sceneId_idx" ON "BreakdownExtra"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownVehicle_projectId_idx" ON "BreakdownVehicle"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownVehicle_sceneId_idx" ON "BreakdownVehicle"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownStunt_projectId_idx" ON "BreakdownStunt"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownStunt_sceneId_idx" ON "BreakdownStunt"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownSfx_projectId_idx" ON "BreakdownSfx"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownSfx_sceneId_idx" ON "BreakdownSfx"("sceneId");

-- CreateIndex
CREATE INDEX "BreakdownMakeup_projectId_idx" ON "BreakdownMakeup"("projectId");

-- CreateIndex
CREATE INDEX "BreakdownMakeup_sceneId_idx" ON "BreakdownMakeup"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBudget_projectId_key" ON "ProjectBudget"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBudget_projectId_idx" ON "ProjectBudget"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBudgetLine_budgetId_idx" ON "ProjectBudgetLine"("budgetId");

-- CreateIndex
CREATE INDEX "ProjectBudgetLine_department_idx" ON "ProjectBudgetLine"("department");

-- CreateIndex
CREATE INDEX "ProductionExpense_projectId_idx" ON "ProductionExpense"("projectId");

-- CreateIndex
CREATE INDEX "ProductionExpense_budgetLineId_idx" ON "ProductionExpense"("budgetLineId");

-- CreateIndex
CREATE INDEX "ProductionExpense_department_idx" ON "ProductionExpense"("department");

-- CreateIndex
CREATE INDEX "ShootDayScene_shootDayId_idx" ON "ShootDayScene"("shootDayId");

-- CreateIndex
CREATE INDEX "ShootDayScene_sceneId_idx" ON "ShootDayScene"("sceneId");

-- CreateIndex
CREATE INDEX "CallSheet_projectId_idx" ON "CallSheet"("projectId");

-- CreateIndex
CREATE INDEX "CallSheet_shootDayId_idx" ON "CallSheet"("shootDayId");

-- CreateIndex
CREATE INDEX "CastingRole_projectId_idx" ON "CastingRole"("projectId");

-- CreateIndex
CREATE INDEX "CastingRole_breakdownCharacterId_idx" ON "CastingRole"("breakdownCharacterId");

-- CreateIndex
CREATE INDEX "CastingInvitation_projectId_idx" ON "CastingInvitation"("projectId");

-- CreateIndex
CREATE INDEX "CastingInvitation_roleId_idx" ON "CastingInvitation"("roleId");

-- CreateIndex
CREATE INDEX "CastingInvitation_creatorId_idx" ON "CastingInvitation"("creatorId");

-- CreateIndex
CREATE INDEX "CastingInvitation_castingAgencyId_idx" ON "CastingInvitation"("castingAgencyId");

-- CreateIndex
CREATE INDEX "CastingInvitation_talentId_idx" ON "CastingInvitation"("talentId");

-- CreateIndex
CREATE INDEX "CrewRoleNeed_projectId_idx" ON "CrewRoleNeed"("projectId");

-- CreateIndex
CREATE INDEX "CrewInvitation_projectId_idx" ON "CrewInvitation"("projectId");

-- CreateIndex
CREATE INDEX "CrewInvitation_needId_idx" ON "CrewInvitation"("needId");

-- CreateIndex
CREATE INDEX "CrewInvitation_creatorId_idx" ON "CrewInvitation"("creatorId");

-- CreateIndex
CREATE INDEX "CrewInvitation_crewTeamId_idx" ON "CrewInvitation"("crewTeamId");

-- CreateIndex
CREATE INDEX "CrewInvitation_crewMemberId_idx" ON "CrewInvitation"("crewMemberId");

-- CreateIndex
CREATE INDEX "ProjectContract_projectId_idx" ON "ProjectContract"("projectId");

-- CreateIndex
CREATE INDEX "ProjectContract_counterpartyUserId_idx" ON "ProjectContract"("counterpartyUserId");

-- CreateIndex
CREATE INDEX "ProjectContract_castingTalentId_idx" ON "ProjectContract"("castingTalentId");

-- CreateIndex
CREATE INDEX "ProjectContract_crewTeamId_idx" ON "ProjectContract"("crewTeamId");

-- CreateIndex
CREATE INDEX "ProjectContract_locationListingId_idx" ON "ProjectContract"("locationListingId");

-- CreateIndex
CREATE INDEX "ProjectContractVersion_contractId_idx" ON "ProjectContractVersion"("contractId");

-- CreateIndex
CREATE INDEX "ProjectSignature_contractId_idx" ON "ProjectSignature"("contractId");

-- CreateIndex
CREATE INDEX "ProjectSignature_versionId_idx" ON "ProjectSignature"("versionId");

-- CreateIndex
CREATE INDEX "ProjectSignature_userId_idx" ON "ProjectSignature"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRequest_projectId_key" ON "FundingRequest"("projectId");

-- CreateIndex
CREATE INDEX "FundingRequest_status_idx" ON "FundingRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PitchDeck_projectId_key" ON "PitchDeck"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChatThread_projectId_idx" ON "ProjectChatThread"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_threadId_idx" ON "ProjectChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_projectId_idx" ON "ProjectChatMessage"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_senderId_idx" ON "ProjectChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTask_assigneeId_idx" ON "ProjectTask"("assigneeId");

-- CreateIndex
CREATE INDEX "ProjectTask_department_idx" ON "ProjectTask"("department");

-- CreateIndex
CREATE INDEX "ProjectTask_shootDayId_idx" ON "ProjectTask"("shootDayId");

-- CreateIndex
CREATE INDEX "ProjectTask_sceneId_idx" ON "ProjectTask"("sceneId");

-- CreateIndex
CREATE INDEX "TableReadSession_projectId_idx" ON "TableReadSession"("projectId");

-- CreateIndex
CREATE INDEX "TableReadParticipant_sessionId_idx" ON "TableReadParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "TableReadParticipant_userId_idx" ON "TableReadParticipant"("userId");

-- CreateIndex
CREATE INDEX "TableReadNote_sessionId_idx" ON "TableReadNote"("sessionId");

-- CreateIndex
CREATE INDEX "TableReadNote_userId_idx" ON "TableReadNote"("userId");

-- CreateIndex
CREATE INDEX "EquipmentPlanItem_projectId_idx" ON "EquipmentPlanItem"("projectId");

-- CreateIndex
CREATE INDEX "EquipmentPlanItem_equipmentListingId_idx" ON "EquipmentPlanItem"("equipmentListingId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskPlan_projectId_key" ON "RiskPlan"("projectId");

-- CreateIndex
CREATE INDEX "RiskChecklistItem_planId_idx" ON "RiskChecklistItem"("planId");

-- CreateIndex
CREATE INDEX "RiskChecklistItem_ownerId_idx" ON "RiskChecklistItem"("ownerId");

-- CreateIndex
CREATE INDEX "ContinuityNote_projectId_idx" ON "ContinuityNote"("projectId");

-- CreateIndex
CREATE INDEX "ContinuityNote_sceneId_idx" ON "ContinuityNote"("sceneId");

-- CreateIndex
CREATE INDEX "ContinuityNote_shootDayId_idx" ON "ContinuityNote"("shootDayId");

-- CreateIndex
CREATE INDEX "DailiesBatch_projectId_idx" ON "DailiesBatch"("projectId");

-- CreateIndex
CREATE INDEX "DailiesBatch_sceneId_idx" ON "DailiesBatch"("sceneId");

-- CreateIndex
CREATE INDEX "DailiesBatch_shootDayId_idx" ON "DailiesBatch"("shootDayId");

-- CreateIndex
CREATE INDEX "DailiesNote_batchId_idx" ON "DailiesNote"("batchId");

-- CreateIndex
CREATE INDEX "DailiesNote_userId_idx" ON "DailiesNote"("userId");

-- CreateIndex
CREATE INDEX "FootageAsset_projectId_idx" ON "FootageAsset"("projectId");

-- CreateIndex
CREATE INDEX "FootageAsset_sceneId_idx" ON "FootageAsset"("sceneId");

-- CreateIndex
CREATE INDEX "FootageAsset_type_idx" ON "FootageAsset"("type");

-- CreateIndex
CREATE INDEX "MusicSelection_projectId_idx" ON "MusicSelection"("projectId");

-- CreateIndex
CREATE INDEX "MusicSelection_trackId_idx" ON "MusicSelection"("trackId");

-- CreateIndex
CREATE INDEX "PostProductionReview_projectId_idx" ON "PostProductionReview"("projectId");

-- CreateIndex
CREATE INDEX "ReviewNote_reviewId_idx" ON "ReviewNote"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewNote_userId_idx" ON "ReviewNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalDelivery_projectId_key" ON "FinalDelivery"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalDelivery_masterAssetId_key" ON "FinalDelivery"("masterAssetId");

-- CreateIndex
CREATE INDEX "DistributionSubmission_projectId_idx" ON "DistributionSubmission"("projectId");

-- CreateIndex
CREATE INDEX "DistributionSubmission_target_idx" ON "DistributionSubmission"("target");

-- CreateIndex
CREATE INDEX "DistributionSubmission_status_idx" ON "DistributionSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkspaceLink_projectId_key" ON "ProjectWorkspaceLink"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkspaceLink_slug_key" ON "ProjectWorkspaceLink"("slug");

-- CreateIndex
CREATE INDEX "ProjectWorkspaceLink_projectId_idx" ON "ProjectWorkspaceLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectWorkspaceLink_slug_idx" ON "ProjectWorkspaceLink"("slug");

-- CreateIndex
CREATE INDEX "ScriptReviewNote_projectId_idx" ON "ScriptReviewNote"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptReviewNote_userId_projectId_key" ON "ScriptReviewNote"("userId", "projectId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CreatorStudioTeamInvite_token_idx" ON "CreatorStudioTeamInvite"("token");

-- AddForeignKey
ALTER TABLE "AdminRequest" ADD CONSTRAINT "AdminRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRequest" ADD CONSTRAINT "AdminRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPortfolioItem" ADD CONSTRAINT "NetworkPortfolioItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPortfolioItem" ADD CONSTRAINT "NetworkPortfolioItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPortfolioItem" ADD CONSTRAINT "NetworkPortfolioItem_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPostComment" ADD CONSTRAINT "NetworkPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPostComment" ADD CONSTRAINT "NetworkPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPostLike" ADD CONSTRAINT "NetworkPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPostLike" ADD CONSTRAINT "NetworkPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPostSave" ADD CONSTRAINT "NetworkPostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPostSave" ADD CONSTRAINT "NetworkPostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkCollaborationApplication" ADD CONSTRAINT "NetworkCollaborationApplication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkCollaborationApplication" ADD CONSTRAINT "NetworkCollaborationApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConversationParticipant" ADD CONSTRAINT "NetworkConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NetworkConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConversationParticipant" ADD CONSTRAINT "NetworkConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMessage" ADD CONSTRAINT "NetworkMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NetworkConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMessage" ADD CONSTRAINT "NetworkMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVisualAsset" ADD CONSTRAINT "ProjectVisualAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIdea" ADD CONSTRAINT "ProjectIdea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScript" ADD CONSTRAINT "ProjectScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScriptVersion" ADD CONSTRAINT "ProjectScriptVersion_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ProjectScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScriptVersion" ADD CONSTRAINT "ProjectScriptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScene" ADD CONSTRAINT "ProjectScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScene" ADD CONSTRAINT "ProjectScene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ProjectScript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScene" ADD CONSTRAINT "ProjectScene_primaryLocationId_fkey" FOREIGN KEY ("primaryLocationId") REFERENCES "BreakdownLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ProjectScriptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownCharacter" ADD CONSTRAINT "BreakdownCharacter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownCharacter" ADD CONSTRAINT "BreakdownCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownProp" ADD CONSTRAINT "BreakdownProp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownProp" ADD CONSTRAINT "BreakdownProp_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownLocation" ADD CONSTRAINT "BreakdownLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownLocation" ADD CONSTRAINT "BreakdownLocation_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownLocation" ADD CONSTRAINT "BreakdownLocation_locationListingId_fkey" FOREIGN KEY ("locationListingId") REFERENCES "LocationListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownWardrobe" ADD CONSTRAINT "BreakdownWardrobe_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownWardrobe" ADD CONSTRAINT "BreakdownWardrobe_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownExtra" ADD CONSTRAINT "BreakdownExtra_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownExtra" ADD CONSTRAINT "BreakdownExtra_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownVehicle" ADD CONSTRAINT "BreakdownVehicle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownVehicle" ADD CONSTRAINT "BreakdownVehicle_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownStunt" ADD CONSTRAINT "BreakdownStunt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownStunt" ADD CONSTRAINT "BreakdownStunt_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownSfx" ADD CONSTRAINT "BreakdownSfx_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownSfx" ADD CONSTRAINT "BreakdownSfx_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownMakeup" ADD CONSTRAINT "BreakdownMakeup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownMakeup" ADD CONSTRAINT "BreakdownMakeup_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudget" ADD CONSTRAINT "ProjectBudget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetLine" ADD CONSTRAINT "ProjectBudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "ProjectBudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDayScene" ADD CONSTRAINT "ShootDayScene_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDayScene" ADD CONSTRAINT "ShootDayScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingRole" ADD CONSTRAINT "CastingRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingRole" ADD CONSTRAINT "CastingRole_breakdownCharacterId_fkey" FOREIGN KEY ("breakdownCharacterId") REFERENCES "BreakdownCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CastingRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_castingAgencyId_fkey" FOREIGN KEY ("castingAgencyId") REFERENCES "CastingAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "CastingTalent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewRoleNeed" ADD CONSTRAINT "CrewRoleNeed_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_needId_fkey" FOREIGN KEY ("needId") REFERENCES "CrewRoleNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_crewTeamId_fkey" FOREIGN KEY ("crewTeamId") REFERENCES "CrewTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewTeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_counterpartyUserId_fkey" FOREIGN KEY ("counterpartyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_castingTalentId_fkey" FOREIGN KEY ("castingTalentId") REFERENCES "CastingTalent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_crewTeamId_fkey" FOREIGN KEY ("crewTeamId") REFERENCES "CrewTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_locationListingId_fkey" FOREIGN KEY ("locationListingId") REFERENCES "LocationListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContractVersion" ADD CONSTRAINT "ProjectContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContractVersion" ADD CONSTRAINT "ProjectContractVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSignature" ADD CONSTRAINT "ProjectSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSignature" ADD CONSTRAINT "ProjectSignature_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSignature" ADD CONSTRAINT "ProjectSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingRequest" ADD CONSTRAINT "FundingRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchDeck" ADD CONSTRAINT "PitchDeck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchDeck" ADD CONSTRAINT "PitchDeck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchDeckSlide" ADD CONSTRAINT "PitchDeckSlide_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "PitchDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatThread" ADD CONSTRAINT "ProjectChatThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatThread" ADD CONSTRAINT "ProjectChatThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ProjectChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadSession" ADD CONSTRAINT "TableReadSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadSession" ADD CONSTRAINT "TableReadSession_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ProjectScriptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadSession" ADD CONSTRAINT "TableReadSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadParticipant" ADD CONSTRAINT "TableReadParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableReadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadParticipant" ADD CONSTRAINT "TableReadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadNote" ADD CONSTRAINT "TableReadNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableReadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableReadNote" ADD CONSTRAINT "TableReadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentPlanItem" ADD CONSTRAINT "EquipmentPlanItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentPlanItem" ADD CONSTRAINT "EquipmentPlanItem_equipmentListingId_fkey" FOREIGN KEY ("equipmentListingId") REFERENCES "EquipmentListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskPlan" ADD CONSTRAINT "RiskPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskChecklistItem" ADD CONSTRAINT "RiskChecklistItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RiskPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskChecklistItem" ADD CONSTRAINT "RiskChecklistItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailiesBatch" ADD CONSTRAINT "DailiesBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailiesBatch" ADD CONSTRAINT "DailiesBatch_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailiesBatch" ADD CONSTRAINT "DailiesBatch_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailiesNote" ADD CONSTRAINT "DailiesNote_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailiesBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailiesNote" ADD CONSTRAINT "DailiesNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootageAsset" ADD CONSTRAINT "FootageAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootageAsset" ADD CONSTRAINT "FootageAsset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicSelection" ADD CONSTRAINT "MusicSelection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicSelection" ADD CONSTRAINT "MusicSelection_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MusicTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostProductionReview" ADD CONSTRAINT "PostProductionReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostProductionReview" ADD CONSTRAINT "PostProductionReview_cutAssetId_fkey" FOREIGN KEY ("cutAssetId") REFERENCES "FootageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PostProductionReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalDelivery" ADD CONSTRAINT "FinalDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalDelivery" ADD CONSTRAINT "FinalDelivery_masterAssetId_fkey" FOREIGN KEY ("masterAssetId") REFERENCES "FootageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionSubmission" ADD CONSTRAINT "DistributionSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkspaceLink" ADD CONSTRAINT "ProjectWorkspaceLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptReviewNote" ADD CONSTRAINT "ScriptReviewNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptReviewNote" ADD CONSTRAINT "ScriptReviewNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
