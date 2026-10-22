const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Demo values. Replace with readings received from your central ESP32.
const state = {
  system: "online",
  communication: "ESP-NOW",
  lastUpdate: new Date().toISOString(),
  rows: {
    row1: { id: 1, moisture: 32, threshold: 45, valve: "OPEN", sensorOnline: true, receivedFrom: "demo" },
    row2: { id: 2, moisture: 68, threshold: 45, valve: "CLOSED", sensorOnline: true, receivedFrom: "demo" }
  },
  history: []
};

function applyMoisture(rowKey, moisture, source = "api") {
  if (!state.rows[rowKey]) throw new Error("rowKey must be row1 or row2");
  const row = state.rows[rowKey];
  row.moisture = Math.max(0, Math.min(100, Number(moisture)));
  // Illustrative threshold logic; tune for your crop, soil and sensor calibration.
  row.valve = row.moisture < row.threshold ? "OPEN" : "CLOSED";
  row.sensorOnline = true;
  row.receivedFrom = source;
  state.lastUpdate = new Date().toISOString();
  state.history.unshift({ at: state.lastUpdate, row: rowKey, moisture: row.moisture, valve: row.valve });
  state.history = state.history.slice(0, 30);
}

app.get("/api/status", (req, res) => res.json(state));

// Central controller / test simulator posts both row moisture values here.
app.post("/api/readings", (req, res) => {
  const { row1, row2 } = req.body || {};
  try {
    if (row1 !== undefined) applyMoisture("row1", row1, "central-esp32");
    if (row2 !== undefined) applyMoisture("row2", row2, "central-esp32");
    res.json({ ok: true, state });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

// Optional manual override for demo/testing only.
app.post("/api/valve/:row/:action", (req, res) => {
  const key = req.params.row.toLowerCase() === "row1" ? "row1" :
              req.params.row.toLowerCase() === "row2" ? "row2" : null;
  const action = req.params.action.toUpperCase();
  if (!key || !["OPEN", "CLOSED"].includes(action))
    return res.status(400).json({ ok: false, error: "Use row1/row2 and open/closed." });
  state.rows[key].valve = action;
  state.lastUpdate = new Date().toISOString();
  state.history.unshift({ at: state.lastUpdate, row: key, moisture: state.rows[key].moisture, valve: action, manual: true });
  res.json({ ok: true, state });
});

// Simulated changes so the dashboard works before hardware is connected.
app.post("/api/demo/tick", (req, res) => {
  for (const key of ["row1", "row2"]) {
    const current = state.rows[key].moisture;
    const next = key === "row1" ? Math.max(20, current - 2) : Math.min(80, current + 1);
    applyMoisture(key, next, "demo");
  }
  res.json({ ok: true, state });
});

app.get("/api/health", (req, res) => res.json({ ok: true, service: "arecanut-irrigation-backend" }));
app.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));
