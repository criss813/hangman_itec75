import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  ClipboardList,
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Bell,
  HelpCircle,
  LogOut,
  X,
  Check,
  CalendarDays,
  Clock3,
  ShieldCheck,
  Download,
  MoreHorizontal,
  Building2,
  QrCode,
  Menu,
  CheckCircle2,
  Camera,
  Mail,
  Filter,
  DoorOpen,
  ExternalLink,
  AlertCircle,
  UserRound,
  Copy,
} from "lucide-react";
import QRCode from "qrcode";
import "./styles.css";
const api = async (path, options = {}) => {
  const res = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
};
const initials = (n) =>
  n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
const time = (d) =>
  d
    ? new Date(d).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
const day = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const colors = ["lavender", "peach", "mint", "rose", "blue", "sand"];
function App() {
  const [user, setUser] = useState(null),
    [page, setPage] = useState("Overview"),
    [visitors, setVisitors] = useState([]),
    [logs, setLogs] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All visitors"),
    [period, setPeriod] = useState("Today"),
    [menu, setMenu] = useState(false),
    [sidebar, setSidebar] = useState(false),
    [notifications, setNotifications] = useState(false),
    [globalSearch, setGlobalSearch] = useState(""),
    [qr, setQr] = useState(""),
    [scanValue, setScanValue] = useState(""),
    [scanResult, setScanResult] = useState(null),
    [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [offset, setOffset] = useState(0);
  const scannerRef = useRef(null);
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        document.querySelector(".global-search input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector('[role="dialog"]');
    const focusable = () => [
      ...dialog.querySelectorAll(
        "button:not([disabled]), a[href], input, select",
      ),
    ];
    const elements = focusable();
    (dialog.querySelector("input") || elements[0])?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && user) {
        setModal(null);
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusable();
      const first = list[0],
        last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [modal, user]);
  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };
  async function refresh() {
    const data = await api("/visitors");
    setVisitors(data);
  }
  async function loadSession() {
    try {
      const u = await api("/session");
      const records = await api("/visitors");
      setUser(u);
      setVisitors(records);
      setPage(u.role === "visitor" ? "My visitor pass" : "Overview");
      return u;
    } catch {
      setModal({ type: "login" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    (async () => {
      try {
        await api("/session");
      } catch {
        await api("/demo", { method: "POST", body: { role: "admin" } }).catch(
          () => {},
        );
      }
      await loadSession();
    })();
  }, []);
  useEffect(() => {
    if (page !== "Scan QR code") setCamera(false);
  }, [page]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const update = async () => {
      if (document.hidden) return;
      try {
        const records = await api("/visitors");
        if (active) setVisitors(records);
      } catch {
        /* Keep the current view during a temporary network interruption. */
      }
    };
    const timer = setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [user?.id]);
  useEffect(() => {
    if (page === "Access logs" && user)
      api("/logs")
        .then(setLogs)
        .catch((e) => setError(e.message));
  }, [page, visitors, user]);
  useEffect(() => {
    setOffset(0);
  }, [search, filter, period, page, globalSearch]);
  useEffect(() => {
    if (modal?.type === "pass")
      QRCode.toDataURL(modal.visitor.token, {
        width: 320,
        margin: 2,
        color: { dark: "#183f35", light: "#ffffff" },
      }).then(setQr);
    else setQr("");
    setError("");
  }, [modal]);
  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    let scanner;
    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (stopped) return;
      scanner = new Html5Qrcode("qr-camera");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          async (decoded) => {
            if (stopped) return;
            stopped = true;
            setCamera(false);
            setScanValue(decoded);
            await handleScan(decoded);
          },
        );
        if (stopped && scanner.isScanning) await scanner.stop();
      } catch {
        setError(
          "Camera access is unavailable. Allow camera access or enter the visitor ID below.",
        );
        setCamera(false);
      }
    });
    return () => {
      stopped = true;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [camera]);
  async function switchRole(role) {
    setBusy(true);
    try {
      await api("/demo", { method: "POST", body: { role } });
      setVisitors([]);
      setLogs([]);
      setScanResult(null);
      setModal(null);
      setMenu(false);
      setFilter("All visitors");
      await loadSession();
      notify(`Switched to ${role} workspace`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function handleScan(value = scanValue) {
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/scan", {
        method: "POST",
        body: { token: value.trim() },
      });
      setScanResult(result);
      setScanValue("");
      await refresh();
      notify(`${result.name} ${result.action}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addVisitor(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const visitor = await api("/visitors", { method: "POST", body: form });
      await refresh();
      setModal({ type: "pass", visitor });
      notify("Visitor registered. Their pass is ready.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = Object.fromEntries(new FormData(e.currentTarget));
      await api("/login", { method: "POST", body: form });
      setModal(null);
      setPage("Overview");
      await loadSession();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function signUp(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = Object.fromEntries(new FormData(e.currentTarget));
      await api("/signup", { method: "POST", body: form });
      setModal(null);
      setPage("My visitor pass");
      await loadSession();
      notify("Your visitor account and pass are ready.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const now = new Date();
  const dateMatches = (d) => {
    if (period === "All time") return true;
    const date = new Date(d);
    if (period === "This week")
      return (
        now - date < 7 * 86400000 && date <= new Date(now.getTime() + 86400000)
      );
    return date.toDateString() === now.toDateString();
  };
  const todayVisitors = visitors.filter((v) => dateMatches(v.scheduled));
  const filtered = todayVisitors.filter(
    (v) =>
      (filter === "All visitors" || v.status === filter) &&
      `${v.name} ${v.email} ${v.company} ${v.host}`
        .toLowerCase()
        .includes((search || globalSearch).toLowerCase()),
  );
  const checkedIn = visitors.filter((v) => v.status === "Checked in").length,
    checkedOut = todayVisitors.filter((v) => v.status === "Checked out").length,
    expected = todayVisitors.filter((v) => v.status === "Expected").length;
  const nav =
    user?.role === "visitor"
      ? [
          ["My visitor pass", QrCode],
          ["My visits", ClipboardList],
        ]
      : [
          ["Overview", LayoutDashboard],
          ["Visitors", Users],
          ["Scan QR code", ScanLine],
          ["Access logs", ClipboardList],
        ];
  const navigate = (p) => {
    setPage(p);
    setSearch("");
    setGlobalSearch("");
    setSidebar(false);
    setError("");
  };
  function exportCsv() {
    const rows = page === "Access logs" ? logs : filtered;
    const headers =
      page === "Access logs"
        ? ["name", "company", "host", "time_in", "time_out"]
        : [
            "name",
            "email",
            "company",
            "host",
            "purpose",
            "status",
            "time_in",
            "time_out",
          ];
    const csv = [headers, ...rows.map((v) => headers.map((h) => v[h] || ""))]
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "entry-" + (page === "Access logs" ? "access-logs" : "visitors") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Your export is ready.");
  }
  function VisitorTable() {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                Visitor <ChevronDown size={12} />
              </th>
              <th>Host</th>
              <th>Purpose of visit</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(offset, offset + 6).map((v, i) => (
              <tr key={v.id}>
                <td>
                  <button
                    className="person-cell"
                    onClick={() => setModal({ type: "pass", visitor: v })}
                  >
                    <span
                      className={
                        "avatar " + colors[(offset + i) % colors.length]
                      }
                    >
                      {initials(v.name)}
                    </span>
                    <span>
                      <strong>{v.name}</strong>
                      <small>{v.company || v.email}</small>
                    </span>
                  </button>
                </td>
                <td>{v.host}</td>
                <td>
                  <span className="purpose">{v.purpose}</span>
                </td>
                <td className="time-cell">{time(v.time_in)}</td>
                <td className="time-cell">{time(v.time_out)}</td>
                <td>
                  <span
                    className={
                      "status " + v.status.toLowerCase().replace(" ", "-")
                    }
                  >
                    <i />
                    {v.status}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button table-more"
                    aria-label={"View pass for " + v.name}
                    onClick={() => setModal({ type: "pass", visitor: v })}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty-state">
            <Users size={30} />
            <h3>No visitors found</h3>
            <p>Try a different search or register a new visitor.</p>
          </div>
        )}
      </div>
    );
  }
  if (loading)
    return (
      <div className="loading">
        <div className="brand-icon">
          <DoorOpen />
        </div>
        <p>Opening your workspace…</p>
      </div>
    );
  return (
    <div className="app">
      <aside className={"sidebar " + (sidebar ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate(user?.role === "visitor" ? "My visitor pass" : "Overview");
          }}
        >
          <span className="brand-icon">
            <DoorOpen size={25} strokeWidth={1.7} />
          </span>
          entry<span className="brand-dot">.</span>
        </a>
        <button
          className="workspace"
          onClick={() => setModal({ type: "workspace" })}
        >
          <span className="workspace-icon">
            <Building2 size={19} />
          </span>
          <span>
            <strong>The Workspace</strong>
            <small>Visitor management</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Visitors" && <b>{visitors.length}</b>}
              {page === name && <span className="active-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-symbol">
              <ShieldCheck size={23} />
            </span>
            <strong>
              A warm welcome.
              <br />A safer workspace.
            </strong>
            <p>Every visitor, accounted for.</p>
            <button onClick={() => setModal({ type: "help" })}>
              Explore the guide <ArrowUpRight size={15} />
            </button>
            <div className="card-rings" />
          </div>
          <button
            className={"bottom-nav " + (page === "Settings" ? "selected" : "")}
            onClick={() => navigate("Settings")}
          >
            <Settings size={19} />
            Settings
          </button>
          <button
            className="bottom-nav"
            onClick={() => setModal({ type: "help" })}
          >
            <HelpCircle size={19} />
            Help & support <ArrowUpRight size={14} />
          </button>
          <div className="profile-wrap">
            <button className="profile" onClick={() => setMenu(!menu)}>
              <span className="avatar profile-avatar">
                {initials(user?.name || "Guest")}
              </span>
              <span>
                <strong>{user?.name || "Guest"}</strong>
                <small>
                  {user?.role === "admin"
                    ? "Administrator"
                    : user?.role === "guard"
                      ? "Security guard"
                      : "Visitor"}
                </small>
              </span>
              <ChevronDown size={16} />
            </button>
            {menu && (
              <div className="profile-menu">
                <p>DEMO WORKSPACE</p>
                {["admin", "guard", "visitor"].map((role) => (
                  <button key={role} onClick={() => switchRole(role)}>
                    <UserRound size={15} />
                    {role === "admin"
                      ? "Administrator"
                      : role === "guard"
                        ? "Security guard"
                        : "Visitor"}
                    {user?.role === role && <Check size={14} />}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setMenu(false);
                    setModal({ type: "login" });
                  }}
                >
                  <LogOut size={15} />
                  Sign in to an account
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="live-dot" />
          All systems operational <span>v1.0</span>
        </div>
      </aside>
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setSidebar(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={16} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setPage("Visitors");
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">
              <button
                className="notification icon-button"
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                <i />
              </button>
              {notifications && (
                <div className="notification-panel">
                  <strong>Workspace updates</strong>
                  <p>
                    <span className="live-dot" />
                    {checkedIn} visitors are currently on site.
                  </p>
                  <p>
                    <CalendarDays size={14} />
                    {expected} visitors expected today.
                  </p>
                  <small>You’re all caught up.</small>
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <button
              className="avatar top-avatar"
              onClick={() => setMenu(!menu)}
              aria-label="Open account menu"
            >
              {initials(user?.name || "Guest")}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR SPACE, CONNECTED</div>
              <h1>
                {page === "Overview"
                  ? "A good day starts with a welcome."
                  : page === "Visitors"
                    ? "People make the place."
                    : page === "Scan QR code"
                      ? "A seamless arrival starts here."
                      : page === "Access logs"
                        ? "Every visit, in the picture."
                        : page === "Settings"
                          ? "Make yourself at home."
                          : page === "My visitor pass"
                            ? "You’re always welcome."
                            : "Your visits, at a glance."}
              </h1>
              <p>
                {page === "Overview" ? (
                  <>
                    Here’s what’s happening at your workspace today.{" "}
                    <span className="wave">✦</span>
                  </>
                ) : page === "Visitors" ? (
                  "Welcome, manage, and keep track of everyone who walks in."
                ) : page === "Scan QR code" ? (
                  "Scan a visitor’s pass to securely log their arrival or departure."
                ) : page === "Access logs" ? (
                  "A complete record of who came in, and when they left."
                ) : page === "Settings" ? (
                  "Your account, workspace, and access preferences."
                ) : (
                  "Your personal visitor ID. Ready when you are."
                )}
              </p>
            </div>
            <div className="heading-actions">
              {user?.role !== "visitor" && (
                <button
                  className="button secondary scan-heading"
                  onClick={() => navigate("Scan QR code")}
                >
                  <ScanLine size={17} />
                  Scan QR code
                </button>
              )}
              {user?.role === "admin" && (
                <button
                  className="button primary"
                  onClick={() => setModal({ type: "register" })}
                >
                  <Plus size={17} />
                  Register visitor
                </button>
              )}
            </div>
          </div>
          {error && !modal && (
            <div className="error">
              <AlertCircle size={17} />
              {error}
              <button onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {["Overview", "Visitors", "My visits"].includes(page) && (
            <>
              <div className="section-top">
                <div className="section-tabs">
                  <button
                    className="current"
                    onClick={() => setPeriod("Today")}
                  >
                    {page === "Overview" ? "At a glance" : "Visitor directory"}
                  </button>
                  {page === "Overview" && (
                    <span className="live-label">
                      <i />
                      Live overview
                    </span>
                  )}
                </div>
                <div className="date-controls">
                  <span className="current-date">
                    <CalendarDays size={15} />
                    {now.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <select
                    aria-label="Date range"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option>Today</option>
                    <option>This week</option>
                    <option>All time</option>
                  </select>
                </div>
              </div>
              <div className="stat-grid">
                {[
                  {
                    label: "Total visitors",
                    value: todayVisitors.length,
                    icon: Users,
                    detail: "Registered visitors",
                    color: "purple",
                    trend: "A connected workspace",
                  },
                  {
                    label: "Currently on site",
                    value: checkedIn,
                    icon: ArrowDownLeft,
                    detail: "Checked in right now",
                    color: "green",
                    trend: "Live occupancy",
                    live: true,
                  },
                  {
                    label: "Checked out",
                    value: checkedOut,
                    icon: ArrowUpRight,
                    detail: "Visits completed",
                    color: "orange",
                    trend: "All visits logged securely",
                  },
                  {
                    label: "Expected visitors",
                    value: expected,
                    icon: CalendarDays,
                    detail: "Yet to arrive",
                    color: "blue",
                    trend: "A warm welcome awaits",
                  },
                ].map((s, i) => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-title">
                      <span>{s.label}</span>
                      <span className={"stat-icon " + s.color}>
                        <s.icon size={18} />
                      </span>
                    </div>
                    <div className="stat-value">
                      {String(s.value).padStart(2, "0")}
                      <span>{s.detail}</span>
                    </div>
                    <div className="stat-foot">
                      {s.live ? (
                        <i className="live-dot" />
                      ) : i === 0 ? (
                        <Users size={12} />
                      ) : i === 2 ? (
                        <ShieldCheck size={12} />
                      ) : (
                        <Clock3 size={12} />
                      )}
                      <span>{s.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
              {page === "Overview" && (
                <div className="middle-grid">
                  <div className="activity-card panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Visitor activity</h2>
                        <p>A little insight into the flow of your day.</p>
                      </div>
                      <div className="chart-key">
                        <span>
                          <i className="in-key" />
                          Check-ins
                        </span>
                        <span>
                          <i className="out-key" />
                          Check-outs
                        </span>
                      </div>
                    </div>
                    <ActivityChart visitors={todayVisitors} />
                    <div className="chart-footer">
                      <span>
                        <span className="chart-footer-icon">
                          <Clock3 size={14} />
                        </span>{" "}
                        Every arrival is a new connection.
                      </span>
                      <span>
                        {todayVisitors.filter((v) => v.time_in).length} arrivals{" "}
                        <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </div>
                  <div className="welcome-card">
                    <div className="welcome-tag">
                      <span className="live-dot" />A BETTER FIRST IMPRESSION
                    </div>
                    <div className="welcome-art">
                      <div className="art-halo halo-one" />
                      <div className="art-halo halo-two" />
                      <div className="art-spark spark-one">✧</div>
                      <div className="art-spark spark-two">✦</div>
                      <div className="mini-pass">
                        <span className="mini-logo">
                          <DoorOpen size={13} />
                          entry.
                        </span>
                        <div className="mini-qr">
                          <QrCode size={58} strokeWidth={1.25} />
                        </div>
                        <span>YOU’RE EXPECTED.</span>
                        <div className="mini-pass-lines" />
                      </div>
                      <div className="art-check">
                        <Check size={22} />
                      </div>
                    </div>
                    <h2>
                      Less waiting.
                      <br />
                      More welcoming.
                    </h2>
                    <p>
                      A simple scan. A seamless check-in.
                      <br />A great start to every visit.
                    </p>
                    <button onClick={() => navigate("Scan QR code")}>
                      Open QR scanner <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
              <section className="visitors-panel panel">
                <div className="visitor-section-heading">
                  <div className="title-inline">
                    <h2>
                      {page === "Overview" ? "Today’s visitors" : "Visitors"}
                    </h2>
                    <span className="count-badge">
                      {todayVisitors.length} visitors
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={
                      page === "Overview"
                        ? () => navigate("Visitors")
                        : exportCsv
                    }
                  >
                    {page === "Overview"
                      ? "View all visitors"
                      : "Export visitors"}
                    {page === "Overview" ? (
                      <ArrowUpRight size={15} />
                    ) : (
                      <Download size={15} />
                    )}
                  </button>
                </div>
                <div className="table-toolbar">
                  <div className="filter-tabs">
                    {[
                      "All visitors",
                      "Checked in",
                      "Checked out",
                      "Expected",
                    ].map((f) => (
                      <button
                        className={filter === f ? "selected" : ""}
                        key={f}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                        {f === "All visitors" && (
                          <span>{todayVisitors.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="table-tools">
                    <label className="table-search">
                      <Search size={15} />
                      <input
                        placeholder="Search visitors..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search visitors"
                      />
                    </label>
                    <button
                      className="filter-button"
                      onClick={() => setModal({ type: "filters" })}
                    >
                      <Filter size={14} />
                      <span>Filters</span>
                    </button>
                  </div>
                </div>
                <VisitorTable />
                <div className="table-footer">
                  <span>
                    Showing{" "}
                    <strong>
                      {filtered.length ? offset + 1 : 0}–
                      {Math.min(offset + 6, filtered.length)}
                    </strong>{" "}
                    of <strong>{filtered.length}</strong> visitors
                  </span>
                  <div className="pagination">
                    <button
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - 6))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from(
                      { length: Math.max(1, Math.ceil(filtered.length / 6)) },
                      (_, i) => (
                        <button
                          key={i}
                          className={offset === i * 6 ? "current" : ""}
                          onClick={() => setOffset(i * 6)}
                        >
                          {i + 1}
                        </button>
                      ),
                    )}
                    <button
                      disabled={offset + 6 >= filtered.length}
                      onClick={() => setOffset(offset + 6)}
                      aria-label="Next page"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {page === "Scan QR code" && (
            <div className="scanner-layout">
              <section className="panel scanner-card">
                <div className="panel-heading">
                  <div>
                    <h2>Visitor QR scanner</h2>
                    <p>One scan to check in. Scan again to check out.</p>
                  </div>
                  <span className="secure-badge">
                    <ShieldCheck size={14} />
                    Secure access
                  </span>
                </div>
                <div className="camera-area">
                  {camera ? (
                    <div id="qr-camera" />
                  ) : (
                    <>
                      <div className="scan-frame">
                        <QrCode size={95} strokeWidth={1} />
                        <span className="scan-corner tl" />
                        <span className="scan-corner tr" />
                        <span className="scan-corner bl" />
                        <span className="scan-corner br" />
                      </div>
                      <p>Position the visitor’s QR code inside the frame</p>
                      <button
                        className="button primary"
                        onClick={() => {
                          setError("");
                          setCamera(true);
                        }}
                      >
                        <Camera size={17} />
                        Enable camera
                      </button>
                    </>
                  )}
                  {camera && (
                    <button
                      className="button secondary"
                      onClick={() => setCamera(false)}
                    >
                      Stop camera
                    </button>
                  )}
                </div>
                <div className="manual-scan">
                  <span>OR ENTER A VISITOR ID</span>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleScan();
                    }}
                  >
                    <input
                      placeholder="Paste the visitor’s pass ID"
                      aria-label="Visitor pass ID"
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      required
                    />
                    <button className="button primary" disabled={busy}>
                      Log visit <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              </section>
              <div className="scanner-side">
                {scanResult ? (
                  <div className="panel scan-success">
                    <CheckCircle2 size={37} />
                    <h2>Successfully {scanResult.action}</h2>
                    <h3>{scanResult.name}</h3>
                    <p>
                      {day(scanResult.time)} · {time(scanResult.time)}
                    </p>
                    <span className="secure-badge">
                      Saved to the access log
                    </span>
                  </div>
                ) : (
                  <div className="panel scan-tips">
                    <span className="stat-icon green">
                      <ScanLine size={22} />
                    </span>
                    <h2>A welcome in seconds.</h2>
                    <p>
                      Ask the visitor to open their digital pass, then scan the
                      QR code.
                    </p>
                    <ol>
                      <li>First scan records the arrival.</li>
                      <li>Next scan records the departure.</li>
                      <li>Every visit is saved automatically.</li>
                    </ol>
                  </div>
                )}
                <div className="panel on-site">
                  <h2>
                    Currently on site{" "}
                    <span className="count-badge">{checkedIn}</span>
                  </h2>
                  {visitors
                    .filter((v) => v.status === "Checked in")
                    .map((v, i) => (
                      <button
                        className="onsite-person"
                        key={v.id}
                        onClick={() => setModal({ type: "pass", visitor: v })}
                      >
                        <span className={"avatar " + colors[i % 6]}>
                          {initials(v.name)}
                        </span>
                        <span>
                          <strong>{v.name}</strong>
                          <small>Since {time(v.time_in)}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
          {page === "Access logs" && (
            <section className="panel logs-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Access history{" "}
                    <span className="count-badge">{logs.length} records</span>
                  </h2>
                  <p>Timestamped records, safely stored in your workspace.</p>
                </div>
                <button className="button secondary" onClick={exportCsv}>
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Host</th>
                      <th>Date</th>
                      <th>Time in</th>
                      <th>Time out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, i) => (
                      <tr key={l.id}>
                        <td>
                          <div className="person-cell">
                            <span className={"avatar " + colors[i % 6]}>
                              {initials(l.name)}
                            </span>
                            <span>
                              <strong>{l.name}</strong>
                              <small>{l.company}</small>
                            </span>
                          </div>
                        </td>
                        <td>{l.host}</td>
                        <td>{day(l.time_in)}</td>
                        <td>{time(l.time_in)}</td>
                        <td>{time(l.time_out)}</td>
                        <td>
                          <span
                            className={
                              "status " +
                              (l.time_out ? "checked-out" : "checked-in")
                            }
                          >
                            <i />
                            {l.time_out ? "Completed" : "On site"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!logs.length && (
                  <div className="empty-state">
                    No visits have been logged yet.
                  </div>
                )}
              </div>
            </section>
          )}
          {page === "My visitor pass" && (
            <div className="visitor-pass-layout">
              <div className="visitor-intro">
                <span className="stat-icon green">
                  <ShieldCheck size={24} />
                </span>
                <h2>
                  Your next great
                  <br />
                  connection starts here.
                </h2>
                <p>
                  Show your digital pass at the front desk.
                  <br />
                  Your guard will scan it when you arrive and leave.
                </p>
                <div className="panel visitor-details">
                  <h3>Your account</h3>
                  <p>
                    <UserRound size={16} />
                    {user?.name}
                  </p>
                  <p>
                    <Mail size={16} />
                    {user?.email}
                  </p>
                  <span className="secure-badge">
                    <ShieldCheck size={14} />
                    Personal visitor access
                  </span>
                </div>
              </div>
              <div className="my-passes">
                {visitors.map((v) => (
                  <div className="panel my-pass-card" key={v.id}>
                    <div className="pass-top">
                      <span className="brand small">entry.</span>
                      <span className="status expected">
                        <i />
                        VISITOR PASS
                      </span>
                    </div>
                    <span className="avatar mint large-avatar">
                      {initials(v.name)}
                    </span>
                    <h2>{v.name}</h2>
                    <p>{v.company}</p>
                    <PassQR token={v.token} />
                    <p className="pass-instruction">
                      Your welcome, in one simple scan.
                    </p>
                    <div className="pass-info">
                      <span>
                        HOST<strong>{v.host}</strong>
                      </span>
                      <span>
                        VISIT DATE<strong>{day(v.scheduled)}</strong>
                      </span>
                    </div>
                    <button
                      className="button secondary full"
                      onClick={() => setModal({ type: "pass", visitor: v })}
                    >
                      <ExternalLink size={16} />
                      Open visitor pass
                    </button>
                  </div>
                ))}
                {!visitors.length && (
                  <div className="panel empty-state">
                    <QrCode size={35} />
                    <h3>Your pass is on its way</h3>
                    <p>Contact your workspace admin to arrange a visit.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {page === "Settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <h2>Account details</h2>
                <p>Your profile and workspace access.</p>
                <div className="settings-profile">
                  <span className="avatar mint large-avatar">
                    {initials(user?.name || "Guest")}
                  </span>
                  <div>
                    <h3>{user?.name}</h3>
                    <span>{user?.email}</span>
                  </div>
                </div>
                <div className="settings-row">
                  <span>Account role</span>
                  <strong className="role-label">{user?.role}</strong>
                </div>
                <div className="settings-row">
                  <span>Workspace</span>
                  <strong>The Workspace</strong>
                </div>
                <div className="settings-row">
                  <span>Time zone</span>
                  <strong>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </strong>
                </div>
                <button
                  className="button secondary"
                  onClick={async () => {
                    await api("/logout", { method: "POST" });
                    setUser(null);
                    setVisitors([]);
                    setModal({ type: "login" });
                  }}
                >
                  {" "}
                  <LogOut size={16} />
                  Sign out
                </button>
              </section>
              <section className="panel settings-panel">
                <span className="stat-icon green">
                  <ShieldCheck size={22} />
                </span>
                <h2>Everyone has their place.</h2>
                <p>Access is tailored to each person’s role.</p>
                <div className="role-description">
                  <strong>Administrator</strong>
                  <p>
                    Register visitors, view passes, scan QR codes, and export
                    access logs.
                  </p>
                </div>
                <div className="role-description">
                  <strong>Security guard</strong>
                  <p>
                    Scan visitor passes and keep track of arrivals and
                    departures.
                  </p>
                </div>
                <div className="role-description">
                  <strong>Visitor</strong>
                  <p>Access your own digital visitor pass and visit history.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setModal({ type: "roles" })}
                >
                  Try a different demo role <ArrowRight size={15} />
                </button>
              </section>
            </div>
          )}
          <footer className="main-footer">
            <span>
              <ShieldCheck size={13} /> A little more welcoming. A lot more
              secure.
            </span>
            <span>
              Made for meaningful connections{" "}
              <span className="footer-spark">✳</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && user) setModal(null);
          }}
        >
          <section
            className={"modal " + (modal.type === "pass" ? "pass-modal" : "")}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.type === "register"
                ? "Register visitor"
                : modal.type === "pass"
                  ? "Visitor pass"
                  : "Workspace dialog"
            }
          >
            <button
              className="modal-close icon-button"
              onClick={() =>
                user ? setModal(null) : setModal({ type: "login" })
              }
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
            {modal.type === "register" && (
              <>
                <span className="modal-icon">
                  <Users size={24} />
                </span>
                <h2>A new face. A warm welcome.</h2>
                <p>Register a visitor and create their personal QR pass.</p>
                <form onSubmit={addVisitor} className="form-grid">
                  <label>
                    Full name <span>*</span>
                    <input
                      name="name"
                      placeholder="e.g. Olivia Rhye"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Email address <span>*</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="olivia@company.com"
                      required
                    />
                  </label>
                  <label>
                    Company
                    <input
                      name="company"
                      placeholder="Company or organization"
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Host <span>*</span>
                    <input
                      name="host"
                      placeholder="Who are they visiting?"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Purpose of visit <span>*</span>
                    <select name="purpose">
                      <option>Business meeting</option>
                      <option>Interview</option>
                      <option>Delivery</option>
                      <option>Site visit</option>
                      <option>Personal visit</option>
                    </select>
                  </label>
                  <label>
                    Visit date & time <span>*</span>
                    <input
                      name="scheduled"
                      type="datetime-local"
                      defaultValue={new Date(
                        Date.now() - new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)}
                      required
                    />
                  </label>
                  {error && <div className="error form-wide">{error}</div>}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setModal(null)}
                    >
                      Cancel
                    </button>
                    <button className="button primary" disabled={busy}>
                      <QrCode size={16} />
                      {busy ? "Creating pass…" : "Create visitor pass"}
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal.type === "pass" && (
              <>
                <div className="pass-top">
                  <span className="brand small">entry.</span>
                  <span className="status expected">
                    <i />
                    VISITOR PASS
                  </span>
                </div>
                <span className="avatar mint large-avatar">
                  {initials(modal.visitor.name)}
                </span>
                <h2>{modal.visitor.name}</h2>
                <p>{modal.visitor.company || modal.visitor.email}</p>
                {qr && (
                  <img
                    className="pass-qr"
                    src={qr}
                    alt={"QR visitor pass for " + modal.visitor.name}
                  />
                )}
                <p className="pass-instruction">
                  Your welcome, in one simple scan.
                </p>
                <div className="pass-info">
                  <span>
                    HOST<strong>{modal.visitor.host}</strong>
                  </span>
                  <span>
                    VISIT DATE<strong>{day(modal.visitor.scheduled)}</strong>
                  </span>
                </div>
                <div className="pass-id">
                  <span>PASS ID</span>
                  <button
                    title="Copy visitor pass ID"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          modal.visitor.token,
                        );
                        notify("Pass ID copied.");
                      } catch {
                        setError("Copy the pass ID shown below.");
                      }
                    }}
                  >
                    {modal.visitor.token}
                    <Copy size={13} />
                  </button>
                </div>
                {error && <div className="error">{error}</div>}
                <div className="pass-buttons">
                  <a
                    className="button secondary"
                    href={qr}
                    download={
                      "entry-pass-" +
                      modal.visitor.name.replaceAll(" ", "-") +
                      ".png"
                    }
                  >
                    <Download size={16} />
                    Download QR
                  </a>
                  {user?.role !== "visitor" && (
                    <button
                      className="button primary"
                      onClick={() => {
                        setScanValue(modal.visitor.token);
                        setModal(null);
                        navigate("Scan QR code");
                      }}
                    >
                      <ScanLine size={16} />
                      Log visit
                    </button>
                  )}
                </div>
                <div className="pass-security">
                  <ShieldCheck size={13} />
                  This pass is personal. Keep it safe.
                </div>
              </>
            )}
            {modal.type === "login" && (
              <>
                <span className="modal-icon">
                  <DoorOpen size={24} />
                </span>
                <h2>Welcome to Entry.</h2>
                <p>A warm welcome, a safer workspace.</p>
                <form onSubmit={signIn} className="login-form">
                  <label>
                    Email address
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="you@company.com"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      required
                      placeholder="Enter your password"
                    />
                  </label>
                  {error && <div className="error">{error}</div>}
                  <button className="button primary full" disabled={busy}>
                    Sign in <ArrowRight size={16} />
                  </button>
                </form>
                <p className="login-link">
                  Here for a visit?{" "}
                  <button onClick={() => setModal({ type: "signup" })}>
                    Create your visitor account
                  </button>
                </p>
                <div className="demo-roles">
                  <span>EXPLORE THE DEMO</span>
                  <div>
                    {["admin", "guard", "visitor"].map((r) => (
                      <button
                        className="button secondary"
                        key={r}
                        onClick={() => switchRole(r)}
                        disabled={busy}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {modal.type === "signup" && (
              <>
                <span className="modal-icon">
                  <UserRound size={24} />
                </span>
                <h2>Your next visit starts here.</h2>
                <p>Create your visitor account and personal QR pass.</p>
                <form className="form-grid" onSubmit={signUp}>
                  <label>
                    Full name
                    <input name="name" required maxLength={120} />
                  </label>
                  <label>
                    Email address
                    <input name="email" type="email" required />
                  </label>
                  <label className="form-wide">
                    Password
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      required
                      placeholder="At least 8 characters"
                    />
                  </label>
                  <label>
                    Company
                    <input name="company" maxLength={120} />
                  </label>
                  <label>
                    Host
                    <input name="host" required maxLength={120} />
                  </label>
                  <label>
                    Purpose
                    <select name="purpose">
                      <option>Business meeting</option>
                      <option>Interview</option>
                      <option>Site visit</option>
                      <option>Personal visit</option>
                    </select>
                  </label>
                  <label>
                    Visit date
                    <input name="scheduled" type="datetime-local" required />
                  </label>
                  {error && <div className="error form-wide">{error}</div>}
                  <button
                    className="button primary full form-wide"
                    disabled={busy}
                  >
                    Create account & pass <ArrowRight size={16} />
                  </button>
                </form>
                <p className="login-link">
                  <button onClick={() => setModal({ type: "login" })}>
                    Already have an account? Sign in
                  </button>
                </p>
              </>
            )}
            {modal.type === "filters" && (
              <>
                <span className="modal-icon">
                  <Filter size={23} />
                </span>
                <h2>Find the right visitors.</h2>
                <p>Choose a status and date range for your directory.</p>
                <label className="standalone-label">
                  Visitor status
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      "All visitors",
                      "Checked in",
                      "Checked out",
                      "Expected",
                    ].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="standalone-label">
                  Date range
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option>Today</option>
                    <option>This week</option>
                    <option>All time</option>
                  </select>
                </label>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Apply filters <Check size={16} />
                </button>
              </>
            )}
            {modal.type === "help" && (
              <>
                <span className="modal-icon">
                  <HelpCircle size={24} />
                </span>
                <h2>A little guidance. A great start.</h2>
                <p>Three simple steps to a welcoming workspace.</p>
                <div className="guide-step">
                  <b>01</b>
                  <div>
                    <h3>Register your visitor</h3>
                    <p>
                      Admins create a visitor record, or visitors create their
                      own account from the sign-in screen.
                    </p>
                  </div>
                </div>
                <div className="guide-step">
                  <b>02</b>
                  <div>
                    <h3>Share their personal pass</h3>
                    <p>
                      Download the QR pass and send it to your visitor. Visitors
                      can also access their own pass online.
                    </p>
                  </div>
                </div>
                <div className="guide-step">
                  <b>03</b>
                  <div>
                    <h3>Scan, welcome, repeat</h3>
                    <p>
                      Guards scan the pass on arrival and departure. Each
                      timestamp is saved to the database automatically.
                    </p>
                  </div>
                </div>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Got it <Check size={16} />
                </button>
              </>
            )}
            {["workspace", "roles"].includes(modal.type) && (
              <>
                <span className="modal-icon">
                  <Building2 size={24} />
                </span>
                <h2>One workspace. Three perspectives.</h2>
                <p>
                  You’re in a demo workspace with sample visitors. Explore how
                  Entry works for each role.
                </p>
                <div className="role-options">
                  {[
                    [
                      "admin",
                      "Administrator",
                      "Manage visitors and see the full picture.",
                      LayoutDashboard,
                    ],
                    [
                      "guard",
                      "Security guard",
                      "Welcome visitors and log their visits.",
                      ScanLine,
                    ],
                    [
                      "visitor",
                      "Visitor",
                      "Your personal pass, always at hand.",
                      QrCode,
                    ],
                  ].map(([role, name, description, Icon]) => (
                    <button
                      disabled={busy}
                      key={role}
                      onClick={() => switchRole(role)}
                    >
                      <span className="stat-icon green">
                        <Icon size={21} />
                      </span>
                      <span>
                        <strong>{name}</strong>
                        <small>{description}</small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
                {error && <div className="error">{error}</div>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function PassQR({ token }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(token, {
      width: 260,
      margin: 2,
      color: { dark: "#183f35" },
    }).then(setUrl);
  }, [token]);
  return (
    url && (
      <img className="pass-qr" src={url} alt="Your personal visitor QR code" />
    )
  );
}
function ActivityChart({ visitors }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const data = hours.map((h) => ({
    in: visitors.filter(
      (v) => v.time_in && new Date(v.time_in).getHours() === h,
    ).length,
    out: visitors.filter(
      (v) => v.time_out && new Date(v.time_out).getHours() === h,
    ).length,
  }));
  const max = Math.max(4, ...data.flatMap((d) => [d.in, d.out]));
  return (
    <div className="activity-chart">
      <div className="chart-y">
        {[
          max,
          Math.round(max * 0.75),
          Math.round(max * 0.5),
          Math.round(max * 0.25),
          0,
        ].map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="grid-lines">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} />
          ))}
        </div>
        <div className="chart-bars">
          {data.map((d, i) => (
            <div
              className="bar-group"
              key={i}
              title={`${hours[i]}:00 — ${d.in} check-ins, ${d.out} check-outs`}
            >
              <div className="bars">
                <div
                  className="bar bar-in"
                  style={{ height: `${(d.in / max) * 100}%` }}
                />
                <div
                  className="bar bar-out"
                  style={{ height: `${(d.out / max) * 100}%` }}
                />
              </div>
              <span>
                {hours[i] > 12 ? hours[i] - 12 : hours[i]}{" "}
                {hours[i] >= 12 ? "PM" : "AM"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
