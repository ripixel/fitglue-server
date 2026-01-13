# Contributing to FitGlue

Thank you for your interest in contributing to FitGlue! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful and constructive. We're all here to build something great.

## Getting Started

### Prerequisites

- Go 1.25+
- Node.js 20+
- `protoc` (Protocol Buffers compiler)
- Google Cloud SDK (for deployment)

### Setup

```bash
# Clone the repo
git clone https://github.com/ripixel/fitglue-server.git
cd fitglue-server

# Install dependencies
make setup

# Build everything
make build

# Run tests
make test
```

## Development Workflow

### Adding New Features

1. **New Plugin?** Use the scaffolding:
   ```bash
   make plugin-source name=newservice
   make plugin-enricher name=newfeature
   make plugin-destination name=newtarget
   ```
   See [Adding Plugins](docs/development/adding-plugins.md) for details.

2. **Proto changes?** Regenerate types:
   ```bash
   make generate
   ```

3. **Run tests before committing:**
   ```bash
   make test
   make lint
   ```

### Code Style

- **Go**: Follow standard Go conventions, use `gofmt`
- **TypeScript**: ESLint rules in `.eslintrc`
- **Commits**: Use conventional commits (feat, fix, docs, refactor, test, chore)

### Pull Request Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Run `make test && make lint`
5. Commit with a descriptive message
6. Push and open a PR

### PR Checklist

- [ ] Tests pass (`make test`)
- [ ] Lint passes (`make lint`)
- [ ] Build succeeds (`make build`)
- [ ] Documentation updated if needed
- [ ] Proto types regenerated if proto files changed

## Project Structure

```
server/
├── src/go/               # Go monorepo
│   ├── functions/        # Cloud Functions
│   └── pkg/              # Shared libraries
│       ├── errors/       # Structured errors
│       ├── plugin/       # Plugin registry
│       └── enricher_providers/  # Pipeline plugins
├── src/typescript/       # TypeScript workspace
│   ├── shared/           # @fitglue/shared library
│   └── *-handler/        # Cloud Functions
├── src/proto/            # Protocol Buffer definitions
├── terraform/            # Infrastructure as Code
└── scripts/              # Development scripts
```

## Questions?

Open an issue for questions, bugs, or feature requests.
