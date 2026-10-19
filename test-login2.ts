import { spawn } from "child_process";

const server = spawn("cmd", ["/c", "npx tsx server.ts"], {
  cwd: "D:\\warehouse-oms",
  stdio: ["ignore", "pipe", "pipe"]
});

server.stdout.on("data", (data) => {
  console.log(`[SERVER] ${data}`);
});

server.stderr.on("data", (data) => {
  console.error(`[SERVER ERR] ${data}`);
});

server.on("close", (code) => {
  console.log(`Server exited with code ${code}`);
});

// Wait for server to start
setTimeout(async () => {
  try {
    const response = await fetch("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "123456" })
    });
    const text = await response.text();
    console.log(`Response: ${response.status} ${text}`);
  } catch (error) {
    console.error(`Request failed: ${error}`);
  }
  
  server.kill();
  process.exit(0);
}, 5000);