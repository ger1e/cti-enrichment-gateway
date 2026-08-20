# API boundaries

The gateway is read-only by default. It does not expose arbitrary outbound HTTP, arbitrary headers, shell execution, urlscan submission, malware submission, sample download or detonation endpoints. Those operations are intentionally outside the core API surface.
