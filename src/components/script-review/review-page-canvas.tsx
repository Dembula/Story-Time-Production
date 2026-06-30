"use client";



import { useCallback, useRef, useState } from "react";

import type { ReviewAnnotationRecord, ReviewStamp, ReviewTool } from "@/lib/script-review/types";

import { toolColor, toolStrokeWidth } from "@/lib/script-review/types";

import { stampLabel, stampMeta } from "@/lib/script-review/stamps";

import type { ReviewPeer } from "@/lib/script-review/collaboration-room";

import { ReviewCursorOverlay } from "./review-cursor-overlay";



type Point = [number, number];



type ReviewPageCanvasProps = {

  pageIndex: number;

  lines: string[];

  globalLineOffset: number;

  annotations: ReviewAnnotationRecord[];

  visibleLayers: Set<string>;

  tool: ReviewTool;

  selectedStamp: ReviewStamp;

  layer: string;

  canAnnotate: boolean;

  peers?: ReviewPeer[];

  onCreateAnnotation: (payload: {

    type: string;

    pageIndex: number;

    lineIndex?: number;

    body?: string;

    data: Record<string, unknown>;

  }) => void;

  onAddComment: (lineIndex: number, text: string, data?: Record<string, unknown>) => void;

  onCursorMove?: (point: Point, lineIndex: number) => void;

};



function pointsToPath(points: Point[]): string {

  if (points.length === 0) return "";

  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");

}



