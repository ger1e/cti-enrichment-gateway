# Cache semantics

Core v1 uses a bounded in-memory TTL cache with shorter negative-result TTLs. The cache is an optimization only and is not durable across Vercel cold starts or instances. Durable state must preserve the same cache interface and must never contain credential values.
