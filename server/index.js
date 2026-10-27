import express from "express";
import { createDatabase, seed } from "./db.js";
import { createApp } from "./app.js";
const db = createDatabase();
seed(db);
const app = createApp(db);
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("/{*path}", (_, res) => res.sendFile("index.html", { root: "dist" }));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(3000, "0.0.0.0", () =>
  console.log("Entry is ready on http://localhost:3000"),
);
