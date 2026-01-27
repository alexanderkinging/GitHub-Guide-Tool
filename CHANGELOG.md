# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-28

### Added
- 🎉 Initial release of GitHub Guide Tool
- Chrome extension framework with Manifest V3
- GitHub API integration for public repositories
- Code skeleton extraction for JavaScript, TypeScript, and Python
- AI analysis support for multiple providers:
  - Claude API (Anthropic)
  - OpenAI API
  - SiliconFlow
- Real-time streaming output from AI responses
- Adaptive analysis strategy based on project size:
  - Small projects (< 50 files): Deep analysis
  - Medium projects (50-200 files): Standard analysis
  - Large projects (> 200 files): Quick overview
- Popup UI with React 18 and Tailwind CSS
- Markdown rendering with syntax highlighting
- Export analysis results as Markdown files
- Copy to clipboard functionality
- 24-hour cache system for analysis results
- Automatic cache expiration cleanup
- Settings page for API key configuration
- Chinese language output for AI analysis

### Performance
- Smart analysis depth based on project size
- Storage space monitoring (5MB limit)
- Automatic cleanup of oldest cache entries when storage is full
- Memory optimization:
  - Stream reader cleanup in finally blocks
  - React useEffect cleanup to prevent memory leaks
  - File tree builder Map cleanup
- Error handling for Markdown export

### Developer Experience
- TypeScript for type safety
- Vite + CRXJS for fast development
- ESLint and Prettier for code quality
- Hot module replacement in development mode

---

## [Unreleased]

### Planned for v1.1.0
- Private repository support with GitHub OAuth
- Additional language support (Go, Rust, Java, C++)
- Analysis history and search
- Custom prompt templates
- Dark mode support
- Code splitting to reduce bundle size

### Planned for v2.0.0
- Interactive Q&A mode
- Multi-language UI (i18n)
- Chrome Web Store publication
- Enhanced code navigation
- Dependency visualization

---

## Version History

- **v1.0.0** (2026-01-28) - Initial release

---

## Links

- [GitHub Repository](https://github.com/alexanderkinging/github-guide-tool)
- [Issue Tracker](https://github.com/alexanderkinging/github-guide-tool/issues)
- [Releases](https://github.com/alexanderkinging/github-guide-tool/releases)
