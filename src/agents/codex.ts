import { CodexCommandConverter } from "../converters/codex-command-converter.js";
import { CodexSkillConverter } from "../converters/codex-skill-converter.js";
import { CodexParser } from "../parsers/codex-parser.js";
import { CodexSkillParser } from "../parsers/codex-skill-parser.js";
import type { CodexCommand, CodexSkill } from "../types/index.js";
import type { AgentDefinition } from "./types.js";

export function createCodexAgent(): AgentDefinition {
  const parser = new CodexParser();
  const skillParser = new CodexSkillParser();
  const cmdConverter = new CodexCommandConverter();
  const skillConverter = new CodexSkillConverter();

  return {
    displayName: "Codex CLI",
    dirs: {
      commandSubdir: "prompts",
      skillSubdir: "skills",
      projectBase: ".codex",
      userDefault: ".codex",
    },
    fileExtension: ".md",
    commands: {
      parse: (f) => parser.parse(f),
      toIR: (cmd) => cmdConverter.toIR(cmd as CodexCommand),
      fromIR: (ir, opts) => cmdConverter.fromIR(ir, opts),
      stringify: (cmd) => parser.stringify(cmd as CodexCommand),
    },
    skills: {
      parse: (d) => skillParser.parse(d),
      toIR: (s) => skillConverter.toIR(s as CodexSkill),
      fromIR: (ir, opts) => skillConverter.fromIR(ir, opts),
      writeToDirectory: async (skill, srcDir, tgtDir) => {
        const s = skill as CodexSkill;
        s.dirPath = srcDir;
        await skillParser.writeToDirectory(s, tgtDir);
      },
    },
  };
}
