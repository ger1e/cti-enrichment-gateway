# PARA11AX Absolute-Max Shell Command Fabric Design

Date: 2026-08-30
Status: Approved design
Scope: Shared command language for the WebUI analyst terminal and Node CLI

## 1. Objective

Replace the current split shell implementations with one declarative command fabric shared by the browser terminal and `bin/para11ax.mjs`.

The goal is not to emulate a general-purpose operating-system shell. The goal is to make every useful PARA11AX analyst, provider, evidence, case, report, export, diagnostic, discovery, and transformation capability available through one coherent command language while preserving the existing fail-closed, bounded-egress security model.

Success means:

- one grammar and parser;
- one command registry;
- one source of help, manual, aliases, completion, capability and surface metadata;
- WebUI and Node CLI share command names and semantics;
- existing WebUI commands remain compatible;
- existing Node administrative/report commands are brought into the same command model;
- typed pipelines and a small safe Unix-like text-transform subset are supported;
- no OS-shell escape hatch is introduced;
- provider commands continue to inherit PARA11AX provider manifest and execution-policy limits;
- command failures are typed, deterministic, bounded, and fail-closed.

## 2. Current-State Constraints

The current WebUI shell already includes core/auth/gateway commands, enrichment and batch, Shodan, User Scanner, case operations, result views and filters, JSON/STIX export, clipboard helpers, audio controls, Unix-style local display commands, history, and completion. Its command interpretation and dispatch are centralized but largely implemented as explicit command-specific branches.

The Node CLI independently exposes doctor state, provider listing and probing, environment templates, setup/repair helpers, release verification, and report compilation/diff operations.

PARA11AX already has deeper domain primitives below both surfaces: provider capability metadata, evidence graph construction, guidance, report models and report renderers. The new shell fabric should expose these capabilities rather than duplicate them.

## 3. Chosen Architecture

Use a shared declarative command fabric.

```text
INPUT
  ↓
Tokenizer
  ↓
Parser
  ↓
Command / Pipeline AST
  ↓
Shared Command Registry
  ├─ identity
  ├─ aliases
  ├─ namespace
  ├─ arguments + flags
  ├─ input/output type
  ├─ auth requirement
  ├─ required capabilities
  ├─ allowed surfaces
  ├─ egress class
  ├─ side-effect class
  ├─ completion metadata
  └─ help/manual metadata
  ↓
Policy + Capability Gate
  ↓
Executor
  ├─ Browser executor
  └─ Node executor
  ↓
Typed Result
  ↓
Pipeline transforms / renderer
```

The parser and registry are platform-neutral. Browser and Node execution differ only where the underlying capability differs. Surface differences are explicit registry metadata, not separate command dialects.

### 3.1 Proposed module boundaries

The implementation should split the current shell responsibilities into focused units instead of enlarging `app/shell.js` further.

Suggested responsibilities:

- command registry: declarative descriptors only;
- tokenizer/parser: input to AST only;
- validator: schema, surface, auth, capability and type validation;
- pipeline runtime: sequential typed stage execution and limits;
- completion/help: generated from registry and parser position;
- browser executor: API client, volatile browser session, browser downloads, browser-only local state;
- Node executor: control commands, provider probes, reports and explicitly declared local filesystem operations;
- shell UI: input, history navigation, rendering, audio, cancellation and downloads;
- Node CLI entrypoint: argument input/output adapter over the shared command runtime.

No unit should need to inspect another unit's implementation details to understand its public contract.

## 4. Grammar and AST

The shared grammar is intentionally small.

```text
line       := pipeline
pipeline   := invocation ("|" invocation)*
invocation := command argument*
argument   := word | quoted-string | flag | expression
```

Parsing produces an AST only. No parsed text is directly executed.

Example:

```text
enrich 8.8.8.8 --full | evidence | where confidence >= 0.8 | head 20
```

becomes conceptually:

```text
PipelineAST
  stage[0] command=enrich args=[8.8.8.8] flags={profile:full}
  stage[1] command=evidence
  stage[2] command=where expression=(confidence >= 0.8)
  stage[3] command=head args=[20]
```

