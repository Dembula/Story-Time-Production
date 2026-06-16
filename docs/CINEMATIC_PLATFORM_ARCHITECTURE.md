# Storytime Cinematic Platform Architecture

Production architecture for motion, playback, predictive loading, and AI intelligence — designed to scale horizontally without rewriting consumer surfaces.

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│  Experience (Next.js App Router)                            │
│  browse/template · content-row · storytime-media-player     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Motion + Prefetch (client)                                 │
│  src/lib/motion · src/lib/prefetch · src/components/motion  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Playback domain                                            │
│  src/lib/playback · playback-bundle API · Vidstack HLS      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Intelligence domain                                        │
│  src/lib/ai-metadata · src/lib/discovery · src/lib/thumbnails│
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Data (Postgres / Neon)                                     │
│  Content · ContentEnrichment · ContentScene · ContentSubtitle│
└─────────────────────────────────────────────────────────────┘
```

## 1. Ultra-premium motion system

**Location:** `src/lib/motion/`, `src/components/motion/`

| Module | Role |
|--------|------|
| `tokens.ts` | Single timing language (durations, springs, easings, depth) |
| `presets.ts` | Page enter, stagger, hover physics, modal — **transform + opacity only** |
| `intensity.ts` | Maps device class + `prefers-reduced-motion` → minimal/standard/rich |
| `motion-provider.tsx` | Context for intensity |
| `cinematic-route.tsx` | Browse `template.tsx` page transitions |
| `stagger-reveal.tsx` | Row reveals with viewport intersection |
| `hover-physics.tsx` | Reusable hover lift wrapper |

**UX impact:** Perceived performance improves because motion communicates state instead of blocking interaction.

**Performance:** GPU layers via `transform`/`opacity`; reduced motion path disables animation cost.

**Extensibility:** Add route-specific presets (watch enter fullscreen) without touching components.

## 2. Predictive loading engine

**Location:** `src/lib/prefetch/engine.ts`, `src/hooks/use-content-prefetch.ts`

On card hover (before click):

1. Next.js route prefetch (detail + watch)
2. HLS manifest warm (`link rel=prefetch` + low-priority fetch)
3. Poster/thumbnail decode
4. `/api/content/[id]/playback-bundle` metadata

**Scalability:** In-memory dedupe sets; move to Redis edge cache for multi-region later.

**UX impact:** Watch page feels instant; metadata panel populates without secondary spinner.

## 3. Advanced playback experience

**Location:** `src/components/player/storytime-media-player.tsx`

| Feature | Implementation |
|---------|----------------|
| Instant resume | Existing `WatchProgress` + `startTime` |
| Ambient UI fade | Idle timer hides chrome (immersion) |
| Skip intro | First 90s heuristic (configurable per title later) |
| PiP | `document.pictureInPicture` |
| Scene metadata overlay | `PlaybackMetadataPanel` + enrichment scenes |
| Seamless next | Auto-navigate on `onEnd` + prefetch next bundle |
| Mini player shell | `usePlaybackSession` + `MiniPlayer` (expand to floating video) |
| Signed playback resilience | Playback bundle refreshes periodically for long sessions |
| Capture-safe overlays | Badge + forensic watermark on protected sessions |
| Subtitle baseline | VTT tracks from bundle are mounted in main player |

**Future:** Recap skip via scene tags; hover scrub previews via sprite sheets from Stream.

## 4. AI metadata intelligence

**Location:** `src/lib/ai-metadata/`, `POST /api/content/[id]/enrichment`

**Pipeline:**

1. Creator/admin triggers enrichment (or worker on publish — add queue next)
2. OpenAI structured JSON → mood, scenes, dialogue index
3. Embedding via `text-embedding-3-small` stored in `ContentEnrichment.embedding`
4. Scenes persisted to `ContentScene` for jump-to-scene UI

**Scalability path:**

- Phase 1 (now): synchronous API + JSON embeddings in Postgres
- Phase 2: BullMQ/SQS worker + `pgvector` column + HNSW index
- Phase 3: Dedicated vector store (Pinecone/Weaviate) at 100k+ titles

**Requires:** `OPENAI_API_KEY` on server.

## 5. Semantic discovery

**Location:** `src/lib/discovery/semantic-search.ts`, `GET /api/browse/semantic-search`

Hybrid ranking:

- 75% cosine similarity (query embedding vs catalogue embedding)
- 25% lexical fallback via existing `rankSearchResults`

Browse search uses semantic endpoint automatically for queries with **3+ words** (natural language intent).

**Future:** Mood clustering, taste vectors per `ViewerProfile`, pgvector ANN.

## 6. Thumbnail & preview engine

**Location:** `src/lib/thumbnails/engine.ts`

Ranks poster, Stream still, GIF preview, scene stills by engagement score.

Integrated with `getDisplayPosterUrl`; extend with A/B `ThumbnailExperiment` table for CTR analytics.

## 7. Subtitles

**Location:** `src/lib/subtitles/vtt.ts`, `ContentSubtitle` model

VTT parser ready for in-player overlay; bundle API returns subtitle tracks.

**Next:** Upload pipeline for VTT, player track switcher, subtitle search index.

## 8. Database migration

```bash
npx prisma migrate deploy
```

Migration: `20260526180000_content_intelligence`

## 9. Operational checklist

```bash
npm run typecheck
npm run build
npm run health:platform
OPENAI_API_KEY=... npx tsx -e "import { enrichContentById } from './src/lib/ai-metadata/enrich-content'; enrichContentById('CONTENT_ID')"
```

## 10. What remains for “massive scale”

These are **architected but not fully built** (require infra beyond app code):

- Edge CDN adaptive ladder / multi-bitrate switching UI
- Full DRM lifecycle (license + cert + encrypted packaging) for Widevine/FairPlay/PlayReady
- DRM-compatible offline licenses (not clear MP4 cache)
- Live streaming
- Dedicated GPU workers for frame-level actor detection
- Vector DB at billion-scale
- TV native apps

The current codebase provides **modular seams** so each can plug in without rewriting browse or player surfaces.

## 11. Cross-platform compatibility checklist (current + required next)

### Implemented now

- HLS primary playback with signed URL support.
- DASH-capable source typing with device-aware fallback selection.
- Signed-manifest aware prefetch path (uses playback bundle source).
- Client-side refresh loop for expiring signed playback tokens.
- Subtitle tracks attached in the primary player path.
- Capture protection overlays wired into production player chrome.

### Still required for Netflix/Amazon-grade parity

- Native Apple FairPlay certificate/SPC/CKC flow for Safari/iOS (hardware path).
- End-to-end encrypted packaging and key rotation (CMAF/HLS/DASH DRM).
- Multi-audio track packaging and player language selection.
- Real quality/rendition controls and QoE telemetry (startup time, rebuffer ratio).
- Durable ingest/transcode orchestration (queue + retries + dead-letter handling).
- Studio-grade asset QC before publish (codec, loudness, black frame, corruption checks).
