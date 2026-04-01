import { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "storytime2025";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as never),
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Demo / Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || credentials.password == null) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: { id: true, email: true, name: true, role: true, passwordHash: true },
        });
        if (!user) return null;
        if (user.passwordHash) {
          const ok = await compare(credentials.password, user.passwordHash);
          if (!ok) return null;
        } else {
          if (credentials.password !== DEMO_PASSWORD) return null;
        }
        return { id: user.id, email: user.email!, name: user.name, role: user.role } as { id: string; email: string; name: string | null; role: string };
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  events: {
    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      if (dbUser) (user as { role?: string }).role = dbUser.role;

      const pending = user.email
        ? await prisma.pendingCreatorSignup.findUnique({
            where: { email: user.email.toLowerCase() },
          })
        : null;
      if (pending) {
        const roleMap: Record<string, string> = { music: "MUSIC_CREATOR", equipment: "EQUIPMENT_COMPANY", location: "LOCATION_OWNER", content: "CONTENT_CREATOR", crew: "CREW_TEAM", casting: "CASTING_AGENCY", catering: "CATERING_COMPANY" };
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
        await prisma.pendingCreatorSignup.delete({ where: { id: pending.id } });
        (user as { role?: string }).role = role;
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
