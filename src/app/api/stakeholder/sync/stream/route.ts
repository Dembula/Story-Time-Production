import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchSyncEventsForUser } from "@/lib/stakeholder-ecosystem/sync-events";

export const dynamic = "force-dynamic";

/** SSE stream — pushes schedule/booking sync events to stakeholder portals. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sinceParam = new URL(req.url).searchParams.get("since");
  let since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60000);
  if (Number.isNaN(since.getTime())) since = new Date(Date.now() - 60000);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", at: new Date().toISOString() });

      const interval = setInterval(async () => {
        try {
          const events = await fetchSyncEventsForUser(userId, since);
          if (events.length > 0) {
            since = events[events.length - 1]!.createdAt;
            send({ type: "sync", events });
          } else {
            send({ type: "heartbeat", at: new Date().toISOString() });
          }
        } catch {
          send({ type: "error", message: "poll_failed" });
        }
      }, 8000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
