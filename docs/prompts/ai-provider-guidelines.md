# AI Provider Guidelines

These guidelines apply to every AI prompt and response handled by Migrate Pilot.

## Inputs

Every prompt sent to an AI provider must include:

1. **Task identifier** - one of the `AITaskKind` values
   (e.g. `STEP_IMPLEMENTATION`, `AI_REVIEW`, `AUTO_FIX`).
2. **Scan summary** - the small structured summary, not the raw scan output.
3. **Current migration step** - title, description, target files, expected
   validation command.
4. **Strict constraints** (always included):
   - Edit only files listed under "target files".
   - Do not modify the original project path.
   - Do not run destructive commands.
   - Do not delete files unless the step authorises it.
   - Do not change unrelated files.
5. **Required output format** - a deterministic block listing changed files
   and a short summary. The orchestrator parses this output; non-conforming
   responses are rejected.
6. **Relevant file contents** - only the minimum needed. Never the whole repo.

## Excluded inputs

The following must never be included in a prompt:

- `.env*`, `*.pem`, `*.key`, `*.p12`, `*.crt`, `id_rsa`, `id_ed25519`,
  `secrets.*`, `credentials.*`.
- Files larger than the configured size cap.
- Binary files (images, archives, fonts, etc.).
- Anything outside the workspace path for the current session.

## Determinism

- Prompts are templated and deterministic per task + step + scan version.
- Identical inputs must produce identical prompts.
- Every prompt + response is persisted as an artifact
  (`steps/<step>/prompt.md` and `steps/<step>/ai-response.md`).

## Model routing

| Task | Preferred capability |
| --- | --- |
| `PLAN_GENERATION`, `AI_REVIEW` | Stronger reasoning model |
| `STEP_IMPLEMENTATION` | Cost-effective code-generation model |
| `SUMMARY_GENERATION`, `VALIDATION_ANALYSIS` | Smaller summarisation model |

## Response handling

- All responses pass through a parser that extracts the structured output.
- Unstructured or contract-violating responses produce a `FIX_REQUESTED`
  step state instead of being applied blindly.
- Cost (`prompt_tokens`, `completion_tokens`, `cost_usd`) is recorded per
  run by `orchestrator.ai.cost_tracker`.

## Safety summary

> Every AI run is bounded by the workspace path, an allowlisted set of files,
> and a human approval gate on the diff it produces.
