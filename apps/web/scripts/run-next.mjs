import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "dev";
const port =
  process.env.DASHBOARD_PORT ?? process.env.PORT ?? "3000";

const args =
  mode === "start"
    ? ["start", "--port", port]
    : ["dev", "--port", port];

const child = spawn("next", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
