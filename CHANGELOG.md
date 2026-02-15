# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-02-15

### Added
- 🧠 **Intelligent Chunked Analysis** - Automatically split large codebases into multiple chunks for analysis
  - Token estimation for Chinese/English mixed content
  - Model context limit mapping (Claude 200K, GPT-4o 128K, DeepSeek 64K, Qwen 32K, etc.)
  - Smart chunking by directory to keep related modules together
  - Structured JSON summaries for intermediate rounds
  - Accumulated context passing between rounds
  - Final Markdown report generation from all summaries
- 📊 **Multi-round Progress Display** - UI shows current chunk progress (e.g., "Analyzing chunk 2/5...")
- 🔧 **New AI Modules**:
  - `src/lib/ai/tokenEstimator.ts` - Token count estimation
  - `src/lib/ai/modelLimits.ts` - Model context limits mapping
  - `src/lib/ai/chunker.ts` - Intelligent chunking logic
  - `src/lib/prompts/chunkedAnalysis.ts` - Multi-round analysis prompts

### Changed
- Analysis automatically detects if chunking is needed based on model's context limit
- Progress bar now shows chunk-level progress during multi-round analysis

## [1.7.0] - 2026-02-14

### Added
- Multi-language code skeleton extraction support (Go, Rust, Java, C++)

## [1.6.0] - 2026-02-13

### Added
- Multi-language code skeleton extraction support

## [1.5.0] - 2026-02-12

### Added
- Private repository support with GitHub Personal Access Token

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

- **v1.8.0** (2026-02-15) - Intelligent chunked analysis for large codebases
- **v1.7.0** (2026-02-14) - Multi-language code skeleton extraction
- **v1.6.0** (2026-02-13) - Multi-language support
- **v1.5.0** (2026-02-12) - Private repository support
- **v1.0.0** (2026-01-28) - Initial release

---

## Links

- [GitHub Repository](https://github.com/alexanderkinging/github-guide-tool)
- [Issue Tracker](https://github.com/alexanderkinging/github-guide-tool/issues)
- [Releases](https://github.com/alexanderkinging/github-guide-tool/releases)
