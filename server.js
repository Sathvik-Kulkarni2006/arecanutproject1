
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your GitHub Pages website and local development.
app.use(cors({
  origin: [
    "https://YOUR-GITHUB-USERNAME.github.io",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API key: configure DEVICE_API_KEY in Render environment variables.
// ESP32s must send this key in the x-device-key header.
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "";

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
function checkDeviceKey(req, res, next) {
  if (!DEVICE_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "DEVICE_API_KEY is not configured on the server."
    });
  }

  if (req.get("x-device-key") !== DEVICE_API_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Invalid device API key."
    });
  }

  next();
}

function applyMoisture(rowKey, moisture, raw, source = "esp32") {
  if (!state.rows[rowKey]) {
    throw new Error("deviceId must be row1 or row2");
  }

  const value = Number(moisture);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Moisture must be a number between 0 and 100");
  }

  const row = state.rows[rowKey];

  row.moisture = value;
  row.valve = value < row.threshold ? "OPEN" : "CLOSED";
  row.sensorOnline = true;
  row.receivedFrom = source;
  row.lastUpdate = new Date().toISOString();

  state.lastUpdate = row.lastUpdate;

  state.history.unshift({
    at: row.lastUpdate,
    row: rowKey,
    moisture: value,
    raw: raw ?? null,
    valve: row.valve
  });

  state.history = state.history.slice(0, 1000);
}

// Health check: supports both /health and /api/health.
app.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({
    ok: true,
    service: "arecanut-irrigation-backend"
  });
});

// Get both rows' latest readings.
app.get("/api/status", (req, res) => {
  res.json(state);
});

// ESP32 posts one row using deviceId, moisture, raw, valveOn.
// Also supports a central controller posting { row1, row2 }.
app.post("/api/readings", checkDeviceKey, (req, res) => {
  try {
    const body = req.body || {};

    if (body.deviceId !== undefined) {
      const id = String(body.deviceId).toLowerCase();

      if (!["row1", "row2"].includes(id)) {
        return res.status(400).json({
          ok: false,
          error: "deviceId must be row1 or row2"
        });
      }

      applyMoisture(id, body.moisture, body.raw, "esp32");

      // Reflect actual valve feedback if hardware provides it.
      // Otherwise the backend calculates the recommended valve state.
      if (typeof body.valveOn === "boolean") {
        state.rows[id].valve = body.valveOn ? "OPEN" : "CLOSED";
      }
    } else {
      if (body.row1 !== undefined) {
        applyMoisture("row1", body.row1, null, "central-esp32");
      }

      if (body.row2 !== undefined) {
        applyMoisture("row2", body.row2, null, "central-esp32");
      }

      if (body.row1 === undefined && body.row2 === undefined) {
        return res.status(400).json({
          ok: false,
          error: "Provide deviceId and moisture, or row1/row2 values."
        });
      }
    }

    res.json({ ok: true, state });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

// Optional demo route. Protect it with an API key too.
app.post("/api/demo/tick", checkDeviceKey, (req, res) => {
  for (const key of ["row1", "row2"]) {
    const current = state.rows[key].moisture ?? 50;
    const next = key === "row1"
      ? Math.max(0, current - 2)
      : Math.min(100, current + 1);

    applyMoisture(key, next, null, "demo");
  }

  res.json({ ok: true, state });
});

// Manual dashboard valve override.
// This changes backend state only; it does not operate a physical valve
// unless you implement a command-polling mechanism in the ESP32 firmware.
app.post("/api/valve/:row/:action", (req, res) => {
  const key = req.params.row.toLowerCase();
  const action = req.params.action.toUpperCase();

  if (!state.rows[key] || !["OPEN", "CLOSED"].includes(action)) {
    return res.status(400).json({
      ok: false,
      error: "Use row1/row2 and open/closed."
    });
  }

  state.rows[key].valve = action;
  state.lastUpdate = new Date().toISOString();

  res.json({ ok: true, state });
});

// Basic root response for deployment checks.
app.get("/", (req, res, next) => {
  const indexPath = path.join(__dirname, "public", "index.html");

  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Arecanut irrigation backend listening on port ${PORT}`);
});
