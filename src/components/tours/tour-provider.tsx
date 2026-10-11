"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findMatchingTours } from "@/lib/tours/registry";
import type { TourDefinition, TourProgressRecord, TourStep } from "@/lib/tours/types";
import { TourOverlay } from "@/components/tours/tour-overlay";

const SKIP_PREFIXES = [
  "/auth",
  "/api",
  "/onboarding",
  "/creator/onboarding",
  "/company/onboarding",
  "/music-creator/onboarding",
];

function shouldSkipPath(pathname: string): boolean {
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isTourFinished(
  progress: TourProgressRecord[],
  tour: TourDefinition,
): boolean {
  const row = progress.find((p) => p.tourId === tour.id);
  if (!row) return false;
  if (row.status === "COMPLETED" || row.status === "DISMISSED") {
    // Re-show only if we bump version intentionally.
    return row.tourVersion >= tour.version;
  }
  return false;
}

async function waitForSelector(
  selector: string,
  timeoutMs: number,
): Promise<HTMLElement | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      const r = el.getBoundingClientRect();
      if (r.width > 1 || r.height > 1) return el;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname() || "/";
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [progress, setProgress] = useState<TourProgressRecord[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const resolvingRef = useRef(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  /** Stamp common workspace anchors so every project tool gets tour targets without per-page edits. */
  useEffect(() => {
    const stamp = () => {
      const pairs: Array<[string, string]> = [
        [".creator-tool-workspace-header", "tool-workspace-header"],
        [".creator-tool-workspace-body", "tool-workspace-body"],
        [".creator-tool-studio-tabs", "breakdown-studio-tabs"],
      ];
      for (const [selector, id] of pairs) {
        document.querySelectorAll(selector).forEach((el) => {
          if (el instanceof HTMLElement && !el.getAttribute("data-tour")) {
            el.setAttribute("data-tour", id);
          }
        });
      }
      if (
        /^\/(funders|equipment-company|location-owner|crew-team|casting-agency|catering-company|music-creator)(\/|$)/.test(
          pathname,
        )
      ) {
        const main = document.querySelector("main");
        if (main instanceof HTMLElement && !main.getAttribute("data-tour")) {
          main.setAttribute("data-tour", "stakeholder-home");
        }
        if (pathname.includes("/tasks") && main instanceof HTMLElement) {
          main.setAttribute("data-tour", "stakeholder-tasks");
        }
        if (pathname.includes("/calendar") && main instanceof HTMLElement) {
          main.setAttribute("data-tour", "stakeholder-calendar");
        }
      }
    };
    stamp();
    const t = window.setInterval(stamp, 800);
    const stop = window.setTimeout(() => window.clearInterval(t), 8000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(stop);
    };
  }, [pathname]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setProgress([]);
      setProgressLoaded(true);
      setActiveTour(null);
      return;
    }
    if (status !== "authenticated" || !userId) return;

    let cancelled = false;
    setProgressLoaded(false);
    fetch("/api/tours/progress")
      .then(async (r) => {
        if (!r.ok) return { progress: [] as TourProgressRecord[] };
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setProgress(Array.isArray(json.progress) ? json.progress : []);
        setProgressLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setProgress([]);
          setProgressLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  const persist = useCallback(
    async (tourId: string, tourStatus: "COMPLETED" | "DISMISSED", tourVersion: number) => {
      setProgress((prev) => {
        const next = prev.filter((p) => p.tourId !== tourId);
        next.push({
          tourId,
          status: tourStatus,
          tourVersion,
          updatedAt: new Date().toISOString(),
        });
        return next;
      });
      try {
        await fetch("/api/tours/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourId, status: tourStatus, tourVersion }),
        });
      } catch {
        // Local state already updated — next successful sync will reconcile.
      }
    },
    [],
  );

  const finish = useCallback(
    async (tourStatus: "COMPLETED" | "DISMISSED") => {
      if (!activeTour) return;
      const id = activeTour.id;
      const version = activeTour.version;
      setActiveTour(null);
      setTargetEl(null);
      setStepIndex(0);
      await persist(id, tourStatus, version);
    },
    [activeTour, persist],
  );

  const resolveStepTarget = useCallback(
    async (tour: TourDefinition, index: number): Promise<{ step: TourStep; el: HTMLElement | null; index: number } | null> => {
      let i = index;
      while (i < tour.steps.length) {
        if (pathnameRef.current !== pathname) return null;
        const step = tour.steps[i];
        const el = await waitForSelector(step.target, step.optional ? 900 : 3500);
        if (el) {
          try {
            el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
          } catch {
            /* ignore */
          }
          return { step, el, index: i };
        }
        if (step.optional) {
          i += 1;
          continue;
        }
        // Required missing target — skip remaining safely by dismissing.
        return null;
      }
      return null;
    },
    [pathname],
  );

  // Start / restart tour on route change
  useEffect(() => {
    setActiveTour(null);
    setTargetEl(null);
    setStepIndex(0);

    if (!progressLoaded || status !== "authenticated" || !userId) return;
    if (shouldSkipPath(pathname)) return;
    if (resolvingRef.current) return;

    const matches = findMatchingTours(pathname, role);
    const candidate = matches.find((t) => !isTourFinished(progress, t));
    if (!candidate) return;

    let cancelled = false;
    resolvingRef.current = true;

    const timer = window.setTimeout(async () => {
      const resolved = await resolveStepTarget(candidate, 0);
      resolvingRef.current = false;
      if (cancelled || !resolved) {
        if (!cancelled && !resolved) {
          // Could not attach to any step — mark dismissed so we don't loop forever.
          await persist(candidate.id, "DISMISSED", candidate.version);
        }
        return;
      }
      setActiveTour(candidate);
      setStepIndex(resolved.index);
      setTargetEl(resolved.el);
    }, candidate.startDelayMs ?? 450);

    return () => {
      cancelled = true;
      resolvingRef.current = false;
      window.clearTimeout(timer);
    };
  }, [pathname, progressLoaded, progress, status, userId, role, resolveStepTarget, persist]);

  const currentStep: TourStep | null = useMemo(() => {
    if (!activeTour) return null;
    return activeTour.steps[stepIndex] ?? null;
  }, [activeTour, stepIndex]);

  const onNext = useCallback(async () => {
    if (!activeTour || !currentStep) return;
    const nextIndex = stepIndex + 1;
    if (nextIndex >= activeTour.steps.length) {
      await finish("COMPLETED");
      return;
    }
    const resolved = await resolveStepTarget(activeTour, nextIndex);
    if (!resolved) {
      await finish("COMPLETED");
      return;
    }
    setStepIndex(resolved.index);
    setTargetEl(resolved.el);
  }, [activeTour, currentStep, stepIndex, finish, resolveStepTarget]);

  const onBack = useCallback(async () => {
    if (!activeTour || stepIndex <= 0) return;
    // Walk backward to previous available target
    for (let i = stepIndex - 1; i >= 0; i -= 1) {
      const step = activeTour.steps[i];
      const el = document.querySelector(step.target);
      if (el instanceof HTMLElement) {
        try {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        } catch {
          /* ignore */
        }
        setStepIndex(i);
        setTargetEl(el);
        return;
      }
    }
  }, [activeTour, stepIndex]);

  return (
    <>
      {children}
      {activeTour && currentStep ? (
        <TourOverlay
          tour={activeTour}
          stepIndex={stepIndex}
          step={currentStep}
          targetEl={targetEl}
          onNext={onNext}
          onBack={onBack}
          onSkip={() => void finish("DISMISSED")}
        />
      ) : null}
    </>
  );
}
