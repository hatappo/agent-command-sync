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

const LEGACY_DIRS = [".acs", ".asp"];
const NEW_DIR = ".agent-skill-porter";
const LEGACY_USER_DIRS = [".config/acs", ".config/asp"];
const NEW_USER_DIR = ".config/agent-skill-porter";

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

  // User-level: ~/.config/acs or ~/.config/asp → ~/.config/agent-skill-porter
  const home = homedir();
  for (const legacyUserDir of LEGACY_USER_DIRS) {
    results.push(await migrateDir(home, legacyUserDir, NEW_USER_DIR));
  }

  // Project-level: .acs or .asp → .agent-skill-porter
  const projectRoot = options.gitRoot || process.cwd();
  for (const legacyDir of LEGACY_DIRS) {
    results.push(await migrateDir(projectRoot, legacyDir, NEW_DIR));
  }

  // Display results
  console.log(picocolors.bold("Chimera Hub directory migration (.acs/.asp → .agent-skill-porter):\n"));

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
