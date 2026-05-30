/**
 * Workspace path service.
 *
 * Pure helpers for the workspace feature — branch name sanitisation,
 * default workspace path proposals, and structural assertions on user-
 * supplied values. The Rust side performs the authoritative validation;
 * these helpers exist so the UI can mirror the same rules without round-
 * tripping for every keystroke.
 *
 * Architectural rules
 * -------------------
 * - No React, no IPC, no filesystem access. Pure string/path logic.
 * - Match the Rust `is_valid_branch_name` predicate so client-side
 *   feedback never disagrees with the server.
 */

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Maximum length of the sanitised project segment in a branch name. */
const MAX_BRANCH_PROJECT_SEGMENT = 64;

/** Hard cap mirroring the Rust validator. */
const MAX_BRANCH_NAME = 200;

/* -------------------------------------------------------------------------- */
/* Branch name sanitisation                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Reduce an arbitrary string to a branch-safe slug. Mirrors
 * `sanitise_for_branch` in Rust: lowercases ASCII letters, collapses runs
 * of unsafe characters into a single `-`, trims trailing dashes, and
 * caps at {@link MAX_BRANCH_PROJECT_SEGMENT} characters.
 */
export function sanitiseForBranch(input: string): string {
  let out = '';
  let prevDash = false;

  for (const ch of input) {
    let mapped: string;
    if (ch >= 'A' && ch <= 'Z') {
      mapped = ch.toLowerCase();
    } else if (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9')
    ) {
      mapped = ch;
    } else {
      mapped = '-';
    }
    if (mapped === '-') {
      if (!prevDash && out.length > 0) {
        out += '-';
        prevDash = true;
      }
    } else {
      out += mapped;
      prevDash = false;
    }
  }

  while (out.endsWith('-')) {
    out = out.slice(0, -1);
  }
  if (out.length === 0) {
    out = 'project';
  }
  if (out.length > MAX_BRANCH_PROJECT_SEGMENT) {
    out = out.slice(0, MAX_BRANCH_PROJECT_SEGMENT);
    while (out.endsWith('-')) {
      out = out.slice(0, -1);
    }
  }
  return out;
}

/**
 * Validate a fully-formed branch name against the same rules the Rust
 * layer enforces. Used by the UI for opportunistic feedback only — the
 * server is still the source of truth.
 */
export function isValidBranchName(name: string): boolean {
  if (name.length === 0 || name.length > MAX_BRANCH_NAME) return false;
  if (name.startsWith('/') || name.startsWith('-') || name.startsWith('.')) {
    return false;
  }
  if (name.endsWith('/') || name.endsWith('.')) return false;
  if (name.includes('..') || name.includes('//')) return false;
  for (const ch of name) {
    const ok =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '-' ||
      ch === '_' ||
      ch === '.' ||
      ch === '/';
    if (!ok) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Workspace path helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort splitter — works for both POSIX and Windows-style paths.
 * Used purely for display + structural checks; the Rust side does the
 * authoritative canonicalisation.
 */
export function getParentPath(path: string): string {
  if (path.length === 0) return path;
  // Strip trailing separators, then drop the last segment.
  let trimmed = path;
  while (
    trimmed.length > 1 &&
    (trimmed.endsWith('/') || trimmed.endsWith('\\'))
  ) {
    trimmed = trimmed.slice(0, -1);
  }
  const lastSlash = Math.max(
    trimmed.lastIndexOf('/'),
    trimmed.lastIndexOf('\\'),
  );
  if (lastSlash <= 0) return trimmed;
  return trimmed.slice(0, lastSlash);
}

/**
 * True when `candidate` lives at-or-under `root`. Treats both POSIX and
 * Windows separators as path delimiters.
 */
export function isPathInside(candidate: string, root: string): boolean {
  if (root.length === 0 || candidate.length === 0) return false;
  const normRoot = root.endsWith('/') || root.endsWith('\\') ? root.slice(0, -1) : root;
  if (candidate === normRoot) return true;
  return (
    candidate.startsWith(`${normRoot}/`) || candidate.startsWith(`${normRoot}\\`)
  );
}
