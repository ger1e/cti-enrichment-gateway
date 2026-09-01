<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record after implementation. Current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md), `docs/SHELL.md`, and the current README.

# Mission Workspace v1 Design

## Status

Approved architectural follow-on to Analyst Mission Pack v1. This train turns the merged pure Mission Core into a usable analyst workflow without adding an LLM, server persistence, arbitrary egress, or automatic ticket submission.

## Problem

Analyst Mission Pack v1 exposes deterministic functions for client profiles, relevance, hunt packages, KQL validation, bounded result analysis, and ServiceNow projection. Those functions are individually usable by code, but a real analyst should not repeatedly paste nested JSON envelopes between terminal commands.

Mission Workspace v1 must preserve the deterministic core while providing:

- an interactive, volatile Web workspace;
- a file/stdin-oriented CLI automation surface;
- one portable, versioned mission bundle;
- explicit downstream invalidation when upstream facts change;
- bounded local import and export;
- visible fail-closed states and human approval boundaries.

## Goals

1. Complete the analyst workflow from client profile through ServiceNow-ready projection.
2. Keep mission state local to the active browser session unless the analyst explicitly exports it.
3. Give CLI users deterministic single-operation file/stdin commands and pipeline-compatible outputs.
4. Share all transition semantics across browser and Node surfaces.
5. Preserve the Mission Core's existing limits, provenance rules, and fail-closed behavior.
6. Produce no network request, LLM call, secret read, or automatic external action.

## Non-goals

- ServiceNow API submission.
- Sentinel or Defender query execution.
- Server-side client-profile or mission persistence.
- Browser IndexedDB mission persistence.
- Multi-user collaboration, RBAC, or tenant isolation.
- CTI URL retrieval and enrichment.
- Model-assisted hypothesis or KQL generation.
- General-purpose filesystem access from the Web surface.

## Architecture

Mission Workspace v1 adds a pure state-machine layer above the existing Mission Core.

```text
Web commands / CLI commands
          |
          v
mission command adapter
          |
          v
mission workspace reducer
          |
          v
Mission Core v1
          |
          v
typed shell record / artifact
```

The reducer owns dependency ordering and invalidation. The existing Mission Core remains authoritative for normalization, relevance scoring, KQL validation, result analysis, hunt construction, and ServiceNow projection.

The browser executor holds one workspace object in memory for the active shell session. Disconnect, reboot, or `mission clear` destroys it. The Node executor holds state only for its process lifetime. CLI file and stdin transports supply bounded content to one operation; no hidden cross-process state is introduced.

## Mission bundle contract

The portable top-level schema is `mission-workspace-v1.0`.

```json
{
  "schemaVersion": "mission-workspace-v1.0",
  "revision": 0,
  "profile": null,
  "context": null,
  "relevance": null,
  "hunt": null,
  "kqlValidations": [],
  "result": null,
  "serviceNow": null
}
```

Rules:

- The object is deeply frozen before return.
- `revision` is a non-negative integer incremented once per successful state-changing transition.
- No wall-clock timestamp, random identifier, callback, secret, or runtime handle is stored.
- `profile` is a normalized `mission-client-v1.0` object.
- `context` is a bounded, plain JSON object accepted by the existing relevance and hunt APIs.
- Derived fields contain only existing Mission Core projections.
- Import rejects unknown top-level keys, unsupported versions, nested prototypes, non-JSON values, and payloads above 2 MiB.
- Export is deterministic JSON with a trailing newline.

## State transitions and invalidation

`createMissionWorkspace()` returns the empty schema above.

`reduceMissionWorkspace(workspace, action)` accepts one validated action and returns a new workspace. It never mutates its input.

Actions:

- `PROFILE_SET`: normalize the supplied profile; invalidate relevance, hunt, KQL validations, result, and ServiceNow projection.
- `CONTEXT_SET`: validate and store bounded context; invalidate relevance, hunt, KQL validations, result, and ServiceNow projection.
- `RELEVANCE_ASSESS`: require profile and context; calculate relevance; invalidate hunt, KQL validations, result, and ServiceNow projection.
- `HUNT_BUILD`: require profile and context; build a hunt from explicit hunt input; store its embedded KQL validations; invalidate result and ServiceNow projection.
- `KQL_VALIDATE`: validate one explicit query and append a deduplicated validation record; invalidate ServiceNow projection only when the current hunt is replaced, not for independent validation.
- `RESULT_ANALYZE`: analyze bounded JSON or CSV; invalidate ServiceNow projection.
- `SERVICENOW_BUILD`: require a hunt; project the current result when available; never submit it.
- `CLEAR`: return a new empty workspace with revision incremented from the prior workspace.
- `IMPORT`: validate and deep-freeze a complete portable bundle.

Failed transitions return no new state. Errors are normalized at the shell boundary as `INVALID_ARGUMENT` without reflecting unsafe internal exception text.

## Command surface

### Shared commands

```text
mission new
mission show
mission profile set <json>
mission context set <json>
mission relevance
mission hunt build <json>
mission kql validate <query>
mission result analyze <json-or-csv>
mission servicenow
mission export
mission import
mission clear
```

All commands are registered in the shared catalog and discoverable through `help`, `man`, `commands mission`, and completion.

### Web behavior

- `mission profile set`, `mission context set`, and `mission hunt build` accept bounded inline JSON.
- `mission result analyze` accepts bounded inline JSON/CSV. With no inline content, it invokes the explicit local result-file callback and analyzes the selected JSON/CSV without retaining the source file.
- `mission import` opens a local file chooser and accepts a validated mission-bundle JSON file.
- `mission export` creates a registered in-memory JSON artifact and downloads it only through the existing explicit download path.
- `mission show` renders the current typed record; the existing terminal renderer remains authoritative.
- State is erased on disconnect and reboot.

