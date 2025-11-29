/// <reference lib="deno.ns" />
import { fromFileUrl, join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";

const PROJECT_ROOT = fromFileUrl(new URL("..", import.meta.url));
const GITMODULES_PATH = join(PROJECT_ROOT, ".gitmodules");

const run = async (
  cmd: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
) => {
  console.log(`> ${cmd} ${args.join(" ")} (cwd=${options.cwd ?? PROJECT_ROOT})`);
  const p = new Deno.Command(cmd, {
    args,
    cwd: options.cwd ?? PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: options.env,
  }).spawn();
  const { code } = await p.status;
  if (code !== 0) throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
};

const readFile = async (path: string) => {
  return await Deno.readTextFile(path);
};

const parseGitmodules = (content: string) => {
  // crude parse: find lines with 'path ='
  const paths: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*path\s*=\s*(.+)$/);
    if (m && m[1]) paths.push(m[1].trim());
  }
  return paths;
};

const getSubmoduleBranchFromGitmodules = async (path: string) => {
  try {
    const cmd = new Deno.Command("git", { args: ["config", "-f", ".gitmodules", `submodule.${path}.branch`] });
    const out = await cmd.output();
    if (out.code === 0) return new TextDecoder().decode(out.stdout).trim();
  } catch (_e) {
    // ignore
  }
  return null;
};

const getCurrentBranch = async (path: string) => {
  try {
    const cmd = new Deno.Command("git", { args: ["-C", path, "symbolic-ref", "--short", "HEAD"], stdout: "piped", stderr: "null" });
    const out = await cmd.output();
    if (out.code === 0) return new TextDecoder().decode(out.stdout).trim();
  } catch (_e) {
    // ignore
  }
  return null;
};

const setBranch = async (path: string, branch: string) => {
  // Ensure local branch exists tracking origin/branch
  try {
    await run("git", ["-C", path, "fetch", "origin", branch]);
    // checkout local branch as tracking remote branch
    await run("git", ["-C", path, "checkout", "-B", branch, `origin/${branch}`]);
    // pull ff-only
    await run("git", ["-C", path, "pull", "--ff-only", "origin", branch]);
  } catch (err) {
    throw err;
  }
};

const isSubmoduleDirty = async (path: string) => {
  try {
    const cmd = new Deno.Command("git", { args: ["-C", path, "status", "--porcelain"], stdout: "piped" });
    const out = await cmd.output();
    if (out.code !== 0) return true; // conservative
    const s = new TextDecoder().decode(out.stdout).trim();
    return s.length > 0;
  } catch (_e) {
    return true;
  }
};

const revParseShort = async (path: string) => {
  const cmd = new Deno.Command("git", { args: ["-C", path, "rev-parse", "--short", "HEAD"], stdout: "piped" });
  const out = await cmd.output();
  if (out.code !== 0) return null;
  return new TextDecoder().decode(out.stdout).trim();
};

const main = async () => {
  const args = new Set(Deno.args);
  const pushFlag = args.has("--push");
  const skipSetup = args.has("--skip-setup");
  const autoYes = args.has("--yes");
  const useRemote = args.has("--remote");

  const gm = await readFile(GITMODULES_PATH).catch(() => "");
  const subPaths = parseGitmodules(gm);
  if (subPaths.length === 0) {
    console.log("No submodules found in .gitmodules");
    return;
  }

  const updated: { path: string; old: string | null; new: string | null }[] = [];
  for (const p of subPaths) {
    console.log(`\n=== Updating submodule: ${p} ===`);
    const dirty = await isSubmoduleDirty(p);
    if (dirty) {
      console.warn(`[update-deps] Submodule ${p} is dirty; skip or stash/commit changes first`);
      continue;
    }

    let branch = await getSubmoduleBranchFromGitmodules(p);
    if (!branch) branch = (await getCurrentBranch(p)) || "main"; // fallback
    console.log(`[update-deps] submodule ${p} branch: ${branch}`);
    try {
      const oldRev = await revParseShort(p);
      if (useRemote) {
        // attempt to use remote to update
        await run("git", ["-C", p, "fetch", "origin"]);
        await run("git", ["-C", p, "checkout", "-B", branch, `origin/${branch}`]);
      } else {
        // same as switching to track branch at origin
        await setBranch(p, branch);
      }
      const newRev = await revParseShort(p);
      updated.push({ path: p, old: oldRev, new: newRev });
    } catch (err) {
      console.error(`[update-deps] failed to update submodule ${p}: ${err}`);
    }
  }

  if (updated.length === 0) {
    console.log("No submodules updated.");
    return;
  }

  console.log("\nSubmodule updates:");
  for (const u of updated) console.log(`${u.path} ${u.old ?? "?"} -> ${u.new ?? "?"}`);

  if (!autoYes) {
    const confirm = await (async () => {
      const buf = new Uint8Array(100);
      console.log("Do you want to commit the new submodule pointers to the superproject? (y/n)");
      const n = await Deno.stdin.read(buf);
      if (!n) return false;
      const s = new TextDecoder().decode(buf.subarray(0, n)).trim().toLowerCase();
      return s === "y" || s === "yes";
    })();
    if (!confirm) {
      console.log("Aborting without committing submodule changes.");
      return;
    }
  }

  // git add submodule paths
  try {
    await run("git", ["add", ...updated.map((u) => u.path)]);
    const msg = `Update submodules: ${updated.map((u) => `${u.path}@${u.new}`).join(", ")}`;
    await run("git", ["commit", "-m", msg]);
  } catch (err) {
    console.error("Failed to commit submodule updates:", err);
    throw err;
  }

  if (pushFlag) {
    // push current branch
    const cmd = new Deno.Command("git", { args: ["rev-parse", "--abbrev-ref", "HEAD"], stdout: "piped" });
    const out = await cmd.output();
    const branch = new TextDecoder().decode(out.stdout).trim();
    if (branch) {
      await run("git", ["push", "origin", branch]);
      console.log("Pushed superproject changes to origin/" + branch);
    }
  }

  if (!skipSetup) {
    console.log("Running setup script to refresh mediabunny dist and build plugin...");
    try {
      if (args.has("--mediabunny-latest")) {
        await run("deno", ["task", "setup"], { env: { BOTNAMA_USE_LATEST_MEDIABUNNY: "1" } });
      } else {
        await run("deno", ["task", "setup"]);
      }
    } catch (err) {
      console.error("setup script failed:", err);
    }
    // attempt to build plugin if dotnet exists
    try {
      // build plugin if dotnet available
      await run("dotnet", ["--version"]);
      await run("deno", ["task", "plugin:mcv:build"]);
    } catch {
      console.log("dotnet not available or plugin build skipped.");
    }
  }
};

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    Deno.exit(1);
  });
}
