/**
 * Industry-standard cast & crew credit titles for catalogue upload.
 * Labels use common on-screen abbreviations (DOP, 1st AD, etc.) plus full titles.
 */

export type UploadCreditRole = {
  /** Stored on ContentCrewMember.role */
  value: string;
  /** Shown in dropdown */
  label: string;
};

export type UploadCreditRoleGroup = {
  category: string;
  roles: UploadCreditRole[];
};

function role(abbrev: string, full: string): UploadCreditRole {
  const value = abbrev === full ? full : `${abbrev} — ${full}`;
  return { value, label: value };
}

function r(full: string): UploadCreditRole {
  return { value: full, label: full };
}

export const UPLOAD_CREDIT_ROLE_GROUPS: UploadCreditRoleGroup[] = [
  {
    category: "Cast — Principal",
    roles: [
      r("Lead Actor"),
      r("Lead Actress"),
      r("Co-Lead Actor"),
      r("Co-Lead Actress"),
      r("Series Regular"),
      r("Recurring Guest"),
      r("Guest Star"),
      r("Cameo"),
      r("Narrator"),
      r("Presenter"),
      r("Host"),
    ],
  },
  {
    category: "Cast — Supporting & ensemble",
    roles: [
      r("Supporting Actor"),
      r("Supporting Actress"),
      r("Featured Actor"),
      r("Featured Actress"),
      r("Featured Extra"),
      r("Day Player"),
      r("Background Performer"),
      r("Ensemble Cast"),
      r("Chorus / Ensemble"),
      r("Voice Actor"),
      r("Voice Actress"),
      r("Motion Capture Performer"),
      r("Child Actor"),
      r("Teen Actor"),
    ],
  },
  {
    category: "Cast — Specialty & stand-ins",
    roles: [
      r("Stand-In"),
      r("Photo Double"),
      r("Body Double"),
      r("Stunt Double"),
      r("Stunt Performer"),
      r("Fight Performer"),
      r("Dialect Talent"),
      r("Hand Model"),
      r("Crowd Cast"),
    ],
  },
  {
    category: "Directing",
    roles: [
      r("Director"),
      r("Co-Director"),
      role("2nd Unit Dir.", "Second Unit Director"),
      role("Script Sup.", "Script Supervisor"),
      role("Cont. Sup.", "Continuity Supervisor"),
      role("Script Coord.", "Script Coordinator"),
    ],
  },
  {
    category: "Assistant directing (AD)",
    roles: [
      role("1st AD", "First Assistant Director"),
      role("2nd AD", "Second Assistant Director"),
      role("2nd 2nd AD", "Second Second Assistant Director"),
      role("3rd AD", "Third Assistant Director"),
      role("Floor AD", "Floor Assistant Director"),
      role("Crowd AD", "Crowd Assistant Director"),
      role("Trainee AD", "Trainee Assistant Director"),
      role("Set AD", "Set Assistant Director"),
    ],
  },
  {
    category: "Producing",
    roles: [
      role("EP", "Executive Producer"),
      r("Producer"),
      r("Co-Producer"),
      role("Line Prod.", "Line Producer"),
      r("Associate Producer"),
      r("Supervising Producer"),
      r("Consulting Producer"),
      r("Segment Producer"),
      role("Post Prod.", "Post Producer"),
      r("Production Executive"),
      r("Showrunner"),
    ],
  },
  {
    category: "Writing & story",
    roles: [
      r("Writer"),
      r("Screenwriter"),
      r("Story By"),
      r("Screenplay By"),
      r("Script Editor"),
      r("Story Editor"),
      r("Script Consultant"),
      r("Story Consultant"),
      r("Head Writer"),
      r("Staff Writer"),
      r("Writers' Assistant"),
      r("Researchers / Story Research"),
    ],
  },
  {
    category: "Camera & cinematography",
    roles: [
      role("DOP", "Director of Photography"),
      r("Cinematographer"),
      r("Camera Operator"),
      role("A Cam Op.", "A Camera Operator"),
      role("B Cam Op.", "B Camera Operator"),
      role("C Cam Op.", "C Camera Operator"),
      role("Steadicam Op.", "Steadicam Operator"),
      role("Drone Op.", "Drone Operator"),
      role("U/W DOP", "Underwater Director of Photography"),
      role("1st AC", "First Assistant Camera / Focus Puller"),
      role("2nd AC", "Second Assistant Camera / Clapper Loader"),
      role("DIT", "Digital Imaging Technician"),
      r("Loader"),
      role("VT", "Video Assist / Video Technician"),
      r("Camera PA"),
      role("Dolly Grip", "Dolly Grip (Camera Support)"),
    ],
  },
  {
    category: "Lighting (grip & electric)",
    roles: [
      r("Gaffer"),
      role("BBE", "Best Boy Electric"),
      r("Lighting Technician"),
      r("Rigging Gaffer"),
      r("Generator Operator"),
      r("Dimmer Board Operator"),
      role("Key Grip", "Key Grip"),
      role("BBG", "Best Boy Grip"),
      r("Grip"),
      r("Rigging Grip"),
      r("Scaffolding Grip"),
    ],
  },
  {
    category: "Sound — production",
    roles: [
      role("Sound Mixer", "Production Sound Mixer"),
      r("Boom Operator"),
      r("Sound Assistant"),
      r("Utility Sound"),
      r("Sound Trainee"),
      r("Playback Operator"),
    ],
  },
  {
    category: "Art department",
    roles: [
      r("Production Designer"),
      r("Art Director"),
      r("Assistant Art Director"),
      r("Set Designer"),
      r("Set Decorator"),
      r("Lead Set Dresser"),
      r("Set Dresser"),
      r("Props Master"),
      r("Assistant Props"),
      r("Prop Builder"),
      r("Greensman"),
      r("Construction Coordinator"),
      r("Construction Foreman"),
      r("Scenic Artist"),
      r("Scenic Painter"),
      r("Graphic Designer (Art)"),
      r("Art Department Coordinator"),
      r("Art Department PA"),
    ],
  },
  {
    category: "Wardrobe, hair & makeup",
    roles: [
      r("Costume Designer"),
      r("Wardrobe Supervisor"),
      r("Wardrobe Assistant"),
      r("Costumer"),
      r("Tailor / Seamstress"),
      role("HMU Sup.", "Hair & Makeup Supervisor"),
      r("Key Makeup Artist"),
      r("Key Hair Stylist"),
      r("Makeup Artist"),
      r("Hair Stylist"),
      r("SFX Makeup Artist"),
      r("Prosthetics Artist"),
      r("Groomer"),
    ],
  },
  {
    category: "Casting",
    roles: [
      r("Casting Director"),
      r("Casting Associate"),
      r("Casting Assistant"),
      r("Extras Casting"),
      r("Local Casting Director"),
    ],
  },
  {
    category: "Production & locations",
    roles: [
      r("Unit Production Manager"),
      r("Production Manager"),
      r("Production Coordinator"),
      r("Production Secretary"),
      r("Production Accountant"),
      r("Payroll Accountant"),
      r("Assistant Accountant"),
      r("Location Manager"),
      r("Assistant Location Manager"),
      r("Location Scout"),
      r("Unit Manager"),
      r("Travel Coordinator"),
      r("Production Assistant (PA)"),
      r("Set PA"),
      r("Office PA"),
      r("Runner"),
    ],
  },
  {
    category: "Post production — editorial",
    roles: [
      r("Editor"),
      r("Co-Editor"),
      role("AE", "Assistant Editor"),
      r("Assembly Editor"),
      r("Online Editor"),
      r("Conform Editor"),
      r("Post Production Supervisor"),
      r("Post Production Coordinator"),
      r("Post Production Assistant"),
    ],
  },
  {
    category: "Post production — picture & colour",
    roles: [
      r("Colorist"),
      r("Colourist"),
      role("DI Colourist", "DI / Digital Intermediate Colourist"),
      r("Finishing Artist"),
      r("Mastering Technician"),
      r("QC Operator"),
    ],
  },
  {
    category: "Sound — post",
    roles: [
      r("Sound Designer"),
      r("Supervising Sound Editor"),
      r("Dialogue Editor"),
      r("ADR Supervisor"),
      r("ADR Mixer"),
      r("Foley Artist"),
      r("Foley Mixer"),
      r("Foley Editor"),
      role("RX / Restoration", "Audio Restoration / RX"),
      role("Re-recording Mixer", "Re-Recording Mixer"),
      r("Sound Effects Editor"),
      r("Music Editor"),
    ],
  },
  {
    category: "Visual effects",
    roles: [
      role("VFX Sup.", "VFX Supervisor"),
      r("VFX Producer"),
      r("VFX Coordinator"),
      r("VFX Editor"),
      r("Compositor"),
      r("CGI Artist"),
      r("FX TD"),
      r("Matte Painter"),
      r("Roto Artist"),
      r("Matchmove Artist"),
      r("Previs Artist"),
    ],
  },
  {
    category: "Music",
    roles: [
      r("Composer"),
      r("Music Supervisor"),
      r("Music Producer"),
      r("Music Contractor"),
      r("Orchestrator"),
      r("Music Arranger"),
      r("Score Mixer"),
      r("Music Clearance"),
    ],
  },
  {
    category: "Stunts, action & intimacy",
    roles: [
      r("Stunt Coordinator"),
      r("Fight Coordinator"),
      r("Martial Arts Choreographer"),
      r("Intimacy Coordinator"),
      r("Armorer"),
      r("Weapons Master"),
      r("Pyrotechnician"),
      r("SFX Supervisor (On Set)"),
    ],
  },
  {
    category: "Specialty & support",
    roles: [
      r("Choreographer"),
      r("Dialect Coach"),
      r("Acting Coach"),
      r("Animal Wrangler"),
      r("Marine Coordinator"),
      r("Aerial Coordinator"),
      r("Transportation Coordinator"),
      r("Unit Driver"),
      r("Picture Car Coordinator"),
      r("Craft Services"),
      r("Catering"),
      r("Set Medic"),
      r("Health & Safety Officer"),
      r("COVID Compliance Officer"),
      r("Security"),
      r("Still Photographer"),
      role("EPK", "EPK / Behind-the-Scenes"),
      r("Unit Publicist"),
      r("Archival Producer"),
      r("Clearances Coordinator"),
      r("Legal / Entertainment Lawyer"),
      r("Titles Designer"),
      r("Subtitling / Localization"),
      r("Accessibility Coordinator"),
      r("Distributor Representative"),
      r("Other"),
    ],
  },
];

/** Flat list of every credit option (deduped by value). */
export const UPLOAD_CREDIT_ROLES_FLAT: UploadCreditRole[] = (() => {
  const seen = new Set<string>();
  const out: UploadCreditRole[] = [];
  for (const group of UPLOAD_CREDIT_ROLE_GROUPS) {
    for (const item of group.roles) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      out.push(item);
    }
  }
  return out;
})();

export function isKnownUploadCreditRole(value: string): boolean {
  return UPLOAD_CREDIT_ROLES_FLAT.some((r) => r.value === value);
}
