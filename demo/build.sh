#!/bin/bash
# Record and build acs demo SVGs (English + Japanese)
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

inject_clear() {
  local castfile="$1"
  node -e "
const fs = require('fs');
const lines = fs.readFileSync('$castfile', 'utf-8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith('[')) continue;
  if (lines[i].includes('unchanged') && lines[i].includes('Done!')) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].includes('prj')) {
        const parsed = JSON.parse(lines[j]);
        const clearLine = JSON.stringify([parsed[0] - 0.05, 'o', '\u001b[2J\u001b[H']);
        lines.splice(j, 0, clearLine);
        break;
      }
    }
    break;
  }
}
fs.writeFileSync('$castfile', lines.join('\n'));
"
}

build_demo() {
  local src="$1"   # e.g. acs-demo.md
  local name="$2"  # e.g. acs-demo

  echo "Building $name ..."

  # 1. Record
  echo "" | npx terminal-demo play "$DIR/$src" \
    --record "$DIR/$name.cast" \
    --speed 1.5 --prompt "prj" --symbol '$' \
    > /dev/null 2>&1

  # 2. Inject screen clear before `acs info`
  inject_clear "$DIR/$name.cast"

  # 3. Convert to SVG
  npx svg-term-cli \
    --in "$DIR/$name.cast" \
    --out "$DIR/$name.svg" \
    --window --width 100 --height 35

  echo "  -> $DIR/$name.svg"
}

build_demo "acs-demo.md"    "acs-demo"
build_demo "acs-demo-ja.md" "acs-demo-ja"

echo "Done!"
