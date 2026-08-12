import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  cacheDir: ".vite-preview-cache",
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
});

await server.listen();
server.printUrls();
