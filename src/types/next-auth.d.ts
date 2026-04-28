import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
    portalScope?: "VIEWER" | "CREATOR" | "ADMIN";
    funderVerificationStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    image?: string | null;
    activeCreatorStudioProfileId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
      portalScope?: "VIEWER" | "CREATOR" | "ADMIN";
      funderVerificationStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
      name?: string | null;
      email?: string | null;
      image?: string | null;
      activeCreatorStudioProfileId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    portalScope?: "VIEWER" | "CREATOR" | "ADMIN";
    funderVerificationStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    activeCreatorStudioProfileId?: string | null;
  }
}
