---
description: "Review code"
_chimera:
  claude:
    allowed-tools: "Read,Write,Bash"
    model: "opus-4"
    argument-hint: "file path"
  gemini:
    custom-gemini-field: "gemini-value"
---

Review the code in $ARGUMENTS and check !`git diff` results, following @config.json settings.
