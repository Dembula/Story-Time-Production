/**
 * Enterprise contract library — maps display types to base template engines.
 * Jurisdiction-specific clause packs extend the base template at generation time.
 */

export type ContractCategory =
  | "talent"
  | "crew"
  | "vendors"
  | "locations"
  | "finance"
  | "rights"
  | "ip"
  | "production";

export type CatalogEntry = {
  id: string;
  label: string;
  category: ContractCategory;
  /** Maps to contract-template-engine template key */
  baseTemplate: string;
  description: string;
  requiredFields?: string[];
};

export const CONTRACT_CATEGORIES: { id: ContractCategory; label: string }[] = [
  { id: "talent", label: "Talent" },
  { id: "crew", label: "Crew" },
  { id: "vendors", label: "Vendors" },
  { id: "locations", label: "Locations" },
  { id: "finance", label: "Finance" },
  { id: "rights", label: "Rights" },
  { id: "ip", label: "Intellectual property" },
  { id: "production", label: "Production" },
];

const talent: CatalogEntry[] = [
  { id: "lead_actor", label: "Lead actor agreement", category: "talent", baseTemplate: "cast_member", description: "Principal performer engagement" },
  { id: "supporting_actor", label: "Supporting actor agreement", category: "talent", baseTemplate: "cast_member", description: "Supporting cast engagement" },
  { id: "background_artist", label: "Background artist agreement", category: "talent", baseTemplate: "cast_member", description: "Extras and background performers" },
  { id: "voice_artist", label: "Voice artist agreement", category: "talent", baseTemplate: "cast_member", description: "Voice-over and narration" },
  { id: "presenter", label: "Presenter agreement", category: "talent", baseTemplate: "cast_member", description: "On-camera presenter" },
  { id: "host", label: "Host agreement", category: "talent", baseTemplate: "cast_member", description: "Show or event host" },
  { id: "influencer", label: "Influencer agreement", category: "talent", baseTemplate: "cast_member", description: "Social and branded content talent" },
  { id: "minor_performer", label: "Minor performer agreement", category: "talent", baseTemplate: "cast_member", description: "Child performer with guardian provisions" },
  { id: "stunt_performer", label: "Stunt performer agreement", category: "talent", baseTemplate: "cast_member", description: "Stunts and action sequences" },
  { id: "model_release", label: "Model release", category: "talent", baseTemplate: "cast_member", description: "Image and likeness release" },
  { id: "appearance_release", label: "Appearance release", category: "talent", baseTemplate: "cast_member", description: "Recorded appearance consent" },
  { id: "image_release", label: "Image release", category: "talent", baseTemplate: "cast_member", description: "Photography and stills release" },
];

const crew: CatalogEntry[] = [
  { id: "director", label: "Director agreement", category: "crew", baseTemplate: "crew_member", description: "Director services" },
  { id: "producer", label: "Producer agreement", category: "crew", baseTemplate: "crew_member", description: "Producer engagement" },
  { id: "executive_producer", label: "Executive producer agreement", category: "crew", baseTemplate: "crew_member", description: "Executive producer" },
  { id: "ad", label: "Assistant director agreement", category: "crew", baseTemplate: "crew_member", description: "AD department" },
  { id: "production_manager", label: "Production manager agreement", category: "crew", baseTemplate: "crew_member", description: "Production management" },
  { id: "camera_crew", label: "Camera crew agreement", category: "crew", baseTemplate: "crew_member", description: "Camera department" },
  { id: "sound_crew", label: "Sound crew agreement", category: "crew", baseTemplate: "crew_member", description: "Sound department" },
  { id: "editor", label: "Editor agreement", category: "crew", baseTemplate: "crew_member", description: "Post-production editor" },
  { id: "vfx", label: "VFX agreement", category: "crew", baseTemplate: "crew_member", description: "Visual effects artist" },
  { id: "animator", label: "Animator agreement", category: "crew", baseTemplate: "crew_member", description: "Animation services" },
  { id: "pa", label: "Production assistant agreement", category: "crew", baseTemplate: "crew_member", description: "PA and runner" },
  { id: "freelancer", label: "Freelancer agreement", category: "crew", baseTemplate: "crew_member", description: "Independent contractor" },
  { id: "consultant", label: "Consultant agreement", category: "crew", baseTemplate: "crew_member", description: "Specialist consultant" },
  { id: "intern", label: "Intern agreement", category: "crew", baseTemplate: "crew_member", description: "Internship placement" },
  { id: "volunteer", label: "Volunteer agreement", category: "crew", baseTemplate: "crew_member", description: "Volunteer services" },
];

