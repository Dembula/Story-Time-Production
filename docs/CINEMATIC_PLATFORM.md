# Cinematic Platform Architecture

Production architecture for Storytime’s premium viewer experience: motion, predictive loading, playback, AI metadata, and semantic discovery.

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation (Next.js App Router)                          │
│  motion/* · player/* · browse/template · content-row        │
├─────────────────────────────────────────────────────────────┤
│  Client orchestration                                       │
│  MotionProvider · prefetch engine · playback session store  │
├─────────────────────────────────────────────────────────────┤
│  API routes (typed, edge-cacheable where safe)              │
│  /api/content/[id]/playback-bundle                          │
│  /api/browse/semantic-search · /api/content/[id]/enrichment│
├─────────────────────────────────────────────────────────────┤
│  Domain services                                            │
│  lib/motion · lib/prefetch · lib/ai-metadata · lib/discovery│
│  lib/thumbnails · lib/subtitles · lib/playback              │
├─────────────────────────────────────────────────────────────┤
│  Data (Prisma / Neon)                                       │
│  Content · ContentEnrichment · ContentScene · ContentSubtitle│
└─────────────────────────────────────────────────────────────┘
```

## Folder structure

```
src/
  lib/
    motion/           # tokens, presets, intensity (GPU transform/opacity only)
    prefetch/         # hover preload, manifest warm, metadata cache
    playback/         # zustand session store (mini-player, ambient UI)
    ai-metadata/      # enrichment pipeline, embeddings, types
    discovery/        # semantic search, hybrid ranking
    thumbnails/       # artwork scoring & selection
    subtitles/        # VTT parse + cue lookup
  components/
    motion/           # MotionProvider, CinematicRoute, StaggerReveal, HoverPhysics
    player/           # StorytimeMediaPlayer, chrome, metadata panel, mini-player
  hooks/
    use-content-prefetch.ts
  app/
    browse/template.tsx          # route-level cinematic enter
    api/content/[id]/playback-bundle/
    api/content/[id]/enrichment/
    api/browse/semantic-search/
prisma/
  migrations/20260526180000_content_intelligence/
```

## Motion system

**Strategy:** Central tokens (`motionDurations`, `motionSprings`, `motionEasings`) and presets ensure one timing language. `MotionProvider` reads `prefers-reduced-motion` and `AdaptiveUiProvider` device class to scale intensity (`minimal | standard | rich`).

**Performance:** Animations use `transform` + `opacity` only (`willChange: transform`). No width/height animation. Page transitions via `browse/template.tsx`.

**UX:** Staggered reveals on rows; hover physics on catalogue cards; modal variants for metadata panel.

**Extensibility:** Add presets in `lib/motion/presets.ts`; route groups can wrap with `CinematicRoute`.

## Predictive loading

**Strategy:** On card hover, `prefetchOnContentHover` runs:

1. Next.js route prefetch (detail + watch)
2. Poster `Image()` warm
3. HLS manifest `<link rel=prefetch>` + low-priority fetch
4. `/api/content/[id]/playback-bundle` metadata

**Scalability:** In-memory dedupe sets; TTL on metadata (60s). Future: move to Redis edge cache keyed by `contentId`.

**UX:** Click-to-play feels instant when manifest + metadata already warmed.

## Playback experience

**StorytimeMediaPlayer** (Vidstack + HLS):

- Instant resume via `startTime` from `WatchProgress`
- Ambient UI fade after 3.2s idle
- Skip intro (first 90s heuristic; replace with scene metadata when available)
- Picture-in-picture
- Auto-advance to `nextEpisode` on end
- Scene intelligence panel (mood, atmosphere, jump-to-scene)
- Manifest prefetch for next episode

**State:** `usePlaybackSession` zustand store for mini-player shell (expandable to floating PiP chrome).

**Future:** Recap skip from `ContentScene` markers; hover scrub previews from scene thumbnails; adaptive quality via Vidstack quality API.

## AI metadata pipeline

**Models:** `ContentEnrichment`, `ContentScene`, `ContentSubtitle`.

**Flow:**

1. `POST /api/content/[id]/enrichment` (creator/admin) → `enrichContentById`
2. OpenAI JSON enrichment (mood, scenes, dialogue index)
3. `text-embedding-3-small` vector stored in `embedding` JSON column
4. Scenes persisted for playback overlay + thumbnail candidates

**Scalability:** Status field (`PENDING | PROCESSING | READY | FAILED`). Next step: queue worker (Inngest/BullMQ) triggered on publish webhook instead of sync POST.

**Future extensibility:** Swap embedder; add pgvector index on Neon; actor/soundtrack detectors as separate enricher modules under `lib/ai-metadata/enrichers/`.

## Semantic discovery

**Hybrid ranking:** Cosine similarity on query embedding vs catalogue embeddings (75%) + lexical boost (25%). Falls back to keyword search when `OPENAI_API_KEY` absent.

**Natural language:** Browse search uses semantic API when query ≥ 3 words.

**Personalization path:** Append viewer taste vector (mean of watched content embeddings) to query embedding.

## Thumbnail engine

`rankThumbnailCandidates` scores poster, Stream stills, GIF previews, scene stills. `selectBestThumbnail` used by browse/search APIs.

**Future:** A/B bucket per profile; CTR analytics table; personalized artwork selection.

## Subtitles

`parseVtt` + `findActiveCue` for overlay rendering. `ContentSubtitle` model + playback bundle exposes tracks.

**Next:** Burn-in customization (size, background), subtitle search index from `dialogueIndex`.

## Performance targets

| Area | Approach |
|------|----------|
| 60fps motion | transform/opacity only, reduced-motion path |
| Bundle | dynamic import player; lazy Modoc unchanged |
| SSR | browse `revalidate=60`; playback-bundle CDN cache |
| Hydration | motion gated client-side; skeletons on watch route |

## Deployment checklist

1. `npx prisma migrate deploy` (content intelligence tables)
2. Set `OPENAI_API_KEY` for semantic search + enrichment
3. Optional `OPENAI_ENRICHMENT_MODEL=gpt-4o-mini`
4. Run enrichment on published titles: `POST /api/content/{id}/enrichment`

## What is intentionally deferred (Phase 3+)

- Vector DB (Pinecone/pgvector index at scale)
- Dedicated media workers / queue
- DRM, offline, native TV apps
- Full actor/object CV pipelines (requires video analysis workers)
- Thumbnail CTR experimentation service

These layers are designed so each can plug in without rewriting presentation code.
