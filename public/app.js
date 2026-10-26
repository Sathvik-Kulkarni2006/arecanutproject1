
const API_BASE = "https://arecanutproject1.onrender.com";
const $ = id => document.getElementById(id);

function fmtTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function paintRow(key, row) {
  if (!row || row.moisture == null) return;

  const moisture = Number(row.moisture);
  const threshold = Number(row.threshold ?? 35);
  const valve = row.valve || "CLOSED";
  const n = key === "row1" ? "1" : "2";

  $(`${key}Big`).innerHTML = `${moisture}<span>%</span>`;
  $(`${key}Bar`).style.width = `${Math.max(0, Math.min(100, moisture))}%`;
  $(`${key}Valve`).textContent = valve;
  $(`${key}Threshold`).textContent = `${threshold}%`;

  const dry = moisture < threshold;
  $(`${key}Pill`).textContent = dry ? "WATER NEEDED" : "MOISTURE OK";
  $(`${key}Pill`).className = `pill ${dry ? "dry" : "good"}`;

  $(`fieldMoist${n}`).textContent = `${moisture}% moisture`;
  $(`fieldNeed${n}`).textContent = dry
    ? "Dry · watering needed"
    : "Moisture OK";
  $(`fieldValve${n}`).textContent = `VALVE ${valve}`;
  $(`fieldValve${n}`).parentElement.classList.toggle(
    "closed", valve !== "OPEN"
  );
}

function paintHistory(history) {
  const rows = history || [];

  $("historyBody").innerHTML = rows.length
    ? rows.slice(0, 10).map(h => `
      <tr>
        <td>${fmtTime(h.at)}</td>
        <td>${h.row === "row1" ? "Row 01" : "Row 02"}</td>
        <td>${h.moisture}%</td>
        <td>${h.valve || "—"}</td>
        <td>${h.receivedFrom || (h.manual ? "Manual demo" : "ESP32 / demo")}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">No readings received yet.</td></tr>';
}

async function refresh() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) throw new Error("Backend request failed");

    const s = await response.json();

    paintRow("row1", s.rows?.row1);
    paintRow("row2", s.rows?.row2);

    $("lastUpdate").textContent = fmtTime(s.lastUpdate);

    const online = [s.rows?.row1, s.rows?.row2]
      .filter(row => row?.sensorOnline === true).length;

    $("rowsOnline").textContent = `${online} / 2`;
    $("apiStatus").textContent = "ONLINE";
    $("systemStatus").textContent = "BACKEND ONLINE";

    paintHistory(s.history);
  } catch (error) {
    $("apiStatus").textContent = "OFFLINE";
    $("systemStatus").textContent = "BACKEND CONNECTION ERROR";
    console.error("Dashboard refresh failed:", error);
  }
}

// Moisture slider display
$("moistureInput").addEventListener("input", e => {
  $("rangeValue").textContent = `${e.target.value}%`;
});

// Row selection
$("rowSelect").addEventListener("change", () => {
  const key = $("rowSelect").value;
  const value = $( `${key}Big`).textContent.replace("%", "");

  if (value && value !== "null") {
    $("moistureInput").value = value;
    $("rangeValue").textContent = `${value}%`;
  }
});

// These controls are not connected to physical hardware.
// Backend write requests need the configured device API key.
$("sendReading").addEventListener("click", () => {
  alert("Demo writing is temporarily disabled. First verify the live backend connection.");
});

$("simulate").addEventListener("click", () => {
  alert("Simulation is temporarily disabled. First verify the live backend connection.");
});

// Draw the trees once
document.querySelectorAll(".trees").forEach(el => {
  if (el.children.length === 0) {
    for (let i = 0; i < 11; i++) {
      const tree = document.createElement("span");
      tree.className = "tree";
      el.appendChild(tree);
    }
  }
});

// Refresh dashboard every 3 seconds
refresh();
setInterval(refresh, 3000);
```
