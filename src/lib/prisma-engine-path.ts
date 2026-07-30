import fs from "node:fs";
import path from "node:path";

const RHEL_ENGINE = "libquery_engine-rhel-openssl-3.0.x.so.node";
const DEBIAN_ENGINE = "libquery_engine-debian-openssl-3.0.x.so.node";

/**
 * Point Prisma at a Query Engine that actually exists in the deployment.
 * Custom `output = "../generated/prisma"` clients often fail on Vercel when the
 * bundled `__dirname` no longer sits next to the `.so.node` file.
 */
export function ensurePrismaQueryEngineLibrary(): string | null {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY?.trim()) {
    const existing = process.env.PRISMA_QUERY_ENGINE_LIBRARY.trim();
    if (fs.existsSync(existing)) return existing;
  }

  const preferred =
    process.platform === "linux"
      ? [RHEL_ENGINE, DEBIAN_ENGINE]
      : process.platform === "win32"
        ? ["query_engine-windows.dll.node"]
        : [RHEL_ENGINE, DEBIAN_ENGINE];

  const searchRoots = [
    path.join(process.cwd(), "generated", "prisma"),
    path.join(process.cwd(), ".next", "server", "generated", "prisma"),
    path.join(__dirname, "..", "..", "generated", "prisma"),
    path.join(__dirname, "..", "..", "..", "generated", "prisma"),
  ];

  for (const engineName of preferred) {
    for (const root of searchRoots) {
      const candidate = path.join(root, engineName);
      if (fs.existsSync(candidate)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
        return candidate;
      }
    }
  }

  return null;
}
