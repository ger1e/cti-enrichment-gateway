<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
# PARA11AX User Scanner worker

This directory contains the isolated active-OSINT worker used by the PARA11AX terminal `user-scanner` command. It intentionally sits outside the passive Evidence v2 provider pipeline.

Local run:

```bash
cd workers/user-scanner
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export USER_SCANNER_WORKER_TOKEN='replace-me'
python server.py
```

Then configure the PARA11AX gateway:

```bash
PARA11AX_USER_SCANNER_URL=http://127.0.0.1:8765/scan
PARA11AX_USER_SCANNER_TOKEN=replace-me
```

For hosted use, create a separate Vercel project with `workers/user-scanner` as its Root Directory. Set `USER_SCANNER_WORKER_TOKEN` in that worker project and set the main PARA11AX project's `PARA11AX_USER_SCANNER_URL` to the deployed `/scan` endpoint plus the matching `PARA11AX_USER_SCANNER_TOKEN`.

The gateway does not accept worker URLs, proxies, concurrency values, timeouts, arbitrary module paths, or loud-module toggles from terminal users. Cross-scan is opt-in and fixed to depth 1. NSFW modules are excluded unless the analyst explicitly adds `--include-nsfw`.

Terminal examples:

```text
user-scanner username kaifcodec
user-scanner username kaifcodec --module github
user-scanner username kaifcodec --category dev --cross-scan
user-scanner email analyst@example.com
```

Aliases: `osint`, `identity`.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
