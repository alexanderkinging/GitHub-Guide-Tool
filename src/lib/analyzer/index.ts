import type {
  FileNode,
  RepoInfo,
  CodeSkeleton,
  DirectoryTree,
  ProjectConfig,
  ModuleSkeleton,
  FunctionSignature,
  ClassSignature,
  DependencyInfo,
  ProjectSize,
  AnalysisConfig,
} from '@/types';
import { githubAPI } from '@/lib/github';

// Config file patterns
const CONFIG_FILES = [
  'package.json',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  'go.mod',
  'composer.json',
  'Gemfile',
  'pom.xml',
  'build.gradle',
];

// Entry point patterns
const ENTRY_PATTERNS = [
  /^(src\/)?index\.(ts|js|tsx|jsx)$/,
  /^(src\/)?main\.(ts|js|tsx|jsx|py)$/,
  /^(src\/)?app\.(ts|js|tsx|jsx|py)$/,
  /^__main__\.py$/,
  /^main\.go$/,
  /^src\/main\.rs$/,
  /^lib\.rs$/,
];

// Priority directories for analysis
const PRIORITY_DIRS = ['src', 'lib', 'core', 'api', 'app', 'components', 'services', 'utils'];

// TypeScript/JavaScript function regex
const TS_FUNCTION_REGEX =
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g;

// TypeScript/JavaScript arrow function regex
const TS_ARROW_REGEX =
  /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;

// TypeScript/JavaScript class regex
const TS_CLASS_REGEX = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;

// Python function regex
const PY_FUNCTION_REGEX = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g;

// Python class regex
const PY_CLASS_REGEX = /class\s+(\w+)(?:\s*\(([^)]*)\))?:/g;

// Go function regex: func name(params) returnType or func (receiver) name(params) returnType
const GO_FUNCTION_REGEX = /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]+)\)|\s+([^{\n]+))?/g;
// Go struct regex: type Name struct
const GO_STRUCT_REGEX = /type\s+(\w+)\s+struct\s*\{/g;
// Go interface regex: type Name interface
const GO_INTERFACE_REGEX = /type\s+(\w+)\s+interface\s*\{/g;

// Rust function regex: pub fn name(params) -> ReturnType
const RUST_FUNCTION_REGEX = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{\n]+))?/g;
// Rust struct regex: pub struct Name
const RUST_STRUCT_REGEX = /(?:pub\s+)?struct\s+(\w+)(?:<[^>]*>)?/g;
// Rust trait regex: pub trait Name
const RUST_TRAIT_REGEX = /(?:pub\s+)?trait\s+(\w+)(?:<[^>]*>)?/g;

// Java method regex: public void name(params)
const JAVA_METHOD_REGEX = /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:<[^>]*>\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
// Java class regex: public class Name extends Parent implements Interface
const JAVA_CLASS_REGEX = /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
// Java interface regex: public interface Name
const JAVA_INTERFACE_REGEX = /(?:public\s+)?interface\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+([^{]+))?/g;

// C++ function regex: ReturnType name(params)
const CPP_FUNCTION_REGEX = /(?:virtual\s+)?(?:static\s+)?(?:inline\s+)?(?:const\s+)?(\w+(?:\s*[*&])?)\s+(\w+)\s*\(([^)]*)\)(?:\s*const)?(?:\s*override)?(?:\s*=\s*0)?/g;
// C++ class regex: class Name : public Parent
const CPP_CLASS_REGEX = /class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?/g;
// C++ struct regex
const CPP_STRUCT_REGEX = /struct\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?/g;

export function determineProjectSize(fileCount: number): ProjectSize {
  if (fileCount < 50) return 'small';
  if (fileCount <= 200) return 'medium';
  return 'large';
}

export function getAnalysisConfig(size: ProjectSize): AnalysisConfig {
  switch (size) {
    case 'small':
      return { projectSize: size, maxFilesToAnalyze: 50, includeFullContent: true };
    case 'medium':
      return { projectSize: size, maxFilesToAnalyze: 30, includeFullContent: false };
    case 'large':
      return { projectSize: size, maxFilesToAnalyze: 15, includeFullContent: false };
  }
}

