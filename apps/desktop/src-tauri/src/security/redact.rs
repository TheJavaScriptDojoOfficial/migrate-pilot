//! Secret-redaction helpers used when forwarding logs/prompts to the UI or
//! to AI providers.
//!
//! TODO:
//!   * Add patterns for .env-style assignments (KEY=VALUE).
//!   * Add patterns for common token prefixes (sk-, ghp_, gho_, etc.).
//!   * Add file-extension allowlist for files the scanner may include in
//!     AI prompts (mirror docs/architecture/security-principles.md).

/// Sensitive filename patterns that must NEVER be forwarded to AI providers.
pub const SENSITIVE_FILENAMES: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    "id_rsa",
    "id_ed25519",
    "secrets.json",
    "credentials.json",
];

/// Sensitive file extensions that must be excluded from AI context.
pub const SENSITIVE_EXTENSIONS: &[&str] = &["pem", "key", "p12", "crt"];

/// Returns true if the given filename should be excluded from AI context.
pub fn is_sensitive_filename(name: &str) -> bool {
    if SENSITIVE_FILENAMES.iter().any(|s| s.eq_ignore_ascii_case(name)) {
        return true;
    }
    if let Some((_, ext)) = name.rsplit_once('.') {
        if SENSITIVE_EXTENSIONS
            .iter()
            .any(|s| s.eq_ignore_ascii_case(ext))
        {
            return true;
        }
    }
    name.starts_with("secrets.") || name.starts_with("credentials.")
}
