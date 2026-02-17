# GitHub Guide Tool v1.0.0

> 🎉 Initial Release - A Chrome extension for analyzing GitHub repositories with AI

## 📦 Installation

1. Download `github-guide-tool-v1.0.0.zip` below
2. Unzip to get the `dist` folder
3. Open Chrome → `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" → Select `dist` folder

## ✨ Features

### Core Functionality
- 🚀 **One-Click Analysis** - Analyze any public GitHub repository instantly
- 🤖 **Multi-AI Support** - Choose from Claude, OpenAI, or SiliconFlow
- 📊 **Smart Strategy** - Adaptive analysis depth based on project size
  - Small projects (<50 files): Deep analysis
  - Medium projects (50-200 files): Standard analysis
  - Large projects (>200 files): Quick overview
- ⚡ **Real-time Streaming** - Watch AI generate analysis in real-time
- 💾 **Smart Caching** - 7-day cache to save API calls
- 📄 **Markdown Export** - Export results as `.md` files

### Performance & Optimization
- Memory-optimized architecture with automatic cleanup
- Storage space monitoring (5MB limit with auto-cleanup)
- Intelligent cache management
- Stream reader cleanup for memory efficiency

### User Experience
- Clean, modern UI built with React and Tailwind CSS
- Syntax-highlighted code display
- Progress indicators for each analysis stage
- Error handling with friendly messages
- Chinese language AI output support

## 🔑 Configuration Required

Before using, configure in Settings:
- **AI Provider**: Select Claude, OpenAI, or SiliconFlow
- **API Key**: Your API key for the selected provider
- **GitHub Token** (optional): For higher API rate limits

## 🛠️ Tech Stack

- TypeScript + React 18
- Tailwind CSS for styling
- Vite + CRXJS for building
- Chrome Manifest V3
- react-markdown with syntax highlighting

## 📚 Documentation

- [README (English)](https://github.com/alexanderkinging/GitHub-Guide-Tool#readme)
- [README (中文)](https://github.com/alexanderkinging/GitHub-Guide-Tool/blob/main/README.zh-CN.md)
- [Version Roadmap](https://github.com/alexanderkinging/GitHub-Guide-Tool/blob/main/docs/VERSION.md)
- [Changelog](https://github.com/alexanderkinging/GitHub-Guide-Tool/blob/main/CHANGELOG.md)

## 🐛 Known Issues

- Bundle size is ~330KB (optimization planned for v1.1.0)
- Only supports JS/TS/Python code analysis (more languages in v1.1.0)

## 🚀 What's Next (v1.1.0)

- Private repository support
- Additional language support (Go, Rust, Java, C++)
- Analysis history
- Custom prompt templates
- Dark mode

## 📝 Feedback

Found a bug or have a suggestion? Please [open an issue](https://github.com/alexanderkinging/GitHub-Guide-Tool/issues)!

---

**Note**: This extension requires API keys from third-party AI services. Ensure compliance with their terms of service.
