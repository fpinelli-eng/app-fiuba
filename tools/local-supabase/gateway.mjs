// Local stand-in for Supabase, to try the app end to end without the real project:
//   /rest/v1/*     → PostgREST (port 3001), with the user's JWT
//   /auth/v1/user  → the user written in the JWT
//
//   node tools/local-supabase/gateway.mjs            starts it on port 54321
//   node tools/local-supabase/gateway.mjs cookie     prints the session cookie of the test user
//
// Only for local tests: the secret below is public on purpose.
import http from "node:http";
import crypto from "node:crypto";

export const SECRET = "local-test-secret-local-test-secret-123";
export const TEST_USER = { id: "11111111-1111-1111-1111-111111111111", email: "prueba@fi.uba.ar" };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [head, body, sig] = (token || "").split(".");
  if (!sig) return null;
  const ok = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url") === sig;
  return ok ? JSON.parse(Buffer.from(body, "base64url").toString()) : null;
}

const metadata = { full_name: "Prueba Local", given_name: "Prueba" };

if (process.argv[2] === "cookie") {
  // Cookie that @supabase/ssr reads for http://localhost:54321 ("sb-localhost-auth-token").
  const exp = 4102444800; // 2100
  const token = sign({ sub: TEST_USER.id, email: TEST_USER.email, role: "authenticated", aud: "authenticated", exp });
  const session = {
    access_token: token,
    refresh_token: "local",
    token_type: "bearer",
    expires_in: exp - Math.floor(Date.now() / 1000),
    expires_at: exp,
    user: { ...TEST_USER, aud: "authenticated", role: "authenticated", user_metadata: metadata, app_metadata: {} },
  };
  console.log(JSON.stringify({ name: "sb-localhost-auth-token", value: "base64-" + b64(session), domain: "localhost", path: "/" }));
  process.exit(0);
}

http
  .createServer((req, res) => {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const claims = verify(token);

    if (req.url.startsWith("/auth/v1/user")) {
      res.writeHead(claims ? 200 : 401, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          claims
            ? { id: claims.sub, email: claims.email, aud: "authenticated", role: "authenticated", user_metadata: metadata, app_metadata: {} }
            : { message: "invalid token" },
        ),
      );
      return;
    }

    if (req.url.startsWith("/rest/v1/")) {
      const headers = { ...req.headers, host: "localhost:3001" };
      delete headers.authorization; // the publishable key is not a JWT: without a session, PostgREST uses anon
      if (claims) headers.authorization = `Bearer ${token}`;
      const upstream = http.request(
        { host: "127.0.0.1", port: 3001, path: req.url.slice("/rest/v1".length), method: req.method, headers },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      upstream.on("error", (e) => {
        res.writeHead(502);
        res.end(String(e));
      });
      req.pipe(upstream);
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .listen(54321, () => console.log("Local Supabase on http://localhost:54321"));
