/**
 * Scenario tests for the auto-build pipeline.
 *
 * Per Software Factory principles, these are full user-journey tests:
 * each scenario exercises the entire executeGraph() function with
 * mocked Claude API and Cloudflare API responses.
 *
 * No narrow unit tests — every test validates a complete multi-step workflow
 * checking concrete field values and call arguments.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { SessionContext, GraphResult, EdgeLabel } from "@/lib/graph-types";
import type { ProjectIntakeData } from "@/lib/intake-types";
import { createSession } from "@/lib/graph-state";
import { executeGraph, type GraphEnv } from "@/lib/graph-executor";

/* ─── Module Mocks ─── */

// vi.hoisted ensures mockDeployToCloudflare is available when vi.mock is hoisted
const { mockDeployToCloudflare } = vi.hoisted(() => ({
  mockDeployToCloudflare: vi.fn(),
}));

vi.mock("@/lib/cloudflare-deploy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cloudflare-deploy")>();
  return {
    ...actual,
    deployToCloudflare: mockDeployToCloudflare,
  };
});

/* ─── Test Fixtures ─── */

function makeIntakeData(overrides?: Partial<ProjectIntakeData>): ProjectIntakeData {
  return {
    business: {
      businessName: "Sunrise Bakery",
      businessType: "Restaurant",
      industry: "Food & Beverage",
      website: "",
      ...overrides?.business,
    },
    project: {
      description: "We are a family-owned bakery in Brooklyn specializing in artisan sourdough bread and pastries.",
      goals: "Get more local customers to visit our shop and order online for pickup.",
      callToAction: "Order Fresh Bread Today",
      content: "We want to showcase our daily specials and seasonal items.",
      imageNotes: "Warm, rustic photography of bread and pastries.",
      ...overrides?.project,
    },
    style: {
      stylePreset: "warm",
      primaryColor: "#F07D2E",
      secondaryColor: "#FFB347",
      styleNotes: "",
      inspirationUrls: "",
      ...overrides?.style,
    },
    contact: {
      name: "Maria Santos",
      email: "maria@sunrisebakery.com",
      phone: "718-555-0123",
      preferredContact: "email",
      additionalNotes: "",
      ...overrides?.contact,
    },
  } as ProjectIntakeData;
}

function makeContext(overrides?: Partial<SessionContext>): SessionContext {
  return {
    intakeData: makeIntakeData(),
    plainText: "Sunrise Bakery — Family-owned bakery in Brooklyn...",
    generateAttempts: 0,
    iterationCount: 0,
    ...overrides,
  };
}

function makeEnv(overrides?: Partial<GraphEnv>): GraphEnv {
  return {
    ANTHROPIC_API_KEY: "test-api-key",
    CLOUDFLARE_API_TOKEN: "test-cf-token",
    CLOUDFLARE_ACCOUNT_ID: "test-cf-account",
    ...overrides,
  };
}

/* ─── Mock Claude Responses ─── */

const ASSESS_RESPONSE = JSON.stringify({
  qualityScore: 8,
  missingElements: [],
  qualityNotes: "Strong brief with clear CTA and business description.",
  edge: "proceed",
});

const GENERATE_RESPONSE = JSON.stringify({
  refinedBrief: "Sunrise Bakery is a beloved family-owned artisan bakery in the heart of Brooklyn...",
  siteSpec: {
    headline: "Brooklyn's Finest Artisan Sourdough",
    subheadline: "Family-baked since 2015. Fresh bread, pastries, and seasonal specials daily.",
    seoDescription: "Sunrise Bakery Brooklyn — artisan sourdough, pastries, and seasonal specials. Order for pickup today.",
    sections: [
      { sectionName: "Hero", purpose: "Hook visitors with the bakery's warmth", suggestedContent: "Hero image of fresh bread..." },
      { sectionName: "About", purpose: "Tell the family story", suggestedContent: "The Santos family has been baking..." },
      { sectionName: "Menu", purpose: "Showcase daily offerings", suggestedContent: "Our daily bread selection includes..." },
      { sectionName: "Specials", purpose: "Highlight seasonal items", suggestedContent: "This season we're featuring..." },
      { sectionName: "Contact", purpose: "Drive visits and orders", suggestedContent: "Visit us at 123 Main St, Brooklyn..." },
    ],
  },
  edge: "generated",
});

