//! Security primitives shared by all commands.
//!
//! Anything that touches the filesystem, spawns a process, or accepts
//! user-supplied paths must go through this module.

pub mod path;
pub mod redact;
