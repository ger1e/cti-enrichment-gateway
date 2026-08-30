# PARA11AX Absolute-Max Shell Command Fabric Design

Date: 2026-08-30
Status: Approved design
Scope: Shared command language for the WebUI analyst terminal and Node CLI

## 1. Objective

Replace the current split shell implementations with one declarative command fabric shared by the browser terminal and `bin/para11ax.mjs`.

The goal is not to emulate a general-purpose operating-system shell. The goal is to make PARA11AX analyst, provider, evidence, case, report, export, diagnostic, discovery, transformation, and existing Node administrative capabilities available through one coherent command language while preserving the existing fail-closed, bounded-egress security model.

Success means:

- one grammar and parser;
- one command registry;
- one source of help, manual, aliases, completion, capability and surface metadata;
- WebUI and Node CLI share command names and semantics;
- existing WebUI commands remain compatible;
- all existing Node CLI commands remain compatible;
- typed pipelines and a small safe Unix-like text-transform subset are supported;
- no OS-shell escape hatch is introduced;
- provider commands inherit PARA11AX provider manifest and execution-policy limits;
- command failures are typed, deterministic, bounded, and fail-closed.

## 2. Current-State Constraints

The current WebUI shell already includes core/auth/gateway commands, enrichment and batch, Shodan, User Scanner, case operations, result views and filters, JSON/STIX export, clipboard helpers, audio controls, Unix-style local display commands, history, and completion. Its command interpretation and dispatch are centralized but largely implemented as explicit command-specific branches.

The Node CLI independently exposes doctor state, provider listing/probing/environment templates, Maltego checking, release verification, setup/repair, and report compilation/diff operations.

PARA11AX already has deeper domain primitives below both surfaces: provider capability metadata, evidence graph construction, guidance, report models, and report renderers. The new shell fabric exposes these capabilities rather than duplicating them.

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

### 3.1 Module boundaries

Implementation responsibilities are split into focused units instead of enlarging `app/shell.js` further:

- command registry: declarative descriptors only;
- tokenizer/parser: input to AST only;
- validator: schema, surface, auth, capability and type validation;
- pipeline runtime: sequential typed stage execution and limits;
- completion/help: generated from registry and parser position;
- browser executor: API client, volatile browser session, browser downloads and browser-only local state;
- Node executor: control commands, provider operations, reports and explicitly declared local administrative/filesystem operations;
- shell UI: input, history navigation, rendering, audio, cancellation and downloads;
- Node CLI entrypoint: argv/stdin/stdout adapter over the shared command runtime.

Each unit exposes a small documented interface; consumers do not inspect another unit's internals.

## 4. Grammar and AST

The shared grammar is intentionally small.

```text
line       := pipeline
pipeline   := invocation ("|" invocation)*
invocation := command argument*
argument   := word | quoted-string | flag | expression
```

Parsing produces an AST only. Parsed text is never directly executed.

Example:

```text
enrich 8.8.8.8 --full | evidence | where confidence >= 0.8 | head 20
```

Conceptual AST:

```text
PipelineAST
  stage[0] command=enrich args=[8.8.8.8] flags={profile:full}
  stage[1] command=evidence
  stage[2] command=where expression=(confidence >= 0.8)
  stage[3] command=head args=[20]
```

The tokenizer preserves current quoting, backslash escaping, case-normalization of command names, and literal argument preservation unless the new grammar explicitly rejects a shell metacharacter for security reasons.

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
sideEffect      none | session | browser-download | filesystem | local-admin
capabilities
completion
handler key
```

Provider-backed commands additionally inherit provider metadata such as supported observable types, active state, credential mode, cost class, admission policy, fixed hosts, allowed methods, response limits and timeout policy. These properties are not user-overridable command arguments.

The registry validates itself at startup/test time. Duplicate names, ambiguous aliases, invalid namespaces, missing handlers, impossible surface combinations, unknown type names, or malformed metadata are fatal registry errors.

## 6. Command Taxonomy

### 6.1 Discovery

```text
help [command]
man <command>
commands [namespace] [--all]
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

Login secrets remain memory-only on the browser surface and never enter history, help, errors or terminal output.

### 6.3 System/gateway/admin

```text
system health
system status
system meta
system doctor
system policy
system limits
system capabilities
system setup
system repair
system release verify
system maltego check
```