function buildDirectoryTree(nodes: FileNode[]): DirectoryTree {
  const root: DirectoryTree = {
    name: '.',
    path: '',
    type: 'dir',
    children: [],
  };

  function addNode(node: FileNode, parent: DirectoryTree) {
    const treeNode: DirectoryTree = {
      name: node.name,
      path: node.path,
      type: node.type,
      children: node.type === 'dir' ? [] : undefined,
    };

    parent.children!.push(treeNode);

    if (node.children) {
      for (const child of node.children) {
        addNode(child, treeNode);
      }
    }
  }

  for (const node of nodes) {
    addNode(node, root);
  }

  return root;
}

function findConfigFiles(fileTree: FileNode[]): string[] {
  const configs: string[] = [];

  function traverse(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file' && CONFIG_FILES.includes(node.name)) {
        configs.push(node.path);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(fileTree);
  return configs;
}

function findEntryPoints(fileTree: FileNode[]): string[] {
  const entries: string[] = [];

  function traverse(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        for (const pattern of ENTRY_PATTERNS) {
          if (pattern.test(node.path)) {
            entries.push(node.path);
            break;
          }
        }
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(fileTree);
  return entries;
}

function findAnalyzableFiles(fileTree: FileNode[], maxFiles: number): string[] {
  const files: string[] = [];
  const priorityFiles: string[] = [];
  const otherFiles: string[] = [];

  function traverse(nodes: FileNode[], inPriorityDir: boolean) {
    for (const node of nodes) {
      if (node.type === 'file') {
        const ext = node.name.split('.').pop()?.toLowerCase();
        if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'cc', 'cxx', 'c', 'h', 'hpp'].includes(ext || '')) {
          if (inPriorityDir) {
            priorityFiles.push(node.path);
          } else {
            otherFiles.push(node.path);
          }
        }
      }
      if (node.children) {
        const isPriority = inPriorityDir || PRIORITY_DIRS.includes(node.name);
        traverse(node.children, isPriority);
      }
    }
  }

  traverse(fileTree, false);

  // Combine priority files first, then other files
  files.push(...priorityFiles, ...otherFiles);

  return files.slice(0, maxFiles);
}

function parseConfig(content: string, filename: string): ProjectConfig {
  if (filename === 'package.json') {
    try {
      const pkg = JSON.parse(content);
      return {
        type: 'npm',
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        scripts: pkg.scripts,
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
        raw: content,
      };
    } catch {
      return { type: 'npm', raw: content };
    }
  }

  if (filename === 'tsconfig.json') {
    try {
      const tsconfig = JSON.parse(content);
      return {
        type: 'npm',
        raw: content,
        // Extract useful TypeScript config info
        scripts: {
          target: tsconfig.compilerOptions?.target,
          module: tsconfig.compilerOptions?.module,
          strict: tsconfig.compilerOptions?.strict ? 'enabled' : 'disabled',
        },
      };
    } catch {
      return { type: 'npm', raw: content };
    }
  }

  if (filename === 'pyproject.toml' || filename === 'setup.py') {
    // Parse pyproject.toml for project info
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/);

    return {
      type: 'python',
      name: nameMatch?.[1],
      version: versionMatch?.[1],
      description: descMatch?.[1],
      raw: content,
    };
  }

  if (filename === 'Cargo.toml') {
    // Parse Cargo.toml for Rust project info
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/);

    return {
      type: 'cargo',
      name: nameMatch?.[1],
      version: versionMatch?.[1],
      description: descMatch?.[1],
      raw: content,
    };
  }

  if (filename === 'go.mod') {
    // Parse go.mod for Go project info
    const moduleMatch = content.match(/module\s+(\S+)/);
    const goVersionMatch = content.match(/go\s+(\d+\.\d+)/);

    return {
      type: 'go',
      name: moduleMatch?.[1],
      version: goVersionMatch?.[1],
      raw: content,
    };
  }

  return { type: 'unknown', raw: content };
}

function detectLanguage(path: string): 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'cpp' | 'unknown' {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'java':
      return 'java';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c':
    case 'h':
    case 'hpp':
      return 'cpp';
    default:
      return 'unknown';
  }
}

