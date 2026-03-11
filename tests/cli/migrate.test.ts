import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { directoryExists } from "../../src/utils/file-utils.js";
import { runMigrate } from "../../src/cli/migrate.js";

describe("migrate subcommand", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `migrate-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore
    }
  });

  it("should rename .acs to .asp in project directory", async () => {
    await mkdir(join(tempDir, ".acs", "skills"), { recursive: true });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runMigrate({ gitRoot: tempDir });
    spy.mockRestore();

    expect(await directoryExists(join(tempDir, ".asp", "skills"))).toBe(true);
    expect(await directoryExists(join(tempDir, ".acs"))).toBe(false);
  });

  it("should skip if .asp already exists (idempotent)", async () => {
    await mkdir(join(tempDir, ".asp", "skills"), { recursive: true });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runMigrate({ gitRoot: tempDir });
    spy.mockRestore();

    expect(await directoryExists(join(tempDir, ".asp", "skills"))).toBe(true);
  });

  it("should report not-found when neither exists", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    await runMigrate({ gitRoot: tempDir });
    spy.mockRestore();

    const output = logs.join("\n");
    expect(output).toContain("not found");
    expect(output).toContain("Nothing to migrate");
  });

  it("should show renamed status after migration", async () => {
    await mkdir(join(tempDir, ".acs", "commands"), { recursive: true });

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    await runMigrate({ gitRoot: tempDir });
    spy.mockRestore();

    const output = logs.join("\n");
    expect(output).toContain("renamed from");
  });

  it("should check cwd when not in git repo", async () => {
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    await mkdir(join(tempDir, ".acs"), { recursive: true });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runMigrate({ gitRoot: null });
    spy.mockRestore();

    expect(await directoryExists(join(tempDir, ".asp"))).toBe(true);
    expect(await directoryExists(join(tempDir, ".acs"))).toBe(false);

    process.chdir(originalCwd);
  });
});