`system setup`, `system repair`, `system release verify`, and `system maltego check` are Node-only administrative operations. Existing CLI forms remain compatibility aliases:

```text
setup
repair
release verify
maltego check
```

Existing WebUI short forms `health`, `status`, and `meta` remain compatibility aliases.

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

Typed front doors validate the requested observable class before provider work begins. They route into the normal enrichment/orchestration contract, not a bypass path.

### 6.5 Provider namespace

```text
provider list
provider show <provider>
provider status [provider]
provider probe <provider|all>
provider capabilities <provider>
provider coverage <observable-type>
provider run <provider> <observable>
provider env-template
```

`provider env-template` is Node-only and prints secret variable names/placeholders, never secret values. Existing plural CLI forms remain compatibility aliases, including `providers list`, `providers env-template`, and `providers probe ...`.

`provider run` is the generic direct-provider read primitive. It validates provider existence, active state, credential readiness, supported observable type, cost/policy state, and surface capability before egress. On WebUI it routes through the gateway/server; the browser never receives provider credentials or performs provider egress directly.

Initial direct analyst aliases are fixed as:

```text
vt             -> provider run virustotal
gn             -> provider run greynoise
otx            -> provider run otx
urlscan        -> provider run urlscan
threatfox      -> provider run threatfox
malwarebazaar  -> provider run malwarebazaar
rdap           -> provider run rdap
epss           -> provider run epss
kev            -> provider run cisa-kev
nvd            -> provider run nvd
censys         -> provider run censys
```

The existing dedicated `shodan` command family remains available and is registered in the same command fabric rather than being replaced by the generic provider-run syntax.

Direct provider execution cannot specify an arbitrary host, credential, HTTP method, timeout, parser or output size. Unsupported observable/provider combinations fail before egress.

### 6.6 Existing OSINT specialist commands

```text
shodan <host|search|count|stats|domain|info> ...
user-scanner <email|username> ...
```

Existing aliases/options for Shodan and User Scanner remain compatible. These specialist operations stay isolated from the current Evidence v2 result unless a future separately approved design changes that contract.

### 6.7 Result and evidence

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

Existing direct view/filter commands remain compatibility aliases where they exist, including `overview`, `evidence`, `correlation`, `relationships`, `coverage`, `raw`, `last`, `request`, `failures`, `contradictions`, `corroboration`, `references`, and `providers`.

The result namespace exposes the current Evidence v2/enrichment result and domain objects produced by PARA11AX rather than recomputing shell-only intelligence.

### 6.8 Cases

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

Existing `pin`, `unpin`, `note`, and `diff` behavior remains available through compatibility aliases or the case namespace. Each case command declares its actual storage/surface capability; shared syntax does not imply identical persistence on both surfaces.

### 6.9 Reports

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

The existing report compiler remains authoritative for model creation, quality gates, deterministic output, presets and artifact generation.

Browser report commands render/download supported in-memory artifacts. Filesystem compilation is Node-only, explicitly surface-gated, and retains bounded regular-file and output-directory validation.

Existing `report compile` and `report diff` CLI syntax remains compatible.

### 6.10 Export

```text
json [save]
stix
copy <target>
download <artifact>
```

`download` is a semantic artifact operation, not a general filesystem primitive. Browser execution is limited to explicit user-triggered downloads. Node filesystem writes are limited to commands declaring `sideEffect: filesystem`.

### 6.11 Terminal/local display

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

These are virtual/local PARA11AX commands. They do not expose arbitrary host process execution.

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

Structured transforms operate on typed in-memory values and do not stringify data until explicitly converted or final rendering occurs.

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

Execution is sequential and fail-fast. If stage N fails, later stages do not execute.

`Ctrl+C` aborts the active network-capable operation and terminates the whole pipeline. Pure transforms remain side-effect-free and deterministic whether implemented synchronously or through a Promise-compatible runtime contract.

Hard ceilings exist for pipeline stage count, incoming record count, intermediate value bytes, final rendered output bytes/lines, and any transform that can expand output. Concrete limits are centralized constants covered by tests.

## 8. Security and Capability Model

### 8.1 Command classes

