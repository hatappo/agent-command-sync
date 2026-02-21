import { GeminiCommandConverter } from "../converters/gemini-command-converter.js";
import { GeminiSkillConverter } from "../converters/gemini-skill-converter.js";
import { GeminiParser } from "../parsers/gemini-parser.js";
import { GeminiSkillParser } from "../parsers/gemini-skill-parser.js";
import type { GeminiCommand, GeminiSkill } from "../types/index.js";
import type { AgentDefinition } from "./types.js";

export function createGeminiAgent(): AgentDefinition {
  const parser = new GeminiParser();
  const skillParser = new GeminiSkillParser();
  const cmdConverter = new GeminiCommandConverter();
  const skillConverter = new GeminiSkillConverter();

  return {
    displayName: "Gemini CLI",
    dirs: {
      commandSubdir: "commands",
      skillSubdir: "skills",
      projectBase: ".gemini",
      userDefault: ".gemini",
    },
    fileExtension: ".toml",
    commands: {
      parse: (f) => parser.parse(f),
      toIR: (cmd) => cmdConverter.toIR(cmd as GeminiCommand),
      fromIR: (ir, opts) => cmdConverter.fromIR(ir, opts),
      stringify: (cmd) => parser.stringify(cmd as GeminiCommand),
    },
    skills: {
      parse: (d) => skillParser.parse(d),
      toIR: (s) => skillConverter.toIR(s as GeminiSkill),
      fromIR: (ir, opts) => skillConverter.fromIR(ir, opts),
      writeToDirectory: async (skill, srcDir, tgtDir) => {
        const s = skill as GeminiSkill;
        s.dirPath = srcDir;
        await skillParser.writeToDirectory(s, tgtDir);
      },
    },
  };
}
