# add
Add skills from GitHub

---
$ sk add https://github.com/anthropics/skills  # bulk add skills
[spinner:1200] Fetching repository tree...
>
> Downloading [bold]3[/bold] skills from [cyan]github.com/anthropics/skills[/cyan]...
>
>   [green][A][/green] .claude/skills/pdf/SKILL.md - [green]Created[/green]
>   [green][A][/green] .claude/skills/pdf/reference.md - [green]Created[/green]
>   [green][A][/green] .claude/skills/pdf/forms.md - [green]Created[/green]
>   [green][A][/green] .claude/skills/mcp-builder/SKILL.md - [green]Created[/green]
>   [green][A][/green] .claude/skills/mcp-builder/reference/ - [green]Created[/green]
>   [green][A][/green] .claude/skills/skill-creator/SKILL.md - [green]Created[/green]
>   [green][A][/green] .claude/skills/skill-creator/references/ - [green]Created[/green]
>
> Done! [green]7 files created[/green].
>
>   Skills:
>     [green][A][/green] pdf - [green]Created[/green]
>     [green][A][/green] mcp-builder - [green]Created[/green]
>     [green][A][/green] skill-creator - [green]Created[/green]
>   [green]3 skills created[/green].
[wait:3000]

# sync
Sync skills across agents

---
$ sk sync claude gemini  # convert Claude → Gemini
> [cyan]Starting claude → gemini conversion... [project: ~/prj][/cyan]
> Found 3 source skill(s)
>
> [bold]Results:[/bold]
> [green][A][/green] .gemini/skills/pdf/SKILL.md - Created
> [green][A][/green] .gemini/skills/pdf/reference.md - Created
> [green][A][/green] .gemini/skills/pdf/forms.md - Created
> [green][A][/green] .gemini/skills/mcp-builder/SKILL.md - Created
> [green][A][/green] .gemini/skills/mcp-builder/reference/ - Created
> [green][A][/green] .gemini/skills/skill-creator/SKILL.md - Created
> [green][A][/green] .gemini/skills/skill-creator/references/ - Created
>
> [bold]Summary:[/bold]
>   [green]Created:[/green] 7 (7 skills)
>
> [green]✓ Conversion completed successfully![/green]
[wait:3000]

# update
Check for upstream updates

---
$ sk update  # check & apply upstream updates
> Checking for skill updates...
>
>   [cyan]anthropics/skills[/cyan]:
>     [cyan][=][/cyan] pdf [gray](.claude/skills/pdf)[/gray] - [cyan]No upstream changes[/cyan]
>     [yellow][M][/yellow] mcp-builder [gray](.claude/skills/mcp-builder)[/gray] - [yellow]Updated[/yellow]
>     [cyan][=][/cyan] skill-creator [gray](.claude/skills/skill-creator)[/gray] - [cyan]No upstream changes[/cyan]
>
> Done! [yellow]1 skill updated[/yellow], [cyan]2 unchanged[/cyan].
[wait:3000]

# info
View skill information

---
$ sk info  # view skill details
> Found 3 skills.
>
[select:3000] Select a skill to view: | 1. pdf  (.claude/skills/pdf), 2. mcp-builder  (.claude/skills/mcp-builder), 3. skill-creator  (.claude/skills/skill-creator) | 0
>
> [bold]pdf[/bold]
>
>   [gray]Description:[/gray]  PDF processing: read, merge, split, fill forms, OCR...
>   [gray]Source:[/gray]       anthropics/skills@d5cd683
>   [gray]Path:[/gray]         .claude/skills/pdf
>
>   [gray]Files:[/gray]
>     SKILL.md
>     forms.md
>     reference.md
>     scripts/  (8 files)
>
>   [gray]Source links:[/gray]
>     [gray]GitHub:[/gray]    [cyan]https://github.com/anthropics/skills/.../pdf[/cyan]
>     [gray]skills.sh:[/gray] [cyan]https://skills.sh/anthropics/skills/pdf[/cyan]
[wait:3000]

# status
View Chimera hub status

---
$ sk status  # show Chimera hub status
>
> [gray]sk v7.0.0 [project: ~/prj][/gray]
>
> [cyan]      .────────────────────────────────────────────.[/cyan]
> [cyan]     (  User:    0 commands, 3 skills (1 agent)    )[/cyan]
> [cyan]     (  Project: 0 commands, 3 skills (2 agents)   )[/cyan]
> [cyan]      '────────────────────────────────────────────'[/cyan]
> [cyan]        /[/cyan]
>
> [cyan]  /\_/\[/cyan]
> [cyan] (=^.^=)[/cyan]
> [cyan]  (")(")[/cyan]
> [cyan] <\  / >[/cyan]
>
> [bold]Chimera Lv.2[/bold]
> [gray]  Composition: 🐱 Cat + 🐦 Bird (wings)[/gray]
>
>   Agents: Claude Code, Gemini CLI
>
> [gray]  Your Chimera grows as you sync more agents![/gray]
[wait:6000]
