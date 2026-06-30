import { cn } from "@/lib/utils";

/** Platform-native `<select>` — no OS chrome, matches glass panels. */
export const creatorToolSelectClass =
  "storytime-select creator-tool-select";

export const creatorToolSelectSmClass =
  "storytime-select creator-tool-select creator-tool-select--sm";

export function creatorToolSelect(extra?: string) {
  return cn(creatorToolSelectClass, extra);
}

export function creatorToolSelectSm(extra?: string) {
  return cn(creatorToolSelectSmClass, extra);
}
