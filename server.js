
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const DEVICE_API_KEY = process.env.DEVICE_API_KEY;

app.use(cors({
  origin: [
    "https://sathvik-kulkarni2006.github.io",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]
}));

app.use(express.json({ limit: "10kb" }));

// Initial values are demo values, not actual sensor readings.
const state = {
  system: "online",
  communication: "Wi-Fi / HTTPS",
  lastUpdate: new Date().toISOString(),
  rows: {
    row1: {
      id: 1,
      moisture: 32,
      threshold: 35,
      valve: "OPEN",
      sensorOnline: false,
      receivedFrom: "demo"
    },
    row2: {
      id: 2,
      moisture: 68,
      threshold: 35,
      valve: "CLOSED",
      sensorOnline: false,
      receivedFrom: "demo"
    }
  },
  history: []
};

// Authenticate ESP32 devices
function authenticateDevice(req, res, next) {
  if (!DEVICE_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Set DEVICE_API_KEY in Render Environment"
    });
  }

  if (req.get("x-device-key") !== DEVICE_API_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Invalid or missing device API key"
    });
  }

  next();
}

// Save a real sensor reading
function applyMoisture(rowKey, moisture, raw) {
  const row = state.rows[rowKey];

  row.moisture = moisture;
  row.valve = moisture < row.threshold ? "OPEN" : "CLOSED";
  row.sensorOnline = true;
  row.receivedFrom = "esp32";

  state.lastUpdate = new Date().toISOString();

  state.history.unshift({
    at: state.lastUpdate,
    row: rowKey,
    moisture,
    raw: raw ?? null,
    valve: row.valve,
    receivedFrom: "esp32"
  });

  state.history = state.history.slice(0, 30);
}

// Root and health endpoints
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "arecanut-irrigation-backend"
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "arecanut-irrigation-backend" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "arecanut-irrigation-backend" });
});

// Dashboard reads this endpoint
app.get("/api/status", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(state);
});

// ESP32 sends:
// {"deviceId":"row1","moisture":42,"raw":2340}
app.post("/api/readings", authenticateDevice, (req, res) => {
  const body = req.body || {};
  const deviceId = String(body.deviceId || "").toLowerCase();
  const moisture = Number(body.moisture);

  if (!["row1", "row2"].includes(deviceId)) {
    return res.status(400).json({
      ok: false,
      error: "deviceId must be row1 or row2"
    });
  }

  if (
    body.moisture === undefined ||
    !Number.isFinite(moisture) ||
    moisture < 0 ||
    moisture > 100
  ) {
    return res.status(400).json({
      ok: false,
      error: "moisture must be a number from 0 to 100"
    });
  }

  const raw = Number.isFinite(Number(body.raw))
    ? Number(body.raw)
    : null;

  applyMoisture(deviceId, moisture, raw);

  res.json({
    ok: true,
    deviceId,
    moisture,
    state
  });
});

// Configure the moisture threshold for a row
app.post("/api/threshold/:row", authenticateDevice, (req, res) => {
  const rowKey = String(req.params.row).toLowerCase();
  const threshold = Number(req.body?.threshold);

  if (!state.rows[rowKey]) {
    return res.status(400).json({
      ok: false,
      error: "Row must be row1 or row2"
    });
  }

  if (
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 100
  ) {
    return res.status(400).json({
      ok: false,
      error: "Threshold must be between 0 and 100"
    });
  }

  state.rows[rowKey].threshold = threshold;

  const row = state.rows[rowKey];
  if (row.moisture !== null) {
    row.valve = row.moisture < threshold ? "OPEN" : "CLOSED";
  }

  res.json({ ok: true, state });
});

// Demo endpoint, protected by API key
app.post("/api/demo/tick", authenticateDevice, (req, res) => {
  for (const key of ["row1", "row2"]) {
    const row = state.rows[key];
    const next = key === "row1"
      ? Math.max(20, row.moisture - 2)
      : Math.min(80, row.moisture + 1);

    row.moisture = next;
    row.valve = next < row.threshold ? "OPEN" : "CLOSED";
    row.sensorOnline = false;
    row.receivedFrom = "demo";

    state.lastUpdate = new Date().toISOString();

    state.history.unshift({
      at: state.lastUpdate,
      row: key,
      moisture: next,
      valve: row.valve,
      receivedFrom: "demo"
    });
  }

  state.history = state.history.slice(0, 30);
  res.json({ ok: true, state });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API route not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Irrigation backend listening on port ${PORT}`);
});
