// The proxy's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { APP_MS, BASE_MB, BURST, capacity, SLOW_MS, THREADS } from "./nginx-engine";
import type { NginxEventType, NginxFrame, NginxNodeId, NginxState } from "./nginx-types";

const app = (n: 1 | 2 | 3) => ({ name: `app${n}`, sub: "App server :3000", role: "Runs your application code: reads the database, builds the page. It's slow and precious compared with nginx, so nginx's job is to send it only real work, and to stop sending it anything once it's down." });

export const ROLES: Record<NginxNodeId, { name: string; sub: string; role: string }> = {
  clients: { name: "Clients", sub: "Browsers and phones", role: "Everyone connected right now. Most connections are idle most of the time: a browser keeps one open between page loads so the next request skips the TCP and TLS handshakes." },
  nginx: { name: "Nginx", sub: "4 workers, event loop", role: "A few worker processes, one per CPU core. Each runs an event loop: it asks the kernel (epoll on Linux) which of its thousands of connections have something to do, does that, and asks again. A connection that's waiting costs a few hundred bytes, not a thread." },
  disk: { name: "Disk", sub: "/var/www/static", role: "Static files: images, CSS, scripts. Nginx serves these itself, with sendfile copying straight from the file to the socket, so they never reach an app server." },
  app1: app(1), app2: app(2), app3: app(3),
};

type Note = [title: string, text: string];

const req = (f: NginxFrame) => f.state.requests[f.state.requests.length - 1];

const NOTES: Record<NginxEventType, (f: NginxFrame) => Note> = {
  ready: () => ["Ready", "Nginx is listening on port 80, in front of three app servers. Send it a request."],
  "burst.arrived": () => [`${BURST.toLocaleString("en")} clients connect`, "Each opens a keep-alive connection and then goes quiet. None of them is asking for anything yet."],
  "burst.held": (f) => ["All held, for almost nothing", `Each connection is a small record in a worker's event loop. ${f.state.stats.connections.toLocaleString("en")} open connections take about ${(f.state.stats.memoryMb - BASE_MB).toFixed(1)} MB. The limit here is ${capacity(f.state).toLocaleString("en")}.`],
  "burst.threads": (f) => [`${THREADS} threads, all waiting`, `One thread per connection, about 1 MB each: ${f.state.stats.memoryMb} MB, and every thread is blocked on a client that isn't saying anything. ${f.state.stats.waiting.toLocaleString("en")} more connections wait in line.`],
  accepted: (f) => [`Request ${req(f)?.n}: GET ${req(f)?.path}`, f.state.model === "event" ? "The kernel reports the socket readable, and the worker reads the request in between serving everything else." : "The request arrives on a connection that needs a free thread."],
  queued: () => ["No thread is free", `All ${THREADS} threads are blocked on idle clients. This request waits in the queue, and none of them will let go soon.`],
  "timed.out": () => ["Timed out", "After a minute the browser gives up. The server is barely doing any work, yet it can't serve anyone: this is the C10k problem."],
  "static.read": () => ["Served from disk", "location /static/ matches, so nginx reads the file itself. No app server is involved."],
  proxied: (f) => [`Proxied to ${f.app}`, (req(f)?.tried.length ?? 0) > 1 ? `Retrying: proxy_next_upstream sends the same request on to ${f.app}.` : `Round robin picks ${f.app}. Nginx opens a connection to it and forwards the request.`],
  "upstream.ok": (f) => [`${f.app} answers`, `It took ${APP_MS} ms to build the page. Nginx relays it.`],
  "upstream.refused": (f) => [`${f.app} refuses the connection`, `Nothing is listening. With max_fails=1, nginx marks ${f.app} down for fail_timeout and tries the next server. The client doesn't know.`],
  "no.live": () => ["502 Bad Gateway", "Every app server is marked down, so there's no one to forward to. Nginx answers 502 straight away instead of hanging."],
  buffered: (f) => ["Buffered for a slow client", `Nginx reads the whole response from ${f.app} in ${APP_MS} ms and frees it, then feeds the phone over ${SLOW_MS / 1000} s itself, which costs it next to nothing.`],
  unbuffered: (f) => ["Streamed to a slow client", `With proxy_buffering off, ${f.app} has to wait for the phone to download every byte: ${SLOW_MS / 1000} s of an app server spent on a weak signal.`],
  responded: (f) => [`${req(f)?.status} in ${(req(f)?.ms ?? 0).toLocaleString("en")} ms`, req(f)?.upstream ? `Served by ${req(f)?.upstream}${(req(f)?.tried.length ?? 0) > 1 ? ` after ${req(f)?.tried.join(" refused, then ")}` : ""}.` : "A file from disk, in a millisecond."],
  "app.down": (f) => [`${f.app} crashes`, "Nginx doesn't know yet. It'll find out the next time it sends that server a request."],
  "app.up": (f) => [`${f.app} is back`, "Once fail_timeout passes, nginx tries it again and it rejoins the rotation."],
  "config.changed": ({ patch = {}, state }: NginxFrame) => (patch.model
    ? [patch.model === "event" ? "Event loop" : "One thread per connection", patch.model === "event" ? "A few workers multiplex every connection." : `A pool of ${THREADS} threads, one per open connection, as older servers worked.`]
    : [patch.buffering === "on" ? "proxy_buffering on" : "proxy_buffering off", state.buffering === "on" ? "Nginx collects the app's response and frees it quickly." : "The app writes at the client's pace."]),
};

export const describe = (frame: NginxFrame): Note => NOTES[frame.type](frame);

// nginx.conf, abridged.
export const config = (s: Pick<NginxState, "buffering">) => [
  "worker_processes 4;                   # one per CPU core",
  "events { worker_connections 16384; }  # each, not in total",
  "http {",
  "  upstream app {                      # round robin by default",
  "    server app1:3000 max_fails=1 fail_timeout=10s;",
  "    server app2:3000 max_fails=1 fail_timeout=10s;",
  "    server app3:3000 max_fails=1 fail_timeout=10s;",
  "  }",
  "  server {",
  "    listen 80;",
  "    location /static/ { root /var/www; }",
  "    location / {",
  "      proxy_pass http://app;",
  "      proxy_next_upstream error timeout;",
  `      proxy_buffering ${s.buffering};`,
  "    }",
  "  }",
  "}",
];

// The line a frame is about, if any.
export const configLine = (f: NginxFrame): number | undefined => {
  switch (f.type) {
    case "burst.held": return 1;
    case "accepted": return f.state.requests[f.state.requests.length - 1]?.kind === "static" ? 10 : 12;
    case "static.read": return 10;
    case "proxied": return f.app ? 3 + Number(f.app.slice(3)) : 12;
    case "upstream.refused": return 13;
    case "no.live": return 3;
    case "buffered": case "unbuffered": return 14;
    default: return undefined;
  }
};
