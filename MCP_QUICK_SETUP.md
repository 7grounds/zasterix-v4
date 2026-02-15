# Quick MCP Setup

## For Claude Desktop

### macOS
```bash
# Create config directory if it doesn't exist
mkdir -p ~/Library/Application\ Support/Claude

# Create or edit config file
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Windows
```powershell
# Navigate to config directory
cd %APPDATA%\Claude

# Create or edit config file
notepad claude_desktop_config.json
```

### Linux
```bash
# Create config directory if it doesn't exist
mkdir -p ~/.config/Claude

# Create or edit config file
nano ~/.config/Claude/claude_desktop_config.json
```

## Configuration Content

Copy and paste this into your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=idsifdlczfhhabqaytma"
    }
  }
}
```

## Verify

1. Save the file
2. Restart Claude Desktop
3. Ask Claude: "Show me the database schema"

## What You Get

✅ AI can see your database structure
✅ Better code suggestions for database queries
✅ Schema-aware migration help
✅ Table relationship understanding

## Security

- Read-only access to schema
- No data access
- No write operations
- Safe for production

---

For detailed instructions, see [MCP_SETUP_GUIDE.md](MCP_SETUP_GUIDE.md)