const vendors: CatalogEntry[] = [
  { id: "equipment_rental", label: "Equipment rental", category: "vendors", baseTemplate: "vendor", description: "Camera, grip, and gear rental" },
  { id: "vehicle_rental", label: "Vehicle rental", category: "vendors", baseTemplate: "vendor", description: "Production vehicles" },
  { id: "drone_operator", label: "Drone operator agreement", category: "vendors", baseTemplate: "vendor", description: "UAV operations" },
  { id: "lighting_rental", label: "Lighting rental", category: "vendors", baseTemplate: "vendor", description: "Lighting package hire" },
  { id: "grip_rental", label: "Grip rental", category: "vendors", baseTemplate: "vendor", description: "Grip equipment" },
  { id: "accommodation", label: "Accommodation agreement", category: "vendors", baseTemplate: "vendor", description: "Cast and crew lodging" },
  { id: "transport", label: "Transport agreement", category: "vendors", baseTemplate: "vendor", description: "Unit and personnel transport" },
  { id: "security", label: "Security agreement", category: "vendors", baseTemplate: "vendor", description: "On-set security" },
  { id: "catering", label: "Catering agreement", category: "vendors", baseTemplate: "vendor", description: "Craft and meal services" },
  { id: "medical", label: "Medical services agreement", category: "vendors", baseTemplate: "vendor", description: "Set medic and first aid" },
  { id: "it_services", label: "IT services agreement", category: "vendors", baseTemplate: "vendor", description: "Technical infrastructure" },
  { id: "cloud_services", label: "Cloud services agreement", category: "vendors", baseTemplate: "vendor", description: "Cloud hosting and storage" },
  { id: "software_license", label: "Software licensing", category: "vendors", baseTemplate: "vendor", description: "Production software licenses" },
];

const locations: CatalogEntry[] = [
  { id: "private_property", label: "Private property agreement", category: "locations", baseTemplate: "location", description: "Private location hire" },
  { id: "commercial_property", label: "Commercial property agreement", category: "locations", baseTemplate: "location", description: "Commercial premises" },
  { id: "municipal_permit", label: "Municipal location permit", category: "locations", baseTemplate: "location", description: "Municipal filming permit" },
  { id: "government_property", label: "Government property agreement", category: "locations", baseTemplate: "location", description: "Government-owned sites" },
  { id: "studio_rental", label: "Studio rental agreement", category: "locations", baseTemplate: "location", description: "Sound stage hire" },
  { id: "venue_hire", label: "Venue hire agreement", category: "locations", baseTemplate: "location", description: "Event and performance venue" },
  { id: "parking", label: "Parking agreement", category: "locations", baseTemplate: "location", description: "Parking and base camp" },
  { id: "road_closure", label: "Road closure agreement", category: "locations", baseTemplate: "location", description: "Traffic and road closure" },
  { id: "public_space", label: "Public space permit", category: "locations", baseTemplate: "location", description: "Public filming permit" },
];

const finance: CatalogEntry[] = [
  { id: "investor", label: "Investor agreement", category: "finance", baseTemplate: "funding", description: "Equity or debt investor" },
  { id: "funding", label: "Funding agreement", category: "finance", baseTemplate: "funding", description: "Production funding" },
  { id: "equity_investment", label: "Equity investment agreement", category: "finance", baseTemplate: "funding", description: "Equity stake" },
  { id: "loan", label: "Loan agreement", category: "finance", baseTemplate: "funding", description: "Production loan" },
  { id: "revenue_share", label: "Revenue share agreement", category: "finance", baseTemplate: "funding", description: "Revenue participation" },
  { id: "grant", label: "Grant agreement", category: "finance", baseTemplate: "funding", description: "Grant funding" },
  { id: "sponsorship", label: "Sponsorship agreement", category: "finance", baseTemplate: "funding", description: "Brand sponsorship" },
  { id: "brand_partnership", label: "Brand partnership agreement", category: "finance", baseTemplate: "funding", description: "Brand integration" },
  { id: "completion_bond", label: "Completion bond agreement", category: "finance", baseTemplate: "funding", description: "Completion guarantor" },
  { id: "escrow", label: "Escrow agreement", category: "finance", baseTemplate: "funding", description: "Escrow holding" },
];