The grammar must preserve the current shell's quoting and escaping behavior for ordinary command arguments where compatible.

## 5. Command Registry Contract

Every registered command declares at least:

```text
name
namespace
aliases
usage
summary
arguments
flags
surfaces        web | cli | both
auth            none | optional | required
inputType
outputType
egressClass     none | gateway | provider
sideEffect      none | session | browser-download | filesystem
capabilities
completion
handler key
```

Provider-backed commands additionally inherit provider metadata such as supported observable types, active state, credential mode, cost class, admission policy, fixed hosts, allowed methods, response limits and timeout policy. These properties are not user-overridable command arguments.

The registry must validate itself at startup/test time: duplicate names, ambiguous aliases, invalid namespaces, missing handlers, impossible surface combinations, unknown type names, or malformed metadata are errors.

## 6. Command Taxonomy

### 6.1 Discovery

```text
help [command]
man <command>
commands [namespace]
apropos <term>
which <command>
aliases
capabilities [type|provider|surface]
limits
```

`help`, `man`, `apropos`, `which`, aliases and completion are generated from the same registry source.

### 6.2 Session and authentication

```text
login
auth status
auth clear
whoami
session
history
history clear
disconnect
reboot
```

Login secrets remain memory-only on the browser surface and must never be added to history or rendered back to the terminal.

### 6.3 System/gateway

```text
system health
system status
system meta
system doctor
system policy
system limits
system capabilities
```

Existing short forms such as `health`, `status`, and `meta` remain valid compatibility aliases.

### 6.4 Intelligence and enrichment

```text
enrich <observable> [profile]
intel <observable>
intel ip <ip>
intel domain <domain>
intel url <url>
intel hash <hash>
intel cve <cve>
intel asn <asn>
intel cidr <cidr>
intel certificate <fingerprint>
batch <observable>...
normalize <observable>
type <observable>
validate <observable>
```

`scan` and `pivot` remain aliases of `enrich`.

Typed front doors validate the requested observable class before any provider work begins. They route into the normal enrichment/orchestration contract, not a bypass path.

### 6.5 Provider namespace

```text
provider list
provider show <provider>
provider status [provider]
provider probe <provider|all>
provider capabilities <provider>
provider coverage <observable-type>
```

Direct analyst provider commands may be registered for providers where this adds substantial operational value, for example:

```text
vt
gn
otx
urlscan
threatfox
malwarebazaar
rdap
epss
kev
nvd
censys
shodan
```

A direct provider command is only an alias/front door into a registered PARA11AX provider operation. It cannot specify an arbitrary host, credential, HTTP method, timeout, parser, or output size.

Direct commands that are not valid for a given observable type must reject the request before egress.

### 6.6 Result and evidence

```text
result summary
result request
result evidence
result facts
result providers
result failures
result contradictions
result corroboration
result references
result relationships
result coverage
result graph
result guidance
result decision
result attacks
result hunts
result telemetry
result freshness
result raw
```

Existing direct view/filter commands remain compatible aliases where they exist, including `overview`, `evidence`, `correlation`, `relationships`, `coverage`, `raw`, `last`, `request`, `failures`, `contradictions`, `corroboration`, `references`, and `providers`.

The result namespace should expose the current Evidence v2/enrichment result and domain objects already produced by PARA11AX rather than recomputing separate shell-only intelligence.

### 6.7 Cases

```text
case new
case open
case close
case list
case show
case refresh
case import
case export
case find
case pins
case notes
case timeline
case graph
case diff
```

Existing `pin`, `unpin`, `note`, and `diff` behavior remains available through compatibility aliases or the case namespace as appropriate.

Case commands declare their actual surface/storage capability explicitly. The shared grammar does not imply identical persistence mechanisms across browser and Node.

### 6.8 Reports

```text
report show
report quality
report compile
report diff
report text
report html
report pdf
report csv
report kql
report navigator
report stix
report evidence
report manifest
```

The existing report compiler remains the authority for report model creation, quality gates, deterministic output, presets and artifact generation.

Browser report commands may render or download supported in-memory artifacts. Node-only filesystem compilation remains explicitly surface-gated and retains bounded input/output validation.

### 6.9 Export