function extractFunctions(content: string, language: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];
  const lines = content.split('\n');

  if (language === 'typescript' || language === 'javascript') {
    // Extract regular functions
    let match;
    while ((match = TS_FUNCTION_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        params: match[2].trim(),
        returnType: match[3]?.trim(),
        isAsync: match[0].includes('async'),
        isExported: match[0].includes('export'),
        line: lineNumber,
      });
    }

    // Extract arrow functions
    while ((match = TS_ARROW_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        params: '',
        isAsync: match[0].includes('async'),
        isExported: match[0].includes('export'),
        line: lineNumber,
      });
    }
  } else if (language === 'python') {
    let match;
    while ((match = PY_FUNCTION_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      // Check if it's a method (indented) or top-level function
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const indent = match.index - lineStart;

      if (indent === 0) {
        // Top-level function
        functions.push({
          name: match[1],
          params: match[2].trim(),
          returnType: match[3]?.trim(),
          isAsync: lines[lineNumber - 1]?.includes('async'),
          isExported: !match[1].startsWith('_'),
          line: lineNumber,
        });
      }
    }
  } else if (language === 'go') {
    let match;
    while ((match = GO_FUNCTION_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      // Go exports are determined by capitalization
      const isExported = /^[A-Z]/.test(match[1]);
      const returnType = match[3]?.trim() || match[4]?.trim();
      functions.push({
        name: match[1],
        params: match[2].trim(),
        returnType,
        isAsync: false,
        isExported,
        line: lineNumber,
      });
    }
  } else if (language === 'rust') {
    let match;
    while ((match = RUST_FUNCTION_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        params: match[2].trim(),
        returnType: match[3]?.trim(),
        isAsync: match[0].includes('async'),
        isExported: match[0].includes('pub'),
        line: lineNumber,
      });
    }
  } else if (language === 'java') {
    let match;
    while ((match = JAVA_METHOD_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      // Skip constructors (return type equals method name)
      if (match[1] === match[2]) continue;
      functions.push({
        name: match[2],
        params: match[3].trim(),
        returnType: match[1],
        isAsync: false,
        isExported: match[0].includes('public'),
        line: lineNumber,
      });
    }
  } else if (language === 'cpp') {
    let match;
    while ((match = CPP_FUNCTION_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      // Skip common false positives
      if (['if', 'while', 'for', 'switch', 'catch', 'return'].includes(match[2])) continue;
      functions.push({
        name: match[2],
        params: match[3].trim(),
        returnType: match[1].trim(),
        isAsync: false,
        isExported: true, // C++ doesn't have export concept like JS
        line: lineNumber,
      });
    }
  }

  return functions;
}

function extractClasses(content: string, language: string): ClassSignature[] {
  const classes: ClassSignature[] = [];

  if (language === 'typescript' || language === 'javascript') {
    let match;
    while ((match = TS_CLASS_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        extends: match[2],
        methods: [],
        isExported: match[0].includes('export'),
        line: lineNumber,
      });
    }
  } else if (language === 'python') {
    let match;
    while ((match = PY_CLASS_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        extends: match[2],
        methods: [],
        isExported: !match[1].startsWith('_'),
        line: lineNumber,
      });
    }
  } else if (language === 'go') {
    // Extract structs
    let match;
    while ((match = GO_STRUCT_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        methods: [],
        isExported: /^[A-Z]/.test(match[1]),
        line: lineNumber,
      });
    }
    // Extract interfaces
    while ((match = GO_INTERFACE_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1] + ' (interface)',
        methods: [],
        isExported: /^[A-Z]/.test(match[1]),
        line: lineNumber,
      });
    }
  } else if (language === 'rust') {
    // Extract structs
    let match;
    while ((match = RUST_STRUCT_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        methods: [],
        isExported: match[0].includes('pub'),
        line: lineNumber,
      });
    }
    // Extract traits
    while ((match = RUST_TRAIT_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1] + ' (trait)',
        methods: [],
        isExported: match[0].includes('pub'),
        line: lineNumber,
      });
    }
  } else if (language === 'java') {
    // Extract classes
    let match;
    while ((match = JAVA_CLASS_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        extends: match[2],
        methods: [],
        isExported: match[0].includes('public'),
        line: lineNumber,
      });
    }
    // Extract interfaces
    while ((match = JAVA_INTERFACE_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1] + ' (interface)',
        extends: match[2],
        methods: [],
        isExported: match[0].includes('public'),
        line: lineNumber,
      });
    }
  } else if (language === 'cpp') {
    // Extract classes
    let match;
    while ((match = CPP_CLASS_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1],
        extends: match[2],
        methods: [],
        isExported: true,
        line: lineNumber,
      });
    }
    // Extract structs
    while ((match = CPP_STRUCT_REGEX.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      classes.push({
        name: match[1] + ' (struct)',
        extends: match[2],
        methods: [],
        isExported: true,
        line: lineNumber,
      });
    }
  }

  return classes;
}

