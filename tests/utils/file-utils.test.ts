import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fileExists,
  directoryExists,
  ensureDirectory,
  readFile,
  writeFile,
  deleteFile,
  autoCompleteExtension,
  getBaseName,
  getCommandName,
  getFilePathFromCommandName
} from '../../src/utils/file-utils.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';

describe('FileUtils', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-dir-${Date.now()}`);
    testFile = join(testDir, 'test.txt');
    await ensureDirectory(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await writeFile(testFile, 'test content');
      expect(await fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await fileExists('/non/existent/file.txt')).toBe(false);
    });
  });

  describe('directoryExists', () => {
    it('should return true for existing directory', async () => {
      expect(await directoryExists(testDir)).toBe(true);
    });

    it('should return false for non-existing directory', async () => {
      expect(await directoryExists('/non/existent/directory')).toBe(false);
    });

    it('should return false for file path', async () => {
      await writeFile(testFile, 'test');
      expect(await directoryExists(testFile)).toBe(false);
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = join(testDir, 'new-dir');
      await ensureDirectory(newDir);
      expect(await directoryExists(newDir)).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedDir = join(testDir, 'level1', 'level2', 'level3');
      await ensureDirectory(nestedDir);
      expect(await directoryExists(nestedDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await expect(ensureDirectory(testDir)).resolves.not.toThrow();
    });
  });

  describe('readFile and writeFile', () => {
    it('should write and read file content', async () => {
      const content = 'Hello, World!';
      await writeFile(testFile, content);
      
      const readContent = await readFile(testFile);
      expect(readContent).toBe(content);
    });

    it('should create directory when writing file', async () => {
      const nestedFile = join(testDir, 'nested', 'file.txt');
      await writeFile(nestedFile, 'content');
      
      expect(await fileExists(nestedFile)).toBe(true);
      expect(await readFile(nestedFile)).toBe('content');
    });

    it('should throw error when reading non-existent file', async () => {
      await expect(readFile('/non/existent/file.txt')).rejects.toThrow('Failed to read file');
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      await writeFile(testFile, 'content');
      expect(await fileExists(testFile)).toBe(true);
      
      await deleteFile(testFile);
      expect(await fileExists(testFile)).toBe(false);
    });

    it('should throw error when deleting non-existent file', async () => {
      await expect(deleteFile('/non/existent/file.txt')).rejects.toThrow('Failed to delete file');
    });
  });

  describe('autoCompleteExtension', () => {
    it('should add extension if not present', () => {
      expect(autoCompleteExtension('filename', ['.md', '.txt'])).toBe('filename.md');
    });

    it('should not add extension if already present', () => {
      expect(autoCompleteExtension('filename.txt', ['.md', '.txt'])).toBe('filename.txt');
    });

    it('should use first extension as default', () => {
      expect(autoCompleteExtension('test', ['.toml', '.yaml', '.yml'])).toBe('test.toml');
    });
  });

  describe('getBaseName', () => {
    it('should return filename without extension', () => {
      expect(getBaseName('command.md')).toBe('command');
      expect(getBaseName('path/to/command.toml')).toBe('command');
    });

    it('should return filename if no extension', () => {
      expect(getBaseName('command')).toBe('command');
      expect(getBaseName('path/to/command')).toBe('command');
    });

    it('should handle multiple dots', () => {
      expect(getBaseName('file.name.ext')).toBe('file.name');
    });
  });

  describe('getCommandName', () => {
    it('should generate command name from file path', () => {
      const baseDir = '/base/commands';
      const filePath = '/base/commands/git/commit.md';
      
      expect(getCommandName(filePath, baseDir)).toBe('git:commit');
    });

    it('should handle single level command', () => {
      const baseDir = '/base/commands';
      const filePath = '/base/commands/test.md';
      
      expect(getCommandName(filePath, baseDir)).toBe('test');
    });

    it('should handle nested directories', () => {
      const baseDir = '/base/commands';
      const filePath = '/base/commands/frontend/react/component.md';
      
      expect(getCommandName(filePath, baseDir)).toBe('frontend:react:component');
    });
  });

  describe('getFilePathFromCommandName', () => {
    it('should generate file path from command name', () => {
      const baseDir = '/base/commands';
      const commandName = 'git:commit';
      const extension = '.md';
      
      const result = getFilePathFromCommandName(commandName, baseDir, extension);
      expect(result).toBe('/base/commands/git/commit.md');
    });

    it('should handle single level command', () => {
      const baseDir = '/base/commands';
      const commandName = 'test';
      const extension = '.toml';
      
      const result = getFilePathFromCommandName(commandName, baseDir, extension);
      expect(result).toBe('/base/commands/test.toml');
    });

    it('should handle deeply nested command', () => {
      const baseDir = '/base/commands';
      const commandName = 'frontend:react:component';
      const extension = '.md';
      
      const result = getFilePathFromCommandName(commandName, baseDir, extension);
      expect(result).toBe('/base/commands/frontend/react/component.md');
    });
  });
});