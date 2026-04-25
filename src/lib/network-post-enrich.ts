import { prisma } from "@/lib/prisma";
import type { NetworkPost } from "../../generated/prisma";
import { parseNetworkPostMetadata } from "@/lib/network-types";

export type EnrichedNetworkPost = NetworkPost & {
  author: {
    id: string;
    name: string | null;
    image: string | null;
    headline: string | null;
    primaryRole: string | null;
    professionalName: string | null;
  };
  content: { id: string; title: string; type: string; posterUrl: string | null } | null;
  project: { id: string; title: string; type: string; posterUrl: string | null; phase: string; status: string } | null;
  scene: { id: string; number: string; heading: string | null } | null;
  parsedMetadata: ReturnType<typeof parseNetworkPostMetadata>;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
};

export async function enrichNetworkPostsForFeed(
  posts: NetworkPost[],
  viewerId: string | null,
): Promise<EnrichedNetworkPost[]> {
  if (posts.length === 0) return [];

  const authorIds = [...new Set(posts.map((p) => p.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: {
      id: true,
      name: true,
      image: true,
      headline: true,
      primaryRole: true,
      professionalName: true,
    },
  });
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

  const contentIds = [...new Set(posts.map((p) => p.contentId).filter(Boolean))] as string[];
  const projectIds = [...new Set(posts.map((p) => p.projectId).filter(Boolean))] as string[];
  const sceneIds = [...new Set(posts.map((p) => p.sceneId).filter(Boolean))] as string[];

  const [contents, projects, scenes] = await Promise.all([
    contentIds.length
      ? prisma.content.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, title: true, type: true, posterUrl: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.originalProject.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, title: true, type: true, posterUrl: true, phase: true, status: true },
        })
      : Promise.resolve([]),
    sceneIds.length
      ? prisma.projectScene.findMany({
          where: { id: { in: sceneIds } },
          select: { id: true, number: true, heading: true },
        })
      : Promise.resolve([]),
  ]);

  const postIds = posts.map((p) => p.id);
  const [likeGroups, saveGroups, commentGroups, myLikes, mySaves] = await Promise.all([
    prisma.networkPostLike.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }),
    prisma.networkPostSave.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }),
    prisma.networkPostComment.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.networkPostLike.findMany({
          where: { userId: viewerId, postId: { in: postIds } },
          select: { postId: true },
        })
      : Promise.resolve([]),
    viewerId
      ? prisma.networkPostSave.findMany({
          where: { userId: viewerId, postId: { in: postIds } },
          select: { postId: true },
        })
      : Promise.resolve([]),
  ]);

  const likeCountMap = new Map(likeGroups.map((g) => [g.postId, g._count._all]));
  const saveCountMap = new Map(saveGroups.map((g) => [g.postId, g._count._all]));
  const commentCountMap = new Map(commentGroups.map((g) => [g.postId, g._count._all]));
  const likedSet = new Set(myLikes.map((l) => l.postId));
  const savedSet = new Set(mySaves.map((s) => s.postId));

  return posts.map((p) => {
    const author = authorMap[p.authorId];
    return {
      ...p,
      author: author ?? {
        id: p.authorId,
        name: null,
        image: null,
        headline: null,
        primaryRole: null,
        professionalName: null,
      },
      content: p.contentId ? contents.find((c) => c.id === p.contentId) ?? null : null,
      project: p.projectId ? projects.find((pr) => pr.id === p.projectId) ?? null : null,
      scene: p.sceneId ? scenes.find((s) => s.id === p.sceneId) ?? null : null,
      parsedMetadata: parseNetworkPostMetadata(p.metadata),
      likeCount: likeCountMap.get(p.id) ?? 0,
      saveCount: saveCountMap.get(p.id) ?? 0,
      commentCount: commentCountMap.get(p.id) ?? 0,
      likedByViewer: likedSet.has(p.id),
      savedByViewer: savedSet.has(p.id),
    };
  });
}
