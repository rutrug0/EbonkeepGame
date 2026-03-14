import type { PrismaClient, Prisma } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

function getAdminAccountIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_ACCOUNT_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );
}

export function isAdminAccountId(accountId: string): boolean {
  return getAdminAccountIds().has(accountId);
}

export async function isDeveloperToolsEnabledForAccount(prisma: PrismaLike, accountId: string): Promise<boolean> {
  if (isAdminAccountId(accountId)) {
    return true;
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { provider: true }
  });

  return account?.provider === "dev-guest";
}