```text
Class 0 — PURE
help, man, discovery, transforms, local rendering
No auth, no egress, no external side effect

Class 1 — LOCAL STATE
profile, history, session-local controls, browser-local state, audio
No external egress

Class 2 — GATEWAY READ
gateway health/status/meta, enrichment and gateway-backed evidence operations
Bounded server operation; auth as declared

Class 3 — PROVIDER READ
provider probes and direct provider reads
Manifest-bound allowlisted provider egress

Class 4 — EXPLICIT LOCAL WRITE
Node report/export filesystem writes and browser downloads
Only commands explicitly declaring the relevant write capability

Class 5 — EXPLICIT LOCAL ADMIN
Node-only setup/repair/release/Maltego fixed administrative tooling
Only named registered handlers; never arbitrary command execution
```

### 8.2 Hard invariants

The shared command language never provides:

- arbitrary OS command execution;
- `eval` or `Function` execution;
- browser or Node command substitution;
- arbitrary subprocess invocation from parsed user command text;
- arbitrary URL fetching;
- user-supplied provider host/method/credential overrides;
- provider secret-value display;
- implicit filesystem traversal or generic write primitives;
- redirect syntax that maps to host filesystem operations.

The following shell constructs are outside the language and are rejected as syntax rather than passed through:

- backticks;
- `$()`;
- `&&`;
- `||`;
- semicolon command chaining;
- OS-shell redirects.

`>` and `<` are accepted only inside the registered expression grammar, such as `where score >= 80`; they never imply redirects.

### 8.3 Provider policy inheritance

Provider commands honor the provider manifest and execution policy, including:

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

Quota/scarce operations are marked in `help`, `man`, `provider show`, and execution output. Completion does not consume quota and never probes providers merely to produce suggestions.

## 9. Compatibility Contract

Backward compatibility is mandatory for the existing interactive shell and Node CLI grammar unless an existing behavior violates the hard security invariants.

The migration changes how commands are represented and dispatched, not their expected observable behavior.

Compatibility coverage includes:

- `help` / `man`;
- `clear` / `cls`;
- `history`;
- login/auth/disconnect/reboot;
- `health`, `status`, `meta`;
- `enrich`, `scan`, `pivot`, profiles and batch;
- User Scanner aliases/options;
- Shodan subcommands/options;
- current case commands;
- current result views/filters;
- JSON/STIX/copy behavior;
- sound/volume/theme/local display commands;
- history exclusion of login secrets;
- current completion behavior, upgraded to registry/parser-driven completion;
- `doctor`;
- `providers list`;
- `providers env-template`;
- `providers probe [--all] [--provider <name>]`;
- `maltego check`;
- `release verify`;
- `setup`;
- `repair`;
- `report compile`;
- `report diff`.

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

Each error carries bounded structured context sufficient for rendering and tests, such as command, stage, argument, expected type, actual type, provider, or policy reason. Raw secrets, unbounded upstream bodies, stack traces and provider credentials are excluded from user-visible error context.

Unknown or unsupported operations fail closed. No error condition falls through to a system shell or arbitrary HTTP client.

## 11. Completion and Discovery

Completion is parser-position-aware and registry-generated.

Depending on AST position it suggests:

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

Surface behavior is deterministic:

- ordinary Tab completion lists only commands available on the current surface;
- `help` and `commands` default to commands available on the current surface;
- `commands --all` lists all registered commands and labels each command's surface;
- `man <explicit-command>` may display a command unavailable on the current surface, but must label it `web`, `cli`, or `both` and state that it cannot execute on the current surface.

`apropos` searches command names, aliases, summaries, namespaces and capability keywords in the local registry only. It never performs web/provider search.

## 12. Browser and Node Responsibilities

### 12.1 Browser executor

Responsible for:

- gateway API calls through the existing API client;
- volatile bearer session integration;
- browser-safe local state;
- in-memory typed transforms;
- result rendering;
- explicit clipboard/download operations;
- cancellation via AbortController;
- UI audio/visual feedback.

Direct provider aliases on WebUI execute through a gateway provider-read contract. The browser does not receive provider credentials and does not perform provider egress directly.

### 12.2 Node executor

Responsible for:

- local doctor state;
- provider list/probe/env-template operations;
- direct provider reads through registered provider code;
- report compiler/diff operations;
- fixed setup/repair/release/Maltego administrative handlers;
- filesystem writes only for commands explicitly declaring filesystem capability;
- stdout/stderr rendering and exit-code mapping.

The shared runtime never converts arbitrary user command text into `child_process` execution. Existing internal administrative helpers may invoke fixed repository tooling only through their named constrained handlers and `shell:false`-style execution; no generic spawn/exec command is registered.