```text
json [save]
stix
copy <target>
save/download <artifact>
```

`save/download` is a semantic family, not a general filesystem primitive. Browser execution is limited to user-triggered downloads. Node filesystem writes are limited to commands whose registry descriptor explicitly declares `sideEffect: filesystem`.

### 6.10 Terminal/local display

```text
clear
echo
printf
date
hostname
pwd
uname
id
theme
sound
volume
```

These are virtual/local PARA11AX commands. They do not expose arbitrary process execution.

## 7. Pipeline Model

The selected composition model supports both typed structured pipelines and a deliberately small safe Unix-like text-transform subset.

### 7.1 Internal types

The runtime uses a small explicit type system:

```text
void
text
scalar
record
records
enrichment
evidence
relationships
graph
guidance
provider-list
artifact
error
```

Command descriptors state accepted input type(s) and output type.

### 7.2 Structured transforms

First-class typed transforms:

```text
where
select
fields
sort
unique
count
group
pluck
head
tail
jsonpath
```

Examples:

```text
enrich 8.8.8.8 | evidence | where confidence >= 0.8 | sort score desc
provider list | where credentialMode != none | fields name status
result relationships | group type | count
```

Structured transforms operate on typed in-memory values and must not stringify data until explicitly requested or final rendering occurs.

### 7.3 Text transforms

Safe text transforms:

```text
grep
head
tail
wc
sort
uniq
```

Example:

```text
enrich example.com | json | grep malicious | head 20
```

Text transforms are internal PARA11AX functions. They are not host binaries and never invoke the operating system.

### 7.4 Pipeline execution

Each stage executes in this order:

```text
resolve alias
→ validate command schema
→ validate surface
→ validate auth/capability
→ validate input type
→ execute registered handler
→ enforce output bounds
→ pass typed result to next stage
→ render final value
```

Execution is sequential and fail-fast. If stage N fails, stage N+1 and later stages do not execute.

`Ctrl+C` aborts the active network-capable operation and terminates the whole pipeline. Pure transforms remain deterministic and synchronous unless implementation constraints require an equivalent bounded asynchronous interface.

Hard ceilings must exist for pipeline stage count, incoming record count, intermediate value size, final rendered output, and any text transform that can multiply output. Concrete values should be centralized runtime constants and covered by tests.

## 8. Security and Capability Model

### 8.1 Command classes

```text
Class 0 — PURE
help, man, discovery, transforms, local rendering
No auth, no egress, no external side effect

Class 1 — LOCAL STATE
profile/history/browser case state/audio/session-local controls
No external egress

Class 2 — GATEWAY READ
gateway health/status/meta, enrichment, evidence retrieval
Bounded server operation; auth as declared

Class 3 — PROVIDER READ
provider probes and direct provider reads
Manifest-bound allowlisted provider egress

Class 4 — EXPLICIT LOCAL WRITE
Node report compilation/export and browser downloads
Only commands explicitly declaring the relevant write capability
```

### 8.2 Hard invariants

The shared command language must never provide:

- arbitrary OS command execution;
- `eval` or `Function` execution;
- browser or Node command substitution;
- arbitrary subprocess invocation from parsed user command text;
- arbitrary URL fetching;
- user-supplied provider host/method/credential overrides;
- provider secret-value display;
- implicit filesystem traversal or generic write primitives;
- redirect syntax that maps to host filesystem operations.

The following shell constructs are not part of the language and must be rejected as syntax rather than passed through:

- backticks;
- `$()`;
- `&&`;
- `||`;
- semicolon command chaining;
- OS-shell redirects.

`>` and `<` may appear only inside registered expression grammar such as `where score >= 80`; they do not imply redirects.

### 8.3 Provider policy inheritance

Provider commands must continue to honor the current provider manifest and execution policy, including:

- active/inactive state;
- supported observable types;
- fixed hosts;
- HTTPS-only protocol constraints;
- allowed HTTP methods;
- credential mode;
- cost class;
- admission/execution policy version;
- provider timeout;
- max response bytes;
- concurrency and attempt limits;
- distribution policy.

Scarce/quota-backed commands should be visibly marked in help/completion and execution output when the underlying provider metadata supports that distinction.

