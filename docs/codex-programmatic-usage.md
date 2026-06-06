<!--
Purpose: Explicitly document programmatic Codex invocation and MCP server integration.
Why: Enable structured, automated task execution and review pipelines via CLI and stdio.
Info flow: Local Codex config -> this guide -> script automation.
-->
# Programmatic Codex Usage Guide

This guide details how to invoke the Codex CLI and interact with the Codex Model Context Protocol (MCP) server programmatically to automate complex repository tasks, such as resolving merge conflicts and harvesting review comments.

---

## 1. Direct MCP Server Integration

Codex can run as a direct stdio-based MCP server. This allows another AI agent (such as Antigravity) to call Codex tools directly to run git commands, read or modify the filesystem, and query workspace states.

### Configuration (`mcp_config.json`)
The integration is configured by registering `codex` in the local MCP configuration:
```json
{
  "mcpServers": {
    "codex-mcp": {
      "command": "codex",
      "args": ["mcp-server"]
    }
  }
}
```
Antigravity automatically reads this configuration on startup, spawning `codex mcp-server` over stdio.

---

## 2. Programmatic CLI Invocation

In addition to direct tool calling, scripts and validation runners can invoke the Codex CLI.

### Command Patterns

1. ** isolated Query (`codex exec`)**
   Executes a single, bounded instruction against the current workspace and exits.
   ```bash
   codex exec "Analyze docs/triage-table.md and list the branch names for all conflicting PRs."
   ```

2. **Run a Skill (`codex run`)**
   Executes a pre-defined Codex skill. Skills are stored under `~/.codex/skills/` and contain structured instructions and validators.
   ```bash
   codex run antigravity-reviewer
   ```

3. **Session Resumption (`codex exec resume`)**
   Resumes the last active agent loop to continue a multi-step task.
   ```bash
   codex exec resume --last "Continue verifying open PR branches"
   ```

---

## 3. Node.js Script Integration Pattern

To call Codex from automation scripts (such as custom merge/verify runners), use Node's `child_process` module.

```javascript
import { execSync } from 'node:child_process';

/**
 * Invoke Codex programmatically with a specific prompt.
 * @param {string} prompt The instruction to pass to Codex.
 * @returns {string} The captured stdout from Codex.
 */
function askCodex(prompt) {
  try {
    console.log(`Sending instruction to Codex: "${prompt}"...`);
    // Pass the prompt to codex exec. Set PAGER=cat to avoid terminal pagers.
    const output = execSync(`codex exec "${prompt.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      env: { ...process.env, PAGER: 'cat' }
    });
    return output.trim();
  } catch (error) {
    console.error('Codex programmatic call failed:', error.message);
    throw error;
  }
}
```

---

## 4. Key Use Cases (When to Use Codex Programmatically)

Programmatic invocation should be used when a task is repetitive, requires structured git manipulation, or benefits from a localized secondary agent loop.

| Use Case | Method | Description |
| --- | --- | --- |
| **Bulk Review Harvesting** | `get-pr-todos.js` | Fetches JSON review threads from the GitHub cache, feeds them to Codex, and outputs a formatted Markdown todo list for the developer. |
| **Merge Conflict Resolution** | Scripted `codex exec` | Automates checking out a conflict branch, attempting a merge, and calling Codex to resolve specific git conflict markers (`<<<<<<< HEAD`) using SDD compliance rules. |
| **Candidate Branch Validation** | `validate-pr-backlog.js` | Runs isolated checkouts, invokes local build/test check chains, and compiles execution logs into validation markdown files. |

---

## 5. Windows Keyring & Authentication Safety

When invoking Codex programmatically from background/non-interactive processes on Windows, standard keyring access may time out.

### Mitigation Strategies:
1. **Interactive Warms:** Before starting a headless loop or running a script, run a simple command in a visible interactive terminal to ensure the keyring is unlocked and auth is warm:
   ```powershell
   codex exec "Reply with OK"
   ```
2. **Handle Exit Codes:** Ensure script wrappers check exit codes. A non-zero exit code or timeout indicates that the keyring/auth session has locked, and requires user intervention.
