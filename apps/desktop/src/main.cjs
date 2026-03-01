const { app, BrowserWindow } = require("electron");
const path = require("node:path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#0f1317",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const webUrl = process.env.EBONKEEP_WEB_URL || "http://localhost:5173";
  window.loadURL(webUrl).catch((error) => {
    console.error("Failed to load URL", error);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