const VALIDATE_PASS_RESPONSE = JSON.stringify({
  scores: { clarity: 9, completeness: 8, ctaStrength: 8, sectionFlow: 8 },
  overallScore: 8.25,
  critique: "Strong specification with clear messaging.",
  suggestions: [],
  edge: "passes",
});

const VALIDATE_FAIL_RESPONSE = JSON.stringify({
  scores: { clarity: 5, completeness: 4, ctaStrength: 3, sectionFlow: 4 },
  overallScore: 4.0,
  critique: "CTA is vague and sections lack specificity.",
  suggestions: ["Make CTA more specific", "Add testimonials section"],
  edge: "needs_revision",
});

const BUILD_RESPONSE = JSON.stringify({
  html: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Sunrise Bakery</title></head><body><h1>Brooklyn\'s Finest</h1></body></html>',
  buildNotes: "Used warm color palette with system fonts for fast loading.",
  edge: "built",
});

const BUILD_VALIDATE_PASS_RESPONSE = JSON.stringify({
  scores: { structuralIntegrity: 9, responsiveness: 8, accessibility: 7, brandAlignment: 8 },
  overallScore: 8.0,
  issues: [],
  edge: "html_passes",
});

const BUILD_VALIDATE_FAIL_RESPONSE = JSON.stringify({
  scores: { structuralIntegrity: 5, responsiveness: 4, accessibility: 4, brandAlignment: 5 },
  overallScore: 4.5,
  issues: ["Missing viewport meta tag", "No responsive CSS", "Poor color contrast"],
  edge: "html_fails",
});

/* ─── Mock Setup ─── */

// Mock fetch globally
const mockFetch = vi.fn() as Mock;

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
  mockDeployToCloudflare.mockReset();
  global.fetch = mockFetch;

  // Default: Cloudflare deploy succeeds
  mockDeployToCloudflare.mockResolvedValue({
    projectName: "sunrise-bakery",
    deploymentUrl: "https://sunrise-bakery.pages.dev",
    deploymentId: "deploy-123",
  });
});

/**
 * Configure fetch mock to return specific Claude responses in order,
 * and handle Cloudflare API calls.
 */
function setupMocks(options: {
  claudeResponses: string[];
  cfDeployFails?: boolean;
  resendStatus?: number;
}) {
  let claudeCallIndex = 0;

  // Override Cloudflare deploy mock if test needs failure
  if (options.cfDeployFails) {
    mockDeployToCloudflare.mockRejectedValue(new Error("Wrangler deploy failed: simulated error"));
  }

  mockFetch.mockImplementation(async (url: string) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    // Anthropic API
    if (urlStr.includes("anthropic.com")) {
      const response = options.claudeResponses[claudeCallIndex] ?? '{}';
      claudeCallIndex++;
      return {
        ok: true,
        json: async () => ({ content: [{ type: "text", text: response }] }),
        text: async () => response,
      };
    }

    // Resend
    if (urlStr.includes("resend.com")) {
      const status = options.resendStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        json: async () => ({ id: "email-123" }),
        text: async () => "OK",
      };
    }

    throw new Error(`Unmocked fetch: ${urlStr}`);
  });
}

/* ─── Helper ─── */

function getEdges(result: GraphResult): EdgeLabel[] {
  return result.history.map((t) => t.edge);
}

/* ─── Scenario Tests ─── */

