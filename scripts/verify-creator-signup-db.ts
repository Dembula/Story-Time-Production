/**
 * Verification script: ensures creator signup data is stored correctly.
 * Run with: npx tsx scripts/verify-creator-signup-db.ts
 * Optional: set VERIFY_CREATE=1 to create and then delete a test user.
 */
import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 0. Basic connectivity check (works even before tables exist)
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Database connection OK");
  } catch (e) {
    console.error("✗ Database connection failed.");
    throw e;
  }

  // 1. Check that User table has expected columns by querying a user with profile/passwordHash
  let userWithHash:
    | {
        id: string;
        email: string | null;
        role: string;
        passwordHash: string | null;
        bio: string | null;
        socialLinks: string | null;
        education: string | null;
        goals: string | null;
        previousWork: string | null;
        isAfdaStudent: boolean;
        createdAt: Date;
      }
    | null = null;

  try {
    userWithHash = await prisma.user.findFirst({
      where: { passwordHash: { not: null } },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        bio: true,
        socialLinks: true,
        education: true,
        goals: true,
        previousWork: true,
        isAfdaStudent: true,
        createdAt: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      console.log(
        "\n✓ Connected, but Prisma tables are not created yet (e.g. public.\"User\").\n" +
          "  Next step: run Prisma schema sync against Supabase using a DIRECT (5432) connection,\n" +
          "  then run `npm run db:seed`.\n"
      );
      return;
    }
    throw e;
  }

  if (userWithHash) {
    console.log("✓ User with passwordHash (creator signup) found:");
    console.log("  email:", userWithHash.email);
    console.log("  role:", userWithHash.role);
    console.log("  has passwordHash:", !!userWithHash.passwordHash);
    console.log("  bio:", userWithHash.bio ? "(set)" : "(empty)");
    console.log("  isAfdaStudent:", userWithHash.isAfdaStudent);
  } else {
    const anyUser = await prisma.user.findFirst({ select: { email: true, role: true } });
    console.log(
      anyUser
        ? "No creator signup users (passwordHash) yet. Existing users (e.g. seeded):"
        : "No users in database yet."
    );
    if (anyUser) console.log("  sample:", anyUser.email, anyUser.role);
  }

  // 2. Check PendingCreatorSignup has isAfdaStudent (schema applied)
  const pending = await prisma.pendingCreatorSignup.findFirst({
    select: { email: true, type: true, isAfdaStudent: true, bio: true },
  });
  if (pending) {
    console.log("\n✓ PendingCreatorSignup record(s) exist; isAfdaStudent and profile fields available.");
  } else {
    console.log("\n✓ PendingCreatorSignup table exists (no rows). Schema supports isAfdaStudent and profile fields.");
  }

  // 3. Optional: create then delete a test user to verify full write path
  if (process.env.VERIFY_CREATE === "1") {
    const testEmail = "verify-creator-signup@test.local";
    await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});
    const created = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Verify Script",
        role: "CONTENT_CREATOR",
        passwordHash: "$2a$10$dummy.hash.not.real",
        bio: "Test bio",
        socialLinks: "https://example.com",
        education: "Test edu",
        goals: "Test goals",
        previousWork: "Test work",
        isAfdaStudent: true,
      },
    });
    console.log("\n✓ Test user created:", created.email);
    const readBack = await prisma.user.findUnique({
      where: { id: created.id },
      select: { email: true, bio: true, isAfdaStudent: true, passwordHash: true },
    });
    console.log("  Read back: bio=%s isAfdaStudent=%s hasHash=%s", readBack?.bio, readBack?.isAfdaStudent, !!readBack?.passwordHash);
    await prisma.user.delete({ where: { id: created.id } });
    console.log("  Test user deleted.");
  }

  console.log("\nDone. Database schema supports creator signup storage.");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
