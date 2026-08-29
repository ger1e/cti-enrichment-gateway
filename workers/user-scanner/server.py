import os
from http.server import ThreadingHTTPServer

from api.index import handler


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer((host, port), handler)
    print(f"User Scanner worker listening on http://{host}:{port}")
    server.serve_forever()
