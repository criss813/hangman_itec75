import express from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { scanVisitor } from "./db.js";

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  function session(res, id) {
    const token = randomUUID();
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      token,
      id,
      Date.now() + 86400000,
    );
    res.cookie("entry_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000,
    });
  }
  app.post("/api/demo", (req, res) => {
    if (process.env.DISABLE_DEMO === "true")
      return res.status(403).json({ error: "Demo access is disabled." });
    const role = req.body.role;
    if (!["admin", "guard", "visitor"].includes(role))
      return res.status(400).json({ error: "Invalid role" });
    session(res, role);
    res.json({ ok: true });
  });
  app.post("/api/login", (req, res) => {
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(String(req.body.email || "").toLowerCase());
    if (
      !user ||
      !bcrypt.compareSync(String(req.body.password || ""), user.password)
    )
      return res.status(401).json({ error: "Incorrect email or password." });
    session(res, user.id);
    res.json({ ok: true });
  });
  app.post("/api/signup", (req, res) => {
    const { name, email, password, company, host, purpose, scheduled } =
      req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 120 ||
      typeof host !== "string" ||
      !host.trim() ||
      host.length > 120 ||
      typeof purpose !== "string" ||
      !purpose.trim() ||
      purpose.length > 120 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(email || "") ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72 ||
      !Number.isFinite(Date.parse(scheduled))
    )
      return res.status(400).json({
        error:
          "Complete all fields and use a password of at least 8 characters.",
      });
    if (
      db.prepare("SELECT id FROM users WHERE email=?").get(email.toLowerCase())
    )
      return res.status(409).json({
        error: "An account with this email already exists. Please sign in.",
      });
    const id = randomUUID();
    db.exec("BEGIN");
    try {
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
        id,
        name.trim().slice(0, 120),
        email.toLowerCase(),
        bcrypt.hashSync(password, 10),
        "visitor",
      );
      db.prepare("INSERT INTO visitors VALUES(?,?,?,?,?,?,?,?,?,?)").run(
        randomUUID(),
        name.trim().slice(0, 120),
        email.toLowerCase(),
        String(company || "").slice(0, 120),
        host.trim().slice(0, 120),
        purpose.slice(0, 120),
        new Date(scheduled).toISOString(),
        randomUUID(),
        id,
        new Date().toISOString(),
      );
      session(res, id);
      db.exec("COMMIT");
      res.status(201).json({ ok: true });
    } catch {
      db.exec("ROLLBACK");
      res.status(500).json({
        error: "Your account could not be created. Please try again.",
      });
    }
  });
  app.post("/api/logout", (req, res) => {
    const token = (req.headers.cookie || "").match(
      /entry_session=([^;]+)/,
    )?.[1];
    db.prepare("DELETE FROM sessions WHERE token=?").run(token || "");
    res.clearCookie("entry_session");
    res.json({ ok: true });
  });
  app.use("/api", (req, res, next) => {
    const token = (req.headers.cookie || "").match(
      /entry_session=([^;]+)/,
    )?.[1];
    req.user = db
      .prepare(
        "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
      )
      .get(token || "", Date.now());
    if (!req.user)
      return res.status(401).json({ error: "Please sign in to continue." });
    next();
  });
  app.get("/api/session", (req, res) => res.json(req.user));
  app.get("/api/visitors", (req, res) => {
    const rows = db
      .prepare(
        `SELECT v.*, (SELECT time_in FROM visits WHERE visitor_id=v.id ORDER BY time_in DESC LIMIT 1) time_in, (SELECT time_out FROM visits WHERE visitor_id=v.id ORDER BY time_in DESC LIMIT 1) time_out FROM visitors v ${req.user.role === "visitor" ? "WHERE v.user_id=?" : ""} ORDER BY v.created_at DESC, v.scheduled`,
      )
      .all(...(req.user.role === "visitor" ? [req.user.id] : []));
    res.json(
      rows.map((v) => ({
        ...v,
        status: v.time_in
          ? v.time_out
            ? "Checked out"
            : "Checked in"
          : "Expected",
      })),
    );
  });
  app.post("/api/visitors", (req, res) => {
    if (req.user.role !== "admin")
      return res
        .status(403)
        .json({ error: "Only admins can register visitors." });
    const { name, email, company, host, purpose, scheduled } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 120 ||
      typeof host !== "string" ||
      !host.trim() ||
      host.length > 120 ||
      typeof purpose !== "string" ||
      !purpose.trim() ||
      purpose.length > 120 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(email || "") ||
      !Number.isFinite(Date.parse(scheduled))
    )
      return res.status(400).json({
        error:
          "Please complete all required fields with a valid email and visit date.",
      });
    const id = randomUUID();
    db.prepare("INSERT INTO visitors VALUES(?,?,?,?,?,?,?,?,?,?)").run(
      id,
      name.trim().slice(0, 120),
      email.toLowerCase(),
      String(company || "").slice(0, 120),
      host.trim().slice(0, 120),
      purpose.slice(0, 120),
      new Date(scheduled).toISOString(),
      randomUUID(),
      db
        .prepare("SELECT id FROM users WHERE email=? AND role='visitor'")
        .get(email.toLowerCase())?.id || null,
      new Date().toISOString(),
    );
    res
      .status(201)
      .json(db.prepare("SELECT * FROM visitors WHERE id=?").get(id));
  });
  app.post("/api/scan", (req, res) => {
    if (!["admin", "guard"].includes(req.user.role))
      return res
        .status(403)
        .json({ error: "This action requires guard or admin access." });
    try {
      res.json(
        scanVisitor(db, String(req.body.token || "").trim(), req.user.id),
      );
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });
  app.get("/api/logs", (req, res) => {
    if (req.user.role === "visitor")
      return res.status(403).json({ error: "Access denied." });
    res.json(
      db
        .prepare(
          "SELECT l.*,v.name,v.company,v.host,v.purpose FROM visits l JOIN visitors v ON l.visitor_id=v.id ORDER BY l.time_in DESC",
        )
        .all(),
    );
  });
  app.use("/api", (_, res) => res.status(404).json({ error: "Not found" }));

  return app;
}
