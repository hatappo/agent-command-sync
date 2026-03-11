import { rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import picocolors from "picocolors";
import { directoryExists } from "../utils/file-utils.js";

interface MigrateOptions {
  gitRoot?: string | null;
}

interface MigrateResult {
  path: string;
  from: string;
  to: string;
  status: "renamed" | "already-migrated" | "not-found";
}

const LEGACY_DIR = ".acs";
const NEW_DIR = ".asp";
const LEGACY_USER_DIR = ".config/acs";
const NEW_USER_DIR = ".config/asp";

async function migrateDir(parentDir: string, legacyName: string, newName: string): Promise<MigrateResult> {
  const legacyPath = join(parentDir, legacyName);
  const newPath = join(parentDir, newName);

  if (await directoryExists(newPath)) {
    return { path: newPath, from: legacyName, to: newName, status: "already-migrated" };
  }

  if (await directoryExists(legacyPath)) {
    await rename(legacyPath, newPath);
    return { path: newPath, from: legacyName, to: newName, status: "renamed" };
  }

  return { path: legacyPath, from: legacyName, to: newName, status: "not-found" };
}

export async function runMigrate(options: MigrateOptions): Promise<void> {
  const results: MigrateResult[] = [];

  // User-level: ~/.config/acs → ~/.config/asp
  const home = homedir();
  results.push(await migrateDir(home, LEGACY_USER_DIR, NEW_USER_DIR));

  // Project-level: .acs → .asp
  if (options.gitRoot) {
    results.push(await migrateDir(options.gitRoot, LEGACY_DIR, NEW_DIR));
  } else {
    // Not in a git repo — check current directory
    const cwd = process.cwd();
    results.push(await migrateDir(cwd, LEGACY_DIR, NEW_DIR));
  }

  // Display results
  console.log(picocolors.bold("Chimera Hub directory migration (.acs → .asp):\n"));

  for (const r of results) {
    switch (r.status) {
      case "renamed":
        console.log(`  ${picocolors.green("[M]")} ${r.path} ${picocolors.green(`(renamed from ${r.from})`)}`);
        break;
      case "already-migrated":
        console.log(`  ${picocolors.blue("[=]")} ${r.path} ${picocolors.blue("(already migrated)")}`);
        break;
      case "not-found":
        console.log(`  ${picocolors.gray("[-]")} ${r.path} ${picocolors.gray("(not found, skipped)")}`);
        break;
    }
  }

  const renamed = results.filter((r) => r.status === "renamed").length;
  if (renamed > 0) {
    console.log(picocolors.green(`\nDone! ${renamed} director${renamed === 1 ? "y" : "ies"} migrated.`));
  } else {
    console.log(picocolors.dim("\nNothing to migrate."));
  }
}
