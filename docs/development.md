# Development

<div align="center"> en | <a href="development_ja.md">ja</a> </div>

## Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development mode (watch)
npm run dev
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Lint & Format

```bash
# Lint and format code
npm run lint
npm run format

# Type check
npm run lint:tsc
```

## Publishing

```bash
# Check package contents
npm pack --dry-run

# Update patch version (1.0.0 → 1.0.1)
npm version patch

# Update minor version (1.0.0 → 1.1.0)
npm version minor

# Update major version (1.0.0 → 2.0.0)
npm version major

# Publish a package
npm publish
```
