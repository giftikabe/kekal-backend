/**
 * githubService.ts
 *
 * Thin wrapper around the GitHub REST API ("Contents" endpoint) used to
 * commit files directly into the kekal-frontend repository. This is how
 * AI-generated components (see POST /api/publish/component) land in the
 * frontend codebase without a human doing a manual git push.
 *
 * Auth: uses a GitHub Personal Access Token (fine-grained, "Contents: write"
 * scope on the target repo) read from env.GITHUB_TOKEN (see wrangler.toml
 * from B1).
 */

export interface GithubFile {
  /** Path relative to repo root, e.g. "src/shared/componentLibrary/Hero/Hero.tsx" */
  path: string;
  /** Raw (non-base64) file content */
  content: string;
}

export interface CommitFilesResult {
  /** SHA of the commit produced for each file (GitHub's Contents API commits one file per call) */
  commitShas: string[];
  /** HTML URLs for the commits, useful for surfacing back to the admin */
  commitUrls: string[];
}

const GITHUB_API_BASE = "https://api.github.com";

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "kekal-living-publish-module",
  };
}

/** Base64-encode UTF-8 content the way GitHub's Contents API expects. */
function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Looks up the current `sha` of a file on a given branch, if it exists.
 * Returns undefined if the file does not exist yet (i.e. this will be a
 * create, not an update).
 */
async function getExistingFileSha(
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<string | undefined> {
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(
    branch
  )}`;
  const res = await fetch(url, { headers: githubHeaders(token) });

  if (res.status === 404) return undefined;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub lookup failed for ${path}: ${res.status} ${body}`);
  }

  const json = (await res.json()) as { sha: string };
  return json.sha;
}

/**
 * Commits one or more files to a repo/branch. Each file is written via its
 * own Contents API call — GitHub's Contents API doesn't support a true
 * multi-file atomic commit without the lower-level Git Data API. If atomic
 * multi-file commits become a hard requirement later, swap this
 * implementation for the git trees/commits/refs flow instead.
 *
 * @param repo          "owner/name", e.g. "kekal-living/kekal-frontend"
 * @param branch        target branch, e.g. "main"
 * @param files         files to write (create-or-update resolved automatically per file)
 * @param commitMessage commit message applied to every file write in this call
 */
export async function commitFiles(
  repo: string,
  branch: string,
  files: GithubFile[],
  commitMessage: string,
  token: string
): Promise<CommitFilesResult> {
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  if (files.length === 0) {
    throw new Error("commitFiles called with no files");
  }

  const commitShas: string[] = [];
  const commitUrls: string[] = [];

  for (const file of files) {
    const existingSha = await getExistingFileSha(repo, branch, file.path, token);

    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${encodeURI(file.path)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: commitMessage,
        content: toBase64(file.content),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub commit failed for ${file.path}: ${res.status} ${body}`);
    }

    const json = (await res.json()) as { commit: { sha: string; html_url: string } };
    commitShas.push(json.commit.sha);
    commitUrls.push(json.commit.html_url);
  }

  return { commitShas, commitUrls };
}

/**
 * Fetches the current text content of a file on a branch. Used by the
 * component-publish flow to read registry.ts before appending a new entry.
 */
export async function getFileContent(
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<{ content: string; sha: string }> {
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(
    branch
  )}`;
  const res = await fetch(url, { headers: githubHeaders(token) });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub read failed for ${path}: ${res.status} ${body}`);
  }

  const json = (await res.json()) as { content: string; sha: string; encoding: string };
  // GitHub returns base64 content, chunked with embedded newlines.
  const decoded = atob(json.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
  const text = new TextDecoder().decode(bytes);
  return { content: text, sha: json.sha };
}
