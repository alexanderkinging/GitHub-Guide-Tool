import type { FileNode, RepoInfo } from '@/types';

const GITHUB_API_BASE = 'https://api.github.com';

// Directories to ignore when building file tree
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  '.next',
  '.nuxt',
  'vendor',
  'target',
  '.venv',
  'venv',
  'env',
  '.env',
  'coverage',
  '.cache',
  '.idea',
  '.vscode',
]);

// File extensions to ignore
const IGNORED_EXTENSIONS = new Set([
  '.lock',
  '.log',
  '.map',
  '.min.js',
  '.min.css',
]);

export interface TokenPermissions {
  isValid: boolean;
  hasPrivateAccess: boolean | 'unknown';
  scopes: string[];
  rateLimit: {
    remaining: number;
    limit: number;
    reset: number;
  };
  user?: string;
  error?: string;
}

export class GitHubAPI {
  private token: string | null = null;
  private maxRetries = 3;
  private retryDelay = 1000;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkTokenPermissions(): Promise<TokenPermissions> {
    if (!this.token) {
      return {
        isValid: false,
        hasPrivateAccess: false,
        scopes: [],
        rateLimit: { remaining: 0, limit: 0, reset: 0 },
        error: 'No token configured',
      };
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      const rateLimit = {
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10),
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0', 10),
        reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10),
      };

      if (!response.ok) {
        return {
          isValid: false,
          hasPrivateAccess: false,
          scopes: [],
          rateLimit,
          error: response.status === 401 ? 'Invalid token' : `HTTP ${response.status}`,
        };
      }

      const scopesHeader = response.headers.get('X-OAuth-Scopes') || '';
      const scopes = scopesHeader.split(',').map(s => s.trim()).filter(Boolean);

      const userData = await response.json();

      // Check if token has private repo access
      // Classic token: check 'repo' scope in X-OAuth-Scopes header
      // Fine-grained token: no scopes header, cannot determine access level
      const hasPrivateAccess: boolean | 'unknown' = scopes.length === 0
        ? 'unknown'  // Fine-grained token - cannot determine
        : scopes.includes('repo') || scopes.some(s => s.startsWith('repo'));

      return {
        isValid: true,
        hasPrivateAccess,
        scopes,
        rateLimit,
        user: userData.login,
      };
    } catch (error) {
      return {
        isValid: false,
        hasPrivateAccess: false,
        scopes: [],
        rateLimit: { remaining: 0, limit: 0, reset: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchWithRetry<T>(endpoint: string, retries = this.maxRetries): Promise<T> {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers });

      if (!response.ok) {
        if (response.status === 403) {
          const remaining = response.headers.get('X-RateLimit-Remaining');
          if (remaining === '0') {
            throw new Error('GitHub API rate limit exceeded. Please add a GitHub token in settings.');
          }
        }

        // Retry on 5xx errors or 429 (rate limit)
        if ((response.status >= 500 || response.status === 429) && retries > 0) {
          await this.sleep(this.retryDelay);
          return this.fetchWithRetry<T>(endpoint, retries - 1);
        }

        // Handle private repo access errors
        if (endpoint.startsWith('/repos/')) {
          if (response.status === 404) {
            throw new Error('PRIVATE_REPO_ACCESS_DENIED: 仓库不存在或无访问权限。如果是私有仓库，请在设置中配置有 repo 权限的 Token。');
          }
          if (response.status === 403) {
            throw new Error('PRIVATE_REPO_ACCESS_DENIED: 无权访问此仓库。请检查 Token 是否有 repo 权限。');
          }
          if (response.status === 401) {
            throw new Error('PRIVATE_REPO_ACCESS_DENIED: Token 无效或已过期。请在设置中重新配置 Token。');
          }
        }

        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // Retry on network errors
      if (retries > 0 && error instanceof TypeError) {
        await this.sleep(this.retryDelay);
        return this.fetchWithRetry<T>(endpoint, retries - 1);
      }
      throw error;
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    return this.fetchWithRetry<T>(endpoint);
  }

  async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    // Fetch repo metadata
    const repoData = await this.fetch<{
      default_branch: string;
      description: string;
      language: string;
      stargazers_count: number;
      forks_count: number;
      private: boolean;
      visibility: 'public' | 'private' | 'internal';
    }>(`/repos/${owner}/${repo}`);

    // Fetch file tree
    const treeData = await this.fetch<{
      tree: Array<{
        path: string;
        type: 'blob' | 'tree';
        size?: number;
        sha: string;
      }>;
    }>(`/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`);

    // Build file tree structure
    const fileTree = this.buildFileTree(treeData.tree);
    const fileCount = treeData.tree.filter(item => item.type === 'blob').length;

    // Fetch README
    let readme = '';
    try {
      const readmeData = await this.fetch<{ content: string }>(`/repos/${owner}/${repo}/readme`);
      readme = atob(readmeData.content);
    } catch {
      // README might not exist
    }

    return {
      owner,
      repo,
      defaultBranch: repoData.default_branch,
      description: repoData.description || '',
      language: repoData.language || 'Unknown',
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      fileTree,
      readme,
      fileCount,
      isPrivate: repoData.private,
      visibility: repoData.visibility || (repoData.private ? 'private' : 'public'),
    };
  }

  private buildFileTree(
    items: Array<{ path: string; type: 'blob' | 'tree'; size?: number; sha: string }>
  ): FileNode[] {
    const root: FileNode[] = [];
    const nodeMap = new Map<string, FileNode>();

    // Filter out ignored directories and files
    const filteredItems = items.filter(item => {
      const parts = item.path.split('/');

      // Check if any part of the path is in ignored directories
      for (const part of parts) {
        if (IGNORED_DIRS.has(part)) {
          return false;
        }
      }

      // Check file extension
      if (item.type === 'blob') {
        for (const ext of IGNORED_EXTENSIONS) {
          if (item.path.endsWith(ext)) {
            return false;
          }
        }
      }

      return true;
    });

    // Sort items so directories come before their contents
    filteredItems.sort((a, b) => a.path.localeCompare(b.path));

    for (const item of filteredItems) {
      const parts = item.path.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const node: FileNode = {
        path: item.path,
        name,
        type: item.type === 'blob' ? 'file' : 'dir',
        size: item.size,
        sha: item.sha,
        children: item.type === 'tree' ? [] : undefined,
      };

      nodeMap.set(item.path, node);

      if (parentPath === '') {
        root.push(node);
      } else {
        const parent = nodeMap.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      }
    }

    // Clear the temporary map to free memory
    nodeMap.clear();

    return root;
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const data = await this.fetch<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}`
    );

    if (data.encoding === 'base64') {
      return atob(data.content);
    }

    return data.content;
  }

  async getMultipleFiles(
    owner: string,
    repo: string,
    paths: string[]
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Fetch files in parallel with a concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < paths.length; i += concurrencyLimit) {
      const batch = paths.slice(i, i + concurrencyLimit);
      const promises = batch.map(async path => {
        try {
          const content = await this.getFileContent(owner, repo, path);
          return { path, content };
        } catch {
          return { path, content: '' };
        }
      });

      const batchResults = await Promise.all(promises);
      for (const { path, content } of batchResults) {
        if (content) {
          results.set(path, content);
        }
      }
    }

    return results;
  }
}

export const githubAPI = new GitHubAPI();
