# Changelog

All notable repository changes should be recorded here. This project uses a lightweight chronological changelog rather than claiming semantic-versioning guarantees for private lab workflows.

## Unreleased

### Added

- Public-release safety audit for blocked artifacts, common high-confidence credential patterns and optional forbidden terms.
- Public-release checklist for secrets, licensing, restricted data, Git history and sanitized extraction.
- Architecture and trust-boundary documentation.
- Security-control matrix covering implemented and settings-dependent controls.
- GitHub governance layer: CODEOWNERS, contribution guidance, pull-request template and structured issue forms.

### Security

- Public publication is explicitly treated as a separate review event rather than a repository-visibility change.
- File-based controls are documented as complementary to GitHub account/repository settings such as rulesets, required checks, secret scanning and signed-commit enforcement.

## 1.0.0

Initial private personal-research implementation of the read-only CTI enrichment gateway, bounded Maltego client, provider normalization layer, CI verification and Vercel bootstrap/deployment workflow.
