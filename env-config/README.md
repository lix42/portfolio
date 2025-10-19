# env-config

Environment configuration management for development tools. This folder serves as the **source of truth** for IDE and editor configurations, with scripts to sync them to their real locations.

## Why This Exists

Development tools (VSCode, Claude Code, Cursor) require config files in specific locations (`.vscode/`, `.claude/`, `.cursor/`). However:

1. **Security**: Some config files contain tokens/secrets that shouldn't be in git
2. **Consistency**: MCP server configs need to be in multiple places (`.claude/.mcp.json`, `.vscode/mcp.json`)
3. **Separation**: Team-shared configs vs personal configs should be clearly separated

This tool solves these problems by:
- Storing all configs in one place (`env-config/`)
- Using `.env.local` for secrets (git-ignored)
- Providing scripts to sync configs to their real locations
- Supporting bidirectional sync (source → real, real → source)

## Folder Structure

```
env-config/
├── README.md                    # This file
├── package.json                 # Local package for tsx
├── tsconfig.json                # TypeScript config
├── .env.local.sample            # Template for tokens
├── .env.local                   # Your actual tokens (git-ignored)
├── mcp-servers.project.json     # Project-wide MCP servers
├── mcp-servers.local.json       # Personal MCP servers
├── scripts/
│   ├── setup-env.ts             # Sync: env-config → real configs
│   ├── save-env.ts              # Sync: real configs → env-config
│   └── utils/                   # Helper functions
├── claude/
│   └── commands/                # Claude Code commands
├── cursor/
│   └── rules/                   # Cursor editor rules
└── vscode/
    ├── settings.json            # VSCode settings
    └── extensions.json          # VSCode extensions
```

## Quick Start

### First Time Setup

1. **Copy the environment template:**
   ```bash
   cp env-config/.env.local.sample env-config/.env.local
   ```

2. **Edit `.env.local` and fill in your tokens:**
   ```bash
   # Edit this file with your actual tokens
   BRIGHT_DATA_TOKEN=your_actual_token_here
   ```

3. **Run the setup script:**
   ```bash
   pnpm env:setup
   ```

   This will:
   - Create `.claude/.mcp.json` (project MCP servers)
   - Create `.vscode/mcp.json` (merged project + local MCP servers)
   - Copy other config files (settings, extensions, rules, commands)
   - Substitute tokens from `.env.local`

4. **Restart your editor** for changes to take effect.

## MCP Configuration

### Two Types of MCP Servers

**Project-wide servers** (`mcp-servers.project.json`):
- Shared with the team
- Checked into git
- Examples: Context7, chrome-devtools, Bright Data

**Personal servers** (`mcp-servers.local.json`):
- Your personal MCP servers
- Git-ignored
- Examples: servers with personal tokens, experimental servers

### How MCP Configs Are Applied

When you run `pnpm env:setup`:

1. **`.claude/.mcp.json`** ← `mcp-servers.project.json` (direct copy)
2. **`.claude/.mcp.local.json`** ← `mcp-servers.local.json` (direct copy)
3. **`.vscode/mcp.json`** ← merged (project + local)

**Note:** Claude Code reads both `.mcp.json` and `.mcp.local.json`, but VSCode only reads one `mcp.json`, so we merge them.

## Available Commands

Run these from the **project root**:

### `pnpm env:setup`
Sync configs from `env-config/` to their real locations.

**When to use:**
- First time setup
- After pulling changes from git
- After editing configs in `env-config/`
- After updating tokens in `.env.local`

**What it does:**
- Loads tokens from `.env.local`
- Substitutes `${TOKEN_NAME}` with actual values
- Copies files to `.claude/`, `.vscode/`, `.cursor/`
- Warns if `.env.local` is missing

### `pnpm env:save`
Save **project** MCP configs from real locations back to `env-config/`.

**When to use:**
- After using `claude mcp add` to add a project-wide MCP server
- After manually editing `.vscode/mcp.json`

**What it does:**
- Reads `.vscode/mcp.json`
- Auto-detects tokens and replaces with `${VAR_NAME}` placeholders
- Updates `mcp-servers.project.json`
- Updates `.env.local.sample` if new tokens found

**Example:**
```bash
# Add a new MCP server via Claude CLI
claude mcp add my-server

# Save it to env-config
pnpm env:save
```

### `pnpm env:save:local`
Save **local** MCP configs from real locations back to `env-config/`.

**When to use:**
- After adding personal MCP servers to `.claude/.mcp.local.json`

**What it does:**
- Reads `.claude/.mcp.local.json`
- Auto-detects and replaces tokens
- Updates `mcp-servers.local.json`

## Token Management

### How Tokens Work

Tokens are stored in `.env.local` (git-ignored) and referenced as `${VAR_NAME}` in config files.

