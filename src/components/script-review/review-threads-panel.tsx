"use client";



import { useState } from "react";

import type { ReviewAnnotationRecord } from "@/lib/script-review/types";



type ReviewThreadsPanelProps = {

  threads: ReviewAnnotationRecord[];

  canReply: boolean;

  onResolve: (id: string) => void;

  onReply: (parentId: string, body: string) => void;

  onJumpToLine?: (lineIndex: number) => void;

};



function ThreadCard({

  thread,

  canReply,

  onResolve,

  onReply,

  onJumpToLine,

  depth = 0,

}: {

  thread: ReviewAnnotationRecord;

  canReply: boolean;

  onResolve: (id: string) => void;

  onReply: (parentId: string, body: string) => void;

  onJumpToLine?: (lineIndex: number) => void;

  depth?: number;

}) {

  const [replyOpen, setReplyOpen] = useState(false);

  const [replyText, setReplyText] = useState("");

  const author = thread.author.professionalName || thread.author.name || "Reviewer";



  return (

    <div className={`rounded border border-slate-700 p-2 ${depth > 0 ? "ml-3 border-slate-800 bg-slate-950/40" : ""}`}>

      <p className="text-slate-200">{thread.body}</p>

      <p className="text-[10px] text-slate-500 mt-1">

        {author}

        {thread.lineIndex != null ? (

          <button

            type="button"

            className="ml-2 text-cyan-400 hover:text-cyan-300"

            onClick={() => onJumpToLine?.(thread.lineIndex!)}

          >

            · L{thread.lineIndex + 1}

          </button>

        ) : null}

      </p>

      {depth === 0 && !thread.resolved ? (

        <button type="button" className="text-[10px] text-cyan-400 mt-1" onClick={() => onResolve(thread.id)}>

          Resolve

        </button>

      ) : depth === 0 && thread.resolved ? (

        <span className="text-[10px] text-green-500">Resolved</span>

      ) : null}

      {canReply && depth === 0 ? (

        <div className="mt-2">

          {!replyOpen ? (

            <button type="button" className="text-[10px] text-orange-300" onClick={() => setReplyOpen(true)}>

              Reply

            </button>

          ) : (

            <div className="space-y-1">

              <textarea

                rows={2}

                value={replyText}

                onChange={(e) => setReplyText(e.target.value)}

                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-[10px] text-white"

                placeholder="Thread reply…"

              />

              <div className="flex gap-2">

                <button

                  type="button"

                  className="text-[10px] text-orange-300"

                  onClick={() => {

                    if (replyText.trim()) {

                      onReply(thread.id, replyText.trim());

                      setReplyText("");

                      setReplyOpen(false);

                    }

                  }}

                >

                  Post reply

                </button>

                <button type="button" className="text-[10px] text-slate-500" onClick={() => setReplyOpen(false)}>

                  Cancel

                </button>

              </div>

            </div>

          )}

        </div>

      ) : null}

      {thread.replies?.map((r) => (

        <div key={r.id} className="mt-2">

          <ThreadCard

            thread={r}

            canReply={false}

            onResolve={onResolve}

            onReply={onReply}

            onJumpToLine={onJumpToLine}

            depth={depth + 1}

          />

        </div>

      ))}

    </div>

  );

}



export function ReviewThreadsPanel({

  threads,

  canReply,

  onResolve,

  onReply,

  onJumpToLine,

}: ReviewThreadsPanelProps) {

  if (threads.length === 0) {

    return <p className="text-slate-500">No comment threads yet. Use Comment or margin notes on the script.</p>;

  }



  return (

    <div className="space-y-2">

      {threads.map((t) => (

        <ThreadCard

          key={t.id}

          thread={t}

          canReply={canReply}

          onResolve={onResolve}

          onReply={onReply}

          onJumpToLine={onJumpToLine}

        />

      ))}

    </div>

  );

}


