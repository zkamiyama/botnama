/// <reference lib="deno.ns" />

declare global {
  interface ImportMeta {
    readonly main?: boolean;
  }
}

import { copy } from "@std/fs/copy";
import { ensureDir } from "@std/fs/ensure-dir";
import { fromFileUrl, join } from "@std/path";

const PROJECT_ROOT = fromFileUrl(new URL("..", import.meta.url));
const VENDOR_ROOT = join(PROJECT_ROOT, "public", "vendor", "mediabunny");
const MCV_PLUGIN_PROJECT = join(
  PROJECT_ROOT,
  "plugins",
  "mcv-botnama",
  "MCV.Botnama.Plugin.csproj",
);
const USER_AGENT = "botnama-setup-script";

async function runCommand(command: string, args: string[]) {
  console.log(`[setup] ${command} ${args.join(" ")}`);
  const child = new Deno.Command(command, {
    args,
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const { code } = await child.status;
  if (code !== 0) {
    throw new Error(`[setup] command failed: ${command} ${args.join(" ")}`);
  }
}

async function readMediabunnyVersion() {
  // If env BOTNAMA_USE_LATEST_MEDIABUNNY=1, fetch latest info from npm registry
  if (Deno.env.get("BOTNAMA_USE_LATEST_MEDIABUNNY") === "1") {
    console.log("[setup] BOTNAMA_USE_LATEST_MEDIABUNNY=1 enabled, fetching latest mediabunny from npm registry...");
    const res = await fetch("https://registry.npmjs.org/mediabunny/latest", { headers: { "user-agent": USER_AGENT }});
    if (!res.ok) throw new Error(`[setup] Failed to fetch mediabunny latest: ${res.status}`);
    const json = await res.json();
    if (!json.version) throw new Error("[setup] npm registry returned no version information for mediabunny latest");
    return json.version;
  }
  const pkgPath = join(PROJECT_ROOT, "external", "mediabunny", "package.json");
  const json = JSON.parse(await Deno.readTextFile(pkgPath)) as { version?: string };
  if (!json.version) throw new Error("[setup] Failed to read mediabunny version");
  return json.version;
}

async function ensureMediabunnyAssets() {
  const version = await readMediabunnyVersion();
  const tarballUrl = `https://registry.npmjs.org/mediabunny/-/mediabunny-${version}.tgz`;
  console.log(`[setup] downloading mediabunny dist ${version}`);
  const res = await fetch(tarballUrl, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`[setup] failed to download mediabunny dist: ${res.status} ${res.statusText}`);
  }
  const tarballBytes = new Uint8Array(await res.arrayBuffer());
  const tarballPath = await Deno.makeTempFile({ suffix: ".tgz" });
  const extractDir = await Deno.makeTempDir();
  try {
    await Deno.writeFile(tarballPath, tarballBytes);
    await runCommand("tar", ["-xzf", tarballPath, "-C", extractDir]);
    const distSource = join(extractDir, "package", "dist");
    await Deno.stat(distSource);
    await ensureDir(VENDOR_ROOT);
    const destDist = join(VENDOR_ROOT, "dist");
    await Deno.remove(destDist, { recursive: true }).catch(() => {});
    await copy(distSource, destDist, { overwrite: true });
    const licenseSrc = join(extractDir, "package", "LICENSE");
    await Deno.copyFile(licenseSrc, join(VENDOR_ROOT, "LICENSE"));
    console.log(`[setup] mediabunny assets installed to ${destDist}`);
  } finally {
    await Deno.remove(tarballPath).catch(() => {});
    await Deno.remove(extractDir, { recursive: true }).catch(() => {});
  }
}

async function ensureSubmodules() {
  await runCommand("git", ["submodule", "update", "--init", "--recursive"]);
}

async function hasDotnetCli() {
  try {
    const probe = new Deno.Command("dotnet", {
      args: ["--version"],
      cwd: PROJECT_ROOT,
      stdout: "null",
      stderr: "null",
    });
    const { code } = await probe.output();
    return code === 0;
  } catch {
    return false;
  }
}

async function ensureMcvPluginBuilt() {
  const available = await hasDotnetCli();
  if (!available) {
    console.warn("[setup] .NET SDK (dotnet) not found, skipping MCV plugin build");
    return;
  }
  console.log("[setup] building MCV.Botnama plugin (Release)");
  // Ensure release directory exists and put the plugin build artifact there
  const pluginOut = join(PROJECT_ROOT, "release", "plugins", "botnama");
  await ensureDir(pluginOut);
  await runCommand("dotnet", ["build", MCV_PLUGIN_PROJECT, "-c", "Release", "-o", pluginOut]);
}

export async function runSetup() {
  await ensureSubmodules().catch((err) => {
    throw new Error(`[setup] git submodule update failed: ${err.message}`);
  });
  await ensureMediabunnyAssets();
  await ensureMcvPluginBuilt();
  console.log("[setup] all done");
}

if (import.meta.main) {
  runSetup().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    Deno.exit(1);
  });
}
