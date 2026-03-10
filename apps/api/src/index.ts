import { startServer } from "./app.js";

void startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
