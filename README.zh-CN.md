# GitHub 项目分析助手

> 一个 Chrome 浏览器插件，通过 AI 自动生成项目文档，帮助你快速理解 GitHub 开源项目。

[![Version](https://img.shields.io/badge/version-1.8.0-blue.svg)](https://github.com/alexanderkinging/github-guide-tool)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[English](README.md) | [中文](README.zh-CN.md)

## 📖 项目简介

GitHub Guide Tool 是一个 Chrome 浏览器插件，可以分析 GitHub 仓库并使用 AI 生成全面的项目指南。与直接将整个代码库发送给 AI 不同，本工具提取代码骨架和元数据，在节省 Token 的同时生成准确的分析结果。

### 核心特性

- 🚀 **即时分析** - 一键分析任何公开 GitHub 仓库
- 🤖 **多 AI 服务** - 支持 Claude、OpenAI、硅基流动和智谱
- 🧠 **智能分块** - 自动将大型代码库分块分析，适配不同模型的上下文限制
- 📊 **智能策略** - 根据项目规模自适应分析深度
- ⚡ **流式输出** - 实时显示 AI 响应内容
- 💾 **缓存系统** - 24 小时结果缓存，避免重复 API 调用
- 📄 **Markdown 导出** - 导出分析结果为 Markdown 文件
- 🔒 **私���仓库** - 支持使用 GitHub Token 分析私有仓库

## 🎯 工作原理

```
GitHub 仓库 → 代码骨架提取 → AI 分析 → 格式化指南
```

1. **获取仓库信息** - 通过 GitHub API 获取文件树、README 和配置文件
2. **提取代码骨架** - 解析目录结构、函数签名和导出内容
3. **AI 分析** - 将骨架数据发送给 AI 进行全面分析
4. **展示结果** - 显示格式化的 Markdown 指南，包含语法高亮

## 🛠️ 安装方法

### 方式一：从 Release 安装（推荐）

1. 从 [Releases](https://github.com/alexanderkinging/github-guide-tool/releases) 下载最新的 `github-guide-tool.zip`
2. 解压文件，得到 `dist` 文件夹
3. 打开 Chrome 浏览器，访问 `chrome://extensions/`
4. 开启右上角的 **开发者模式**
5. 点击 **加载已解压的扩展程序**，选择 `dist` 文件夹
6. 完成！插件图标将出现在工具栏中

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/alexanderkinging/github-guide-tool.git
cd github-guide-tool

# 安装依赖
npm install

# 构建插件
npm run build

# 构建后的插件位于 dist/ 文件夹
```

然后按照方式一的步骤 3-6 进行安装。

## 🔑 配置说明

使用插件前需要配置 API 密钥：

1. 点击插件图标
2. 进入 **设置** 页面
3. 配置以下内容：

### 必填设置

- **AI 服务商**：选择 Claude、OpenAI 或硅基流动
- **AI API Key**：所选服务商的 API 密钥

### 可选设置

- **GitHub Token**：个人访问令牌，用于提高 API 速率限制（从 60 次/小时提升到 5000 次/小时）

### 获取 API 密钥

- **Claude API**：[Anthropic 控制台](https://console.anthropic.com/)
- **OpenAI API**：[OpenAI 平台](https://platform.openai.com/)
- **硅基流动**：[硅基流动控制台](https://cloud.siliconflow.cn/)
- **GitHub Token**：[GitHub 设置 → Developer settings → Personal access tokens](https://github.com/settings/tokens)

## 📚 使用方法

1. 访问任意 GitHub 仓库页面（如 `https://github.com/facebook/react`）
2. 点击工具栏中的 **GitHub Guide Tool** 图标
3. 点击 **Analyze Repository**（分析仓库）
4. 等待分析完成（流式输出会显示进度）
5. 查看生成的项目指南
6. 可选操作：
   - 点击 📋 复制到剪贴板
   - 点击 💾 导出为 Markdown 文件

## 🎨 分析策略

插件会根据项目规模自动调整分析深度：

| 项目规模 | 文件数量 | 分析深度 |
|---------|---------|---------|
| 小型    | < 50    | 深度分析（完整骨架） |
| 中型    | 50-200  | 标准分析（核心模块） |
| 大型    | > 200   | 快速概览（概览 + 核心模块） |

## 🏗️ 技术栈

- **语言**：TypeScript
- **UI 框架**：React 18
- **样式**：Tailwind CSS
- **构建工具**：Vite + CRXJS
- **Chrome API**：Manifest V3
- **Markdown 渲染**：react-markdown（带语法高亮）

## 📂 项目结构

```
github-guide-tool/
├── src/
│   ├── popup/              # 插件弹出界面
│   │   ├── components/     # React 组件
│   │   └── App.tsx
│   ├── background/         # Service Worker
│   │   └── index.ts
│   ├── content/            # Content Script
│   │   └── index.ts
│   ├── lib/                # 共享模块
│   │   ├── github/         # GitHub API 客户端
│   │   ├── analyzer/       # 代码骨架提取
│   │   └── ai/             # AI 服务适配器
│   └── types/              # TypeScript 类型定义
├── icons/                  # 插件图标
├── manifest.json           # Chrome 插件配置
└── docs/                   # 文档
```

## 🔧 开发指南

```bash
# 安装依赖
npm install

# 启动开发服务器（支持热重载）
npm run dev

# 生产环境构建
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

## 📋 版本规划

### v1.8.0 (当前版本) ✅
- [x] 智能分块分析，支持大型代码库
- [x] Token 预估和模型上下文限制映射
- [x] 多轮分析与结构化摘要
- [x] 分块分析进度显示

### v1.5.0 - v1.7.0 ✅
- [x] 私有仓库支持
- [x] 多语言代码骨架提取（Go、Rust、Java、C++）
- [x] 自定义 Prompt 模板
- [x] 智谱 AI 服务支持

### v1.0.0 ✅
- [x] Chrome 插件基础框架
- [x] GitHub API 集成
- [x] 代码骨架提取（JS/TS/Python）
- [x] AI 分析（Claude/OpenAI/硅基流动）
- [x] 流式输出
- [x] Markdown 导出
- [x] 缓存系统
- [x] 内存优化

### v2.0.0 (未来)
- [ ] 交互式问答模式
- [ ] 多语言界面（国际化）
- [ ] Chrome Web Store 发布
- [ ] 增强代码导航功能

## 🤝 贡献指南

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 开源协议

本项目采用 MIT 协议 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Anthropic](https://www.anthropic.com/) - Claude API
- [OpenAI](https://openai.com/) - GPT API
- [硅基流动](https://siliconflow.cn/) - AI 推理平台
- [GitHub](https://github.com/) - 仓库托管和 API

## 📧 联系方式

如有任何问题或建议，请在 GitHub 上提交 issue。

---

**注意**：本插件需要第三方 AI 服务的 API 密钥。请确保遵守相应服务的使用条款和政策。