describe("Auto-Build Pipeline", () => {

  // Scenario 1: Happy path — full auto-build and deploy
  it("should build, validate HTML, deploy to Cloudflare, and deliver with live URL", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_PASS_RESPONSE,
        BUILD_RESPONSE,
        BUILD_VALIDATE_PASS_RESPONSE,
      ],
    });

    const state = createSession("test-session-1", makeContext());
    const env = makeEnv();
    const result = await executeGraph(state, env);

    // Pipeline completed
    expect(result.status).toBe("completed");

    // Site was deployed
    expect(result.siteUrl).toBe("https://sunrise-bakery.pages.dev");

    // All transitions fired
    const edges = getEdges(result);
    expect(edges).toEqual([
      "proceed",      // assess → generate
      "generated",    // generate → validate
      "passes",       // validate → sanity_check
      "auto_build",   // sanity_check → build
      "built",        // build → build_validate
      "html_passes",  // build_validate → deploy
      "deployed",     // deploy → deliver
      "done",         // deliver → terminal
    ]);

    // Enhancement is present
    expect(result.enhancement?.siteSpec.headline).toBe("Brooklyn's Finest Artisan Sourdough");
  });

  // Scenario 2: Sanity check fails — not enough sections
  it("should fall back to email-only when siteSpec has fewer than 3 sections", async () => {
    const sparseGenerate = JSON.stringify({
      refinedBrief: "A brief.",
      siteSpec: {
        headline: "Test",
        subheadline: "Test sub",
        seoDescription: "Test seo",
        sections: [
          { sectionName: "Hero", purpose: "hook", suggestedContent: "content" },
          { sectionName: "Contact", purpose: "action", suggestedContent: "content" },
        ],
      },
      edge: "generated",
    });

    setupMocks({
      claudeResponses: [ASSESS_RESPONSE, sparseGenerate, VALIDATE_PASS_RESPONSE],
    });

    const state = createSession("test-session-2", makeContext());
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBeUndefined();

    const edges = getEdges(result);
    expect(edges).toContain("skip_build");
    expect(edges).not.toContain("auto_build");
  });

  // Scenario 3: Low validation score — fails sanity check
  it("should skip auto-build when validation score is below threshold after max retries", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_FAIL_RESPONSE,   // first validate fails (score 4)
        GENERATE_RESPONSE,        // retry generate
        VALIDATE_FAIL_RESPONSE,   // second validate fails (score 4) → max_retries
      ],
    });

    const state = createSession("test-session-3", makeContext());
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBeUndefined();

    const edges = getEdges(result);
    expect(edges).toContain("needs_revision");
    expect(edges).toContain("max_retries");
    expect(edges).toContain("skip_build");
  });

  // Scenario 4: Build node fails (Claude API error)
  it("should gracefully degrade to email-only when build node throws", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("anthropic.com")) {
        callCount++;
        // Fail on the 4th Claude call (build node)
        if (callCount === 4) {
          return { ok: false, status: 500, text: async () => "Internal Server Error" };
        }
        const responses = [ASSESS_RESPONSE, GENERATE_RESPONSE, VALIDATE_PASS_RESPONSE];
        return {
          ok: true,
          json: async () => ({ content: [{ type: "text", text: responses[callCount - 1] }] }),
        };
      }
      if (urlStr.includes("resend.com")) {
        return { ok: true, json: async () => ({ id: "email-123" }), text: async () => "OK" };
      }
      return { ok: true, json: async () => ({}), text: async () => "OK" };
    });

    const state = createSession("test-session-4", makeContext());
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBeUndefined();

    const edges = getEdges(result);
    expect(edges).toContain("build_failed");
  });

  // Scenario 5: Build validate fails (HTML quality too low)
  it("should skip deployment when generated HTML scores below threshold", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_PASS_RESPONSE,
        BUILD_RESPONSE,
        BUILD_VALIDATE_FAIL_RESPONSE,
      ],
    });

    const state = createSession("test-session-5", makeContext());
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBeUndefined();

    const edges = getEdges(result);
    expect(edges).toContain("html_fails");
    expect(edges).not.toContain("deployed");
  });

  // Scenario 6: Cloudflare deploy fails
  it("should deliver email-only when Cloudflare API returns error", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_PASS_RESPONSE,
        BUILD_RESPONSE,
        BUILD_VALIDATE_PASS_RESPONSE,
      ],
      cfDeployFails: true,
    });

    const state = createSession("test-session-6", makeContext());
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBeUndefined();

    const edges = getEdges(result);
    expect(edges).toContain("deploy_failed");
  });

  // Scenario 7: Cloudflare env vars not configured
  it("should skip deployment when CLOUDFLARE_API_TOKEN is not set", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_PASS_RESPONSE,
        BUILD_RESPONSE,
        BUILD_VALIDATE_PASS_RESPONSE,
      ],
    });

    const state = createSession("test-session-7", makeContext());
    const env = makeEnv({ CLOUDFLARE_API_TOKEN: undefined, CLOUDFLARE_ACCOUNT_ID: undefined });
    const result = await executeGraph(state, env);

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBeUndefined();

    const edges = getEdges(result);
    expect(edges).toContain("deploy_failed");
  });

  // Scenario 8: Custom colors with full pipeline
  it("should build with custom colors when stylePreset is custom", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_PASS_RESPONSE,
        BUILD_RESPONSE,
        BUILD_VALIDATE_PASS_RESPONSE,
      ],
    });

    const context = makeContext({
      intakeData: makeIntakeData({
        style: {
          stylePreset: "custom",
          primaryColor: "#FF5500",
          secondaryColor: "#0055FF",
          styleNotes: "Bold and vibrant",
          inspirationUrls: "",
        },
      } as Partial<ProjectIntakeData>),
    });

    const state = createSession("test-session-8", context);
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBe("https://sunrise-bakery.pages.dev");

    // Verify the build prompt included custom colors
    const buildCall = mockFetch.mock.calls.find(
      (call: [string, RequestInit]) =>
        call[0].includes("anthropic.com") &&
        JSON.parse(call[1].body as string).messages[0].content.includes("#FF5500"),
    );
    expect(buildCall).toBeDefined();
  });

  // Scenario 9: Generate retry then successful build
  it("should retry generate on validation failure then proceed through full build pipeline", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_FAIL_RESPONSE,   // first validate fails
        GENERATE_RESPONSE,        // retry
        VALIDATE_PASS_RESPONSE,   // second validate passes
        BUILD_RESPONSE,
        BUILD_VALIDATE_PASS_RESPONSE,
      ],
    });

    const state = createSession("test-session-9", makeContext());
    const result = await executeGraph(state, makeEnv());

    expect(result.status).toBe("completed");
    expect(result.siteUrl).toBe("https://sunrise-bakery.pages.dev");

    const edges = getEdges(result);
    expect(edges).toContain("needs_revision");
    expect(edges).toContain("auto_build");
    expect(edges).toContain("deployed");
  });

  // Scenario 10: Per-node model routing sends correct models
  it("should route each node to the correct Claude model (Haiku/Sonnet/Opus)", async () => {
    setupMocks({
      claudeResponses: [
        ASSESS_RESPONSE,
        GENERATE_RESPONSE,
        VALIDATE_PASS_RESPONSE,
        BUILD_RESPONSE,
        BUILD_VALIDATE_PASS_RESPONSE,
      ],
    });

    const state = createSession("test-session-10", makeContext());
    const result = await executeGraph(state, makeEnv());
    expect(result.status).toBe("completed");

    // Extract all Claude API calls and the model used for each
    const claudeCalls = mockFetch.mock.calls
      .filter((call: [string, RequestInit]) => call[0].includes("anthropic.com"))
      .map((call: [string, RequestInit]) => JSON.parse(call[1].body as string).model);

    // Verify per-node model routing:
    // assess → Haiku, generate → Sonnet, validate → Haiku, build → Opus, build_validate → Haiku
    expect(claudeCalls).toEqual([
      "claude-haiku-4-5-20251001",     // assess
      "claude-sonnet-4-20250514",    // generate
      "claude-haiku-4-5-20251001",     // validate
      "claude-sonnet-4-20250514",    // build (Sonnet for speed — must fit 60s Vercel timeout)
      "claude-haiku-4-5-20251001",     // build_validate
    ]);
  });
});

describe("Slug Generation", () => {
  it("should create valid Cloudflare project names from business names", async () => {
    // Import directly to test the pure function
    const { slugifyProjectName } = await import("@/lib/cloudflare-deploy");

    expect(slugifyProjectName("Sunrise Bakery")).toBe("sunrise-bakery");
    expect(slugifyProjectName("Sunrise Bakery & Cafe")).toBe("sunrise-bakery-cafe");
    expect(slugifyProjectName("José's Tacos")).toBe("jos-s-tacos");
    expect(slugifyProjectName("  --Leading Hyphens-- ")).toBe("leading-hyphens");
    expect(slugifyProjectName("")).toBe("site");
    expect(slugifyProjectName("A".repeat(100))).toHaveLength(58);
    expect(slugifyProjectName("123 Main Street Auto")).toBe("123-main-street-auto");
  });
});
