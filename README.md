# GitHub Guide Tool

> A Chrome extension that helps you quickly understand GitHub open-source projects by generating AI-powered project documentation.

[![Version](https://img.shields.io/badge/version-1.8.0-blue.svg)](https://github.com/alexanderkinging/github-guide-tool)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[English](README.md) | [中文](README.zh-CN.md)

## 📖 Overview

GitHub Guide Tool is a Chrome browser extension that analyzes GitHub repositories and generates comprehensive project guides using AI. Instead of sending entire codebases to AI models, it extracts code skeletons and metadata to produce accurate analysis while saving tokens.

### Key Features

- 🚀 **Instant Analysis** - Analyze any public GitHub repository with one click
- 🤖 **Multiple AI Providers** - Support for Claude, OpenAI, SiliconFlow, and BigModel
- 🧠 **Intelligent Chunking** - Automatically split large codebases for models with smaller context limits
- 📊 **Smart Strategy** - Adaptive analysis depth based on project size
- ⚡ **Streaming Output** - Real-time AI response display
- 💾 **Cache System** - 24-hour result caching to avoid repeated API calls
- 📄 **Markdown Export** - Export analysis results as Markdown files
- 🔒 **Private Repos** - Support for private repositories with GitHub token

## 🎯 How It Works

```
GitHub Repository → Code Skeleton Extraction → AI Analysis → Formatted Guide
```

1. **Fetch Repository Info** - Get file tree, README, and configuration files via GitHub API
2. **Extract Code Skeleton** - Parse directory structure, function signatures, and exports
3. **AI Analysis** - Send skeleton data to AI for comprehensive analysis
4. **Display Results** - Show formatted Markdown guide with syntax highlighting

## 🛠️ Installation

### Option 1: Install from Release (Recommended)

1. Download the latest `github-guide-tool.zip` from [Releases](https://github.com/alexanderkinging/github-guide-tool/releases)
2. Unzip the file to get the `dist` folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **Load unpacked** and select the `dist` folder
6. Done! The extension icon will appear in your toolbar

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/alexanderkinging/github-guide-tool.git
cd github-guide-tool

# Install dependencies
npm install

# Build the extension
npm run build

# The built extension will be in the dist/ folder
```

Then follow steps 3-6 from Option 1.

## 🔑 Configuration

Before using the extension, you need to configure API keys:

1. Click the extension icon
2. Go to **Settings**
3. Configure the following:

### Required Settings

- **AI Provider**: Choose from Claude, OpenAI, or SiliconFlow
- **AI API Key**: Your API key for the selected provider

### Optional Settings

- **GitHub Token**: Personal Access Token to increase API rate limit (from 60 to 5000 requests/hour)

### Getting API Keys

- **Claude API**: [Anthropic Console](https://console.anthropic.com/)
- **OpenAI API**: [OpenAI Platform](https://platform.openai.com/)
- **SiliconFlow**: [SiliconFlow Console](https://cloud.siliconflow.cn/)
- **GitHub Token**: [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)

## 📚 Usage

1. Visit any GitHub repository page (e.g., `https://github.com/facebook/react`)
2. Click the **GitHub Guide Tool** icon in your toolbar
3. Click **Analyze Repository**
4. Wait for the analysis to complete (streaming output will show progress)
5. Review the generated guide
6. Optionally:
   - Click 📋 to copy to clipboard
   - Click 💾 to export as Markdown file

## 🎨 Analysis Strategy

The extension automatically adjusts analysis depth based on project size:

| Project Size | File Count | Analysis Depth |
|--------------|------------|----------------|
| Small        | < 50       | Deep Analysis (Complete skeleton) |
| Medium       | 50-200     | Standard Analysis (Core modules) |
| Large        | > 200      | Quick Overview (Overview + core modules) |

## 🏗️ Tech Stack

- **Language**: TypeScript
- **UI Framework**: React 18
- **Styling**: Tailwind CSS
- **Build Tool**: Vite + CRXJS
- **Chrome API**: Manifest V3
- **Markdown Rendering**: react-markdown with syntax highlighting

## 📂 Project Structure

```
github-guide-tool/
├── src/
│   ├── popup/              # Extension popup UI
│   │   ├── components/     # React components
│   │   └── App.tsx
│   ├── background/         # Service Worker
│   │   └── index.ts
│   ├── content/            # Content Script
│   │   └── index.ts
│   ├── lib/                # Shared modules
│   │   ├── github/         # GitHub API client
│   │   ├── analyzer/       # Code skeleton extraction
│   │   └── ai/             # AI service adapters
│   └── types/              # TypeScript type definitions
├── icons/                  # Extension icons
├── manifest.json           # Chrome extension manifest
└── docs/                   # Documentation
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Lint code
npm run lint
```

## 📋 Roadmap

### v1.8.0 (Current) ✅
- [x] Intelligent chunked analysis for large codebases
- [x] Token estimation and model context limits
- [x] Multi-round analysis with structured summaries
- [x] Progress display for chunked analysis

### v1.5.0 - v1.7.0 ✅
- [x] Private repository support
- [x] Multi-language code skeleton extraction (Go, Rust, Java, C++)
- [x] Custom prompt templates
- [x] BigModel (智谱) AI provider support

### v1.0.0 ✅
- [x] Basic Chrome extension framework
- [x] GitHub API integration
- [x] Code skeleton extraction (JS/TS/Python)
- [x] AI analysis (Claude/OpenAI/SiliconFlow)
- [x] Streaming output
- [x] Markdown export
- [x] Cache system
- [x] Memory optimization

### v2.0.0 (Future)
- [ ] Interactive Q&A mode
- [ ] Multi-language UI (i18n)
- [ ] Chrome Web Store publication
- [ ] Enhanced code navigation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://www.anthropic.com/) - Claude API
- [OpenAI](https://openai.com/) - GPT API
- [SiliconFlow](https://siliconflow.cn/) - AI inference platform
- [GitHub](https://github.com/) - Repository hosting and API

## 📧 Contact

If you have any questions or suggestions, please open an issue on GitHub.

---

**Note**: This extension requires API keys from third-party AI services. Please ensure you comply with their respective terms of service and usage policies.
