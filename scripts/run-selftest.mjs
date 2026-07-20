// Compiles the engine to CommonJS and runs the assertion suite.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
execSync(
  "npx tsc src/engine/*.ts --outDir .selftest --module commonjs --target es2020 --esModuleInterop --skipLibCheck --strict",
  { stdio: "inherit" },
);
mkdirSync(".selftest", { recursive: true });
writeFileSync(".selftest/package.json", '{"type":"commonjs"}\n');
execSync("node scripts/selftest.cjs", { stdio: "inherit" });
