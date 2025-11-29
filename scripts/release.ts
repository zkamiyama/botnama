#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env --allow-net --allow-ffi --unstable
// Build/release helper: Ensures `release` directory exists and runs `deno compile` to produce a single executable.
import { ensureDir } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { fromFileUrl } from "@std/path/from-file-url";

const PROJECT_ROOT = fromFileUrl(new URL("..", import.meta.url));
const RELEASE_DIR = join(PROJECT_ROOT, "release");

async function main() {
  await ensureDir(RELEASE_DIR);
  const platform = Deno.args[0] ?? Deno.env.get("BOTNAMA_BUILD_TARGET") ?? Deno.build.target;
  // Platform-specific exe name
  const exeName = Deno.build.os === "windows" || String(platform).includes("windows") ? "botnama.exe" : "botnama";
  const outputPath = join(RELEASE_DIR, exeName);

  // Files/folders to embed
  const includeGlob = "public/**";

  // Default Deno compile args
  const compileArgs = [
    "compile",
    "--unstable",
    "-A",
    "--output",
    outputPath,
    "--include",
    includeGlob,
    "src/server.ts",
  ];

  // If we're explicitly building for Windows, set target arch if cross-building
  if (String(platform).includes("windows")) {
    compileArgs.splice(compileArgs.indexOf("src/server.ts"), 0, "--target", "x86_64-pc-windows-msvc");
  }

  console.log(`[release] Compiling to ${outputPath} (include = ${includeGlob})`);
  const p = Deno.run({ cmd: [Deno.execPath(), ...compileArgs], stdout: "piped", stderr: "piped" });
  const [status, rawOut, rawErr] = await Promise.all([p.status(), p.output(), p.stderrOutput()]);
  p.close();
  if (rawOut.length) console.log(new TextDecoder().decode(rawOut));
  if (rawErr.length) console.error(new TextDecoder().decode(rawErr));
  if (!status.success) {
    console.error(`[release] deno compile failed with code ${status.code}`);
    Deno.exit(status.code);
  }
  console.log(`[release] Done. Release file written to ${outputPath}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
