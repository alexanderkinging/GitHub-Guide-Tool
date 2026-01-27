// Content script for detecting GitHub repository pages

interface RepoInfo {
  owner: string;
  repo: string;
  isRepoPage: boolean;
}

function parseGitHubUrl(): RepoInfo | null {
  const url = window.location.href;
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);

  if (!match) {
    return null;
  }

  const [, owner, repo] = match;

  // Exclude non-repo pages
  const excludedPaths = ['settings', 'notifications', 'explore', 'marketplace', 'sponsors'];
  if (excludedPaths.includes(owner)) {
    return null;
  }

  return {
    owner,
    repo: repo.replace(/\.git$/, ''),
    isRepoPage: true,
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_REPO') {
    const repoInfo = parseGitHubUrl();
    sendResponse(repoInfo);
  }
  return true;
});

// Notify background script when navigating to a repo page
const repoInfo = parseGitHubUrl();
if (repoInfo) {
  chrome.runtime.sendMessage({
    type: 'REPO_PAGE_DETECTED',
    payload: repoInfo,
  });
}
