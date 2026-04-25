-- Film/music creator registration: account structure and team seat cap (see User model).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creatorAccountStructure" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creatorTeamSeatCap" INTEGER;
