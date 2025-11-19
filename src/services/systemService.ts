import { ServerSettings } from "../types.ts";
import { ensureYtDlpBinary, ensureYtDlpEjsResources, resolveProjectPath } from "../bootstrap.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";

const runCommand = async (cmdPath: string, args: string[]) => {
  try {
    const command = new Deno.Command(cmdPath, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (output.code !== 0) return null;
    return new TextDecoder().decode(output.stdout).trim();
  } catch (_err) {
    return null;
  }
};

const fetchLatestYtDlpTag = async () => {
  try {
    const res = await fetch("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", {
      headers: {
        "user-agent": "botnama-app",
        accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.tag_name === "string" ? json.tag_name : null;
  } catch (_err) {
    return null;
  }
};

const readYtDlpEjsVersion = async () => {
  try {
    const versionFile = resolveProjectPath("bin/yt-dlp-ejs/yt_dlp_ejs/_version.py");
    const text = await Deno.readTextFile(versionFile);
    const match = text.match(/__version__\s*=\s*["'`](.+?)["'`]/);
    return match ? match[1] : "unknown";
  } catch (_err) {
    return null;
  }
};

export const getSystemInfo = async (settings: ServerSettings) => {
  const ytDlpPath = resolveProjectPath(settings.ytDlpPath);
  const [current, latest, ejsVersion] = await Promise.all([
    runCommand(ytDlpPath, ["--version"]),
    fetchLatestYtDlpTag(),
    readYtDlpEjsVersion(),
  ]);
  return {
    ytDlp: {
      current,
      latest,
      updateAvailable: Boolean(current && latest && current !== latest),
    },
    ytDlpEjs: {
      version: ejsVersion,
      status: ejsVersion ? "installed" : "missing",
    },
  };
};

export const updateYtDlpBinary = async (settings: ServerSettings) => {
  await ensureYtDlpBinary(settings, true);
  emitDockEvent(DOCK_EVENT.SYSTEM);
  return runCommand(resolveProjectPath(settings.ytDlpPath), ["--version"]);
};

export const updateYtDlpEjs = async () => {
  await ensureYtDlpEjsResources(true);
  emitDockEvent(DOCK_EVENT.SYSTEM);
  return readYtDlpEjsVersion();
};
