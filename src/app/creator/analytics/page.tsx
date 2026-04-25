import { permanentRedirect } from "next/navigation";

/** Legacy URL — Command Center is the canonical analytics home. */
export default function CreatorAnalyticsPage() {
  permanentRedirect("/creator/command-center");
}