### CLI behavior

- Inline structured input remains supported for small automation cases.
- `--file <path>` is accepted only by profile, context, hunt, result, and workspace import commands.
- `--stdin` is accepted only by the same commands and causes the CLI entry point to read at most 2 MiB before execution.
- `--file` and `--stdin` are mutually exclusive.
- File reads are explicit, local, bounded, and performed only by the Node mission transport adapter.
- CLI commands emit typed JSON suitable for host-shell redirection or a subsequent invocation. A complete process-local sequence may begin with `mission import --file <bundle> | ...`; the imported workspace record is passed through the shared pipeline.
- The application performs no implicit file write. `mission export` returns the same artifact type on both surfaces, and the CLI renderer writes the artifact's deterministic JSON content to stdout.

Semantic parity means both surfaces run the same action builder, reducer, bundle validator, and Mission Core functions. Transport mechanics may differ because browsers use file selection while Node uses explicit files or stdin.

## Shell typing

Mission workspace values use the existing `record` type. This avoids adding a parallel shell type hierarchy and keeps generic `jsonpath`, `fields`, `copy`, and JSON rendering compatible.

Commands that transform an existing workspace accept `void` or `record` input:

- `void` uses the executor's current volatile workspace;
- a piped `record` must validate as `mission-workspace-v1.0` and becomes the action input;
- outputs are `record`, except `mission export`, which returns the same `artifact` contract on both surfaces.

No mission command accepts `enrichment` as an implicit workspace. Threat intelligence must be translated into explicit context by the analyst in this train.

## Bounds

- Portable bundle and result import: 2 MiB UTF-8.
- Result rows: 5,000.
- Result columns: 128.
- Result field: 4,096 characters.
- Profile/context/hunt inline command content: bounded by existing shell intermediate and rendered limits.
- Independent KQL validations stored in a workspace: maximum 8.
- Query length: 32,000 characters under the existing validator.
- Import file count: exactly one per action.

Bounds are enforced before parsing or state mutation.

## Security properties

- No new host, HTTP route, provider, environment variable, credential, dependency, or background job.
- External content is always data and cannot modify command policy or workspace reducer behavior.
- No `eval`, `Function`, dynamic import from user input, child process, or host-shell interpretation.
- CSV formula-like cells are counted but never executed.
- KQL is validated but never executed.
- ServiceNow output is projected but never transmitted.
- Browser import is local and explicit.
- CLI file access occurs only after explicit `--file` and never follows a path found inside imported content.
- Workspace export contains no bearer token, provider secret, browser session object, or arbitrary error detail.
- Disconnect and reboot clear volatile mission state.

## User-visible failure states

- Missing profile or context: `INVALID_ARGUMENT` with the missing prerequisite named.
- Invalid bundle or version: `INVALID_ARGUMENT`.
- Oversized input: `OUTPUT_LIMIT`.
- Unsupported file/stdin flag: `POLICY_DENIED`.
- Hunt output preserves `READY`, `TELEMETRY_GAP`, `SCHEMA_UNVERIFIED`, and `INSUFFICIENT_EVIDENCE`.
- Result output preserves `IMPORT_EMPTY`, `NO_RESULTS`, and `RESULTS_PRESENT`.
- `NO_RESULTS` retains `no_results_is_not_benign_evidence`.
- ServiceNow output always retains `projectionOnly: true` and `autoSubmission: false`.

## Files and responsibilities

- `src/core/mission/workspace.js`: schema creation, validation, reducer, invalidation, deterministic export.
- `src/core/mission/command-adapter.js`: shared command-to-action parsing and typed output mapping.
- `src/core/mission/index.js`: public exports for the two new pure modules.
- `app/shell-core/catalog.js`: declarative mission descriptors.
- `app/shell-browser-executor.js`: volatile workspace ownership and browser import/export delegation.
- `src/control/shell-node-executor.js`: process-local workspace ownership and explicit file transport.
- `bin/para11ax.mjs`: bounded explicit stdin acquisition before pipeline execution.
- `docs/SHELL.md`: operator command contract and examples.
- `docs/ANALYST-MISSION-PACK.md`: workspace lifecycle and safety boundary.

## Testing strategy

1. Reducer tests prove immutability, determinism, revision behavior, prerequisites, and exact downstream invalidation.
2. Bundle tests prove round-trip stability, deep freezing, schema rejection, bounds, and secret/session exclusion.
3. Command-adapter tests prove action construction, typed input behavior, error normalization, and flag denial.
4. Catalog tests prove discovery, completion, side-effect metadata, and no new capability or egress declaration.
5. Browser tests prove volatile state sequencing, import/export delegation, disconnect/reboot clearing, and no network call.
6. Node tests prove semantic parity, explicit bounded `--file`/`--stdin`, stdout export, and no implicit write.
7. End-to-end fixture tests execute profile → context → relevance → hunt → result → ServiceNow projection and compare both surfaces.
8. Repository security tests prove no new dependency, host, secret read, dynamic execution, or automatic submission path.

## Definition of done

Mission Workspace v1 is complete when one fixture performs the following through both supported surface semantics:

```text
create workspace
→ set normalized client profile
→ set explicit threat context
→ calculate relevance
→ build evidence-bound hunt
→ validate KQL
→ analyze bounded CSV results
→ build ServiceNow-ready projection
→ export and re-import the exact mission bundle
```

The final state must be deterministic, deeply frozen, portable, free of secrets and runtime handles, and explicit about every telemetry, schema, evidence, and approval limitation. Full repository tests, Tooling smoke, and CodeQL must pass before the PR is ready.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
