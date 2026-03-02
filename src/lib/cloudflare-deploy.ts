/**
 * Cloudflare Pages deployment via Wrangler CLI.
 *
 * Writes index.html to a temp directory and shells out to
 * `wrangler pages deploy` which handles the full upload lifecycle
 * (hashing, chunked upload, deployment promotion).
 *
 * Why Wrangler over the REST API:
 *   The Pages Direct Upload REST API has an undocumented multi-step flow
 *   (upload session → file upload → completion token → deployment) that differs
 *   from a simple multipart POST. Wrangler abstracts this correctly and is
 *   the Cloudflare-recommended approach.
 *
 * @see https://developers.cloudflare.com/pages/get-started/direct-upload/
 */

import { execFile } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CloudflareEnv {
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}

export interface DeployResult {
  projectName: string;
  deploymentUrl: string;
  deploymentId: string;
}

/* ─── Public API ─── */

/**
 * Deploy a single index.html to Cloudflare Pages.
 *
 * 1. Write HTML to a temp directory
 * 2. Run `wrangler pages deploy <dir> --project-name=<slug> --branch=main`
 * 3. Parse the deployment URL from Wrangler's stdout
 * 4. Clean up temp directory
 */
export async function deployToCloudflare(
  businessName: string,
  html: string,
  env: CloudflareEnv,
): Promise<DeployResult> {
  const projectName = slugifyProjectName(businessName);

  // Write HTML to a temp directory
  const tmpDir = await mkdtemp(join(tmpdir(), "cf-deploy-"));
  const indexPath = join(tmpDir, "index.html");
  await writeFile(indexPath, html, "utf-8");

  try {
    const stdout = await runWrangler(projectName, tmpDir, env);

    // Wrangler outputs: "✨ Deployment complete! Take a peek over at https://<id>.<project>.pages.dev"
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.pages\.dev/);
    const deploymentSpecificUrl = urlMatch?.[0] ?? "";

    // Extract deployment ID from the URL: https://<id>.<project>.pages.dev
    const idMatch = deploymentSpecificUrl.match(/https:\/\/([^.]+)\./);
    const deploymentId = idMatch?.[1] ?? "";

    // The stable production URL
    const deploymentUrl = `https://${projectName}.pages.dev`;

    return {
      projectName,
      deploymentUrl,
      deploymentId,
    };
  } finally {
    // Clean up temp directory
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Slugify a business name into a valid Cloudflare Pages project name.
 * Rules: lowercase, alphanumeric + hyphens, no leading/trailing hyphens, max 58 chars.
 */
export function slugifyProjectName(businessName: string): string {
  return (
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")   // replace non-alphanum runs with hyphen
      .replace(/^-+|-+$/g, "")       // trim leading/trailing hyphens
      .slice(0, 58) || "site"         // enforce max length, fallback if empty
  );
}

/* ─── Internal Helpers ─── */

/**
 * Shell out to wrangler pages deploy.
 * Passes credentials via environment variables (never CLI args).
 */
function runWrangler(
  projectName: string,
  directory: string,
  env: CloudflareEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      [
        "wrangler",
        "pages",
        "deploy",
        directory,
        `--project-name=${projectName}`,
        "--branch=main",
        "--commit-dirty=true",
      ],
      {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
        },
        timeout: 30_000, // 30s timeout for the deploy command
        maxBuffer: 1024 * 1024, // 1MB stdout buffer
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(
            `Wrangler deploy failed: ${error.message}\nstderr: ${stderr.slice(0, 500)}`,
          ));
          return;
        }

        // Wrangler writes progress to stderr, deployment URL to stdout
        const combined = stdout + "\n" + stderr;
        resolve(combined);
      },
    );
  });
}
