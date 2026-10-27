import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import fs from "node:fs";
export function createDatabase(path = "data/entry.db") {
  if (path !== ":memory:") fs.mkdirSync("data", { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    `PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL); CREATE TABLE IF NOT EXISTS visitors(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, company TEXT, host TEXT NOT NULL, purpose TEXT NOT NULL, scheduled TEXT NOT NULL, token TEXT UNIQUE NOT NULL, user_id TEXT REFERENCES users(id), created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL REFERENCES visitors(id), time_in TEXT NOT NULL, time_out TEXT, guard_id TEXT REFERENCES users(id)); CREATE UNIQUE INDEX IF NOT EXISTS one_active_visit ON visits(visitor_id) WHERE time_out IS NULL; CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);`,
  );
  return db;
}
export function seed(db) {
  if (db.prepare("SELECT count(*) as n FROM users").get().n) return;
  const hash = bcrypt.hashSync("Welcome123!", 10);
  for (const [id, name, email, role] of [
    ["admin", "Alex Morgan", "admin@entry.local", "admin"],
    ["guard", "James Wilson", "guard@entry.local", "guard"],
    ["visitor", "Olivia Rhye", "visitor@entry.local", "visitor"],
  ])
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      id,
      name,
      email,
      hash,
      role,
    );
  const people = [
    [
      "Olivia Rhye",
      "olivia@acme.co",
      "Acme Studio",
      "Sarah Mitchell",
      "Business meeting",
      "in",
      "visitor",
    ],
    [
      "Phoenix Baker",
      "phoenix@layers.design",
      "Layers",
      "David Chen",
      "Interview",
      "out",
      null,
    ],
    [
      "Lana Steiner",
      "lana@sisyphus.com",
      "Sisyphus Ventures",
      "Michael Foster",
      "Business meeting",
      "in",
      null,
    ],
    [
      "Demi Wilkinson",
      "demi@catalog.com",
      "Catalog",
      "Emma Wilson",
      "Delivery",
      "out",
      null,
    ],
    [
      "Drew Cano",
      "drew@circooles.com",
      "Circooles",
      "Sarah Mitchell",
      "Business meeting",
      "expected",
      null,
    ],
    [
      "Natali Craig",
      "natali@hourglass.app",
      "Hourglass",
      "David Chen",
      "Site visit",
      "expected",
      null,
    ],
    [
      "Orlando Diggs",
      "orlando@command.io",
      "Command",
      "Emma Wilson",
      "Interview",
      "out",
      null,
    ],
    [
      "Andi Lane",
      "andi@goodwell.co",
      "Goodwell",
      "Michael Foster",
      "Business meeting",
      "in",
      null,
    ],
  ];
  people.forEach((p, i) => {
    const day = new Date();
    day.setHours(8 + Math.floor(i / 2), i % 2 ? 45 : 15, 0, 0);
    const id = randomUUID();
    db.prepare("INSERT INTO visitors VALUES(?,?,?,?,?,?,?,?,?,?)").run(
      id,
      ...p.slice(0, 5),
      day.toISOString(),
      randomUUID(),
      p[6],
      new Date().toISOString(),
    );
    if (p[5] !== "expected")
      db.prepare("INSERT INTO visits VALUES(?,?,?,?,?)").run(
        randomUUID(),
        id,
        day.toISOString(),
        p[5] === "out" ? new Date(day.getTime() + 3600000).toISOString() : null,
        "guard",
      );
  });
}
export function scanVisitor(db, token, guardId) {
  const visitor = db
    .prepare("SELECT * FROM visitors WHERE token=? OR id=?")
    .get(token, token);
  if (!visitor)
    throw new Error(
      "This visitor pass was not found. Check the ID and try again.",
    );
  const active = db
    .prepare("SELECT * FROM visits WHERE visitor_id=? AND time_out IS NULL")
    .get(visitor.id);
  const now = new Date().toISOString();
  if (active)
    db.prepare("UPDATE visits SET time_out=? WHERE id=?").run(now, active.id);
  else
    db.prepare("INSERT INTO visits VALUES(?,?,?,?,?)").run(
      randomUUID(),
      visitor.id,
      now,
      null,
      guardId,
    );
  return {
    name: visitor.name,
    action: active ? "checked out" : "checked in",
    time: now,
  };
}
