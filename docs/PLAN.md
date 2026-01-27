# GitHub 项目分析助手 - 产品规划文档

## 项目概述

**项目名称**：GitHub Guide Tool（GitHub 项目分析助手）

**目标**：开发一个 Chrome 浏览器插件，帮助用户快速理解 GitHub 开源项目，自动生成项目介绍和使用文档。

**核心理念**：不把代码直接丢给 AI，而是把「代码的骨架和元数据」丢给 AI，节省 Token 的同时获得精准分析。

---

## 需求规格

### 输入输出
| 项目 | 说明 |
|-----|------|
| 输入 | GitHub 仓库 URL（通过 API 获取，不克隆到本地） |
| 输出 | 弹出面板展示分析结果 + Markdown 文件导出 |

### 认证配置
| 服务 | 方式 |
|-----|------|
| GitHub | 用户配置 Personal Access Token（提高 API 限额） |
| AI 服务 | 用户自带 API Key |

### 支持的 AI 服务
- Claude API（Anthropic）
- OpenAI API
- 硅基流动（SiliconFlow）

### 分析策略（自动智能分析）
| 项目规模 | 文件数量 | 分析深度 | 说明 |
|---------|---------|---------|------|
| 小型 | <50 | 深度分析 | 完整代码骨架 |
| 中型 | 50-200 | 标准分析 | 核心模块骨架 |
| 大型 | >200 | 快速概览 | 概览 + 核心模块 |

### 体验优化
- ✅ 流式输出（实时显示 AI 生成内容）
- ✅ 分阶段展示（目录→配置→代码骨架→分析结果）
- ✅ 进度指示（显示当前分析步骤）
- ✅ 缓存机制（同一仓库短期内复用数据）

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  Popup UI (React + Tailwind)                            │
│  ├── 设置页面（API Key 配置）                            │
│  ├── 分析结果展示（Markdown 渲染）                       │
│  └── 导出功能                                            │
├─────────────────────────────────────────────────────────┤
│  Background Service Worker                               │
│  ├── GitHub API 模块                                     │
│  ├── 代码骨架提取模块                                    │
│  ├── AI 分析模块（多服务适配器）                         │
│  └── 缓存管理                                            │
├─────────────────────────────────────────────────────────┤
│  Content Script                                          │
│  └── 检测 GitHub 页面，提取仓库信息                      │
└─────────────────────────────────────────────────────────┘
```

### 技术栈
| 类别 | 技术选型 |
|-----|---------|
| 语言 | TypeScript |
| UI 框架 | React 18 |
| 样式 | Tailwind CSS |
| 构建工具 | Vite + CRXJS |
| Chrome API | Manifest V3 |
| Markdown 渲染 | react-markdown |

### 项目结构
```
/src
  /popup              # 弹出面板 UI
    /components       # React 组件
    /hooks            # 自定义 Hooks
    App.tsx
    main.tsx
  /background         # Service Worker
    index.ts
  /content            # Content Script
    index.ts
  /lib                # 共享模块
    /github           # GitHub API 封装
    /analyzer         # 代码骨架提取
    /ai               # AI 服务适配器
    /cache            # 缓存管理
  /types              # TypeScript 类型定义
/public
  icon.png
manifest.json
vite.config.ts
tailwind.config.js
```

---

## 代码骨架提取设计

### 提取内容
| 类别 | 具体内容 | 用途 |
|-----|---------|-----|
| 目录结构 | 文件树（过滤无关目录） | 了解项目组织 |
| 配置文件 | package.json, tsconfig.json, pyproject.toml 等 | 了解依赖和配置 |
| 入口文件 | main.ts, index.js, app.py 等 | 了解程序入口 |
| 函数签名 | `function name(params): returnType` | 了解 API 接口 |
| 类定义 | `class Name { methods }` | 了解数据结构 |
| 导出内容 | `export { ... }` | 了解公开 API |

### 智能过滤规则
**忽略目录**：
- node_modules, dist, build, .git
- __pycache__, .pytest_cache, .venv
- coverage, .nyc_output

**优先分析**：
- src, lib, core, api, components
- 入口文件（main, index, app）

**配置文件识别**：
- JavaScript/TypeScript: package.json, tsconfig.json
- Python: pyproject.toml, setup.py, requirements.txt
- Rust: Cargo.toml
- Go: go.mod

### 签名提取正则
```typescript
// TypeScript/JavaScript 函数
/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g

// 箭头函数
/(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g

// Python 函数
/def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g

// 类定义
/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g
```

---

## AI Prompt 设计

### 输入给 AI 的内容
```
1. 项目基本信息
   - 名称、描述、主要语言、Stars 数

2. 目录结构
   - 树形展示（已过滤无关目录）

3. 配置文件内容
   - package.json（依赖、脚本）
   - 其他配置文件

4. 核心模块骨架
   - 函数/类签名列表
   - 导出内容

5. README 内容（如有）
```

### 要求 AI 输出
```
1. 项目简介（一句话说明这个项目是做什么的）

2. 核心功能列表
   - 功能1：说明
   - 功能2：说明

3. 技术栈分析
   - 使用的框架/库
   - 架构特点

4. 快速上手指南
   - 安装步骤
   - 基本使用方法

5. 核心 API/功能使用示例
   - 代码示例
   - 参数说明
```

---

## MVP 功能边界

### 包含（v1.0）
- [x] Chrome 插件基础框架（Manifest V3）
- [x] GitHub API 集成（公开仓库）
- [x] 代码骨架提取（JS/TS/Python）
- [x] AI 分析（Claude/OpenAI/硅基流动）
- [x] 弹出面板 UI
- [x] 流式输出
- [x] 进度指示
- [x] Markdown 导出

### 不包含（后续迭代）
- [ ] 私有仓库支持
- [ ] 更多语言支持（Go, Rust, Java, C++）
- [ ] 对话式追问功能
- [ ] 分析历史记录
- [ ] ���语言 UI
- [ ] 自定义 Prompt 模板

---

## 验证方案

### 功能验证步骤
1. 安装插件到 Chrome（开发者模式）
2. 访问 GitHub 仓库页面
3. 点击插件图标，触发分析
4. 验证能正确获取仓库信息
5. 验证 AI 分析结果质量
6. 验证 Markdown 导出功能

### 测试仓库
| 规模 | 仓库 | 用途 |
|-----|------|-----|
| 小型 | sindresorhus/is-odd | 测试深度分析 |
| 中型 | chalk/chalk | 测试标准分析 |
| 大型 | facebook/react | 测试快速概览 |
