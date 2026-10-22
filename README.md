# Smart Arecanut Irrigation — Dashboard + Backend

## Included
- Responsive web dashboard with a top-view illustration of two arecanut rows.
- Separate moisture ratio, threshold, and valve status for each row.
- Node.js + Express backend with JSON API and recent-reading history.
- Demo controls to test the dashboard without physical hardware.
- ESP32/ESP-NOW integration architecture notes.

## Run locally
1. Install Node.js (LTS).
2. Extract this ZIP and open a terminal in this folder.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`

## API
- `GET /api/status` — current dashboard data
- `POST /api/readings` — receive readings, JSON example:
  `{"row1":32,"row2":68}`
- `POST /api/valve/row1/open` or `/closed` — demo/manual status override
- `POST /api/demo/tick` — simulated readings
- `GET /api/health` — backend health

## Important hardware architecture
The dashboard/backend is a working demo, not a direct ESP-NOW radio receiver. ESP-NOW messages are exchanged between ESP32 devices, not by a browser. A practical setup is:
1. Each row's sensor ESP32 reads its calibrated moisture sensor and sends `{row, moisture}` over ESP-NOW to the central ESP32.
2. The central ESP32 applies the moisture threshold independently for Row 1 and Row 2, then sends a row-specific command to each valve ESP32 using ESP-NOW.
3. The central ESP32 connects to Wi-Fi and posts the readings to `POST /api/readings` so the browser dashboard can update.
4. Valve ESP32s operate relays using safe, properly rated driver circuits. Configure relay active-high/active-low according to the module.
5. Use a shared, agreed ESP-NOW packet structure and MAC addresses. Do not assume the sample API is wired to physical outputs.

## Calibration and safety
- Demo threshold is 45% only as an example. Calibrate your specific sensor in your soil and define thresholds for the crop.
- Many low-cost capacitive sensors report raw ADC counts rather than true percent. Calibrate dry and wet endpoints before converting to a percentage.
- Never connect a valve or pump directly to an ESP32 GPIO. Use a correctly rated relay/driver, separate power supply as required, and safe electrical isolation.
- This demo's manual valve buttons only change dashboard state. Real valve operation must be implemented in firmware and tested safely.
