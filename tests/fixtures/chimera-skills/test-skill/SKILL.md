---
name: test-skill
description: "A test skill for chimera"
disable-model-invocation: false
_chimera:
  claude:
    allowed-tools: "Read,Write"
    model: "opus-4"
    user-invocable: true
  gemini:
    custom-field: "value"
---

This is a test skill body with $ARGUMENTS.
