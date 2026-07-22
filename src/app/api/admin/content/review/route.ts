import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaDbNull, type InputJsonValue } from "@/lib/prisma-json";
import { notifyUser } from "@/lib/notify-user";
import { sanitizeReviewFeedback } from "@/lib/review-feedback";
import { buildAppUrl } from "@/lib/app-url";
import { isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import { getStreamAssetsByUrls } from "@/lib/stream-asset-store";
import { isLikelyVideoStorageUrl } from "@/lib/stream-ingest-link";
import { isSeasonOnlyCatalogueUpdate } from "@/lib/content-season-review";
import {
  buildApprovedPlaybackUrls,
  isFailedStreamStatus,
  isReadyStreamStatus,
  syncReadyStreamsForContent,
  toApproveResponse,
} from "@/lib/content-approve-publish";

export const runtime = "nodejs";
export const maxDuration = 60;

function reviewDetailUrl(contentId: string) {
  return `/creator/catalogue/reviews/${contentId}`;
}

async function loadStreamAssetsSafely(urls: string[]) {
  try {
    return await getStreamAssetsByUrls(urls);
  } catch (err) {
    console.error("stream asset lookup failed during content review:", err);
    return new Map();
  }
}

function schedulePostApproveWork(input: {
  contentId: string;
  videoUrl: string | null;
  trailerUrl: string | null;
  episodeRows: Array<{ videoUrl: string | null }>;
}) {
  void (async () => {
    try {
      const { linkOrIngestStreamForUrl } = await import("@/lib/stream-ingest-link");
      const ingestTargets = [
        { url: input.videoUrl, area: "content-main" },
        { url: input.trailerUrl, area: "content-trailer" },
        ...input.episodeRows.map((episode) => ({ url: episode.videoUrl, area: "content-episode" })),
      ];
      for (const target of ingestTargets) {
        if (!target.url?.trim()) continue;
        await linkOrIngestStreamForUrl(target.url, "Content", input.contentId, {
          area: target.area,
          source: "storytime-admin-approve",
        });
      }
    } catch (err) {
      console.error("stream ingest on approve failed:", err);
    }

    try {
      const { ensureSceneIntelligence } = await import("@/lib/ai-metadata/ensure-scene-intelligence");
      await ensureSceneIntelligence(input.contentId);
    } catch (err) {
      console.error("scene intelligence on approve failed:", err);
    }
  })();
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    const adminId = (session?.user as { id?: string })?.id;
    if (role !== "ADMIN" || !adminId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { contentId, action, reviewNote, featured, reviewFeedback: rawFeedback } = body;

    if (!contentId || !action) {
      return NextResponse.json({ error: "contentId and action required" }, { status: 400 });
    }

    const before = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        trailerUrl: true,
        reviewStatus: true,
        published: true,
        creatorId: true,
        linkedProjectId: true,
      },
    });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();
    const feedbackList = sanitizeReviewFeedback(rawFeedback, before.linkedProjectId);
    const feedbackForDb =
      feedbackList === null ? prismaDbNull : (feedbackList as InputJsonValue);

    const seasonRows = await prisma.contentSeason.findMany({
      where: { contentId },
      select: { id: true, seasonNumber: true, title: true, published: true },
    });
    const seasonOnlyUpdate = isSeasonOnlyCatalogueUpdate(before.published, seasonRows);

    const baseAudit = {
      adminUserId: adminId,
      entityType: "Content",
      entityId: contentId,
      oldValue: {
        reviewStatus: before.reviewStatus,
        published: before.published,
      } as InputJsonValue,
    };

    const notify = async (
      actionKey: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "UNPUBLISH",
      title: string,
      bodyText: string,
    ) => {
      const url = reviewDetailUrl(contentId);
      await notifyUser({
        userId: before.creatorId,
        type: "CONTENT_REVIEW_DECISION",
        title,
        body: bodyText,
        metadata: { url, contentId, action: actionKey },
        email: {
          subject: title,
          text: `${bodyText}\n\nOpen: ${buildAppUrl(url)}`,
        },
      });
    };

    if (action === "APPROVE") {
      const episodeRows = await prisma.contentEpisode.findMany({
        where: { season: { contentId } },
        select: { id: true, title: true, videoUrl: true },
      });
      const playbackItems = [
        { label: "main video", url: before.videoUrl },
        { label: "trailer", url: before.trailerUrl },
        ...episodeRows.map((episode) => ({ label: `episode "${episode.title}"`, url: episode.videoUrl })),
      ].filter((item): item is { label: string; url: string } => {
        const url = item.url?.trim();
        if (!url) return false;
        return isCloudflareStreamUrl(url) || isLikelyVideoStorageUrl(url);
      });

      const streamAssets = await loadStreamAssetsSafely(playbackItems.map((item) => item.url));
      const failed = playbackItems.find((item) => {
        const asset = streamAssets.get(item.url.trim());
        return Boolean(asset?.status && isFailedStreamStatus(asset.status));
      });
      if (failed) {
        const { isMediaConvertMezzanineConfigured } = await import("@/lib/mediaconvert-mezzanine");
        const mezzanineEnabled = isMediaConvertMezzanineConfigured();
        try {
          if (mezzanineEnabled) {
            const { recoverFromStreamBitrateFailure } = await import("@/lib/stream-encode-pipeline");
            await recoverFromStreamBitrateFailure({
              sourceUrl: failed.url,
              lastError: "bitrate exceeds 200Mbps",
              entityType: "Content",
              entityId: contentId,
              forceRestart: true,
            });
          } else {
            const { linkOrIngestStreamForUrl } = await import("@/lib/stream-ingest-link");
            await linkOrIngestStreamForUrl(failed.url, "Content", contentId, {
              area: "admin-approve-reencode",
              source: "storytime-admin-reencode",
            });
          }
        } catch (reencodeErr) {
          console.error("admin approve re-encode failed:", reencodeErr);
        }
        return NextResponse.json(
          {
            error: mezzanineEnabled
              ? `The ${failed.label} failed Stream encode (often bitrate >200 Mbps). A mezzanine compress job was queued — open AWS MediaConvert in region ${process.env.MEDIACONVERT_REGION || process.env.STORAGE_REGION || "(STORAGE_REGION)"} and wait, then Approve again.`
              : `The ${failed.label} failed to encode for playback. Cloudflare Stream rejects masters over 200 Mbps (uncompressed/ProRes). Export an H.264 delivery master under ~180 Mbps, or set MEDIACONVERT_ROLE_ARN for automatic mezzanine compression.`,
          },
          { status: 409 },
        );
      }

      const processing = playbackItems.find((item) => {
        const asset = streamAssets.get(item.url.trim());
        if (!asset?.status) return false;
        if (isReadyStreamStatus(asset.status)) return false;
        if (isFailedStreamStatus(asset.status)) return false;
        return true;
      });
      if (processing) {
        const asset = streamAssets.get(processing.url.trim());
        const mezzanining = asset?.status?.toLowerCase() === "mezzanining";
        if (mezzanining) {
          try {
            const { recoverFromStreamBitrateFailure, advanceMezzaninePlaceholder } = await import(
              "@/lib/stream-encode-pipeline"
            );
            if (asset?.uid.startsWith("mc_")) {
              const advanced = await advanceMezzaninePlaceholder(asset.uid);
              if (advanced === "error") {
                // Stuck placeholder with no real AWS job — start a fresh MediaConvert job.
                await recoverFromStreamBitrateFailure({
                  sourceUrl: processing.url,
                  lastError: "bitrate exceeds 200Mbps",
                  entityType: "Content",
                  entityId: contentId,
                  forceRestart: true,
                });
              }
            } else {
              await recoverFromStreamBitrateFailure({
                sourceUrl: processing.url,
                lastError: "bitrate exceeds 200Mbps",
                entityType: "Content",
                entityId: contentId,
                forceRestart: true,
              });
            }
          } catch (err) {
            console.error("admin approve mezzanine poll/restart failed:", err);
          }
        }
        const region =
          process.env.MEDIACONVERT_REGION?.trim() ||
          process.env.STORAGE_REGION?.trim() ||
          "your STORAGE_REGION";
        return NextResponse.json(
          {
            error: mezzanining
              ? `The ${processing.label} is still being compressed for Stream. Check AWS MediaConvert → Jobs in region ${region}. If the job list is empty, Approve again to restart compress. Then Approve once Stream is ready.`
              : `The ${processing.label} is still encoding. Wait a few minutes and try again.`,
          },
          { status: 409 },
        );
      }

      const { episodeUrls, ...contentPlayback } = buildApprovedPlaybackUrls({
        videoUrl: before.videoUrl,
        trailerUrl: before.trailerUrl,
        episodeRows,
        streamAssets,
      });

      const updated = await prisma.$transaction(async (tx) => {
        const content = await tx.content.update({
          where: { id: contentId },
          data: {
            reviewStatus: "APPROVED",
            published: true,
            featured: featured === true,
            reviewNote: reviewNote || null,
            reviewFeedback: prismaDbNull,
            reviewedAt: now,
            ...contentPlayback,
          },
        });

        await tx.contentSeason.updateMany({
          where: seasonOnlyUpdate ? { contentId, published: false } : { contentId },
          data: { published: true },
        });

        for (const episode of episodeUrls) {
          await tx.contentEpisode.update({
            where: { id: episode.id },
            data: { videoUrl: episode.videoUrl },
          });
        }

        return content;
      });

      const { refreshCreditPersonBlurbsForContent } = await import("@/lib/credit-person-blurb");
      void refreshCreditPersonBlurbsForContent(contentId);

      try {
        await prisma.adminAuditLog.create({
          data: {
            ...baseAudit,
            action: "CONTENT_REVIEW_APPROVE",
            newValue: { reviewStatus: updated.reviewStatus, published: updated.published } as InputJsonValue,
          },
        });
      } catch (err) {
        console.error("admin audit log on approve failed:", err);
      }

      try {
        await notify(
          "APPROVE",
          seasonOnlyUpdate ? "New season approved" : "Your catalogue title was approved",
          seasonOnlyUpdate
            ? `A new season for "${before.title}" is approved and now visible to viewers.`
            : `"${before.title}" is approved and published on the catalogue.`,
        );
      } catch (err) {
        console.error("creator notification on approve failed:", err);
      }

      if (!seasonOnlyUpdate) {
        await syncReadyStreamsForContent(streamAssets);
        schedulePostApproveWork({
          contentId,
          videoUrl: updated.videoUrl,
          trailerUrl: updated.trailerUrl,
          episodeRows,
        });
      }

      return NextResponse.json(toApproveResponse(updated));
    }

    if (action === "REJECT") {
      if (seasonOnlyUpdate) {
        const pendingIds = seasonRows.filter((s) => !s.published).map((s) => s.id);
        await prisma.contentSeason.deleteMany({ where: { id: { in: pendingIds } } });
        const totalEpisodes = await prisma.contentEpisode.count({
          where: { season: { contentId } },
        });
        const updated = await prisma.content.update({
          where: { id: contentId },
          data: {
            reviewStatus: "APPROVED",
            published: true,
            reviewNote:
              reviewNote ||
              "The new season was not approved. Your series remains live; you may submit a revised season.",
            reviewFeedback: feedbackForDb,
            reviewedAt: now,
            episodes: totalEpisodes,
          },
        });
        try {
          await prisma.adminAuditLog.create({
            data: {
              ...baseAudit,
              action: "CONTENT_REVIEW_REJECT",
              newValue: {
                reviewStatus: updated.reviewStatus,
                reviewNote: updated.reviewNote,
                seasonOnlyUpdate: true,
              } as InputJsonValue,
            },
          });
        } catch (err) {
          console.error("admin audit log on reject failed:", err);
        }
        try {
          await notify(
            "REJECT",
            "New season not approved",
            `The new season for "${before.title}" was not approved. The series stays live on the catalogue.`,
          );
        } catch (err) {
          console.error("creator notification on reject failed:", err);
        }
        return NextResponse.json(toApproveResponse(updated));
      }

      const updated = await prisma.content.update({
        where: { id: contentId },
        data: {
          reviewStatus: "REJECTED",
          published: false,
          reviewNote: reviewNote || "Content did not meet platform guidelines.",
          reviewFeedback: feedbackForDb,
          reviewedAt: now,
        },
      });
      try {
        await prisma.adminAuditLog.create({
          data: {
            ...baseAudit,
            action: "CONTENT_REVIEW_REJECT",
            newValue: {
              reviewStatus: updated.reviewStatus,
              reviewNote: updated.reviewNote,
            } as InputJsonValue,
          },
        });
      } catch (err) {
        console.error("admin audit log on reject failed:", err);
      }
      try {
        await notify(
          "REJECT",
          "Catalogue submission declined",
          `Your submission "${before.title}" was not approved. Open Story Time for full details and next steps.`,
        );
      } catch (err) {
        console.error("creator notification on reject failed:", err);
      }
      return NextResponse.json(toApproveResponse(updated));
    }

    if (action === "REQUEST_CHANGES") {
      const updated = await prisma.content.update({
        where: { id: contentId },
        data: {
          reviewStatus: "CHANGES_REQUESTED",
          published: seasonOnlyUpdate ? true : false,
          reviewNote:
            reviewNote ||
            (seasonOnlyUpdate
              ? "Please update the new season and resubmit."
              : "Please address the noted issues and resubmit."),
          reviewFeedback: feedbackForDb,
          reviewedAt: now,
        },
      });
      try {
        await prisma.adminAuditLog.create({
          data: {
            ...baseAudit,
            action: "CONTENT_REVIEW_REQUEST_CHANGES",
            newValue: {
              reviewStatus: updated.reviewStatus,
              reviewNote: updated.reviewNote,
            } as InputJsonValue,
          },
        });
      } catch (err) {
        console.error("admin audit log on request changes failed:", err);
      }
      try {
        await notify(
          "REQUEST_CHANGES",
          seasonOnlyUpdate ? "Changes requested on new season" : "Changes requested on your catalogue submission",
          seasonOnlyUpdate
            ? `Please update the new season for "${before.title}" and resubmit. The series stays live on the catalogue.`
            : `Please update "${before.title}" and resubmit. We added guidance in your review page.`,
        );
      } catch (err) {
        console.error("creator notification on request changes failed:", err);
      }
      return NextResponse.json(toApproveResponse(updated));
    }

    if (action === "UNPUBLISH") {
      const updated = await prisma.content.update({
        where: { id: contentId },
        data: {
          reviewStatus: "UNPUBLISHED",
          published: false,
          reviewNote: reviewNote || null,
          reviewedAt: now,
        },
      });
      try {
        await prisma.adminAuditLog.create({
          data: {
            ...baseAudit,
            action: "CONTENT_REVIEW_UNPUBLISH",
            newValue: { reviewStatus: updated.reviewStatus, published: false } as InputJsonValue,
          },
        });
      } catch (err) {
        console.error("admin audit log on unpublish failed:", err);
      }
      try {
        await notify(
          "UNPUBLISH",
          "A title was unpublished",
          `"${before.title}" is no longer public on the catalogue. See your review page for notes.`,
        );
      } catch (err) {
        console.error("creator notification on unpublish failed:", err);
      }
      return NextResponse.json(toApproveResponse(updated));
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("admin content review failed:", error);
    const message = error instanceof Error ? error.message : "Review action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
