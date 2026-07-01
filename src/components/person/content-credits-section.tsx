"use client";

import { HorizontalScrollRow } from "@/components/layout/horizontal-scroll-row";
import { groupContentCredits } from "@/lib/credit-person-types";
import { PersonCardTrigger } from "./person-card-trigger";

export type ContentCreditMember = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  creditPersonId: string | null;
  creditPerson?: {
    id: string;
    imageUrl: string | null;
    userId: string | null;
  } | null;
};

type ContentCreditsSectionProps = {
  members: ContentCreditMember[];
};

export function ContentCreditsSection({ members }: ContentCreditsSectionProps) {
  if (members.length === 0) return null;

  const grouped = groupContentCredits(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      creditPersonId: m.creditPersonId,
    })),
  );

  return (
    <HorizontalScrollRow
      className="mt-10"
      sideArrows={false}
      title={<h3 className="text-xl font-semibold text-white">Cast & Crew</h3>}
      headerEnd={
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
          {grouped.length} credited
        </span>
      }
      scrollClassName="flex gap-3 overflow-x-auto pb-2 pt-1 [-webkit-overflow-scrolling:touch] scrollbar-hide"
    >
      {grouped.map((entry) => {
        const sample = members.find((m) => entry.crewMemberIds.includes(m.id));
        const imageUrl = sample?.creditPerson?.imageUrl ?? null;
        const personId = entry.personId ?? sample?.creditPersonId ?? null;
        const creatorUserId = sample?.creditPerson?.userId ?? null;
        return (
          <PersonCardTrigger
            key={entry.key}
            personId={personId}
            crewMemberId={entry.crewMemberIds[0]}
            name={entry.name}
            roles={entry.roles}
            imageUrl={imageUrl}
            verified={Boolean(creatorUserId)}
          />
        );
      })}
    </HorizontalScrollRow>
  );
}
