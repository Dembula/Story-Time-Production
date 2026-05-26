import type { LucideIcon } from "lucide-react";
import {
  Bell,
  DollarSign,
  Film,
  Megaphone,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

export function notificationTypeIcon(type: string): LucideIcon {
  const t = type.toUpperCase();
  if (t.includes("PAYOUT") || t.includes("WALLET") || t.includes("PAYMENT")) return Wallet;
  if (t.includes("REVENUE") || t.includes("EARNING")) return DollarSign;
  if (t.includes("MODER") || t.includes("REVIEW") || t.includes("KYC")) return Shield;
  if (t.includes("PUBLISH") || t.includes("CONTENT") || t.includes("CATALOGUE")) return Film;
  if (t.includes("TEAM") || t.includes("INVITE") || t.includes("COLLAB")) return Users;
  if (t.includes("CAMPAIGN") || t.includes("ANNOUNCE")) return Megaphone;
  if (t.includes("MILESTONE") || t.includes("ACHIEVE")) return Sparkles;
  return Bell;
}

export function notificationTypeAccent(type: string): string {
  const t = type.toUpperCase();
  if (t.includes("PAYOUT") || t.includes("REVENUE")) return "text-emerald-300";
  if (t.includes("MODER") || t.includes("REJECT")) return "text-amber-300";
  if (t.includes("MILESTONE")) return "text-violet-300";
  return "text-orange-300";
}