const rights: CatalogEntry[] = [
  { id: "writer", label: "Writer agreement", category: "rights", baseTemplate: "crew_member", description: "Screenwriter engagement" },
  { id: "option", label: "Option agreement", category: "rights", baseTemplate: "funding", description: "Rights option" },
  { id: "life_rights", label: "Life rights agreement", category: "rights", baseTemplate: "funding", description: "Biographical rights" },
  { id: "book_adaptation", label: "Book adaptation agreement", category: "rights", baseTemplate: "funding", description: "Literary adaptation" },
  { id: "music_licensing", label: "Music licensing", category: "rights", baseTemplate: "vendor", description: "Synchronisation and master use" },
  { id: "composer", label: "Composer agreement", category: "rights", baseTemplate: "crew_member", description: "Original score composer" },
  { id: "distribution", label: "Distribution agreement", category: "rights", baseTemplate: "funding", description: "Distribution rights" },
  { id: "streaming", label: "Streaming agreement", category: "rights", baseTemplate: "funding", description: "SVOD / AVOD platform" },
  { id: "broadcast", label: "Broadcast agreement", category: "rights", baseTemplate: "funding", description: "Linear broadcast" },
  { id: "sales_agent", label: "Sales agent agreement", category: "rights", baseTemplate: "funding", description: "International sales" },
  { id: "localization", label: "Localization agreement", category: "rights", baseTemplate: "funding", description: "Dubbing and subtitles" },
];

const ip: CatalogEntry[] = [
  { id: "copyright_assignment", label: "Copyright assignment", category: "ip", baseTemplate: "crew_member", description: "Copyright transfer" },
  { id: "trademark_license", label: "Trademark license", category: "ip", baseTemplate: "vendor", description: "Trademark use" },
  { id: "confidentiality", label: "Confidentiality agreement", category: "ip", baseTemplate: "nda", description: "One-way confidentiality" },
  { id: "mutual_nda", label: "Mutual NDA", category: "ip", baseTemplate: "nda", description: "Mutual non-disclosure" },
  { id: "one_way_nda", label: "One-way NDA", category: "ip", baseTemplate: "nda", description: "Unilateral NDA" },
  { id: "non_compete", label: "Non-compete", category: "ip", baseTemplate: "nda", description: "Non-competition covenant" },
  { id: "non_solicitation", label: "Non-solicitation", category: "ip", baseTemplate: "nda", description: "Non-solicitation of staff" },
  { id: "ip_assignment", label: "IP assignment", category: "ip", baseTemplate: "crew_member", description: "Intellectual property assignment" },
  { id: "technology_license", label: "Technology license", category: "ip", baseTemplate: "vendor", description: "Technology licensing" },
];

const production: CatalogEntry[] = [
  { id: "co_production", label: "Co-production agreement", category: "production", baseTemplate: "funding", description: "International co-production" },
  { id: "joint_venture", label: "Joint venture", category: "production", baseTemplate: "funding", description: "JV structure" },
  { id: "service_agreement", label: "Service agreement", category: "production", baseTemplate: "vendor", description: "Production services" },
  { id: "post_production", label: "Post production agreement", category: "production", baseTemplate: "vendor", description: "Post house services" },
  { id: "marketing", label: "Marketing agreement", category: "production", baseTemplate: "vendor", description: "Marketing and publicity" },
  { id: "pr", label: "PR agreement", category: "production", baseTemplate: "vendor", description: "Public relations" },
  { id: "festival_submission", label: "Festival submission agreement", category: "production", baseTemplate: "vendor", description: "Festival entry terms" },
  { id: "insurance_declaration", label: "Insurance declaration", category: "production", baseTemplate: "vendor", description: "Insurance schedule" },
  { id: "production_services", label: "Production services agreement", category: "production", baseTemplate: "vendor", description: "Full production services" },
];

export const CONTRACT_TEMPLATE_CATALOG: CatalogEntry[] = [
  ...talent,
  ...crew,
  ...vendors,
  ...locations,
  ...finance,
  ...rights,
  ...ip,
  ...production,
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CONTRACT_TEMPLATE_CATALOG.find((e) => e.id === id);
}

export function catalogByCategory(category: ContractCategory): CatalogEntry[] {
  return CONTRACT_TEMPLATE_CATALOG.filter((e) => e.category === category);
}

export const SUPPORTED_JURISDICTIONS = [
  "South Africa",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "European Union",
  "Nigeria",
  "India",
  "New Zealand",
] as const;

export type Jurisdiction = (typeof SUPPORTED_JURISDICTIONS)[number];
