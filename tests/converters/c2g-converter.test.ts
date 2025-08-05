import { describe, it, expect, beforeEach } from 'vitest';
import { C2GConverter } from '../../src/converters/c2g-converter.js';
import type { ClaudeCommand, ConversionOptions } from '../../src/types/index.js';

describe('C2GConverter', () => {
  let converter: C2GConverter;
  let defaultOptions: ConversionOptions;

  beforeEach(() => {
    converter = new C2GConverter();
    defaultOptions = {
      direction: 'c2g',
      removeUnsupported: false,
      noOverwrite: false,
      syncDelete: false,
      dryRun: false
    };
  });

  describe('convert', () => {
    it('should convert basic Claude command to Gemini format', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {
          description: 'Test command'
        },
        content: 'This is a test command.',
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result).toEqual({
        description: 'Test command',
        prompt: 'This is a test command.',
        filePath: '/test/command.toml'
      });
    });

    it('should convert argument placeholders', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {},
        content: 'Process the following: $ARGUMENTS',
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result.prompt).toBe('Process the following: {{args}}');
    });

    it('should convert shell commands with backticks', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {},
        content: 'Current status: !`git status`',
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result.prompt).toBe('Current status: !{git status}');
    });

    it('should convert shell commands at line start', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {},
        content: '!git status\n!ls -la',
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result.prompt).toBe('!{git status}\n!{ls -la}');
    });

    it('should handle Claude-specific fields with removeUnsupported=false', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': 'Bash(git status:*)',
          'argument-hint': '[message]',
          model: 'sonnet'
        },
        content: 'Test content',
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result.description).toBe('Test command');
      expect(result._claude_allowed_tools).toBe('Bash(git status:*)');
      expect(result._claude_argument_hint).toBe('[message]');
      expect(result._claude_model).toBe('sonnet');
    });

    it('should remove Claude-specific fields with removeUnsupported=true', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': 'Bash(git status:*)',
          'argument-hint': '[message]',
          model: 'sonnet'
        },
        content: 'Test content',
        filePath: '/test/command.md'
      };

      const options = { ...defaultOptions, removeUnsupported: true };
      const result = converter.convert(claudeCommand, options);

      expect(result.description).toBe('Test command');
      expect(result._claude_allowed_tools).toBeUndefined();
      expect(result._claude_argument_hint).toBeUndefined();
      expect(result._claude_model).toBeUndefined();
    });

    it('should convert file path extension', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {},
        content: 'Test',
        filePath: '/path/to/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result.filePath).toBe('/path/to/command.toml');
    });

    it('should handle command without description', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {},
        content: 'Test content',
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      expect(result.description).toBeUndefined();
      expect(result.prompt).toBe('Test content');
    });

    it('should convert shell commands in all contexts', () => {
      const claudeCommand: ClaudeCommand = {
        frontmatter: {},
        content: `Before code block
\`\`\`bash
!git status
!ls -la
\`\`\`
After code block: !git log`,
        filePath: '/test/command.md'
      };

      const result = converter.convert(claudeCommand, defaultOptions);

      // 現在の実装では、すべてのシェルコマンドが変換される
      expect(result.prompt).toContain('!{git status}');
      expect(result.prompt).toContain('!{ls -la}');
      expect(result.prompt).toContain('After code block: !git log'); // 行頭でないため変換されない
    });
  });
});