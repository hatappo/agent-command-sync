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
    it("CLI_NAME should be asp", () => {
      expect(CLI_NAME).toBe("asp");
    });

    it("LEGACY_CLI_NAMES should include acs and agent-command-sync", () => {
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
      process.argv = ["node", "/usr/local/bin/asp"];
      expect(getInvokedName()).toBe("asp");
    });

    it("should return basename for legacy acs", () => {
      process.argv = ["node", "/usr/local/bin/acs"];
      expect(getInvokedName()).toBe("acs");
    });
  });

  describe("isLegacyInvocation", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("should return false for asp", () => {
      process.argv = ["node", "/usr/local/bin/asp"];
      expect(isLegacyInvocation()).toBe(false);
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
    const originalEnv = process.env.ASP_NO_DEPRECATION_WARNING;

    beforeEach(() => {
      process.env.ASP_NO_DEPRECATION_WARNING = undefined;
    });

    afterEach(() => {
      process.argv = originalArgv;
      if (originalEnv !== undefined) {
        process.env.ASP_NO_DEPRECATION_WARNING = originalEnv;
      } else {
        process.env.ASP_NO_DEPRECATION_WARNING = undefined;
      }
    });

    it("should output warning for legacy invocation", () => {
      process.argv = ["node", "/usr/local/bin/acs"];
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      showDeprecationWarning();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("'acs' is deprecated"));
      spy.mockRestore();
    });

    it("should not output warning for asp invocation", () => {
      process.argv = ["node", "/usr/local/bin/asp"];
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      showDeprecationWarning();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should suppress warning when ASP_NO_DEPRECATION_WARNING=1", () => {
      process.argv = ["node", "/usr/local/bin/acs"];
      process.env.ASP_NO_DEPRECATION_WARNING = "1";
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      showDeprecationWarning();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
