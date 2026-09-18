"""Serve the console the way the worker does: one page for every address.

The worker answers the whole /admin tree with the console's HTML, because its
screens have real addresses — /admin/schools/sch_oak/roster — and a refresh, a
bookmark or a pasted link asks the server for that path.

A plain file server answers 404 for all of those, so with one the suite could
only ever test the root. Deep links and refreshes are most of what having real
addresses is for, so the test server has to behave like the real one.

    python3 serve.py <dir-holding-portal.html> <port>
"""

import http.server
import sys

ROOT, PORT = sys.argv[1], int(sys.argv[2])
with open(ROOT + "/portal.html", "rb") as f:
    HTML = f.read()


class OnePage(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - the name is the interface
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(HTML)))
        self.end_headers()
        self.wfile.write(HTML)

    def log_message(self, *args):
        pass


http.server.HTTPServer(("127.0.0.1", PORT), OnePage).serve_forever()
