//! Filesystem helpers used by commands.
//!
//! All public functions in this module enforce path scoping via
//! [`crate::security::path::resolve_within`].

pub mod app_data;
pub mod artifacts;
