# Development

<div align="center"> en | <a href="development_ja.md">ja</a> </div>

## Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Development mode (watch)
pnpm dev
```

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## Lint & Format

```bash
# Lint and format code
pnpm lint
pnpm format

# Type check
pnpm lint:tsc
```

## Publishing

```bash
# Check package contents
pnpm pack --dry-run

# Update patch version (1.0.0 → 1.0.1)
pnpm version patch

# Update minor version (1.0.0 → 1.1.0)
pnpm version minor

# Update major version (1.0.0 → 2.0.0)
pnpm version major

# Publish a package
pnpm publish
```
