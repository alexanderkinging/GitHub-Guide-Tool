# GitHub Guide Tool - 开发任务清单

## 阶段 1：项目初始化

### 1.1 环境搭建
- [x] 初始化 npm 项目
- [x] 配置 TypeScript
- [x] 配置 Vite + CRXJS 插件
- [x] 配置 Tailwind CSS
- [x] 配置 ESLint + Prettier

### 1.2 Chrome 插件基础
- [x] 创建 manifest.json（Manifest V3）
- [x] 创建 Background Service Worker 入口
- [x] 创建 Content Script 入口
- [x] 创建 Popup 页面入口
- [x] 配置插件图标

### 1.3 项目结构
- [x] 创建 /src/popup 目录结构
- [x] 创建 /src/background 目录结构
- [x] 创建 /src/content 目录结构
- [x] 创建 /src/lib 目录结构
- [x] 创建 /src/types 目录结构

---

## 阶段 2：GitHub API 集成

### 2.1 API 封装
- [x] 实现 GitHub API 客户端基类
- [x] 实现 Token 认证
- [x] 实现 API 速率限制处理
- [x] 实现错误处理

### 2.2 仓库信息获取
- [x] 实现获取仓库基本信息（名称、描述、语言、Stars）
- [x] 实现获取文件树（递归获取目录结构）
- [x] 实现获取 README 内容
- [x] 实现获取单个文件内容

### 2.3 数据类型定义
- [x] 定义 RepoInfo 接口
- [x] 定义 FileNode 接口
- [x] 定义 GitHubApiResponse 接口

---

## 阶段 3：代码骨架提取

### 3.1 目录分析
- [x] 实现目录结构解析
- [x] 实现智能过滤（忽略 node_modules 等）
- [x] 实现优先目录识别（src, lib, core）

### 3.2 配置文件解析
- [x] 实现 package.json 解析
- [x] 实现 tsconfig.json 解析
- [x] 实现 pyproject.toml 解析
- [x] 实现入口文件识别

### 3.3 代码签名提取
- [x] 实现 JavaScript/TypeScript 函数签名提取
- [x] 实现 Python 函数签名提取
- [x] 实现类定义提取
- [x] 实现导出内容提取

### 3.4 骨架数据结构
- [x] 定义 CodeSkeleton 接口
- [x] 定义 ModuleSkeleton 接口
- [x] 定义 FunctionSignature 接口
- [x] 实现骨架数据序列化

---

## 阶段 4：AI 分析模块

### 4.1 统一接口设计
- [x] 定义 AIProvider 抽象接口
- [x] 定义 AnalysisRequest 接口
- [x] 定义 AnalysisResponse 接口
- [x] 实现流式响应处理

### 4.2 Claude API 适配器
- [x] 实现 Claude API 客户端
- [x] 实现消息格式转换
- [x] 实现流式响应解析
- [x] 实现错误处理

### 4.3 OpenAI API 适配器
- [x] 实现 OpenAI API 客户端
- [x] 实现消息格式转换
- [x] 实现流式响应解析
- [x] 实现错误处理

### 4.4 硅基流动适配器
- [x] 实现硅基流动 API 客户端
- [x] 实现消息格式转换
- [x] 实现流式响应解析
- [x] 实现错误处理

### 4.5 Prompt 模板
- [x] 设计项目分析 Prompt 模板
- [x] 实现 Prompt 动态生成
- [x] 实现不同规模项目的 Prompt 策略

---

## 阶段 5：UI 实现

### 5.1 设置页面
- [x] 实现 GitHub Token 输入
- [x] 实现 AI 服务选择
- [x] 实现 API Key 输入
- [x] 实现设置持久化（chrome.storage）

### 5.2 主界面
- [x] 实现仓库信息展示
- [x] 实现分析触发按钮
- [x] 实现进度指示器
- [x] 实现错误提示

### 5.3 结果展示
- [x] 实现 Markdown 渲染
- [x] 实现流式内容更新
- [x] 实现代码高亮
- [x] 实现复制功能

### 5.4 导出功能
- [x] 实现 Markdown 文件生成
- [x] 实现文件下载
- [x] 实现复制到剪贴板

---

## 阶段 6：集成与优化

### 6.1 Content Script
- [x] 实现 GitHub 页面检测
- [x] 实现仓库 URL 解析
- [x] 实现与 Background 通信

### 6.2 缓存机制
- [x] 实现仓库数据缓存
- [x] 实现缓存过期策略
- [x] 实现缓存清理

### 6.3 错误处理
- [x] 实现全局错误捕获
- [x] 实现用户友好的错误提示
- [x] 实现重试机制

### 6.4 性能优化
- [x] 优化大型仓库处理（智能分析策略）
- [x] 优化 UI 渲染性能
- [ ] 优化内存使用（代码分割）

---

## 阶段 7：测试与发布

### 7.1 功能测试
- [ ] 测试小型项目分析
- [ ] 测试中型项目分析
- [ ] 测试大型项目分析
- [ ] 测试各 AI 服务

### 7.2 兼容性测试
- [ ] 测试 Chrome 最新版
- [ ] 测试 Edge 浏览器
- [ ] 测试不同操作系统

### 7.3 发布准备
- [ ] 编写用户使用说明
- [ ] 准备 Chrome Web Store 素材
- [ ] 准备隐私政策

---

## 进度追踪

| 阶段 | 状态 | 完成度 |
|-----|------|-------|
| 阶段 1：项目初始化 | ✅ 完成 | 100% |
| 阶段 2：GitHub API | ✅ 完成 | 100% |
| 阶段 3：骨架提取 | ✅ 完成 | 100% |
| 阶段 4：AI 分析 | ✅ 完成 | 100% |
| 阶段 5：UI 实现 | ✅ 完成 | 100% |
| 阶段 6：集成优化 | ✅ 基本完成 | 95% |
| 阶段 7：测试发布 | 🔄 待进行 | 0% |

---

## 备注

- 每完成一个任务，将 `[ ]` 改为 `[x]`
- 遇到问题或变更需求，在对应任务下添加备注
- 定期更新进度追踪表

### 已完成功能总结

1. **项目初始化** - Vite + React + TypeScript + Tailwind + CRXJS
2. **GitHub API** - 完整的仓库信息获取，带重试机制
3. **代码骨架** - JS/TS/Python 签名提取，多配置文件解析
4. **AI 分析** - Claude/OpenAI/SiliconFlow 三种服务，流式输出
5. **UI** - 设置页面、分析面板、进度指示、Markdown渲染、代码高亮
6. **缓存** - 24小时缓存，自动过期

### 待优化项

1. 代码分割优化包体积（当前 popup.js 约 950KB）
2. 功能测试
3. 发布准备
