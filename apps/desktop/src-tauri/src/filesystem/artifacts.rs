//! Resolve artifact paths for a given session.
//!
//! Layout (per `docs/architecture/folder-structure.md`):
//!   sessions/<session>/scan-report.json
//!   sessions/<session>/migration-plan.json
//!   sessions/<session>/execution-events.ndjson
//!   sessions/<session>/steps/<step>/prompt.md
//!   sessions/<session>/steps/<step>/ai-response.md
//!   sessions/<session>/steps/<step>/changed-files.json
//!   sessions/<session>/steps/<step>/patch.diff
//!   sessions/<session>/steps/<step>/validation-log.txt
//!   sessions/<session>/steps/<step>/validation-result.json
//!
//! TODO: implement helpers that resolve and validate these paths.
