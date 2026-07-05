export type AppRole =
  | "CONTENT_CREATOR"
  | "MUSIC_CREATOR"
  | "EQUIPMENT_COMPANY"
  | "LOCATION_OWNER"
  | "CREW_TEAM"
  | "CASTING_AGENCY"
  | "CATERING_COMPANY"
  | "FUNDER"
  | "ADMIN"
  | "SUBSCRIBER";

export function getAccountRouteForRole(role?: string | null) {
  switch (role as AppRole | undefined) {
    case "CONTENT_CREATOR":
      return "/creator/account";
    case "MUSIC_CREATOR":
      return "/music-creator/account";
    case "FUNDER":
      return "/funders/verification";
    default:
      return "/payout-verification";
  }
}

export function getWalletRouteForRole(role?: string | null) {
  switch (role as AppRole | undefined) {
    case "CONTENT_CREATOR":
      return "/creator/wallet";
    case "MUSIC_CREATOR":
      return "/music-creator/wallet";
    case "EQUIPMENT_COMPANY":
      return "/equipment-company/wallet";
    case "LOCATION_OWNER":
      return "/location-owner/wallet";
    case "CREW_TEAM":
      return "/crew-team/wallet";
    case "CASTING_AGENCY":
      return "/casting-agency/wallet";
    case "CATERING_COMPANY":
      return "/catering-company/wallet";
    case "FUNDER":
      return "/funders/wallet";
    case "ADMIN":
      return "/admin/payments";
    default:
      return "/profiles";
  }
}
