import { describe, it, expect, beforeEach } from 'vitest';
import { G2CConverter } from '../../src/converters/g2c-converter.js';
import type { GeminiCommand, ConversionOptions } from '../../src/types/index.js';

describe('G2CConverter', () => {
  let converter: G2CConverter;
  let defaultOptions: ConversionOptions;

  beforeEach(() => {
    converter = new G2CConverter();
    defaultOptions = {
      direction: 'g2c',
      removeUnsupported: false,
      noOverwrite: false,
      syncDelete: false,
      dryRun: false
    };
  });

  describe('convert', () => {
    it('should convert basic Gemini command to Claude format', () => {
      const geminiCommand: GeminiCommand = {
        description: 'Test command',
        prompt: 'This is a test command.',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result).toEqual({
        frontmatter: {
          description: 'Test command'
        },
        content: 'This is a test command.',
        filePath: '/test/command.md'
      });
    });

    it('should convert argument placeholders', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Process the following: {{args}}',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.content).toBe('Process the following: $ARGUMENTS');
    });

    it('should convert shell commands', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Current status: !{git status}',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.content).toBe('Current status: !`git status`');
    });

    it('should handle multiple shell commands', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Status: !{git status}\nFiles: !{ls -la}',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.content).toBe('Status: !`git status`\nFiles: !`ls -la`');
    });

    it('should restore Claude-specific fields', () => {
      const geminiCommand: GeminiCommand = {
        description: 'Test command',
        prompt: 'Test content',
        filePath: '/test/command.toml',
        _claude_allowed_tools: 'Bash(git status:*)',
        _claude_argument_hint: '[message]',
        _claude_model: 'sonnet'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.frontmatter).toEqual({
        description: 'Test command',
        'allowed-tools': 'Bash(git status:*)',
        'argument-hint': '[message]',
        model: 'sonnet'
      });
    });

    it('should convert file path extension', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Test',
        filePath: '/path/to/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.filePath).toBe('/path/to/command.md');
    });

    it('should handle command without description', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Test content',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('Test content');
    });

    it('should handle complex placeholder combinations', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Process {{args}} and run !{git status} then check {{args}} again',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.content).toBe('Process $ARGUMENTS and run !`git status` then check $ARGUMENTS again');
    });

    it('should preserve empty frontmatter when no metadata exists', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Simple command',
        filePath: '/test/command.toml'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.frontmatter).toEqual({});
    });

    it('should handle Claude fields with underscores correctly', () => {
      const geminiCommand: GeminiCommand = {
        prompt: 'Test',
        filePath: '/test/command.toml',
        _claude_argument_hint: 'test hint'
      };

      const result = converter.convert(geminiCommand, defaultOptions);

      expect(result.frontmatter['argument-hint']).toBe('test hint');
    });
  });
});