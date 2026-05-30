//! Resolve the per-user local data root for Migrate Pilot.
//!
//! Default layout:
//!   ~/.legacy-modernizer/
//!     app.db
//!     sessions/<session-id>/...
//!
//! TODO: use `tauri::path::BaseDirectory::AppLocalData` to honour OS
//! conventions where appropriate, while keeping a stable `.legacy-modernizer`
//! layout for V1 simplicity.