**In `env-config/mcp-servers.project.json`:**
```json
{
  "mcpServers": {
    "Bright Data": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.brightdata.com/mcp?token=${BRIGHT_DATA_TOKEN}"]
    }
  }
}
```

**In `env-config/.env.local`:**
```bash
BRIGHT_DATA_TOKEN=04b177d7c52546d4cb2762a6760d3c5fb27ca49c
```

**After running `pnpm env:setup`, in `.vscode/mcp.json`:**
```json
{
  "mcpServers": {
    "Bright Data": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.brightdata.com/mcp?token=04b177d7c52546d4cb2762a6760d3c5fb27ca49c"]
    }
  }
}
```

### Auto-Detection of Tokens

When you run `pnpm env:save`, the script:
1. Detects long alphanumeric strings (potential tokens)
2. Infers variable names from context (e.g., `BRIGHT_DATA_TOKEN`)
3. Replaces tokens with `${VAR_NAME}` placeholders
4. Updates `.env.local.sample`

**If detection fails or is ambiguous:**
- You'll see a warning
- Manually edit `mcp-servers.*.json` to add placeholders
- Manually update `.env.local.sample`

## Workflow Examples

### Scenario 1: New Team Member Setup

```bash
# Clone the repo
git clone <repo-url>
cd portfolio

# Install dependencies
pnpm install

# Setup environment
cp env-config/.env.local.sample env-config/.env.local
# Edit .env.local with your tokens
pnpm env:setup

# Start coding!
```

### Scenario 2: Adding a New Project MCP Server

```bash
# Option A: Add via Claude CLI
claude mcp add my-new-server
pnpm env:save

# Option B: Edit config directly
# 1. Edit env-config/mcp-servers.project.json
# 2. Add token to env-config/.env.local
# 3. Run: pnpm env:setup

# Commit the changes
git add env-config/mcp-servers.project.json
git add env-config/.env.local.sample
git commit -m "feat: add my-new-server MCP"
```

### Scenario 3: Adding a Personal MCP Server

```bash
# Add to local config
# Edit env-config/mcp-servers.local.json
pnpm env:setup

# No need to commit - it's personal!
```

### Scenario 4: Updating Tokens

```bash
# 1. Update env-config/.env.local with new token
# 2. Re-run setup
pnpm env:setup

# 3. Restart your editor
```

## Important Notes

### Idempotent Operations
- `pnpm env:setup` can be run multiple times safely
- It reads existing configs and only updates what's managed
- Won't mess up other settings

### What's Managed vs Not Managed

**Managed by env-config:**
- `.claude/.mcp.json` (project MCP servers)
- `.claude/.mcp.local.json` (local MCP servers)
- `.vscode/mcp.json` (merged MCP servers)
- `.vscode/settings.json` (editor settings)
- `.vscode/extensions.json` (recommended extensions)
- `.cursor/rules/` (Cursor rules)
- `.claude/commands/` (Claude commands)

**NOT managed by env-config:**
- `.claude/settings.local.json` (only the `mcpServers` key would be managed if we used it)
- Other files in `.vscode/`, `.claude/`, `.cursor/` that aren't listed above

### Git Tracking

**Tracked in git (team-shared):**
- `env-config/mcp-servers.project.json`
- `env-config/.env.local.sample`
- `env-config/vscode/`
- `env-config/claude/`
- `env-config/cursor/`
- All scripts and docs

**Git-ignored (personal):**
- `env-config/.env.local`
- `env-config/mcp-servers.local.json`
- `.claude/.mcp.json` (generated)
- `.claude/.mcp.local.json` (generated)
- `.vscode/mcp.json` (generated)

## Troubleshooting

### "Missing .env.local" Error
```bash
cp env-config/.env.local.sample env-config/.env.local
# Edit and fill in tokens
pnpm env:setup
```

### MCP Servers Not Working
1. Check `.env.local` has correct tokens
2. Run `pnpm env:setup` again
3. Restart your editor
4. Check Claude Code or VSCode logs for MCP errors

### Token Detection Warning
If `pnpm env:save` warns about token detection:
1. Manually edit `mcp-servers.*.json`
2. Replace token with `${VAR_NAME}`
3. Add `VAR_NAME=...` to `.env.local`
4. Add placeholder to `.env.local.sample`

### Configs Not Updating
- Make sure you're editing files in `env-config/`, not the real config folders
- Run `pnpm env:setup` after making changes
- Check git status to ensure files aren't accidentally committed

## Development

To modify the scripts:

```bash
cd env-config

# Install dependencies (if not already installed)
pnpm install

# Run scripts directly
pnpm setup    # or: tsx scripts/setup-env.ts
pnpm save     # or: tsx scripts/save-env.ts
```

## Support

For issues or questions:
1. Check this README
2. Check `.env.local.sample` for required tokens
3. Check git status to ensure proper file tracking
4. Ask the team!
