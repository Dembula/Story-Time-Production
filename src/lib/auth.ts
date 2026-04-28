import { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { findUserActiveStudioProfileId, findUserForCredentialsLogin } from "./prisma-user-studio-compat";
import { sendWelcomeEmail } from "./sendgrid";
import { CREATOR_ROLES, VIEWER_ROLES, ensureUserRole, getUserRoles } from "./user-roles";

type PortalScope = "VIEWER" | "CREATOR" | "ADMIN";

function pickCreatorRole(roles: Set<string>, fallbackRole?: string | null): string | null {
  if (fallbackRole && CREATOR_ROLES.has(fallbackRole)) return fallbackRole;
  const ordered = [...roles].filter((r) => CREATOR_ROLES.has(r)).sort();
  return ordered[0] ?? null;
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "storytime2025";
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
const githubClientId = process.env.GITHUB_ID?.trim() ?? "";
const githubClientSecret = process.env.GITHUB_SECRET?.trim() ?? "";

const oauthProviders = [
  ...(googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : []),
  ...(githubClientId && githubClientSecret
    ? [
        GitHubProvider({
          clientId: githubClientId,
          clientSecret: githubClientSecret,
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as never),
  providers: [
    CredentialsProvider({
      id: "credentials-viewer",
      name: "Viewer Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        selectedRole: { label: "Account Type", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || credentials.password == null) return null;
        const user = await findUserForCredentialsLogin(credentials.email.toLowerCase());
        if (!user) return null;
        if (user.passwordHash) {
          const ok = await compare(credentials.password, user.passwordHash);
          if (!ok) return null;
        } else {
          if (credentials.password !== DEMO_PASSWORD) return null;
        }
        const roles = await getUserRoles(user.id, user.role);
        if (![...roles].some((userRole) => VIEWER_ROLES.has(userRole))) return null;
        const role = "SUBSCRIBER";
        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          role,
          portalScope: "VIEWER" as PortalScope,
          image: user.image,
          activeCreatorStudioProfileId: user.activeCreatorStudioProfileId,
        } as {
          id: string;
          email: string;
          name: string | null;
          role: string;
          portalScope: PortalScope;
          image: string | null;
          activeCreatorStudioProfileId: string | null;
        };
      },
    }),
    CredentialsProvider({
      id: "credentials-creator",
      name: "Creator Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || credentials.password == null) return null;
        const user = await findUserForCredentialsLogin(credentials.email.toLowerCase());
        if (!user) return null;
        if (user.passwordHash) {
          const ok = await compare(credentials.password, user.passwordHash);
          if (!ok) return null;
        } else {
          if (credentials.password !== DEMO_PASSWORD) return null;
        }
        const roles = await getUserRoles(user.id, user.role);
        const selectedRoleRaw = (credentials as Record<string, unknown> | undefined)?.selectedRole;
        const selectedRole = typeof selectedRoleRaw === "string" ? selectedRoleRaw : null;
        const role = selectedRole && CREATOR_ROLES.has(selectedRole) && roles.has(selectedRole)
          ? selectedRole
          : pickCreatorRole(roles, user.role);
        if (!role) return null;
        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          role,
          portalScope: "CREATOR" as PortalScope,
          image: user.image,
          activeCreatorStudioProfileId: user.activeCreatorStudioProfileId,
        } as {
          id: string;
          email: string;
          name: string | null;
          role: string;
          portalScope: PortalScope;
          image: string | null;
          activeCreatorStudioProfileId: string | null;
        };
      },
    }),
    CredentialsProvider({
      id: "credentials-admin",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || credentials.password == null) return null;
        const user = await findUserForCredentialsLogin(credentials.email.toLowerCase());
        if (!user) return null;
        if (user.passwordHash) {
          const ok = await compare(credentials.password, user.passwordHash);
          if (!ok) return null;
        } else {
          if (credentials.password !== DEMO_PASSWORD) return null;
        }
        const roles = await getUserRoles(user.id, user.role);
        if (!roles.has("ADMIN")) return null;
        const role = "ADMIN";
        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          role,
          portalScope: "ADMIN" as PortalScope,
          image: user.image,
          activeCreatorStudioProfileId: user.activeCreatorStudioProfileId,
        } as {
          id: string;
          email: string;
          name: string | null;
          role: string;
          portalScope: PortalScope;
          image: string | null;
          activeCreatorStudioProfileId: string | null;
        };
      },
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER || {
        host: "localhost",
        port: 25,
        auth: { user: "user", pass: "pass" },
      },
      from: process.env.EMAIL_FROM || "noreply@storytime.com",
    }),
    ...oauthProviders,
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  events: {
    async createUser({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, email: true, name: true },
      });
      const role = dbUser?.role ?? "SUBSCRIBER";
      await ensureUserRole(user.id, role);

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userEmail: dbUser?.email ?? user.email ?? undefined,
          userName: dbUser?.name ?? user.name ?? undefined,
          role,
          eventType: "REGISTER",
        },
      });

      if (dbUser?.email) {
        try {
          await sendWelcomeEmail(dbUser.email, dbUser.name, { role, registrationType: "new_registration" });
        } catch (error) {
          console.error("Welcome email send failed on user creation:", error);
        }
      }
    },
    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      if (dbUser && !(user as { role?: string }).role) {
        (user as { role?: string }).role = dbUser.role;
      }

      const pending = user.email
        ? await prisma.pendingCreatorSignup.findUnique({
            where: { email: user.email.toLowerCase() },
          })
        : null;
      if (pending) {
        const roleMap: Record<string, string> = { music: "MUSIC_CREATOR", equipment: "EQUIPMENT_COMPANY", location: "LOCATION_OWNER", content: "CONTENT_CREATOR", crew: "CREW_TEAM", casting: "CASTING_AGENCY", catering: "CATERING_COMPANY", funder: "FUNDER" };
        const role = roleMap[pending.type] || "CONTENT_CREATOR";
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role,
            ...(pending.bio != null && { bio: pending.bio }),
            ...(pending.socialLinks != null && { socialLinks: pending.socialLinks }),
            ...(pending.education != null && { education: pending.education }),
            ...(pending.goals != null && { goals: pending.goals }),
            ...(pending.previousWork != null && { previousWork: pending.previousWork }),
            ...(pending.isAfdaStudent != null && { isAfdaStudent: pending.isAfdaStudent }),
          },
        });
        await ensureUserRole(user.id, role);
        await prisma.pendingCreatorSignup.delete({ where: { id: pending.id } });
        (user as { role?: string }).role = role;
        if (user.email) {
          try {
            await sendWelcomeEmail(user.email, user.name, { role, registrationType: "creator_upgrade" });
          } catch (error) {
            console.error("Welcome email send failed on creator upgrade:", error);
          }
        }
      }

      const role = (user as { role?: string }).role ?? dbUser?.role ?? "SUBSCRIBER";
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userEmail: user.email ?? undefined,
          userName: user.name ?? undefined,
          role,
          eventType: "SIGN_IN",
        },
      });
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.portalScope = (user as { portalScope?: PortalScope }).portalScope;
        token.name = user.name ?? null;
        token.email = user.email ?? null;
        token.picture = (user as { image?: string | null }).image ?? null;
        const u = user as { activeCreatorStudioProfileId?: string | null };
        if ("activeCreatorStudioProfileId" in u) {
          token.activeCreatorStudioProfileId = u.activeCreatorStudioProfileId ?? null;
        } else {
          token.activeCreatorStudioProfileId = await findUserActiveStudioProfileId(user.id);
        }
        if ((user as { role?: string }).role === "FUNDER") {
          const profile = await prisma.funderProfile.findUnique({
            where: { userId: user.id },
            select: { verificationStatus: true },
          });
          token.funderVerificationStatus = (profile?.verificationStatus as "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | undefined) ?? "PENDING";
        } else {
          token.funderVerificationStatus = undefined;
        }
      }
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as Record<string, unknown>;
        if ("name" in s) token.name = (s.name as string | null | undefined) ?? null;
        if ("email" in s) token.email = (s.email as string | null | undefined) ?? null;
        if ("image" in s) token.picture = (s.image as string | null | undefined) ?? null;
        if ("activeCreatorStudioProfileId" in s) {
          token.activeCreatorStudioProfileId =
            (s.activeCreatorStudioProfileId as string | null | undefined) ?? null;
        }
        if ("portalScope" in s) {
          token.portalScope = (s.portalScope as PortalScope | undefined) ?? token.portalScope;
        }
      }
      if (token.role === "FUNDER" && !token.funderVerificationStatus && token.id) {
        const profile = await prisma.funderProfile.findUnique({
          where: { userId: token.id as string },
          select: { verificationStatus: true },
        });
        token.funderVerificationStatus =
          (profile?.verificationStatus as "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | undefined) ??
          "PENDING";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        if (token.name !== undefined) session.user.name = token.name;
        if (token.email !== undefined) session.user.email = token.email;
        if (token.picture !== undefined) session.user.image = token.picture;
        (session.user as { portalScope?: PortalScope }).portalScope =
          ((token as { portalScope?: PortalScope }).portalScope as PortalScope | undefined) ?? undefined;
        (session.user as { funderVerificationStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" }).funderVerificationStatus =
          (token as { funderVerificationStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" }).funderVerificationStatus;
        (session.user as { activeCreatorStudioProfileId?: string | null }).activeCreatorStudioProfileId =
          (token as { activeCreatorStudioProfileId?: string | null }).activeCreatorStudioProfileId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
