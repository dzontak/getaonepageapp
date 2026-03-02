# getAOnePageApp — Technical Specification

> AI-powered one-page website generation platform. Transforms a client intake form into a live `.pages.dev` site in under 60 seconds.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Graph Topology](#graph-topology)
3. [Node Reference](#node-reference)
4. [Model Routing](#model-routing)
5. [Cloudflare Deployment](#cloudflare-deployment)
6. [Email Delivery](#email-delivery)
7. [Credit System](#credit-system)
8. [State Persistence](#state-persistence)
9. [API Routes](#api-routes)
10. [Design System](#design-system)
11. [Graceful Degradation](#graceful-degradation)
12. [Environment Variables](#environment-variables)
13. [File Map](#file-map)
14. [Testing](#testing)
15. [Timing Budget](#timing-budget)

---

## System Overview

getAOnePageApp runs an 8-node AI pipeline (the **Attractor** execution engine) that:

1. **Assesses** a client's intake brief for completeness
2. **Generates** a polished brief + site specification
3. **Validates** the spec against a quality rubric (with one retry)
4. **Sanity-checks** whether the submission qualifies for auto-build
5. **Builds** a complete single-file HTML+CSS page via Claude
6. **Validates the HTML** for structural integrity, responsiveness, accessibility
7. **Deploys** the page to Cloudflare Pages via Wrangler CLI
8. **Delivers** email notifications to the team and client

If any auto-build node fails, the pipeline falls back to email-only delivery. The customer lead is never lost.

### Execution Properties

| Property | Implementation |
|---|---|
| **Deterministic** | Same inputs produce the same graph traversal |
| **Observable** | Every transition logged with timestamp + duration in `history[]` |
| **Resumable** | State persisted to KV after every node transition |
| **Composable** | `executeGraph()` is a pure async function, embeddable in larger graphs |

---

## Graph Topology

```
assess → generate → validate → sanity_check → build → build_validate → deploy → deliver
               ↑         │           │                      │               │
               └─────────┘           │                      │               │
              (needs_revision,       │ (skip_build)         │ (html_fails)  │ (deploy_failed)
               attempts < 2)        └──────────────────────┴───────────────→ deliver (email-only)
```

### Edge Labels

| Edge | From → To | Condition |
|---|---|---|
| `proceed` | assess → generate | Always |
| `generated` | generate → validate | Always |
| `passes` | validate → sanity_check | `overallScore >= 7` |
| `needs_revision` | validate → generate | `overallScore < 7` and `attempts < 2` |
| `max_retries` | validate → sanity_check | `overallScore < 7` and `attempts >= 2` |
| `auto_build` | sanity_check → build | All criteria met |
| `skip_build` | sanity_check → deliver | Any criterion fails |
| `built` | build → build_validate | HTML generated successfully |
| `build_failed` | build → deliver | Claude API error (graceful fallback) |
| `html_passes` | build_validate → deploy | `overallScore >= 7` |
| `html_fails` | build_validate → deliver | `overallScore < 7` |
| `deployed` | deploy → deliver | Wrangler succeeded |
| `deploy_failed` | deploy → deliver | Wrangler error or missing env vars |
| `done` | deliver → (terminal) | Always |

---

## Node Reference

### assess (LLM — Haiku)

Evaluates the intake brief against a 5-point checklist:

- Clear call-to-action
- Business description
- Target audience indication
- Services/products mentioned
- Contact information provided

**Output:** `AssessOutput { qualityScore: 1-10, missingElements[], qualityNotes, edge: "proceed" }`

Always routes forward — assessment is advisory, not gating.

### generate (LLM — Sonnet)

Produces a refined brief and complete site specification:

- Polished copy with marketing tone
- 4–7 site sections (hero → trust → offer → proof → action)
- Each section includes `sectionName`, `purpose`, `suggestedContent`
- Headline, subheadline, SEO description
- Incorporates assessment feedback and retry context if applicable

**Output:** `GenerateOutput { refinedBrief, siteSpec: { headline, subheadline, seoDescription, sections[] }, edge: "generated" }`

### validate (LLM — Haiku)

Scores the generated spec on four dimensions (each 1–10):

| Dimension | What it measures |
|---|---|
| `clarity` | Language precision, no jargon |
| `completeness` | All sections substantive |
| `ctaStrength` | CTA is specific and compelling |
| `sectionFlow` | Logical narrative progression |

**Routing logic:**
- `overallScore >= 7` → sanity_check (`passes`)
- `overallScore < 7` and `generateAttempts < 2` → generate (`needs_revision`)
- `overallScore < 7` and `generateAttempts >= 2` → sanity_check (`max_retries`)

**Output:** `ValidateOutput { scores, overallScore, critique, suggestions[], edge }`

### sanity_check (Procedural — no LLM)

Gates the auto-build pipeline. Checks:

- Site spec has >= 3 sections with headline + subheadline
- Validation score >= 6
- Recognized style preset (warm, cool, bold, earth, minimal) or valid custom hex colors
- Business name present (used for Cloudflare project slug)

**Output:** `SanityCheckOutput { qualifies: boolean, reasons[], edge: "auto_build" | "skip_build" }`

### build (LLM — Sonnet)

Generates a complete single-file HTML+CSS page. The prompt specifies:

- `<!DOCTYPE html>` with embedded `<style>` tag (no external dependencies)
- Responsive mobile-first design with CSS custom properties
- Semantic HTML5 (`header`, `nav`, `main`, `section`, `footer`)
- Sticky navigation with smooth-scroll anchors
- Prominent CTA button
- Meta tags (charset, viewport, og:title, og:description)
- System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`)
- Color palette from style preferences via `resolveColors()`
- All sections from siteSpec rendered as `<section>` elements

**Token limit:** 8,192 (`BUILD_MAX_TOKENS`)

**Output:** `BuildOutput { html, buildNotes, edge: "built" }`

On error: falls back to deliver with `edge: "build_failed"`.

### build_validate (LLM — Haiku)

QA review of the generated HTML, scoring four dimensions (each 1–10):

| Dimension | What it measures |
|---|---|
| `structuralIntegrity` | Valid HTML, no broken tags, proper nesting |
| `responsiveness` | Mobile-friendly CSS, media queries |
| `accessibility` | Semantic HTML, ARIA where needed, contrast |
| `brandAlignment` | Colors match spec, all sections present |

**Routing:** `overallScore >= 7` → deploy, otherwise → deliver (email-only, no retry).

**Output:** `BuildValidateOutput { scores, overallScore, issues[], edge }`

### deploy (Wrangler CLI)

Deploys the HTML to Cloudflare Pages:

1. Slugify business name → project name (lowercase, alphanumeric + hyphens, max 58 chars)
2. Write `index.html` to a temp directory
3. Run `npx wrangler pages deploy <dir> --project-name=<slug> --branch=main --commit-dirty=true`
4. Parse deployment URL from stdout
5. Clean up temp directory

Credentials passed via environment variables (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), never CLI args.

**Output:** `DeployOutput { projectName, deploymentUrl, deploymentId, edge: "deployed" }`

On error or missing env vars: falls back to deliver with `edge: "deploy_failed"`.

### deliver (Procedural — no LLM)

Terminal node. Handles:

- **Credit management** — first submission free, revisions cost 1 credit
- **Team email** — internal notification with business details, spec, validation scores, auto-build badge if deployed
- **Client email** — confirmation with refined brief, live site link (or Stripe checkout link), remaining credits
- **Subject lines** — change based on auto-build status:
  - Auto-built: `"Your site for {name} is live!"`
  - Email-only: `"Your Zontak brief for {name} is ready"`

**Output:** `DeliverOutput { teamEmailSent, clientEmailSent, creditsRemaining, siteUrl?, edge: "done" }`

---

## Model Routing

Each graph node is statically classified using a 5-dimension scoring framework (the **ZONTAK.AI Classifier**):

| Dimension | What it measures |
|---|---|
| `complexity` | Cognitive load of the task |
| `reasoning_depth` | Multi-step reasoning required |
| `domain_specificity` | Specialized knowledge needed |
| `ambiguity` | Input interpretation difficulty |
| `stakes` | Impact of error on end user |

Scoring rules:
- Average 1.0–2.0 → **Haiku** (fast, cheap)
- Average 2.1–3.5 → **Sonnet** (balanced)
- Average 3.6–5.0 → **Opus** (high-complexity)
- Any single dimension = 5 → upgrade one tier

### Per-Node Assignments

| Node | Model | Avg Score | Rationale |
|---|---|---|---|
| assess | `claude-haiku-4-5-20251001` | 1.6 | Checklist evaluation, advisory only |
| generate | `claude-sonnet-4-20250514` | 3.2 | Creative writing + gap-filling, customer-facing |
| validate | `claude-haiku-4-5-20251001` | 2.2 | Structured rubric scoring, retry limits damage |
| build | `claude-sonnet-4-20250514` | 4.2 | Highest-stakes node (ships to production), but Opus exceeds 60s timeout |
| build_validate | `claude-haiku-4-5-20251001` | 2.8 | Concrete HTML review, explicit rubric, fallback mitigates risk |

The `build` node would classify as Opus (avg 4.2, stakes=5) but is downgraded to Sonnet because Opus took 72s in production — over Vercel's 60s timeout. The `build_validate` gate + email-only fallback mitigate the quality risk.

---

## Cloudflare Deployment

### Why Wrangler over the REST API

The Cloudflare Pages Direct Upload REST API has an undocumented multi-step flow (upload session → file upload → completion token → deployment) that differs from a simple multipart POST. In testing, the REST API reported successful deployment but the site returned 500 errors. Wrangler CLI abstracts the upload lifecycle correctly and is the Cloudflare-recommended approach.

### Deployment Flow

```
slugifyProjectName("Sunrise Bakery") → "sunrise-bakery"
                    ↓
mkdtemp("/tmp/cf-deploy-XXXXXX")
                    ↓
writeFile("/tmp/cf-deploy-XXXXXX/index.html", html)
                    ↓
execFile("npx", ["wrangler", "pages", "deploy", tmpDir,
  "--project-name=sunrise-bakery", "--branch=main", "--commit-dirty=true"])
                    ↓
Parse stdout: "https://abc123.sunrise-bakery.pages.dev"
                    ↓
Return: { projectName: "sunrise-bakery",
          deploymentUrl: "https://sunrise-bakery.pages.dev",
          deploymentId: "abc123" }
                    ↓
rm(tmpDir, { recursive: true })
```

**Timeout:** 30 seconds for the wrangler command.

### Slug Rules

- Lowercase
- Non-alphanumeric runs replaced with single hyphen
- Leading/trailing hyphens trimmed
- Max 58 characters
- Fallback to `"site"` if empty after processing

---

## Email Delivery

Emails sent via [Resend](https://resend.com) API. Both emails fire in parallel via `Promise.allSettled` — a failure in one doesn't block the other.

### Team Email

Dark-themed HTML with:
- Business details (name, type, industry, website)
- Project description and goals
- Contact information
- Validation scores (color-coded chips: green >= 7, yellow >= 5, red < 5)
- Refined brief
- Proposed site spec with section breakdown
- **Auto-Build badge** with live site link (when deployed)

### Client Email

Professional confirmation with:
- Personalized greeting
- **Live site link** with "View Your Live Site" CTA button (when deployed)
- Stripe checkout CTA ($100/year subscription)
- Refined brief and proposed spec
- Remaining revision credits

---

## Credit System

| Event | Credits |
|---|---|
| Account creation | 3 credits (included with $100/year subscription) |
| First submission | Free (iterationCount = 0) |
| Each revision | 1 credit deducted |
| Exhausted | Warning logged, delivery proceeds (enforcement in V2) |

Credits stored permanently in KV at key `credits:{email}`.

---

## State Persistence

All state persisted to Vercel KV (Upstash Redis) after every node transition.

### KV Schema

| Key Pattern | Value | TTL |
|---|---|---|
| `session:{uuid}` | `ExecutionState` (full graph state + history) | 30 days |
| `credits:{email}` | `CreditRecord` (total, used, plan) | Permanent |

### ExecutionState Shape

```typescript
{
  sessionId: string;
  currentNode: NodeId;
  context: SessionContext;    // accumulated outputs from all nodes
  history: NodeTransition[];  // audit trail
  status: "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
}
```

---

## API Routes

### POST `/api/submit-intake`

Full pipeline execution.

**Request:**
```json
{
  "data": {
    "business": { "businessName": "...", "businessType": "...", "industry": "...", "website": "..." },
    "project": { "description": "...", "goals": "...", "callToAction": "...", "content": "...", "imageNotes": "..." },
    "style": { "stylePreset": "warm", "primaryColor": "", "secondaryColor": "", "styleNotes": "...", "inspirationUrls": [] },
    "contact": { "name": "...", "email": "...", "phone": "...", "preferredContact": "email", "additionalNotes": "" }
  },
  "plainText": "Full formatted brief text...",
  "iterationCount": 0
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "completed",
  "enhancement": { "refinedBrief": "...", "siteSpec": { ... } },
  "validationScore": 8.25,
  "creditsRemaining": 3,
  "siteUrl": "https://my-business.pages.dev",
  "history": [
    { "from": "assess", "to": "generate", "edge": "proceed", "timestamp": "...", "durationMs": 5200 },
    ...
  ]
}
```

**Max duration:** 60 seconds (Vercel Pro).

### POST `/api/refine-brief`

Quick AI polish for on-form preview. Single Claude call, no graph execution.

**Request:** `{ "brief": "plain text..." }`
**Response:** `{ "refinedBrief": "...", "siteSpec": { ... } }`
**Max duration:** 30 seconds.

---

## Design System

### Color Presets

| Preset | Primary | Secondary | Background |
|---|---|---|---|
| `warm` | `#F07D2E` | `#FFB347` | `#FFF8EE` |
| `cool` | `#3DA7DB` | `#5EC4F0` | `#F5F5F5` |
| `bold` | `#E53E3E` | `#1A1A2E` | `#FFFFFF` |
| `earth` | `#6B8E23` | `#8B7355` | `#FFF8DC` |
| `minimal` | `#333333` | `#666666` | `#FFFFFF` |

Custom hex values override presets when provided. Text color auto-derived from background luminance.

### Generated HTML Standards

- Single-file `index.html` with embedded `<style>` tag
- No external dependencies (CDNs, fonts, scripts)
- CSS custom properties for color system
- System font stack
- Mobile-first responsive design
- Semantic HTML5 structure
- Sticky navigation with smooth-scroll anchors
- `<meta>` tags: charset, viewport, og:title, og:description

---

## Graceful Degradation

The pipeline's core invariant: **never lose the lead**. Every auto-build node has a fallback path to email-only delivery.

| Failure Point | Fallback Behavior |
|---|---|
| assess fails | Pipeline aborts (502 error) |
| generate fails | Pipeline aborts (502 error) |
| validate fails | Pipeline aborts (502 error) |
| sanity_check: criteria not met | `skip_build` → email-only delivery |
| build: Claude API error | `build_failed` → email-only delivery |
| build_validate: score < 7 | `html_fails` → email-only delivery |
| build_validate: Claude error | `html_fails` → email-only delivery |
| deploy: Wrangler error | `deploy_failed` → email-only delivery |
| deploy: CF env vars missing | `deploy_failed` → email-only delivery |
| email send fails | Logged, delivery continues (partial success) |
| KV unavailable | Session not persisted, pipeline still completes |

---

## Environment Variables

### Required

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API authentication |

### Optional — Email Notifications

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend email service |
| `NOTIFY_EMAIL` | Team notification recipient |
| `FROM_EMAIL` | Verified sender address |

### Optional — Auto-Build + Deploy

| Variable | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (requires Pages:Edit scope) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

### Optional — Session Persistence

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Auto-set by Vercel Marketplace |
| `UPSTASH_REDIS_REST_TOKEN` | Auto-set by Vercel Marketplace |

---

## File Map

```
src/
├── app/
│   └── api/
│       ├── submit-intake/
│       │   └── route.ts          # POST — full pipeline execution
│       └── refine-brief/
│           └── route.ts          # POST — quick AI polish
├── lib/
│   ├── graph-types.ts            # NodeId, EdgeLabel, all output interfaces, SessionContext, ExecutionState
│   ├── graph-executor.ts         # executeGraph() — main orchestration engine
│   ├── graph-nodes.ts            # NODE_PROMPTS, parsers, evaluateSanityCheck(), GRAPH_EDGES
│   ├── graph-state.ts            # KV persistence (sessions + credits)
│   ├── model-router.ts           # Per-node model classification + routing
│   ├── cloudflare-deploy.ts      # Wrangler CLI deployment client
│   ├── site-builder.ts           # Color preset map + resolveColors()
│   ├── email-templates.ts        # Team + client HTML email generation
│   ├── intake-types.ts           # Shared domain types (BusinessInfo, SiteSpec, etc.)
│   └── __tests__/
│       └── auto-build-pipeline.test.ts  # 10 scenario tests for full pipeline
├── vitest.config.ts              # Test runner configuration
└── package.json
```

---

## Testing

Tests follow **Software Factory** principles: full user-journey scenarios, not isolated unit tests.

### Test Infrastructure

- **Runner:** Vitest 4.x with Node environment
- **Mocking:** `vi.fn()` for fetch (Claude API), `vi.mock()` for `cloudflare-deploy` module
- **Approach:** Each scenario sets up mock responses for the exact sequence of Claude calls, then asserts the full pipeline outcome

### Scenarios

| # | Scenario | Expected Outcome |
|---|---|---|
| 1 | Happy path (all nodes pass) | Site deployed, siteUrl in result, both emails sent |
| 2 | Sanity check fails (low validation score) | `skip_build`, email-only delivery |
| 3 | Build fails (Claude API error) | `build_failed`, graceful degradation to email-only |
| 4 | HTML validation fails (score < 7) | `html_fails`, email-only delivery |
| 5 | Deploy fails (Cloudflare error) | `deploy_failed`, email-only delivery |
| 6 | CF env vars missing | Skip deploy, email-only delivery |
| 7 | Custom colors (hex values) | Custom palette flows through build prompt |
| 8 | Generate retry + build | First validate < 7, retry succeeds, full pipeline |
| 9 | Slug generation edge cases | Special chars, empty string, long names |
| 10 | Model routing verification | Each node sends correct model ID to Claude API |

---

## Timing Budget

| Node | Estimated | Cumulative |
|---|---|---|
| assess (Haiku) | 3–5s | 3–5s |
| generate (Sonnet) | 5–8s | 8–13s |
| validate (Haiku) | 3–5s | 11–18s |
| sanity_check | ~1ms | 11–18s |
| build (Sonnet, 8K tokens) | 20–35s | 31–53s |
| build_validate (Haiku) | 3–5s | 34–58s |
| deploy (Wrangler) | 2–5s | 36–63s |
| deliver (emails) | 1–3s | **37–66s** |

Target: under 60s on Vercel Pro. Observed in production: **~55–90s** depending on build complexity. With one generate retry (~8–15s extra), worst case can exceed timeout — `MAX_GENERATE_ATTEMPTS` may need reduction to 1 when auto-build is enabled.

### Optimization Levers

1. Reduce `BUILD_MAX_TOKENS` (currently 8,192) — shorter HTML = faster generation
2. Reduce `MAX_GENERATE_ATTEMPTS` to 1 — skip retry loop
3. Use streaming for build node (not yet implemented)
4. Pre-warm Wrangler via `npx wrangler --version` at cold start

---

*Generated 2026-03-01. Pipeline version: 8-node with auto-build.*
