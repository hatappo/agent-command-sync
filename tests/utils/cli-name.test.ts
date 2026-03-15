import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLI_NAME,
  LEGACY_CLI_NAMES,
  getInvokedName,
  isLegacyInvocation,
  showDeprecationWarning,
} from "../../src/utils/cli-name.js";

describe("cli-name", () => {
  describe("constants", () => {
    it("CLI_NAME should be sk", () => {
      expect(CLI_NAME).toBe("sk");
    });

    it("LEGACY_CLI_NAMES should include asp, acs and agent-command-sync", () => {
      expect(LEGACY_CLI_NAMES).toContain("asp");
      expect(LEGACY_CLI_NAMES).toContain("acs");
      expect(LEGACY_CLI_NAMES).toContain("agent-command-sync");
    });
  });

  describe("getInvokedName", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("should return basename of argv[1]", () => {
      process.argv = ["node", "/usr/local/bin/sk"];
      expect(getInvokedName()).toBe("sk");
    });

    it("should return basename for legacy asp", () => {
      process.argv = ["node", "/usr/local/bin/asp"];
      expect(getInvokedName()).toBe("asp");
    });
  });

  describe("isLegacyInvocation", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("should return false for sk", () => {
      process.argv = ["node", "/usr/local/bin/sk"];
      expect(isLegacyInvocation()).toBe(false);
    });

    it("should return true for asp", () => {
      process.argv = ["node", "/usr/local/bin/asp"];
      expect(isLegacyInvocation()).toBe(true);
    });

    it("should return true for acs", () => {
      process.argv = ["node", "/usr/local/bin/acs"];
      expect(isLegacyInvocation()).toBe(true);
    });

    it("should return true for agent-command-sync", () => {
      process.argv = ["node", "/usr/local/bin/agent-command-sync"];
      expect(isLegacyInvocation()).toBe(true);
    });

    it("should return false for agent-skill-porter", () => {
      process.argv = ["node", "/usr/local/bin/agent-skill-porter"];
      expect(isLegacyInvocation()).toBe(false);
    });
  });

  describe("showDeprecationWarning", () => {
    const originalArgv = process.argv;
    const originalEnv = process.env.SK_NO_DEPRECATION_WARNING;

    beforeEach(() => {
      process.env.SK_NO_DEPRECATION_WARNING = undefined;
    });

    afterEach(() => {
      process.argv = originalArgv;
      if (originalEnv !== undefined) {
        process.env.SK_NO_DEPRECATION_WARNING = originalEnv;
      } else {
        process.env.SK_NO_DEPRECATION_WARNING = undefined;
      }
    });

    it("should output warning for legacy invocation", () => {
      process.argv = ["node", "/usr/local/bin/asp"];
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      showDeprecationWarning();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("'asp' is deprecated"));
      spy.mockRestore();
    });

    it("should not output warning for sk invocation", () => {
      process.argv = ["node", "/usr/local/bin/sk"];
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      showDeprecationWarning();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should suppress warning when SK_NO_DEPRECATION_WARNING=1", () => {
      process.argv = ["node", "/usr/local/bin/asp"];
      process.env.SK_NO_DEPRECATION_WARNING = "1";
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      showDeprecationWarning();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