export function ReviewPageCanvas({

  pageIndex,

  lines,

  globalLineOffset,

  annotations,

  visibleLayers,

  tool,

  selectedStamp,

  layer,

  canAnnotate,

  peers = [],

  onCreateAnnotation,

  onAddComment,

  onCursorMove,

}: ReviewPageCanvasProps) {

  const svgRef = useRef<SVGSVGElement>(null);

  const [drawing, setDrawing] = useState<Point[]>([]);

  const [shapeStart, setShapeStart] = useState<Point | null>(null);

  const [shapeEnd, setShapeEnd] = useState<Point | null>(null);



  const pageAnnotations = annotations.filter(

    (a) => a.pageIndex === pageIndex && visibleLayers.has(a.layer),

  );



  const localPoint = (e: React.PointerEvent): Point => {

    const svg = svgRef.current;

    if (!svg) return [0, 0];

    const rect = svg.getBoundingClientRect();

    return [e.clientX - rect.left, e.clientY - rect.top];

  };



  const lineAtY = (y: number): number => {

    const lineHeight = 19.2;

    return globalLineOffset + Math.max(0, Math.floor((y - 48) / lineHeight));

  };



  const finishStroke = useCallback(

    (points: Point[]) => {

      if (points.length < 2) return;

      const color = toolColor(tool);

      onCreateAnnotation({

        type: tool === "highlighter" ? "highlighter" : "draw",

        pageIndex,

        data: {

          points,

          color,

          width: toolStrokeWidth(tool),

          opacity: tool === "highlighter" ? 0.35 : 1,

        },

      });

    },

    [onCreateAnnotation, pageIndex, tool],

  );



  const handlePointerDown = (e: React.PointerEvent) => {

    if (!canAnnotate) return;

    const pt = localPoint(e);

    (e.target as Element).setPointerCapture?.(e.pointerId);

    onCursorMove?.(pt, lineAtY(pt[1]));



    if (tool === "stamp") {

      onCreateAnnotation({

        type: "stamp",

        pageIndex,

        body: stampLabel(selectedStamp),

        data: {

          stamp: selectedStamp,

          x: pt[0],

          y: pt[1],

          date: selectedStamp === "date" ? new Date().toLocaleDateString() : undefined,

        },

      });

      return;

    }



    if (tool === "comment" || tool === "sticky") {

      const lineIndex = lineAtY(pt[1]);

      const text = window.prompt(tool === "sticky" ? "Sticky note:" : "Comment:");

      if (text?.trim()) {

        if (tool === "comment") {

          onAddComment(lineIndex, text.trim(), { x: pt[0], y: pt[1] });

        } else {

          onCreateAnnotation({

            type: "sticky",

            pageIndex,

            lineIndex,

            body: text.trim(),

            data: { x: pt[0], y: pt[1], w: 140, h: 80 },

          });

        }

      }

      return;

    }



    if (tool === "text") {

      const text = window.prompt("Text note:");

      if (text?.trim()) {

        onCreateAnnotation({

          type: "text",

          pageIndex,

          data: { x: pt[0], y: pt[1], text: text.trim(), color: toolColor(tool), fontSize: 14 },

        });

      }

      return;

    }



    if (["line", "arrow", "rectangle", "circle"].includes(tool)) {

      setShapeStart(pt);

      setShapeEnd(pt);

      return;

    }



    if (tool === "eraser") return;

    if (tool === "free_draw" || tool.includes("_pen") || tool === "pencil") {

      setDrawing([pt]);

      return;

    }

    setDrawing([pt]);

  };



  const handlePointerMove = (e: React.PointerEvent) => {

    const pt = localPoint(e);

    onCursorMove?.(pt, lineAtY(pt[1]));

    if (!canAnnotate) return;

    if (shapeStart) {

      setShapeEnd(pt);

      return;

    }

    if (drawing.length === 0) return;

    setDrawing((prev) => [...prev, pt]);

  };



  const handlePointerUp = () => {

    if (shapeStart && shapeEnd) {

      onCreateAnnotation({

        type: "shape",

        pageIndex,

        data: {

          shape: tool,

          x1: shapeStart[0],

          y1: shapeStart[1],

          x2: shapeEnd[0],

          y2: shapeEnd[1],

          color: toolColor(tool === "eraser" ? "red_pen" : tool),

          width: toolStrokeWidth(tool),

        },

      });

      setShapeStart(null);

      setShapeEnd(null);

      return;

    }

    if (drawing.length > 1) finishStroke(drawing);

    setDrawing([]);

  };



  const commentPins = pageAnnotations.filter((a) => a.type === "comment" && a.body);



  return (

    <div className="relative mx-auto w-full max-w-[8.5in] shadow-2xl bg-white text-black mb-8">

      <div

        className="relative px-[1.5in] py-[1in] pr-[1in] min-h-[11in]"

        style={{

          fontFamily: "'Courier Prime', 'Courier New', monospace",

          fontSize: "12pt",

          lineHeight: 1.2,

        }}

      >

        <div className="text-right text-[10px] text-slate-400 mb-4">{pageIndex + 1}.</div>

        {lines.map((line, li) => (

          <div key={li} className="whitespace-pre-wrap min-h-[1.2em] relative group">

            {line || "\u00A0"}

            {canAnnotate ? (

              <button

                type="button"

                className="absolute -right-6 top-0 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white"

                title="Margin note"

                onClick={() => {

                  const text = window.prompt("Margin note:");

                  if (text?.trim()) {

                    onCreateAnnotation({

                      type: "margin",

                      pageIndex,

                      lineIndex: globalLineOffset + li,

                      body: text.trim(),

                      data: { side: "right", lineLocal: li },

                    });

                  }

                }}

              >

                +

              </button>

            ) : null}

          </div>

        ))}



        {commentPins.map((ann) => {

          const d = ann.data ?? {};

          const x = (d.x as number) ?? 24;

          const y = (d.y as number) ?? 48 + ((ann.lineIndex ?? 0) - globalLineOffset) * 19.2;

          return (

            <div

              key={`pin-${ann.id}`}

              className="absolute z-10 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white shadow"

              style={{ left: x, top: y }}

              title={ann.body ?? ""}

            >

              !

            </div>

          );

        })}



        <svg

          ref={svgRef}

          className="absolute inset-0 h-full w-full"

          style={{ touchAction: "none" }}

          onPointerDown={handlePointerDown}

          onPointerMove={handlePointerMove}

          onPointerUp={handlePointerUp}

          onPointerLeave={handlePointerUp}

        >

          {pageAnnotations.map((ann) => {

            const d = ann.data ?? {};

            if (ann.type === "draw" || ann.type === "highlighter") {

              const points = (d.points as Point[]) ?? [];

              return (

                <path

                  key={ann.id}

                  d={pointsToPath(points)}

                  fill="none"

                  stroke={(d.color as string) ?? "#dc2626"}

                  strokeWidth={(d.width as number) ?? 2}

                  strokeLinecap="round"

                  strokeLinejoin="round"

                  opacity={(d.opacity as number) ?? 1}

                />

              );

            }

            if (ann.type === "stamp") {

              const stamp = (d.stamp as ReviewStamp) ?? "approved";

              const meta = stampMeta(stamp);

              const label = stampLabel(stamp, d.date as string | undefined);

              const x = (d.x as number) ?? 0;

              const y = (d.y as number) ?? 0;

              return (

                <g key={ann.id} transform={`translate(${x}, ${y})`}>

                  <rect width="128" height="38" rx="4" fill={meta.bg} stroke={meta.color} strokeWidth="2" opacity="0.92" />

                  <text x="64" y="24" textAnchor="middle" fontSize="11" fontWeight="bold" fill={meta.color} fontFamily="system-ui, sans-serif">

                    {label}

                  </text>

                </g>

              );

            }

            if (ann.type === "shape") {

              const x1 = d.x1 as number;

              const y1 = d.y1 as number;

              const x2 = d.x2 as number;

              const y2 = d.y2 as number;

              const stroke = (d.color as string) ?? "#dc2626";

              const w = (d.width as number) ?? 2;

              if (d.shape === "rectangle") {

                return (

                  <rect

                    key={ann.id}

                    x={Math.min(x1, x2)}

                    y={Math.min(y1, y2)}

                    width={Math.abs(x2 - x1)}

                    height={Math.abs(y2 - y1)}

                    fill="none"

                    stroke={stroke}

                    strokeWidth={w}

                  />

                );

              }

              if (d.shape === "circle") {

                const rx = Math.abs(x2 - x1) / 2;

                const ry = Math.abs(y2 - y1) / 2;

                return (

                  <ellipse

                    key={ann.id}

                    cx={(x1 + x2) / 2}

                    cy={(y1 + y2) / 2}

                    rx={rx}

                    ry={ry}

                    fill="none"

                    stroke={stroke}

                    strokeWidth={w}

                  />

                );

              }

              return (

                <g key={ann.id}>

                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={w} />

                  {d.shape === "arrow" ? (

                    <polygon

                      points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}

                      fill={stroke}

                    />

                  ) : null}

                </g>

              );

            }

            if (ann.type === "text") {

              return (

                <text

                  key={ann.id}

                  x={d.x as number}

                  y={d.y as number}

                  fill={(d.color as string) ?? "#dc2626"}

                  fontSize={(d.fontSize as number) ?? 14}

                  fontFamily="Segoe Print, cursive"

                >

                  {d.text as string}

                </text>

              );

            }

            if (ann.type === "sticky") {

              return (

                <g key={ann.id}>

                  <rect

                    x={d.x as number}

                    y={d.y as number}

                    width={(d.w as number) ?? 120}

                    height={(d.h as number) ?? 70}

                    fill="#fef08a"

                    stroke="#ca8a04"

                    rx={4}

                  />

                  <text

                    x={(d.x as number) + 6}

                    y={(d.y as number) + 18}

                    fontSize={11}

                    fill="#422006"

                  >

                    {(ann.body ?? "").slice(0, 80)}

                  </text>

                </g>

              );

            }

            return null;

          })}



          {drawing.length > 1 ? (

            <path

              d={pointsToPath(drawing)}

              fill="none"

              stroke={toolColor(tool)}

              strokeWidth={toolStrokeWidth(tool)}

              strokeLinecap="round"

              opacity={tool === "highlighter" ? 0.35 : 1}

            />

          ) : null}

          {shapeStart && shapeEnd ? (

            <line

              x1={shapeStart[0]}

              y1={shapeStart[1]}

              x2={shapeEnd[0]}

              y2={shapeEnd[1]}

              stroke={toolColor(tool)}

              strokeWidth={toolStrokeWidth(tool)}

              strokeDasharray="4 2"

            />

          ) : null}

        </svg>



        <ReviewCursorOverlay peers={peers} pageIndex={pageIndex} />



        {pageAnnotations

          .filter((a) => a.type === "margin" && a.body)

          .map((ann) => (

            <div

              key={ann.id}

              className="absolute -right-[180px] w-[160px] rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] text-red-900 shadow"

              style={{ top: 48 + ((ann.data?.lineLocal as number) ?? 0) * 19.2 }}

            >

              {ann.body}

            </div>

          ))}

      </div>

    </div>

  );

}


