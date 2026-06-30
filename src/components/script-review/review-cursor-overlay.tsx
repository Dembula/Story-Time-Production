"use client";



import type { ReviewPeer } from "@/lib/script-review/collaboration-room";



type ReviewCursorOverlayProps = {

  peers: ReviewPeer[];

  pageIndex: number;

};



export function ReviewCursorOverlay({ peers, pageIndex }: ReviewCursorOverlayProps) {

  const onPage = peers.filter(

    (p) => p.pageIndex === pageIndex && p.cursorX != null && p.cursorY != null,

  );



  if (onPage.length === 0) return null;



  return (

    <div className="pointer-events-none absolute inset-0 z-20">

      {onPage.map((peer) => (

        <div

          key={peer.userId}

          className="absolute"

          style={{

            left: peer.cursorX ?? 0,

            top: peer.cursorY ?? 0,

            transform: "translate(-2px, -2px)",

          }}

        >

          <div

            className="h-3 w-3 rotate-45 border border-white/80 shadow"

            style={{ backgroundColor: peer.color }}

          />

          <span

            className="absolute left-3 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-medium text-white shadow"

            style={{ backgroundColor: peer.color }}

          >

            {peer.displayName}

            {peer.isDrawing ? " ✎" : ""}

          </span>

        </div>

      ))}

    </div>

  );

}


