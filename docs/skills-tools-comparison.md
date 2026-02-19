# AI Agent Skills Management Tools Comparison

A comparison of tools for managing Skills across AI coding agents (Claude Code, Gemini CLI, Codex CLI, etc.).

## Table of Contents

- [Tool Overview](#tool-overview)
- [Feature Comparison](#feature-comparison)
- [Tool Details](#tool-details)
  - [skills.sh (Vercel)](#skillssh-vercel)
  - [agent-skills-cli](#agent-skills-cli)
  - [skillshare](#skillshare)
  - [.agents](#agents)
  - [agent-command-sync](#agent-command-sync)
- [Recommendations by Use Case](#recommendations-by-use-case)
- [References](#references)

---

## Tool Overview

| Tool | Developer | Primary Purpose |
|------|-----------|-----------------|
| [skills.sh](https://skills.sh) | Vercel | Skills package manager |
| [agent-skills-cli](https://github.com/Karanjot786/agent-skills-cli) | Community | Marketplace installation |
| [skillshare](https://github.com/runkids/skillshare) | Community | Declarative skill sync |
| [.agents](https://github.com/amtiYo/agents) | Community | Unified configuration |
| [agent-command-sync](https://github.com/hatappo/agent-command-sync) | Individual | Format conversion & bidirectional sync |

---

## Feature Comparison

### Core Features

| Feature | skills.sh | agent-skills-cli | skillshare | .agents | agent-command-sync |
|---------|:---------:|:----------------:|:----------:|:-------:|:------------------:|
| Skills support | ✓ | ✓ | ✓ | ✓ | ✓ |
| Commands support | - | - | - | - | ✓ |
| Marketplace | ✓ | ✓ | ✓ | - | - |
| Local skill management | △ | △ | ✓ | ✓ | ✓ |
| Local edit → redistribute | - | - | ✓ (Symlink) | ✓ (Symlink) | ✓ (Copy) |
| Bidirectional sync | - | - | ✓ | ✓ | ✓ |
| Format conversion | - | - | - | - | ✓ |

### Technical Characteristics

| Feature | skills.sh | agent-skills-cli | skillshare | .agents | agent-command-sync |
|---------|:---------:|:----------------:|:----------:|:-------:|:------------------:|
| Distribution method | Copy | Copy | Symlink | Symlink | Copy |
| Runtime | Node.js | Node.js | Go | Node.js | Node.js |
| Web UI | - | - | ✓ | - | - |
| Security audit | ✓ | - | ✓ | - | - |
| Git integration | - | - | ✓ | ✓ | - |
| Offline operation | - | - | ✓ | ✓ | ✓ |

### Platform Support

| Tool | Claude Code | Gemini CLI | Codex CLI | Cursor | GitHub Copilot | Windsurf | Cline | Zed | OpenCode | Antigravity | Total |
|------|:-----------:|:----------:|:---------:|:------:|:--------------:|:--------:|:-----:|:---:|:--------:|:-----------:|:-----:|
| skills.sh | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 37+ |
| agent-skills-cli | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | 42+ |
| skillshare | ✓ | - | - | - | - | - | - | - | ✓ | - | 49+ |
| .agents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | ✓ | ✓ | 8+ |
| agent-command-sync | ✓ | ✓ | ✓ | - | - | - | - | - | - | - | 3 |

---

## Tool Details

### skills.sh (Vercel)

**Concept**: "npm for AI agents" - A package manager for Skills

**Installation**:
```bash
npx skills add <package>
```

**Main Features**:
- Search and install skills from skills.sh
- Local path installation support
- Safety verification (Safe/Low Risk/High Risk/Critical Risk)

**Strengths**:
- Official Vercel support
- Large ecosystem
- Security partnership (with Gen)

**Limitations**:
- Installation-focused (weak edit & redistribute workflow)
- Central registry dependency

**Official Site**: https://skills.sh

---

### agent-skills-cli

**Concept**: Sync 40,000+ skills to 42 agents

**Installation**:
```bash
npm install -g agent-skills-cli
```

**Main Commands**:
```bash
skills search <query>     # Search skills
skills install <name>     # Install
skills init <name>        # Create new skill
skills validate <path>    # Validate SKILL.md
skills export             # Export to agents
skills sync               # Sync to Antigravity workflows
```

**Strengths**:
- FZF-style interactive search
- 4-dimension quality scoring (structure/clarity/specificity/advanced features)
- Enterprise customization via `.skillsrc`
- Deterministic installation tracking via `skills.lock`

**Limitations**:
- SkillsMP marketplace-centric
- Limited local edit → redistribute workflow

**Repository**: https://github.com/Karanjot786/agent-skills-cli

---

### skillshare

**Concept**: Declarative skill sync - One source to all tools

**Installation**:
```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/runkids/skillshare/main/install.sh | sh

# Homebrew
brew install runkids/tap/skillshare
```

**Main Commands**:
```bash
skillshare init           # Initialize
skillshare new            # Create new skill
skillshare sync           # Distribute to all targets
skillshare collect        # Collect from targets
skillshare diff           # Show differences
skillshare audit          # Security audit
skillshare ui             # Launch web dashboard
skillshare push/pull      # Git-based cross-machine sync
```

**Strengths**:
- **Web UI**: Dashboard at http://127.0.0.1:19420 via `skillshare ui`
- **Bidirectional sync**: `sync` (distribute) and `collect` (gather)
- **Security audit**: Prompt injection detection
- **Single Go binary**: No Node.js required
- **Non-destructive merge**: Won't overwrite existing skills

**Limitations**:
- **Symlink-based**: Cross-device issues, Git complexity
- No format conversion (assumes common format)

**Repository**: https://github.com/runkids/skillshare

---

### .agents

**Concept**: Unified config file for MCP/Skills/Instructions management

**Installation**:
```bash
npm install -g @anthropic/agents
# or
npx @anthropic/agents init
```

**Main Features**:
- Centralized management via `.agents/agents.json`
- MCP servers, Skills, and Instructions integration
- Secret management (`local.json` separation)
- Tool-specific routing

**Strengths**:
- **Declarative config**: One config file for all tools
- **Secret separation**: Auto-separates sensitive info to `.gitignore` target
- **MCP support**: Also manages Model Context Protocol servers

**Limitations**:
- **Symlink-based**: Symlinks from `.agents/skills/` to each tool
- Skills distribution only (no format conversion)

**Repository**: https://github.com/amtiYo/agents

---

### agent-command-sync

**Concept**: Format conversion + real file copy for bidirectional sync

**Installation**:
```bash
npm install -g agent-command-sync
```

**Main Commands**:
```bash
# Commands sync
acsync -s claude -d gemini              # Claude → Gemini
acsync -s gemini -d claude              # Gemini → Claude

# Skills sync
acsync -s claude -d codex -t skills     # Skills only
acsync -s claude -d gemini -t both      # Commands + Skills

# Options
acsync -s claude -d gemini -n           # Dry run (preview)
acsync -s claude -d gemini -f my-skill  # Specific skill only
acsync -s claude -d gemini --sync-delete # Delete orphaned files
```

**Strengths**:
- **Real file copy**: No symlinks, independent files for each tool
- **Format conversion**:
  - Commands: Markdown ↔ TOML conversion
  - Placeholders: `$ARGUMENTS` ↔ `{{args}}`
  - Tool-specific settings: `disable-model-invocation` ↔ `openai.yaml`
- **Commands + Skills support**: Both legacy Commands and new Skills
- **Offline operation**: No external services required
- **Git-friendly**: Normal tracking in each tool's directory

**Limitations**:
- No marketplace features
- No Web UI
- Limited platform support (Claude/Gemini/Codex only)

**Repository**: https://github.com/hatappo/agent-command-sync

---

## Recommendations by Use Case

### "I want to easily install community skills"
→ **skills.sh** or **agent-skills-cli**

Easy search and install from large marketplaces. Security verification included.

### "I want to build a unified skill environment for my team"
→ **skillshare** or **.agents**

Define environments with declarative config files and share across the team. Easy version control with Git integration.

### "I want to distribute locally edited skills to each tool (without symlinks)"
→ **agent-command-sync**

Copies as real files, avoiding symlink issues. Natural Git tracking.

### "I need format conversion between Claude/Gemini/Codex"
→ **agent-command-sync**

The only tool supporting format conversion. Also useful for migrating from Commands (legacy) to Skills.

### "I want visual management with a GUI"
→ **skillshare**

Web dashboard for viewing skills, sync status, and audit results.

---

## References

### Official Documentation
- [Agent Skills Standard](https://agentskills.io/)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Codex CLI Skills](https://developers.openai.com/codex/skills/)
- [Gemini CLI Skills](https://geminicli.com/docs/cli/skills/)

### Tools
- [skills.sh](https://skills.sh)
- [agent-skills-cli](https://github.com/Karanjot786/agent-skills-cli)
- [skillshare](https://github.com/runkids/skillshare)
- [.agents](https://github.com/amtiYo/agents)
- [agent-command-sync](https://github.com/hatappo/agent-command-sync)

### Community
- [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
- [SkillsMP Marketplace](https://skillsmp.com)

---

*Last updated: February 2026*
