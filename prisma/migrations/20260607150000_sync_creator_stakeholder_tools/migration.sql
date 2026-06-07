-- Sync missing creator / stakeholder tool tables (safe apply)

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AdminRequest" (
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

CREATE TABLE IF NOT EXISTS "Notification" (
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

CREATE TABLE IF NOT EXISTS "CreatorFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkPost" (
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

CREATE TABLE IF NOT EXISTS "NetworkPortfolioItem" (
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

CREATE TABLE IF NOT EXISTS "NetworkPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPostComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPostLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkPostSave" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPostSave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkCollaborationApplication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "NetworkCollaborationApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkConversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectVisualAsset" (
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

CREATE TABLE IF NOT EXISTS "ProjectScript" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectScriptVersion" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "versionLabel" TEXT,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoSavedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectScriptVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectScene" (
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

CREATE TABLE IF NOT EXISTS "ProjectActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScriptReviewRequest" (
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

CREATE TABLE IF NOT EXISTS "BreakdownCharacter" (
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

CREATE TABLE IF NOT EXISTS "BreakdownProp" (
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

CREATE TABLE IF NOT EXISTS "BreakdownLocation" (
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

CREATE TABLE IF NOT EXISTS "BreakdownWardrobe" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "character" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownWardrobe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BreakdownExtra" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownExtra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BreakdownVehicle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "stuntRelated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownVehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BreakdownStunt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "safetyNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownStunt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BreakdownSfx" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "description" TEXT NOT NULL,
    "practical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownSfx_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BreakdownMakeup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "notes" TEXT NOT NULL,
    "character" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakdownMakeup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectBudget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "totalPlanned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectBudgetLine" (
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

CREATE TABLE IF NOT EXISTS "ProductionExpense" (
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

CREATE TABLE IF NOT EXISTS "ShootDayScene" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShootDayScene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallSheet" (
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

CREATE TABLE IF NOT EXISTS "CastingRole" (
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

CREATE TABLE IF NOT EXISTS "CastingInvitation" (
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

CREATE TABLE IF NOT EXISTS "CrewRoleNeed" (
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

CREATE TABLE IF NOT EXISTS "CrewInvitation" (
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

CREATE TABLE IF NOT EXISTS "ProjectContract" (
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

CREATE TABLE IF NOT EXISTS "ProjectContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "changeNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContractVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectSignature" (
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

CREATE TABLE IF NOT EXISTS "FundingRequest" (
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

CREATE TABLE IF NOT EXISTS "PitchDeck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchDeck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PitchDeckSlide" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "body" TEXT,
    "mediaUrl" TEXT,

    CONSTRAINT "PitchDeckSlide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectChatThread" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "channel" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChatThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectTask" (
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

CREATE TABLE IF NOT EXISTS "TableReadSession" (
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

CREATE TABLE IF NOT EXISTS "TableReadParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "characterName" TEXT,

    CONSTRAINT "TableReadParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TableReadNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableReadNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EquipmentPlanItem" (
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

CREATE TABLE IF NOT EXISTS "RiskPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RiskChecklistItem" (
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

CREATE TABLE IF NOT EXISTS "ContinuityNote" (
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

CREATE TABLE IF NOT EXISTS "DailiesBatch" (
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

CREATE TABLE IF NOT EXISTS "DailiesNote" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailiesNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FootageAsset" (
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

CREATE TABLE IF NOT EXISTS "MusicSelection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "usage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PostProductionReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cutAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostProductionReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewNote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "timestampMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinalDelivery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "masterAssetId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DistributionSubmission" (
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

CREATE TABLE IF NOT EXISTS "ProjectWorkspaceLink" (
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

CREATE TABLE IF NOT EXISTS "ScriptReviewNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptReviewNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");;
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");;
CREATE INDEX IF NOT EXISTS "AdminRequest_requestedById_idx" ON "AdminRequest"("requestedById");;
CREATE INDEX IF NOT EXISTS "AdminRequest_status_idx" ON "AdminRequest"("status");;
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");;
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");;
CREATE INDEX IF NOT EXISTS "CreatorFollow_followerId_idx" ON "CreatorFollow"("followerId");;
CREATE INDEX IF NOT EXISTS "CreatorFollow_followingId_idx" ON "CreatorFollow"("followingId");;
CREATE UNIQUE INDEX IF NOT EXISTS "CreatorFollow_followerId_followingId_key" ON "CreatorFollow"("followerId", "followingId");;
CREATE INDEX IF NOT EXISTS "ConnectionRequest_fromId_idx" ON "ConnectionRequest"("fromId");;
CREATE INDEX IF NOT EXISTS "ConnectionRequest_toId_idx" ON "ConnectionRequest"("toId");;
CREATE INDEX IF NOT EXISTS "ConnectionRequest_status_idx" ON "ConnectionRequest"("status");;
CREATE UNIQUE INDEX IF NOT EXISTS "ConnectionRequest_fromId_toId_key" ON "ConnectionRequest"("fromId", "toId");;
CREATE INDEX IF NOT EXISTS "NetworkPost_authorId_idx" ON "NetworkPost"("authorId");;
CREATE INDEX IF NOT EXISTS "NetworkPost_createdAt_idx" ON "NetworkPost"("createdAt");;
CREATE INDEX IF NOT EXISTS "NetworkPost_contentId_idx" ON "NetworkPost"("contentId");;
CREATE INDEX IF NOT EXISTS "NetworkPost_projectId_idx" ON "NetworkPost"("projectId");;
CREATE INDEX IF NOT EXISTS "NetworkPost_postType_idx" ON "NetworkPost"("postType");;
CREATE INDEX IF NOT EXISTS "NetworkPost_sceneId_idx" ON "NetworkPost"("sceneId");;
CREATE INDEX IF NOT EXISTS "NetworkPortfolioItem_userId_idx" ON "NetworkPortfolioItem"("userId");;
CREATE INDEX IF NOT EXISTS "NetworkPortfolioItem_projectId_idx" ON "NetworkPortfolioItem"("projectId");;
CREATE INDEX IF NOT EXISTS "NetworkPostComment_postId_idx" ON "NetworkPostComment"("postId");;
CREATE INDEX IF NOT EXISTS "NetworkPostComment_authorId_idx" ON "NetworkPostComment"("authorId");;
CREATE INDEX IF NOT EXISTS "NetworkPostLike_postId_idx" ON "NetworkPostLike"("postId");;
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkPostLike_postId_userId_key" ON "NetworkPostLike"("postId", "userId");;
CREATE INDEX IF NOT EXISTS "NetworkPostSave_userId_idx" ON "NetworkPostSave"("userId");;
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkPostSave_postId_userId_key" ON "NetworkPostSave"("postId", "userId");;
CREATE INDEX IF NOT EXISTS "NetworkCollaborationApplication_postId_idx" ON "NetworkCollaborationApplication"("postId");;
CREATE INDEX IF NOT EXISTS "NetworkCollaborationApplication_applicantId_idx" ON "NetworkCollaborationApplication"("applicantId");;
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkCollaborationApplication_postId_applicantId_key" ON "NetworkCollaborationApplication"("postId", "applicantId");;
CREATE INDEX IF NOT EXISTS "NetworkConversationParticipant_conversationId_idx" ON "NetworkConversationParticipant"("conversationId");;
CREATE INDEX IF NOT EXISTS "NetworkConversationParticipant_userId_idx" ON "NetworkConversationParticipant"("userId");;
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkConversationParticipant_conversationId_userId_key" ON "NetworkConversationParticipant"("conversationId", "userId");;
CREATE INDEX IF NOT EXISTS "NetworkMessage_conversationId_idx" ON "NetworkMessage"("conversationId");;
CREATE INDEX IF NOT EXISTS "NetworkMessage_senderId_idx" ON "NetworkMessage"("senderId");;
CREATE INDEX IF NOT EXISTS "NetworkMessage_createdAt_idx" ON "NetworkMessage"("createdAt");;
CREATE INDEX IF NOT EXISTS "ProjectVisualAsset_projectId_idx" ON "ProjectVisualAsset"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectVisualAsset_projectId_category_idx" ON "ProjectVisualAsset"("projectId", "category");;
CREATE INDEX IF NOT EXISTS "ProjectScript_projectId_idx" ON "ProjectScript"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectScriptVersion_scriptId_idx" ON "ProjectScriptVersion"("scriptId");;
CREATE INDEX IF NOT EXISTS "ProjectScriptVersion_createdById_idx" ON "ProjectScriptVersion"("createdById");;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectScene_primaryLocationId_key" ON "ProjectScene"("primaryLocationId");;
CREATE INDEX IF NOT EXISTS "ProjectScene_projectId_idx" ON "ProjectScene"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectScene_scriptId_idx" ON "ProjectScene"("scriptId");;
CREATE INDEX IF NOT EXISTS "ProjectActivity_projectId_idx" ON "ProjectActivity"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectActivity_userId_idx" ON "ProjectActivity"("userId");;
CREATE INDEX IF NOT EXISTS "ProjectActivity_createdAt_idx" ON "ProjectActivity"("createdAt");;
CREATE INDEX IF NOT EXISTS "ScriptReviewRequest_projectId_idx" ON "ScriptReviewRequest"("projectId");;
CREATE INDEX IF NOT EXISTS "ScriptReviewRequest_requesterId_idx" ON "ScriptReviewRequest"("requesterId");;
CREATE INDEX IF NOT EXISTS "ScriptReviewRequest_reviewerId_idx" ON "ScriptReviewRequest"("reviewerId");;
CREATE INDEX IF NOT EXISTS "ScriptReviewRequest_status_idx" ON "ScriptReviewRequest"("status");;
CREATE INDEX IF NOT EXISTS "BreakdownCharacter_projectId_idx" ON "BreakdownCharacter"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownCharacter_sceneId_idx" ON "BreakdownCharacter"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownProp_projectId_idx" ON "BreakdownProp"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownProp_sceneId_idx" ON "BreakdownProp"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownLocation_projectId_idx" ON "BreakdownLocation"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownLocation_sceneId_idx" ON "BreakdownLocation"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownLocation_locationListingId_idx" ON "BreakdownLocation"("locationListingId");;
CREATE INDEX IF NOT EXISTS "BreakdownWardrobe_projectId_idx" ON "BreakdownWardrobe"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownWardrobe_sceneId_idx" ON "BreakdownWardrobe"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownExtra_projectId_idx" ON "BreakdownExtra"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownExtra_sceneId_idx" ON "BreakdownExtra"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownVehicle_projectId_idx" ON "BreakdownVehicle"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownVehicle_sceneId_idx" ON "BreakdownVehicle"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownStunt_projectId_idx" ON "BreakdownStunt"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownStunt_sceneId_idx" ON "BreakdownStunt"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownSfx_projectId_idx" ON "BreakdownSfx"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownSfx_sceneId_idx" ON "BreakdownSfx"("sceneId");;
CREATE INDEX IF NOT EXISTS "BreakdownMakeup_projectId_idx" ON "BreakdownMakeup"("projectId");;
CREATE INDEX IF NOT EXISTS "BreakdownMakeup_sceneId_idx" ON "BreakdownMakeup"("sceneId");;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectBudget_projectId_key" ON "ProjectBudget"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectBudget_projectId_idx" ON "ProjectBudget"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectBudgetLine_budgetId_idx" ON "ProjectBudgetLine"("budgetId");;
CREATE INDEX IF NOT EXISTS "ProjectBudgetLine_department_idx" ON "ProjectBudgetLine"("department");;
CREATE INDEX IF NOT EXISTS "ProductionExpense_projectId_idx" ON "ProductionExpense"("projectId");;
CREATE INDEX IF NOT EXISTS "ProductionExpense_budgetLineId_idx" ON "ProductionExpense"("budgetLineId");;
CREATE INDEX IF NOT EXISTS "ProductionExpense_department_idx" ON "ProductionExpense"("department");;
CREATE INDEX IF NOT EXISTS "ShootDayScene_shootDayId_idx" ON "ShootDayScene"("shootDayId");;
CREATE INDEX IF NOT EXISTS "ShootDayScene_sceneId_idx" ON "ShootDayScene"("sceneId");;
CREATE INDEX IF NOT EXISTS "CallSheet_projectId_idx" ON "CallSheet"("projectId");;
CREATE INDEX IF NOT EXISTS "CallSheet_shootDayId_idx" ON "CallSheet"("shootDayId");;
CREATE INDEX IF NOT EXISTS "CastingRole_projectId_idx" ON "CastingRole"("projectId");;
CREATE INDEX IF NOT EXISTS "CastingRole_breakdownCharacterId_idx" ON "CastingRole"("breakdownCharacterId");;
CREATE INDEX IF NOT EXISTS "CastingInvitation_projectId_idx" ON "CastingInvitation"("projectId");;
CREATE INDEX IF NOT EXISTS "CastingInvitation_roleId_idx" ON "CastingInvitation"("roleId");;
CREATE INDEX IF NOT EXISTS "CastingInvitation_creatorId_idx" ON "CastingInvitation"("creatorId");;
CREATE INDEX IF NOT EXISTS "CastingInvitation_castingAgencyId_idx" ON "CastingInvitation"("castingAgencyId");;
CREATE INDEX IF NOT EXISTS "CastingInvitation_talentId_idx" ON "CastingInvitation"("talentId");;
CREATE INDEX IF NOT EXISTS "CrewRoleNeed_projectId_idx" ON "CrewRoleNeed"("projectId");;
CREATE INDEX IF NOT EXISTS "CrewInvitation_projectId_idx" ON "CrewInvitation"("projectId");;
CREATE INDEX IF NOT EXISTS "CrewInvitation_needId_idx" ON "CrewInvitation"("needId");;
CREATE INDEX IF NOT EXISTS "CrewInvitation_creatorId_idx" ON "CrewInvitation"("creatorId");;
CREATE INDEX IF NOT EXISTS "CrewInvitation_crewTeamId_idx" ON "CrewInvitation"("crewTeamId");;
CREATE INDEX IF NOT EXISTS "CrewInvitation_crewMemberId_idx" ON "CrewInvitation"("crewMemberId");;
CREATE INDEX IF NOT EXISTS "ProjectContract_projectId_idx" ON "ProjectContract"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectContract_counterpartyUserId_idx" ON "ProjectContract"("counterpartyUserId");;
CREATE INDEX IF NOT EXISTS "ProjectContract_castingTalentId_idx" ON "ProjectContract"("castingTalentId");;
CREATE INDEX IF NOT EXISTS "ProjectContract_crewTeamId_idx" ON "ProjectContract"("crewTeamId");;
CREATE INDEX IF NOT EXISTS "ProjectContract_locationListingId_idx" ON "ProjectContract"("locationListingId");;
CREATE INDEX IF NOT EXISTS "ProjectContractVersion_contractId_idx" ON "ProjectContractVersion"("contractId");;
CREATE INDEX IF NOT EXISTS "ProjectSignature_contractId_idx" ON "ProjectSignature"("contractId");;
CREATE INDEX IF NOT EXISTS "ProjectSignature_versionId_idx" ON "ProjectSignature"("versionId");;
CREATE INDEX IF NOT EXISTS "ProjectSignature_userId_idx" ON "ProjectSignature"("userId");;
CREATE UNIQUE INDEX IF NOT EXISTS "FundingRequest_projectId_key" ON "FundingRequest"("projectId");;
CREATE INDEX IF NOT EXISTS "FundingRequest_status_idx" ON "FundingRequest"("status");;
CREATE UNIQUE INDEX IF NOT EXISTS "PitchDeck_projectId_key" ON "PitchDeck"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectChatThread_projectId_idx" ON "ProjectChatThread"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectChatMessage_threadId_idx" ON "ProjectChatMessage"("threadId");;
CREATE INDEX IF NOT EXISTS "ProjectChatMessage_projectId_idx" ON "ProjectChatMessage"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectChatMessage_senderId_idx" ON "ProjectChatMessage"("senderId");;
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectTask_assigneeId_idx" ON "ProjectTask"("assigneeId");;
CREATE INDEX IF NOT EXISTS "ProjectTask_department_idx" ON "ProjectTask"("department");;
CREATE INDEX IF NOT EXISTS "ProjectTask_shootDayId_idx" ON "ProjectTask"("shootDayId");;
CREATE INDEX IF NOT EXISTS "ProjectTask_sceneId_idx" ON "ProjectTask"("sceneId");;
CREATE INDEX IF NOT EXISTS "TableReadSession_projectId_idx" ON "TableReadSession"("projectId");;
CREATE INDEX IF NOT EXISTS "TableReadParticipant_sessionId_idx" ON "TableReadParticipant"("sessionId");;
CREATE INDEX IF NOT EXISTS "TableReadParticipant_userId_idx" ON "TableReadParticipant"("userId");;
CREATE INDEX IF NOT EXISTS "TableReadNote_sessionId_idx" ON "TableReadNote"("sessionId");;
CREATE INDEX IF NOT EXISTS "TableReadNote_userId_idx" ON "TableReadNote"("userId");;
CREATE INDEX IF NOT EXISTS "EquipmentPlanItem_projectId_idx" ON "EquipmentPlanItem"("projectId");;
CREATE INDEX IF NOT EXISTS "EquipmentPlanItem_equipmentListingId_idx" ON "EquipmentPlanItem"("equipmentListingId");;
CREATE UNIQUE INDEX IF NOT EXISTS "RiskPlan_projectId_key" ON "RiskPlan"("projectId");;
CREATE INDEX IF NOT EXISTS "RiskChecklistItem_planId_idx" ON "RiskChecklistItem"("planId");;
CREATE INDEX IF NOT EXISTS "RiskChecklistItem_ownerId_idx" ON "RiskChecklistItem"("ownerId");;
CREATE INDEX IF NOT EXISTS "ContinuityNote_projectId_idx" ON "ContinuityNote"("projectId");;
CREATE INDEX IF NOT EXISTS "ContinuityNote_sceneId_idx" ON "ContinuityNote"("sceneId");;
CREATE INDEX IF NOT EXISTS "ContinuityNote_shootDayId_idx" ON "ContinuityNote"("shootDayId");;
CREATE INDEX IF NOT EXISTS "DailiesBatch_projectId_idx" ON "DailiesBatch"("projectId");;
CREATE INDEX IF NOT EXISTS "DailiesBatch_sceneId_idx" ON "DailiesBatch"("sceneId");;
CREATE INDEX IF NOT EXISTS "DailiesBatch_shootDayId_idx" ON "DailiesBatch"("shootDayId");;
CREATE INDEX IF NOT EXISTS "DailiesNote_batchId_idx" ON "DailiesNote"("batchId");;
CREATE INDEX IF NOT EXISTS "DailiesNote_userId_idx" ON "DailiesNote"("userId");;
CREATE INDEX IF NOT EXISTS "FootageAsset_projectId_idx" ON "FootageAsset"("projectId");;
CREATE INDEX IF NOT EXISTS "FootageAsset_sceneId_idx" ON "FootageAsset"("sceneId");;
CREATE INDEX IF NOT EXISTS "FootageAsset_type_idx" ON "FootageAsset"("type");;
CREATE INDEX IF NOT EXISTS "MusicSelection_projectId_idx" ON "MusicSelection"("projectId");;
CREATE INDEX IF NOT EXISTS "MusicSelection_trackId_idx" ON "MusicSelection"("trackId");;
CREATE INDEX IF NOT EXISTS "PostProductionReview_projectId_idx" ON "PostProductionReview"("projectId");;
CREATE INDEX IF NOT EXISTS "ReviewNote_reviewId_idx" ON "ReviewNote"("reviewId");;
CREATE INDEX IF NOT EXISTS "ReviewNote_userId_idx" ON "ReviewNote"("userId");;
CREATE UNIQUE INDEX IF NOT EXISTS "FinalDelivery_projectId_key" ON "FinalDelivery"("projectId");;
CREATE UNIQUE INDEX IF NOT EXISTS "FinalDelivery_masterAssetId_key" ON "FinalDelivery"("masterAssetId");;
CREATE INDEX IF NOT EXISTS "DistributionSubmission_projectId_idx" ON "DistributionSubmission"("projectId");;
CREATE INDEX IF NOT EXISTS "DistributionSubmission_target_idx" ON "DistributionSubmission"("target");;
CREATE INDEX IF NOT EXISTS "DistributionSubmission_status_idx" ON "DistributionSubmission"("status");;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectWorkspaceLink_projectId_key" ON "ProjectWorkspaceLink"("projectId");;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectWorkspaceLink_slug_key" ON "ProjectWorkspaceLink"("slug");;
CREATE INDEX IF NOT EXISTS "ProjectWorkspaceLink_projectId_idx" ON "ProjectWorkspaceLink"("projectId");;
CREATE INDEX IF NOT EXISTS "ProjectWorkspaceLink_slug_idx" ON "ProjectWorkspaceLink"("slug");;
CREATE INDEX IF NOT EXISTS "ScriptReviewNote_projectId_idx" ON "ScriptReviewNote"("projectId");;
CREATE UNIQUE INDEX IF NOT EXISTS "ScriptReviewNote_userId_projectId_key" ON "ScriptReviewNote"("userId", "projectId");;
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");;
CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");;
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");;
CREATE INDEX IF NOT EXISTS "CreatorStudioTeamInvite_token_idx" ON "CreatorStudioTeamInvite"("token");;

ALTER TABLE "EquipmentListing" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "location" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "AdminRequest" ADD CONSTRAINT "AdminRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "AdminRequest" ADD CONSTRAINT "AdminRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
  ) THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CreatorFollow_followerId_fkey'
  ) THEN
    ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CreatorFollow_followingId_fkey'
  ) THEN
    ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionRequest_fromId_fkey'
  ) THEN
    ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionRequest_toId_fkey'
  ) THEN
    ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPost_sceneId_fkey'
  ) THEN
    ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPost_authorId_fkey'
  ) THEN
    ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPost_contentId_fkey'
  ) THEN
    ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPost_projectId_fkey'
  ) THEN
    ALTER TABLE "NetworkPost" ADD CONSTRAINT "NetworkPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPortfolioItem_userId_fkey'
  ) THEN
    ALTER TABLE "NetworkPortfolioItem" ADD CONSTRAINT "NetworkPortfolioItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPortfolioItem_projectId_fkey'
  ) THEN
    ALTER TABLE "NetworkPortfolioItem" ADD CONSTRAINT "NetworkPortfolioItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPortfolioItem_sceneId_fkey'
  ) THEN
    ALTER TABLE "NetworkPortfolioItem" ADD CONSTRAINT "NetworkPortfolioItem_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPostComment_postId_fkey'
  ) THEN
    ALTER TABLE "NetworkPostComment" ADD CONSTRAINT "NetworkPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPostComment_authorId_fkey'
  ) THEN
    ALTER TABLE "NetworkPostComment" ADD CONSTRAINT "NetworkPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPostLike_postId_fkey'
  ) THEN
    ALTER TABLE "NetworkPostLike" ADD CONSTRAINT "NetworkPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPostLike_userId_fkey'
  ) THEN
    ALTER TABLE "NetworkPostLike" ADD CONSTRAINT "NetworkPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPostSave_postId_fkey'
  ) THEN
    ALTER TABLE "NetworkPostSave" ADD CONSTRAINT "NetworkPostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkPostSave_userId_fkey'
  ) THEN
    ALTER TABLE "NetworkPostSave" ADD CONSTRAINT "NetworkPostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkCollaborationApplication_postId_fkey'
  ) THEN
    ALTER TABLE "NetworkCollaborationApplication" ADD CONSTRAINT "NetworkCollaborationApplication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NetworkPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkCollaborationApplication_applicantId_fkey'
  ) THEN
    ALTER TABLE "NetworkCollaborationApplication" ADD CONSTRAINT "NetworkCollaborationApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkConversationParticipant_conversationId_fkey'
  ) THEN
    ALTER TABLE "NetworkConversationParticipant" ADD CONSTRAINT "NetworkConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NetworkConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkConversationParticipant_userId_fkey'
  ) THEN
    ALTER TABLE "NetworkConversationParticipant" ADD CONSTRAINT "NetworkConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkMessage_conversationId_fkey'
  ) THEN
    ALTER TABLE "NetworkMessage" ADD CONSTRAINT "NetworkMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NetworkConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetworkMessage_senderId_fkey'
  ) THEN
    ALTER TABLE "NetworkMessage" ADD CONSTRAINT "NetworkMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectVisualAsset_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectVisualAsset" ADD CONSTRAINT "ProjectVisualAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectIdea_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectIdea" ADD CONSTRAINT "ProjectIdea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScript_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectScript" ADD CONSTRAINT "ProjectScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScriptVersion_scriptId_fkey'
  ) THEN
    ALTER TABLE "ProjectScriptVersion" ADD CONSTRAINT "ProjectScriptVersion_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ProjectScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScriptVersion_createdById_fkey'
  ) THEN
    ALTER TABLE "ProjectScriptVersion" ADD CONSTRAINT "ProjectScriptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScene_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectScene" ADD CONSTRAINT "ProjectScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScene_scriptId_fkey'
  ) THEN
    ALTER TABLE "ProjectScene" ADD CONSTRAINT "ProjectScene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ProjectScript"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScene_primaryLocationId_fkey'
  ) THEN
    ALTER TABLE "ProjectScene" ADD CONSTRAINT "ProjectScene_primaryLocationId_fkey" FOREIGN KEY ("primaryLocationId") REFERENCES "BreakdownLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectActivity_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectActivity_userId_fkey'
  ) THEN
    ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScriptReviewRequest_projectId_fkey'
  ) THEN
    ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScriptReviewRequest_scriptVersionId_fkey'
  ) THEN
    ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ProjectScriptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScriptReviewRequest_requesterId_fkey'
  ) THEN
    ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScriptReviewRequest_reviewerId_fkey'
  ) THEN
    ALTER TABLE "ScriptReviewRequest" ADD CONSTRAINT "ScriptReviewRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownCharacter_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownCharacter" ADD CONSTRAINT "BreakdownCharacter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownCharacter_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownCharacter" ADD CONSTRAINT "BreakdownCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownProp_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownProp" ADD CONSTRAINT "BreakdownProp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownProp_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownProp" ADD CONSTRAINT "BreakdownProp_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownLocation_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownLocation" ADD CONSTRAINT "BreakdownLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownLocation_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownLocation" ADD CONSTRAINT "BreakdownLocation_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownLocation_locationListingId_fkey'
  ) THEN
    ALTER TABLE "BreakdownLocation" ADD CONSTRAINT "BreakdownLocation_locationListingId_fkey" FOREIGN KEY ("locationListingId") REFERENCES "LocationListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownWardrobe_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownWardrobe" ADD CONSTRAINT "BreakdownWardrobe_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownWardrobe_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownWardrobe" ADD CONSTRAINT "BreakdownWardrobe_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownExtra_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownExtra" ADD CONSTRAINT "BreakdownExtra_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownExtra_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownExtra" ADD CONSTRAINT "BreakdownExtra_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownVehicle_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownVehicle" ADD CONSTRAINT "BreakdownVehicle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownVehicle_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownVehicle" ADD CONSTRAINT "BreakdownVehicle_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownStunt_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownStunt" ADD CONSTRAINT "BreakdownStunt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownStunt_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownStunt" ADD CONSTRAINT "BreakdownStunt_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownSfx_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownSfx" ADD CONSTRAINT "BreakdownSfx_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownSfx_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownSfx" ADD CONSTRAINT "BreakdownSfx_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownMakeup_projectId_fkey'
  ) THEN
    ALTER TABLE "BreakdownMakeup" ADD CONSTRAINT "BreakdownMakeup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakdownMakeup_sceneId_fkey'
  ) THEN
    ALTER TABLE "BreakdownMakeup" ADD CONSTRAINT "BreakdownMakeup_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectBudget_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectBudget" ADD CONSTRAINT "ProjectBudget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectBudgetLine_budgetId_fkey'
  ) THEN
    ALTER TABLE "ProjectBudgetLine" ADD CONSTRAINT "ProjectBudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductionExpense_projectId_fkey'
  ) THEN
    ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductionExpense_budgetLineId_fkey'
  ) THEN
    ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "ProjectBudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductionExpense_createdById_fkey'
  ) THEN
    ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShootDayScene_shootDayId_fkey'
  ) THEN
    ALTER TABLE "ShootDayScene" ADD CONSTRAINT "ShootDayScene_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShootDayScene_sceneId_fkey'
  ) THEN
    ALTER TABLE "ShootDayScene" ADD CONSTRAINT "ShootDayScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CallSheet_projectId_fkey'
  ) THEN
    ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CallSheet_shootDayId_fkey'
  ) THEN
    ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingRole_projectId_fkey'
  ) THEN
    ALTER TABLE "CastingRole" ADD CONSTRAINT "CastingRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingRole_breakdownCharacterId_fkey'
  ) THEN
    ALTER TABLE "CastingRole" ADD CONSTRAINT "CastingRole_breakdownCharacterId_fkey" FOREIGN KEY ("breakdownCharacterId") REFERENCES "BreakdownCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingInvitation_projectId_fkey'
  ) THEN
    ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingInvitation_roleId_fkey'
  ) THEN
    ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CastingRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingInvitation_creatorId_fkey'
  ) THEN
    ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingInvitation_castingAgencyId_fkey'
  ) THEN
    ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_castingAgencyId_fkey" FOREIGN KEY ("castingAgencyId") REFERENCES "CastingAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CastingInvitation_talentId_fkey'
  ) THEN
    ALTER TABLE "CastingInvitation" ADD CONSTRAINT "CastingInvitation_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "CastingTalent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrewRoleNeed_projectId_fkey'
  ) THEN
    ALTER TABLE "CrewRoleNeed" ADD CONSTRAINT "CrewRoleNeed_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrewInvitation_projectId_fkey'
  ) THEN
    ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrewInvitation_needId_fkey'
  ) THEN
    ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_needId_fkey" FOREIGN KEY ("needId") REFERENCES "CrewRoleNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrewInvitation_creatorId_fkey'
  ) THEN
    ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrewInvitation_crewTeamId_fkey'
  ) THEN
    ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_crewTeamId_fkey" FOREIGN KEY ("crewTeamId") REFERENCES "CrewTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrewInvitation_crewMemberId_fkey'
  ) THEN
    ALTER TABLE "CrewInvitation" ADD CONSTRAINT "CrewInvitation_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewTeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContract_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContract_counterpartyUserId_fkey'
  ) THEN
    ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_counterpartyUserId_fkey" FOREIGN KEY ("counterpartyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContract_castingTalentId_fkey'
  ) THEN
    ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_castingTalentId_fkey" FOREIGN KEY ("castingTalentId") REFERENCES "CastingTalent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContract_crewTeamId_fkey'
  ) THEN
    ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_crewTeamId_fkey" FOREIGN KEY ("crewTeamId") REFERENCES "CrewTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContract_locationListingId_fkey'
  ) THEN
    ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_locationListingId_fkey" FOREIGN KEY ("locationListingId") REFERENCES "LocationListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContract_createdById_fkey'
  ) THEN
    ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContractVersion_contractId_fkey'
  ) THEN
    ALTER TABLE "ProjectContractVersion" ADD CONSTRAINT "ProjectContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectContractVersion_createdById_fkey'
  ) THEN
    ALTER TABLE "ProjectContractVersion" ADD CONSTRAINT "ProjectContractVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectSignature_contractId_fkey'
  ) THEN
    ALTER TABLE "ProjectSignature" ADD CONSTRAINT "ProjectSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectSignature_versionId_fkey'
  ) THEN
    ALTER TABLE "ProjectSignature" ADD CONSTRAINT "ProjectSignature_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectSignature_userId_fkey'
  ) THEN
    ALTER TABLE "ProjectSignature" ADD CONSTRAINT "ProjectSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FundingRequest_projectId_fkey'
  ) THEN
    ALTER TABLE "FundingRequest" ADD CONSTRAINT "FundingRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PitchDeck_projectId_fkey'
  ) THEN
    ALTER TABLE "PitchDeck" ADD CONSTRAINT "PitchDeck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PitchDeck_createdById_fkey'
  ) THEN
    ALTER TABLE "PitchDeck" ADD CONSTRAINT "PitchDeck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PitchDeckSlide_deckId_fkey'
  ) THEN
    ALTER TABLE "PitchDeckSlide" ADD CONSTRAINT "PitchDeckSlide_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "PitchDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectChatThread_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectChatThread" ADD CONSTRAINT "ProjectChatThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectChatThread_createdById_fkey'
  ) THEN
    ALTER TABLE "ProjectChatThread" ADD CONSTRAINT "ProjectChatThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectChatMessage_threadId_fkey'
  ) THEN
    ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ProjectChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectChatMessage_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectChatMessage_senderId_fkey'
  ) THEN
    ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_assigneeId_fkey'
  ) THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_shootDayId_fkey'
  ) THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_sceneId_fkey'
  ) THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_createdById_fkey'
  ) THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadSession_projectId_fkey'
  ) THEN
    ALTER TABLE "TableReadSession" ADD CONSTRAINT "TableReadSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadSession_scriptVersionId_fkey'
  ) THEN
    ALTER TABLE "TableReadSession" ADD CONSTRAINT "TableReadSession_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ProjectScriptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadSession_createdById_fkey'
  ) THEN
    ALTER TABLE "TableReadSession" ADD CONSTRAINT "TableReadSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadParticipant_sessionId_fkey'
  ) THEN
    ALTER TABLE "TableReadParticipant" ADD CONSTRAINT "TableReadParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableReadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadParticipant_userId_fkey'
  ) THEN
    ALTER TABLE "TableReadParticipant" ADD CONSTRAINT "TableReadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadNote_sessionId_fkey'
  ) THEN
    ALTER TABLE "TableReadNote" ADD CONSTRAINT "TableReadNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableReadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableReadNote_userId_fkey'
  ) THEN
    ALTER TABLE "TableReadNote" ADD CONSTRAINT "TableReadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentPlanItem_projectId_fkey'
  ) THEN
    ALTER TABLE "EquipmentPlanItem" ADD CONSTRAINT "EquipmentPlanItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentPlanItem_equipmentListingId_fkey'
  ) THEN
    ALTER TABLE "EquipmentPlanItem" ADD CONSTRAINT "EquipmentPlanItem_equipmentListingId_fkey" FOREIGN KEY ("equipmentListingId") REFERENCES "EquipmentListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RiskPlan_projectId_fkey'
  ) THEN
    ALTER TABLE "RiskPlan" ADD CONSTRAINT "RiskPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RiskChecklistItem_planId_fkey'
  ) THEN
    ALTER TABLE "RiskChecklistItem" ADD CONSTRAINT "RiskChecklistItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RiskPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RiskChecklistItem_ownerId_fkey'
  ) THEN
    ALTER TABLE "RiskChecklistItem" ADD CONSTRAINT "RiskChecklistItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContinuityNote_projectId_fkey'
  ) THEN
    ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContinuityNote_sceneId_fkey'
  ) THEN
    ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContinuityNote_shootDayId_fkey'
  ) THEN
    ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContinuityNote_createdById_fkey'
  ) THEN
    ALTER TABLE "ContinuityNote" ADD CONSTRAINT "ContinuityNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailiesBatch_projectId_fkey'
  ) THEN
    ALTER TABLE "DailiesBatch" ADD CONSTRAINT "DailiesBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailiesBatch_sceneId_fkey'
  ) THEN
    ALTER TABLE "DailiesBatch" ADD CONSTRAINT "DailiesBatch_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailiesBatch_shootDayId_fkey'
  ) THEN
    ALTER TABLE "DailiesBatch" ADD CONSTRAINT "DailiesBatch_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailiesNote_batchId_fkey'
  ) THEN
    ALTER TABLE "DailiesNote" ADD CONSTRAINT "DailiesNote_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailiesBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailiesNote_userId_fkey'
  ) THEN
    ALTER TABLE "DailiesNote" ADD CONSTRAINT "DailiesNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FootageAsset_projectId_fkey'
  ) THEN
    ALTER TABLE "FootageAsset" ADD CONSTRAINT "FootageAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FootageAsset_sceneId_fkey'
  ) THEN
    ALTER TABLE "FootageAsset" ADD CONSTRAINT "FootageAsset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MusicSelection_projectId_fkey'
  ) THEN
    ALTER TABLE "MusicSelection" ADD CONSTRAINT "MusicSelection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MusicSelection_trackId_fkey'
  ) THEN
    ALTER TABLE "MusicSelection" ADD CONSTRAINT "MusicSelection_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MusicTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PostProductionReview_projectId_fkey'
  ) THEN
    ALTER TABLE "PostProductionReview" ADD CONSTRAINT "PostProductionReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PostProductionReview_cutAssetId_fkey'
  ) THEN
    ALTER TABLE "PostProductionReview" ADD CONSTRAINT "PostProductionReview_cutAssetId_fkey" FOREIGN KEY ("cutAssetId") REFERENCES "FootageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewNote_reviewId_fkey'
  ) THEN
    ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PostProductionReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewNote_userId_fkey'
  ) THEN
    ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinalDelivery_projectId_fkey'
  ) THEN
    ALTER TABLE "FinalDelivery" ADD CONSTRAINT "FinalDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinalDelivery_masterAssetId_fkey'
  ) THEN
    ALTER TABLE "FinalDelivery" ADD CONSTRAINT "FinalDelivery_masterAssetId_fkey" FOREIGN KEY ("masterAssetId") REFERENCES "FootageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DistributionSubmission_projectId_fkey'
  ) THEN
    ALTER TABLE "DistributionSubmission" ADD CONSTRAINT "DistributionSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectWorkspaceLink_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectWorkspaceLink" ADD CONSTRAINT "ProjectWorkspaceLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScriptReviewNote_userId_fkey'
  ) THEN
    ALTER TABLE "ScriptReviewNote" ADD CONSTRAINT "ScriptReviewNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScriptReviewNote_projectId_fkey'
  ) THEN
    ALTER TABLE "ScriptReviewNote" ADD CONSTRAINT "ScriptReviewNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminAuditLog_adminUserId_fkey'
  ) THEN
    ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