function extractExports(content: string, language: string): string[] {
  const exports: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    // Named exports
    const namedExportRegex = /export\s+\{([^}]+)\}/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(' ')[0]);
      exports.push(...names);
    }

    // Default export
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }
  } else if (language === 'python') {
    // __all__ definition
    const allRegex = /__all__\s*=\s*\[([^\]]+)\]/;
    const match = allRegex.exec(content);
    if (match) {
      const names = match[1].match(/['"](\w+)['"]/g);
      if (names) {
        exports.push(...names.map(n => n.replace(/['"]/g, '')));
      }
    }
  } else if (language === 'go') {
    // Go exports are capitalized identifiers - already handled in function/class extraction
    // Just note the package name
    const pkgMatch = /package\s+(\w+)/.exec(content);
    if (pkgMatch) {
      exports.push(`package: ${pkgMatch[1]}`);
    }
  } else if (language === 'rust') {
    // pub use statements
    const pubUseRegex = /pub\s+use\s+([^;]+);/g;
    let match;
    while ((match = pubUseRegex.exec(content)) !== null) {
      exports.push(match[1].trim());
    }
    // mod declarations
    const modRegex = /pub\s+mod\s+(\w+)/g;
    while ((match = modRegex.exec(content)) !== null) {
      exports.push(`mod ${match[1]}`);
    }
  } else if (language === 'java') {
    // Package declaration
    const pkgMatch = /package\s+([^;]+);/.exec(content);
    if (pkgMatch) {
      exports.push(`package: ${pkgMatch[1].trim()}`);
    }
  } else if (language === 'cpp') {
    // Namespace declarations
    const nsRegex = /namespace\s+(\w+)/g;
    let match;
    while ((match = nsRegex.exec(content)) !== null) {
      exports.push(`namespace: ${match[1]}`);
    }
  }

  return exports;
}

function parseModuleSkeleton(path: string, content: string): ModuleSkeleton {
  const language = detectLanguage(path);

  return {
    path,
    language,
    functions: extractFunctions(content, language),
    classes: extractClasses(content, language),
    exports: extractExports(content, language),
  };
}

function extractDependencies(config: ProjectConfig | null): DependencyInfo {
  if (!config) {
    return { runtime: {}, dev: {} };
  }

  if (config.type === 'npm') {
    return {
      runtime: config.dependencies || {},
      dev: config.devDependencies || {},
    };
  }

  return { runtime: {}, dev: {} };
}

export async function extractCodeSkeleton(
  repoInfo: RepoInfo,
  onProgress?: (stage: string, progress: number) => void
): Promise<CodeSkeleton> {
  const { owner, repo, fileTree, fileCount } = repoInfo;

  // Determine project size and analysis config
  const projectSize = determineProjectSize(fileCount);
  const analysisConfig = getAnalysisConfig(projectSize);

  onProgress?.('Building directory structure', 10);

  // Build directory tree
  const structure = buildDirectoryTree(fileTree);

  onProgress?.('Finding configuration files', 20);

  // Find and fetch config files
  const configPaths = findConfigFiles(fileTree);
  let config: ProjectConfig | null = null;

  if (configPaths.length > 0) {
    const configContents = await githubAPI.getMultipleFiles(owner, repo, configPaths.slice(0, 3));
    for (const [path, content] of configContents) {
      const filename = path.split('/').pop() || '';
      config = parseConfig(content, filename);
      if (config.type !== 'unknown') break;
    }
  }

  onProgress?.('Identifying entry points', 30);

  // Find entry points
  const entryPoints = findEntryPoints(fileTree);

  onProgress?.('Analyzing code modules', 40);

  // Find files to analyze
  const filesToAnalyze = findAnalyzableFiles(fileTree, analysisConfig.maxFilesToAnalyze);

  // Fetch file contents
  const fileContents = await githubAPI.getMultipleFiles(owner, repo, filesToAnalyze);

  onProgress?.('Extracting code signatures', 70);

  // Parse module skeletons
  const modules: ModuleSkeleton[] = [];
  for (const [path, content] of fileContents) {
    const skeleton = parseModuleSkeleton(path, content);
    if (skeleton.functions.length > 0 || skeleton.classes.length > 0) {
      modules.push(skeleton);
    }
  }

  onProgress?.('Extracting dependencies', 90);

  // Extract dependencies
  const dependencies = extractDependencies(config);

  onProgress?.('Complete', 100);

  return {
    structure,
    config,
    entryPoints,
    modules,
    dependencies,
  };
}

export function formatSkeletonForAI(skeleton: CodeSkeleton, repoInfo: RepoInfo): string {
  const lines: string[] = [];

  // Project info
  lines.push('## Project Information');
  lines.push(`- Name: ${repoInfo.repo}`);
  lines.push(`- Owner: ${repoInfo.owner}`);
  lines.push(`- Language: ${repoInfo.language}`);
  lines.push(`- Stars: ${repoInfo.stars}`);
  lines.push(`- Description: ${repoInfo.description || 'No description'}`);
  lines.push('');

  // Directory structure
  lines.push('## Directory Structure');
  lines.push('```');
  lines.push(formatDirectoryTree(skeleton.structure));
  lines.push('```');
  lines.push('');

  // Configuration
  if (skeleton.config) {
    lines.push('## Configuration');
    lines.push(`Project type: ${skeleton.config.type}`);
    if (skeleton.config.name) lines.push(`Name: ${skeleton.config.name}`);
    if (skeleton.config.version) lines.push(`Version: ${skeleton.config.version}`);
    if (skeleton.config.description) lines.push(`Description: ${skeleton.config.description}`);

    if (skeleton.config.scripts && Object.keys(skeleton.config.scripts).length > 0) {
      lines.push('\nScripts:');
      for (const [name, cmd] of Object.entries(skeleton.config.scripts)) {
        lines.push(`  - ${name}: ${cmd}`);
      }
    }
    lines.push('');
  }

  // Dependencies
  if (Object.keys(skeleton.dependencies.runtime).length > 0) {
    lines.push('## Dependencies');
    lines.push('Runtime:');
    for (const [name, version] of Object.entries(skeleton.dependencies.runtime).slice(0, 20)) {
      lines.push(`  - ${name}: ${version}`);
    }
    if (Object.keys(skeleton.dependencies.runtime).length > 20) {
      lines.push(`  ... and ${Object.keys(skeleton.dependencies.runtime).length - 20} more`);
    }
    lines.push('');
  }

  // Entry points
  if (skeleton.entryPoints.length > 0) {
    lines.push('## Entry Points');
    for (const entry of skeleton.entryPoints) {
      lines.push(`- ${entry}`);
    }
    lines.push('');
  }

  // Module skeletons
  if (skeleton.modules.length > 0) {
    lines.push('## Code Modules');
    for (const module of skeleton.modules) {
      lines.push(`\n### ${module.path}`);

      if (module.classes.length > 0) {
        lines.push('Classes:');
        for (const cls of module.classes) {
          const exported = cls.isExported ? 'export ' : '';
          const ext = cls.extends ? ` extends ${cls.extends}` : '';
          lines.push(`  - ${exported}class ${cls.name}${ext}`);
        }
      }

      if (module.functions.length > 0) {
        lines.push('Functions:');
        for (const fn of module.functions) {
          const exported = fn.isExported ? 'export ' : '';
          const async = fn.isAsync ? 'async ' : '';
          const ret = fn.returnType ? `: ${fn.returnType}` : '';
          lines.push(`  - ${exported}${async}function ${fn.name}(${fn.params})${ret}`);
        }
      }

      if (module.exports.length > 0) {
        lines.push(`Exports: ${module.exports.join(', ')}`);
      }
    }
    lines.push('');
  }

  // README excerpt
  if (repoInfo.readme) {
    lines.push('## README (excerpt)');
    const readmeExcerpt = repoInfo.readme.substring(0, 2000);
    lines.push(readmeExcerpt);
    if (repoInfo.readme.length > 2000) {
      lines.push('\n... (truncated)');
    }
  }

  return lines.join('\n');
}

function formatDirectoryTree(tree: DirectoryTree, indent: string = ''): string {
  const lines: string[] = [];

  if (tree.name !== '.') {
    const icon = tree.type === 'dir' ? '📁' : '📄';
    lines.push(`${indent}${icon} ${tree.name}`);
  }

  if (tree.children) {
    const sortedChildren = [...tree.children].sort((a, b) => {
      // Directories first
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const child of sortedChildren.slice(0, 50)) {
      lines.push(formatDirectoryTree(child, indent + '  '));
    }

    if (sortedChildren.length > 50) {
      lines.push(`${indent}  ... and ${sortedChildren.length - 50} more items`);
    }
  }

  return lines.join('\n');
}
