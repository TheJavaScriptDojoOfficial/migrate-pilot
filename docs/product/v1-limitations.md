# Migrate Pilot V1 - Limitations

Migrate Pilot V1 is deliberately narrow. Setting expectations is part of the product.

## Explicitly out of scope in V1

- **Other source frameworks:** Angular, AngularJS, Vue, jQuery, Backbone, etc.
- **Backend or database migrations.**
- **Legacy desktop / mainframe migrations** (COBOL, Java Swing, etc.).
- **Full monorepo migration** (V1 supports a single frontend repo).
- **Microfrontend migration.**
- **Complete UI redesigns.**
- **Automatic production deployment.**
- **Automatic PR merging.**
- **Cloud backend, login, team management, telemetry, analytics.**

## Behavioural limitations

- V1 does not guarantee fully automatic React 19 migration.
- V1 does not guarantee 100% behavioural parity with the original code after the React 19 upgrade.
- V1 does not replace human code review. Every step requires explicit approval.
- V1 does not understand every custom architecture perfectly.
- V1 does not solve missing test coverage. If the project has weak tests, validation will only catch a fraction of regressions.
- V1 does not guarantee zero AI mistakes - diffs are always reviewable.
- V1 does not target React versions older than 16 or other target majors than React 19.

## Operational limitations

- V1 runs **one** migration step at a time. There is no parallel step execution.
- V1 keeps **one** AI write at a time inside the workspace.
- V1 expects the user to be present for diff review and approval.
- V1 requires Git. Projects without a Git repository are not supported.

## The honest summary

> Migrate Pilot reduces the effort of moving React 16/17/18 projects to React 19. It does not remove engineering judgment.
