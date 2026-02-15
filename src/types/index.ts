// GitHub API Types
export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
  children?: FileNode[];
}

export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  fileTree: FileNode[];
  readme: string;
  fileCount: number;
  isPrivate: boolean;
  visibility: 'public' | 'private' | 'internal';
}

// Code Skeleton Types
export interface DirectoryTree {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: DirectoryTree[];
}

export interface ProjectConfig {
  type: 'npm' | 'python' | 'cargo' | 'go' | 'unknown';
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  raw: string;
}

export interface FunctionSignature {
  name: string;
  params: string;
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  line: number;
}

export interface ClassSignature {
  name: string;
  extends?: string;
  methods: FunctionSignature[];
  isExported: boolean;
  line: number;
}

export interface ModuleSkeleton {
  path: string;
  language: 'typescript' | 'javascript' | 'python' | 'unknown';
  functions: FunctionSignature[];
  classes: ClassSignature[];
  exports: string[];
}

export interface DependencyInfo {
  runtime: Record<string, string>;
  dev: Record<string, string>;
}

export interface CodeSkeleton {
  structure: DirectoryTree;
  config: ProjectConfig | null;
  entryPoints: string[];
  modules: ModuleSkeleton[];
  dependencies: DependencyInfo;
}

// AI Service Types
export type AIProvider = 'claude' | 'openai' | 'siliconflow' | 'bigmodel';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIStreamCallback {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface AIService {
  analyze(skeleton: CodeSkeleton, repoInfo: RepoInfo, callback: AIStreamCallback): Promise<void>;
}

// Analysis Types
export type ProjectSize = 'small' | 'medium' | 'large';

export interface AnalysisConfig {
  projectSize: ProjectSize;
  maxFilesToAnalyze: number;
  includeFullContent: boolean;
}

export interface AnalysisResult {
  repoInfo: RepoInfo;
  skeleton: CodeSkeleton;
  aiAnalysis: string;
  generatedAt: number;
}

// Storage Types
export interface StorageSettings {
  githubToken?: string;
  aiProvider: AIProvider;
  claudeApiKey?: string;
  openaiApiKey?: string;
  siliconflowApiKey?: string;
  bigmodelApiKey?: string;
  claudeModel?: string;
  openaiModel?: string;
  siliconflowModel?: string;
  bigmodelModel?: string;
}

export interface CachedAnalysis {
  repoKey: string;
  result: AnalysisResult;
  timestamp: number;
}

// Message Types for Chrome Extension
export type MessageType =
  | 'GET_REPO_INFO'
  | 'ANALYZE_REPO'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'CLEAR_CACHE';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface RepoInfoPayload {
  owner: string;
  repo: string;
}
