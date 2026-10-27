import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createDatabase, seed } from "./db.js";
import { createApp } from "./app.js";
let db, server, base;
before(async () => {
  db = createDatabase(":memory:");
  seed(db);
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});
async function request(path, { cookie, body, method } = {}) {
  const res = await fetch(base + "/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function as(role) {
  return (await request("/demo", { body: { role } })).cookie;
}
const visitor = {
  name: "Test Visitor",
  email: "test@example.com",
  company: "Example Co",
  host: "Alex Morgan",
  purpose: "Business meeting",
  scheduled: new Date().toISOString(),
};
test("unauthenticated access is rejected", async () => {
  assert.equal((await request("/visitors")).status, 401);
  assert.equal((await request("/logs")).status, 401);
});
test("admins register visitors and guard scans persist separate entry and exit timestamps", async () => {
  const admin = await as("admin");
  const guard = await as("guard");
  const created = await request("/visitors", { cookie: admin, body: visitor });
  assert.equal(created.status, 201);
  assert.ok(created.data.token);
  const first = await request("/scan", {
    cookie: guard,
    body: { token: created.data.token },
  });
  assert.equal(first.data.action, "checked in");
  let active = db
    .prepare("SELECT * FROM visits WHERE visitor_id=?")
    .get(created.data.id);
  assert.equal(active.time_in, first.data.time);
  assert.equal(active.time_out, null);
  assert.equal(active.guard_id, "guard");
  const second = await request("/scan", {
    cookie: guard,
    body: { token: created.data.token },
  });
  assert.equal(second.data.action, "checked out");
  active = db
    .prepare("SELECT * FROM visits WHERE visitor_id=?")
    .get(created.data.id);
  assert.equal(active.time_in, first.data.time);
  assert.equal(active.time_out, second.data.time);
  assert.equal(
    (await request("/logs", { cookie: admin })).data.filter(
      (v) => v.visitor_id === created.data.id,
    ).length,
    1,
  );
  await request("/scan", {
    cookie: guard,
    body: { token: created.data.token },
  });
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM visits WHERE visitor_id=?")
      .get(created.data.id).n,
    2,
  );
});
test("guards cannot register visitors and visitors cannot scan or read workspace logs", async () => {
  const guard = await as("guard");
  const cookie = await as("visitor");
  assert.equal(
    (await request("/visitors", { cookie: guard, body: visitor })).status,
    403,
  );
  assert.equal(
    (await request("/scan", { cookie, body: { token: "anything" } })).status,
    403,
  );
  assert.equal((await request("/logs", { cookie })).status, 403);
  const visible = (await request("/visitors", { cookie })).data;
  assert.equal(visible.length, 1);
  assert.equal(visible[0].user_id, "visitor");
});
test("visitor signup issues a private QR pass and permits subsequent sign in", async () => {
  const body = {
    ...visitor,
    email: "private@example.com",
    password: "Private123!",
  };
  const signup = await request("/signup", { body });
  assert.equal(signup.status, 201);
  const mine = await request("/visitors", { cookie: signup.cookie });
  assert.equal(mine.data.length, 1);
  assert.equal(mine.data[0].email, body.email);
  assert.equal(
    (await request("/session", { cookie: signup.cookie })).data.role,
    "visitor",
  );
  assert.equal((await request("/signup", { body })).status, 409);
  await request("/logout", { cookie: signup.cookie, body: {} });
  assert.equal(
    (await request("/session", { cookie: signup.cookie })).status,
    401,
  );
  const login = await request("/login", {
    body: { email: body.email, password: body.password },
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await request("/visitors", { cookie: login.cookie })).data[0].token,
    mine.data[0].token,
  );
});
test("invalid input and unknown passes do not mutate visits", async () => {
  const cookie = await as("admin");
  const before = db.prepare("SELECT count(*) n FROM visits").get().n;
  assert.equal(
    (await request("/scan", { cookie, body: { token: "missing" } })).status,
    404,
  );
  assert.equal(db.prepare("SELECT count(*) n FROM visits").get().n, before);
  assert.equal(
    (await request("/visitors", { cookie, body: { ...visitor, email: "bad" } }))
      .status,
    400,
  );
  assert.equal(
    (await request("/visitors", { cookie, body: { ...visitor, name: 24 } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/login", {
        body: { email: "admin@entry.local", password: "incorrect" },
      })
    ).status,
    401,
  );
});