## 9. Compatibility Contract

Backward compatibility is mandatory for the existing interactive shell grammar unless a current behavior is demonstrably unsafe.

The migration changes how commands are represented and dispatched, not their expected observable behavior.

Compatibility coverage includes:

- `help` / `man`;
- `clear` / `cls`;
- `history`;
- login/auth/disconnect/reboot;
- `health`, `status`, `meta`;
- `enrich`, `scan`, `pivot`, profiles and batch;
- User Scanner aliases and options;
- Shodan subcommands/options;
- current case commands;
- current result views and filters;
- JSON/STIX/copy behavior;
- sound/volume/theme/local display commands;
- current history rules, including exclusion of login secrets;
- existing completion behavior, upgraded to registry/parser-driven completion.

The Node CLI's existing doctor/provider/report functions must remain available under the shared command model.

## 10. Error Model

Errors are structured internally and rendered appropriately per surface.

Baseline codes:

```text
COMMAND_NOT_FOUND
INVALID_SYNTAX
INVALID_ARGUMENT
PIPELINE_TYPE_MISMATCH
AUTH_REQUIRED
CAPABILITY_UNAVAILABLE
SURFACE_UNAVAILABLE
PROVIDER_UNAVAILABLE
POLICY_DENIED
QUOTA_GUARD
OUTPUT_LIMIT
OPERATION_ABORTED
UPSTREAM_FAILED
```

Each error should carry bounded structured context sufficient for rendering and tests, such as command, stage, argument, expected type, actual type, provider, or policy reason. Raw secrets, unbounded upstream bodies, stack traces, and provider credentials must not be included in user-visible error context.

Unknown or unsupported operations fail closed. No error condition falls through to a system shell or arbitrary HTTP client.

## 11. Completion and Discovery

Completion is parser-position-aware and registry-generated.

Depending on AST position it may suggest:

- top-level commands;
- namespaces;
- subcommands;
- aliases;
- command flags;
- profiles;
- observable types;
- provider names;
- supported provider subcommands;
- pipeline transforms;
- transform fields/operators when statically available.

A command unavailable on the current surface may either be omitted from normal completion or shown with an explicit unavailable marker; the behavior must be consistent across completion and `help`.

`apropos` searches command names, aliases, summaries, namespaces and relevant capability keywords only. It is local registry search, not web search.

## 12. Browser and Node Responsibilities

### 12.1 Browser executor

Responsible for:

- gateway API calls through the existing API client;
- volatile bearer session integration;
- browser-safe local state;
- in-memory typed transforms;
- result rendering;
- user-triggered clipboard and download operations;
- cancellation via AbortController;
- UI audio/visual feedback.

It must not gain direct provider credentials or arbitrary provider networking merely because direct provider command aliases exist.

### 12.2 Node executor

Responsible for:

- local doctor state;
- provider list/probe control operations;
- report compiler/diff operations;
- explicitly registered setup/release administrative commands where retained;
- filesystem writes only for commands explicitly declaring filesystem capability;
- terminal stdout/stderr rendering and exit-code mapping.

The shared runtime must not convert arbitrary user command text into `child_process` execution. Existing internal administrative helpers may continue to spawn fixed repo tooling only through their already constrained implementation, not through a generic shell command primitive.

## 13. Testing Strategy

Implementation is test-driven.

### 13.1 Registry invariants

Test:

- command names unique;
- aliases globally unambiguous;
- namespace definitions valid;
- all handlers resolve;
- declared input/output types exist;
- allowed surfaces valid;
- side-effect and egress combinations valid;
- direct provider aliases map to known provider/capability metadata;
- help/completion can be generated for every command.

### 13.2 Tokenizer/parser

Test:

- plain arguments;
- single/double quotes;
- escaped characters;
- flags and values;
- expressions;
- multi-stage pipelines;
- whitespace edge cases;
- malformed quotes;
- malformed expressions;
- invalid pipe placement;
- explicit rejection of backticks, `$()`, `&&`, `||`, semicolon chaining and redirects.

### 13.3 Pipeline/type runtime

Test:

