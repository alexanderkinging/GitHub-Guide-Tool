import type { PromptTemplate } from '@/types';
import DEFAULT_SYSTEM from '@/prompts/system.txt?raw';
import DEFAULT_USER from '@/prompts/user.txt?raw';

// Quick overview system prompt
const QUICK_SYSTEM = `# Role
你是一位高效的技术顾问，擅长快速提炼项目核心信息。

# Output Format
请用简洁的 Markdown 格式输出，控制在 500 字以内：

## 项目概述
* 一句话描述项目用途
* 核心技术栈（3个以内）
* 适用场景

## 快速上手
* 安装命令
* 启动命令
* 核心 API 或入口

## 注意事项
* 最重要的 2-3 个注意点`;

const QUICK_USER = `请快速分析这个项目，给出简洁的概述：

{skeleton}

请用中文输出，控制在 500 字以内。`;

// Security audit system prompt
const SECURITY_SYSTEM = `# Role
你是一位资深安全工程师，专注于代码安全审计和漏洞分析。

# Output Format
请严格按照以下 Markdown 结构输出安全审计报告：

## 1. 安全评级
* **总体评级：** (A/B/C/D/F)
* **风险等级：** 高/中/低

## 2. 依赖安全
* 检查是否有已知漏洞的依赖
* 依赖版本是否过时
* 是否有不必要的依赖

## 3. 代码安全问题
### 高危问题
* 硬编码密钥/Token
* SQL 注入风险
* XSS 漏洞
* 命令注入

### 中危问题
* 不安全的随机数生成
* 敏感信息日志输出
* 缺乏输入验证

### 低危问题
* 代码质量问题
* 潜在的逻辑漏洞

## 4. 配置安全
* 环境变量处理
* 敏感配置文件
* CORS 配置

## 5. 修复建议
* 按优先级列出修复建议`;

const SECURITY_USER = `请对这个项目进行安全审计：

{skeleton}

请重点关注安全漏洞和风险，用中文输出。`;

// Learning guide system prompt
const LEARNING_SYSTEM = `# Role
你是一位耐心的编程导师，擅长帮助初学者理解复杂项目。

# Output Format
请用通俗易懂的语言，按以下结构输出学习指南：

## 1. 项目是什么？
* 用生活中的例子类比解释项目用途
* 这个项目解决了什么问题？

## 2. 需要哪些前置知识？
* 列出学习这个项目需要的基础知识
* 推荐的学习资源链接

## 3. 核心概念解释
* 用简单的语言解释项目中的核心概念
* 配合代码示例说明

## 4. 代码结构导览
* 从入口文件开始，解释代码执行流程
* 重点文件的作用说明

## 5. 动手实践建议
* 建议的学习路径
* 可以尝试修改的地方
* 进阶学习方向

## 6. 常见问题
* 初学者可能遇到的问题和解答`;

const LEARNING_USER = `请为初学者生成这个项目的学习指南：

{skeleton}

请用通俗易懂的中文输出，适合编程初学者阅读。`;

export const PRESET_TEMPLATES: PromptTemplate[] = [
  {
    id: 'preset-default',
    name: '深度分析',
    description: '全面的技术架构解构，适合深入了解项目',
    systemPrompt: DEFAULT_SYSTEM,
    userPrompt: DEFAULT_USER,
    isPreset: true,
  },
  {
    id: 'preset-quick',
    name: '快速概览',
    description: '简洁的项目概述，500字以内',
    systemPrompt: QUICK_SYSTEM,
    userPrompt: QUICK_USER,
    isPreset: true,
  },
  {
    id: 'preset-security',
    name: '安全审计',
    description: '聚焦安全风险和漏洞分析',
    systemPrompt: SECURITY_SYSTEM,
    userPrompt: SECURITY_USER,
    isPreset: true,
  },
  {
    id: 'preset-learning',
    name: '学习指南',
    description: '适合初学者的项目学习指南',
    systemPrompt: LEARNING_SYSTEM,
    userPrompt: LEARNING_USER,
    isPreset: true,
  },
];

export function getTemplateById(
  id: string,
  customTemplates: PromptTemplate[] = []
): PromptTemplate | undefined {
  // First check presets
  const preset = PRESET_TEMPLATES.find(t => t.id === id);
  if (preset) return preset;

  // Then check custom templates
  return customTemplates.find(t => t.id === id);
}

export function getAllTemplates(customTemplates: PromptTemplate[] = []): PromptTemplate[] {
  return [...PRESET_TEMPLATES, ...customTemplates];
}

export function generateTemplateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
