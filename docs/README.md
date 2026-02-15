# GitHub Guide Tool

一款 Chrome 扩展，使用 AI 分析 GitHub 仓库并生成项目指南文档。

## 功能特点

- **智能分析**：自动提取代码骨架，识别项目结构和核心功能
- **多 AI 支持**：支持 Claude、OpenAI、硅基流动、智谱 AI (BigModel) 四种 AI 服务
- **流式输出**：实时显示 AI 分析结果
- **Markdown 导出**：一键导出分析报告为 Markdown 文件
- **缓存机制**：24 小时缓存，避免重复分析

## 安装方法

### 从源码安装

1. 克隆仓库
```bash
git clone https://github.com/alexanderkinging/github-guide-tool.git
cd github-guide-tool
```

2. 安装依赖
```bash
npm install
```

3. 构建项目
```bash
npm run build
```

4. 在 Chrome 中加载扩展
   - 打开 `chrome://extensions/`
   - 开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择 `dist` 文件夹

## 使用方法

1. 打开任意 GitHub 仓库页面
2. 点击扩展图标
3. 在设置中配置 AI 服务和 API Key
4. 点击「Analyze Repository」开始分析
5. 分析完成后可复制或导出 Markdown

## 配置说明

### GitHub Token（可选）
用于提高 API 请求限制。在 GitHub Settings > Developer settings > Personal access tokens 创建。

### AI 服务配置

| 服务 | API Key 获取 | 推荐模型 |
|------|-------------|---------|
| Claude | [console.anthropic.com](https://console.anthropic.com) | claude-sonnet-4-20250514 |
| OpenAI | [platform.openai.com](https://platform.openai.com) | gpt-4o |
| 硅基流动 | [siliconflow.cn](https://siliconflow.cn) | deepseek-ai/DeepSeek-V3 |
| 智谱 AI | [open.bigmodel.cn](https://open.bigmodel.cn) | glm-4.5-air |

## 技术栈

- React 18 + TypeScript
- Vite + CRXJS
- Tailwind CSS
- Chrome Extension Manifest V3

## 许可证

MIT License
