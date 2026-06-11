import { prisma } from "@/lib/prisma";

/** Snapshot whether new catalogue work qualifies as student work at upload time. */
export async function creatorIsStudentAtUpload(creatorId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { isAfdaStudent: true },
  });
  return Boolean(user?.isAfdaStudent);
}
