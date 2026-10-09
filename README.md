# Orbit Dashboard

A personal browser dashboard built with Node.js, SQLite, and React.

## Run on Linux

Requires **Node.js 22.5 or newer** (Node 24 recommended), because the server uses Node's built-in SQLite module. No npm install is required.

```bash
unzip orbit-dashboard-linux.zip
cd orbit-dashboard-linux
node server.js
```

Open `http://localhost:3000` in a browser. Stop the server with `Ctrl+C`.

The included `dashboard.db` contains starter content. Deleting that file resets the dashboard to the starter data the next time the server runs.

The interface loads React from esm.sh, so the first browser visit needs internet access; data storage and the Node server remain fully local.
