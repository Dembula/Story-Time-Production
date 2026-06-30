import type { ScriptTemplateId } from "./types";

export const SCRIPT_TEMPLATES: Array<{
  id: ScriptTemplateId;
  label: string;
  type: string;
  content: string;
}> = [
  {
    id: "FEATURE",
    label: "Feature Film",
    type: "FEATURE",
    content: `FADE IN:

INT. LOCATION - DAY

Opening action. Establish world and protagonist.

CHARACTER
First line of dialogue.

                    CUT TO:

EXT. LOCATION - NIGHT

`,
  },
  {
    id: "SHORT",
    label: "Short Film",
    type: "SHORT",
    content: `FADE IN:

INT. LOCATION - DAY

Short film opening — hook the audience in the first 30 seconds.

CHARACTER
Dialogue.

FADE OUT.

`,
  },
  {
    id: "TV_SERIES",
    label: "TV Series (Pilot)",
    type: "EPISODE",
    content: `TEASER

INT. LOCATION - DAY

Cold open.

CHARACTER
Teaser line.

ACT ONE

INT. LOCATION - DAY

Episode setup.

`,
  },
  {
    id: "DOCUMENTARY",
    label: "Documentary",
    type: "OTHER",
    content: `OPENING MONTAGE

NARRATOR (V.O.)
Documentary opening narration.

INTERVIEW — SUBJECT NAME

Subject speaks to camera.

B-ROLL — CITY - DAY

`,
  },
  {
    id: "WEB_SERIES",
    label: "Web Series",
    type: "EPISODE",
    content: `EPISODE 1 — "TITLE"

INT. LOCATION - DAY

Web series cold open.

CHARACTER
Hook line.

END OF EPISODE 1

`,
  },
  {
    id: "COMMERCIAL",
    label: "Commercial",
    type: "OTHER",
    content: `COMMERCIAL — :30

OPEN ON PRODUCT

VOICE OVER
Tagline.

SUPER: BRAND NAME

`,
  },
  {
    id: "MUSIC_VIDEO",
    label: "Music Video",
    type: "OTHER",
    content: `MUSIC VIDEO — SONG TITLE

INT. STUDIO - NIGHT

Performance setup.

    ♪ First lyric line ♪

`,
  },
  {
    id: "ANIMATION",
    label: "Animation",
    type: "OTHER",
    content: `ANIMATED FEATURE

EXT. FANTASY LANDSCAPE - DAY

Establishing shot — animated world.

CHARACTER
Dialogue.

`,
  },
  {
    id: "THEATRE",
    label: "Theatre / Stage Play",
    type: "OTHER",
    content: `ACT I — SCENE 1

The stage is bare. A single chair centre.

CHARACTER
Opening monologue.

`,
  },
  {
    id: "VERTICAL",
    label: "Vertical Series",
    type: "EPISODE",
    content: `VERTICAL EP 1

INT. CLOSE LOCATION - DAY

Vertical-friendly tight framing.

CHARACTER
Short punchy line.

`,
  },
  {
    id: "YOUTUBE",
    label: "YouTube Original",
    type: "OTHER",
    content: `YOUTUBE ORIGINAL — EP 1

INT. SET - DAY

Creator/host intro.

HOST
Welcome to the show.

`,
  },
  {
    id: "PODCAST",
    label: "Podcast (Scripted)",
    type: "OTHER",
    content: `PODCAST EPISODE 1 — "TITLE"

HOST
Intro.

GUEST
Response.

`,
  },
];