## 13. Testing Strategy

Implementation is test-driven.

### 13.1 Registry invariants

Test:

- command names are unique;
- aliases are globally unambiguous;
- namespaces are valid;
- all handler keys resolve;
- declared input/output types exist;
- surfaces, auth, side-effect and egress values are valid;
- impossible side-effect/egress combinations are rejected;
- direct provider aliases map to the exact provider names declared in this spec;
- help/completion metadata can be generated for every command.

### 13.2 Tokenizer/parser

Test:

- plain arguments;
- single/double quotes;
- backslash escaping;
- flags and values;
- expressions;
- multi-stage pipelines;
- whitespace edge cases;
- malformed quotes/expressions;
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
- record/intermediate/final-output limits;
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
- exceed configured output/pipeline limits;
- convert a provider-policy rejection into a fallback network path;
- reach a generic filesystem or generic subprocess primitive.

### 13.5 Compatibility

Keep the existing shell and CLI tests green while adding golden/contract tests demonstrating that every legacy command listed in section 9 resolves to equivalent behavior through the shared fabric.

Where old behavior is UI-rendered rather than pure command interpretation, test the underlying action contract separately from presentation.

### 13.6 Help/completion

Test:

- help/man are registry-derived;
- aliases appear correctly;
- current-surface restrictions follow section 11 exactly;
- completion suggestions match parser position;
- completion never performs provider egress;
- no parallel hard-coded command list can drift from the registry.

## 14. Documentation

After the command fabric stabilizes, update/add:

- consolidated shell/CLI command reference;
- provider/direct-command semantics;
- pipeline syntax and transform reference;
- security/non-shell guarantees;
- report command examples;
- migration note stating existing commands remain supported;
- specialized docs such as Shodan shell documentation where applicable.

Documentation examples use only commands registered in the final implementation.

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

The implementation plan preserves this order:

1. establish registry/type/error primitives and tests;
2. establish tokenizer/parser/AST and syntax-security tests;
3. establish pipeline runtime, bounds and transform tests;
4. migrate existing WebUI interpretation to the shared core without behavior loss;
5. migrate all existing Node CLI routing to the shared core without behavior loss;
6. expose system/provider/result/report/discovery command families through existing underlying capabilities;
7. implement `provider run` through manifest/execution-policy gates, then add the fixed direct aliases;
8. add generated help/completion/discovery;
9. run full compatibility/security/regression verification;
10. update documentation.

No new provider execution path is added before the shared registry, parser, policy, surface, type and bounds gates exist.

## 17. Acceptance Criteria

The work is complete only when:

- WebUI and Node CLI consume the same command registry and parser;
- one command descriptor drives dispatch metadata, help and completion;
- every legacy WebUI/CLI command listed in section 9 remains compatible;
- typed structured pipelines work;
- the safe text-transform subset works without subprocesses;
- provider commands inherit manifest/execution-policy controls;
- `provider run` is server-routed on WebUI and credential-safe on both surfaces;
- the fixed direct aliases resolve to their declared provider names;
- direct provider execution cannot bypass supported type, authentication, cost or destination policy;
- shell metacharacters outside the grammar are rejected rather than executed;
- pipeline and output bounds are enforced;
- secret values never enter history/help/errors/output;
- browser writes are limited to explicit browser actions such as download/clipboard;
- Node writes/admin operations are limited to explicitly registered capabilities;
- existing tests remain green;
- new registry/parser/pipeline/security/compatibility tests pass;
- documentation matches the implemented registry.

## 18. Design Decision Summary

Chosen scope: absolute-max command surface.

Chosen composition: typed structured pipelines plus a safe Unix-like text-transform subset.

Chosen surface strategy: one shared command language and registry for WebUI and Node CLI, with executor-specific capability gates.

Chosen provider strategy: generic policy-bound `provider run` plus a fixed initial alias set; the existing specialized Shodan command remains dedicated.

Chosen compatibility strategy: preserve every existing WebUI and Node CLI command unless it violates a hard security invariant.

Chosen trust boundary: no expansion to a general OS shell, arbitrary network client, arbitrary filesystem interface, or browser credential store.

The command fabric therefore maximizes analyst expressiveness inside PARA11AX while keeping execution constrained by PARA11AX's existing capability, provider, policy and surface boundaries.
