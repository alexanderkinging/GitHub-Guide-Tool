# Installation Guide

## Quick Start

### Step 1: Download
Download the latest release from [GitHub Releases](https://github.com/alexanderkinging/GitHub-Guide-Tool/releases)

### Step 2: Install Extension
1. Unzip `github-guide-tool-v1.0.0.zip`
2. Open Chrome browser
3. Navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **Load unpacked**
6. Select the `dist` folder from the unzipped files

### Step 3: Configure API Keys
1. Click the extension icon in your toolbar
2. Go to **Settings** tab
3. Configure:
   - **AI Provider**: Choose Claude, OpenAI, or SiliconFlow
   - **API Key**: Enter your API key
   - **GitHub Token** (optional): For higher rate limits

### Step 4: Start Analyzing
1. Visit any GitHub repository (e.g., https://github.com/facebook/react)
2. Click the extension icon
3. Click **Analyze Repository**
4. Wait for the AI-powered analysis to complete

## Getting API Keys

### Claude API
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key

### OpenAI API
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to API Keys
4. Create a new secret key

### SiliconFlow
1. Visit [SiliconFlow Console](https://cloud.siliconflow.cn/)
2. Register an account
3. Navigate to API Keys
4. Generate a new key

### GitHub Token (Optional)
1. Go to [GitHub Settings](https://github.com/settings/tokens)
2. Click **Generate new token** → **Generate new token (classic)**
3. Select scopes: `public_repo` (for public repositories)
4. Generate and copy the token

## Troubleshooting

### Extension not loading
- Make sure you selected the `dist` folder, not the parent folder
- Check that Developer mode is enabled
- Try reloading the extension

### API errors
- Verify your API key is correct
- Check your API quota/credits
- Ensure you have internet connection

### Analysis fails
- Check if the repository is public
- Try adding a GitHub token for higher rate limits
- Clear cache and try again

## Support

For issues or questions:
- [GitHub Issues](https://github.com/alexanderkinging/GitHub-Guide-Tool/issues)
- [Documentation](https://github.com/alexanderkinging/GitHub-Guide-Tool#readme)
