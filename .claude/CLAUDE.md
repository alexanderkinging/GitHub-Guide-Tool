# Project Instructions for Claude

## 版本号更新规范

当用户要求 commit 和 push 代码时，必须同步更新版本号：

### 版本号格式：`MAJOR.MINOR.PATCH`

- **PATCH (最后一位)**: 修复 bug 时 +1
  - 例如：修复 API key 读取错误、修复 UI 显示问题

- **MINOR (中间位)**: 新增功能时 +1，PATCH 归零
  - 例如：添加新的 AI 提供商支持、添加新的导出格式

- **MAJOR (第一位)**: 大功能或重构、重大变动时 +1，MINOR 和 PATCH 归零
  - 例如：架构重构、不兼容的 API 变更

### 需要更新的文件

1. `package.json` - version 字段
2. `manifest.json` - version 字段

### 触发时机

在执行 `git commit` 之前，根据本次变更的性质更新版本号，然后一起提交。

### 示例

```
1.0.0 -> 1.0.1  (bug fix)
1.0.1 -> 1.1.0  (new feature)
1.1.0 -> 2.0.0  (major refactor)
```