- compatible typed stages;
- incompatible type rejection before downstream execution;
- sequential ordering;
- fail-fast behavior;
- abort behavior;
- pipeline stage limit;
- record and byte limits;
- deterministic pure transforms;
- text/structured boundary conversions.

### 13.4 Security/policy

Test that user input cannot:

- trigger OS-shell execution;
- choose an arbitrary provider destination;
- override provider HTTP method/protocol/credential/timeout;
- read provider secrets;
- bypass supported-observable checks;
- execute unavailable surface capabilities;
- exceed configured output or pipeline limits;
- convert a provider-policy rejection into a fallback network path.

### 13.5 Compatibility

Keep the existing shell and CLI tests green while adding golden tests that demonstrate legacy command strings resolve to equivalent shared command actions.

Where old behavior is represented by UI rendering rather than pure command interpretation, test the underlying action contract separately from presentation.

### 13.6 Help/completion

Golden or structured tests should prove:

- help/man are registry-derived;
- aliases appear correctly;
- current surface/capability restrictions are represented consistently;
- completion suggestions match parser position;
- no hard-coded parallel command list drifts from the registry.

## 14. Documentation

Implementation should update or add user-facing shell documentation after the command fabric stabilizes.

Expected documentation targets:

- a consolidated shell/CLI command reference;
- provider/direct-command semantics;
- pipeline syntax and transform reference;
- security/non-shell guarantees;
- report command examples;
- migration note stating that existing commands remain supported;
- existing specialized docs such as Shodan shell documentation where needed.

Documentation examples must use only commands actually registered in the final implementation.

## 15. Non-Goals

This design does not add:

- a general-purpose Bash/Zsh/PowerShell interpreter;
- arbitrary subprocess execution;
- arbitrary filesystem commands;
- arbitrary HTTP/fetch commands;
- provider credential management in the browser;
- unbounded scanners;
- active exploitation primitives;
- generic redirection or shell scripting;
- background jobs/process control;
- unrestricted command substitution;
- a second independent WebUI or CLI command grammar.

## 16. Implementation Sequence Constraints

The implementation plan should preserve these ordering constraints:

1. establish registry/type/error primitives and tests;
2. establish tokenizer/parser/AST and security syntax tests;
3. establish pipeline runtime and transform tests;
4. migrate existing WebUI command interpretation to the shared core without behavior loss;
5. migrate Node CLI command routing to the shared core;
6. expose system/provider/result/report/discovery command families through existing underlying capabilities;
7. add selected direct provider aliases through policy-bound executors;
8. add generated help/completion/discovery;
9. run full compatibility/security/regression verification;
10. update documentation.

The implementation plan may decompose these further, but it must not introduce new network/provider behavior before the shared policy and registry gates exist.

## 17. Acceptance Criteria

The work is complete only when:

- WebUI and Node CLI consume the same command registry and parser;
- one command descriptor drives dispatch metadata, help and completion;
- legacy interactive commands remain compatible;
- Node doctor/provider/report operations are represented in the shared command model;
- typed structured pipelines work;
- the safe text-transform subset works without subprocesses;
- provider commands inherit manifest/execution-policy controls;
- direct provider aliases cannot bypass supported type, authentication, cost or destination policy;
- shell metacharacters outside the grammar are rejected rather than executed;
- pipeline and output bounds are enforced;
- secret values never enter history/help/errors/output;
- browser writes are limited to explicit browser actions such as download/clipboard;
- Node writes are limited to explicitly registered filesystem-capable commands;
- existing tests remain green;
- new registry/parser/pipeline/security/compatibility tests pass;
- documentation matches the implemented registry.

## 18. Design Decision Summary

Chosen scope: absolute-max command surface.

Chosen composition: typed structured pipelines plus a safe Unix-like text-transform subset.

Chosen surface strategy: one shared command language and registry for WebUI and Node CLI, with executor-specific capability gates.

Chosen trust boundary: no expansion to a general OS shell, arbitrary network client, arbitrary filesystem interface, or browser credential store.

The command fabric therefore maximizes analyst expressiveness inside PARA11AX while keeping execution constrained by PARA11AX's existing capability, provider, policy, and surface boundaries.
