# MCP (Model Context Protocol) Setup Guide

## What is MCP?

MCP (Model Context Protocol) is a protocol that allows AI assistants like Claude Desktop and Cursor to connect to external data sources and tools. This enables AI to have direct access to your database schema, making it more helpful for database-related tasks.

## Supabase MCP Server Configuration

This project is configured to use the Supabase MCP server, which provides AI assistants with read-only access to your database schema.

### Project Configuration

**Supabase Project Reference:** `idsifdlczfhhabqaytma`  
**MCP Server URL:** `https://mcp.supabase.com/mcp?project_ref=idsifdlczfhhabqaytma`

---

## Setup for Claude Desktop

### 1. Locate Claude Desktop Configuration

The configuration file location depends on your operating system:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

### 2. Add MCP Server Configuration

Create or edit the configuration file with the following content:

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

### 3. Restart Claude Desktop

After saving the configuration file, restart Claude Desktop for the changes to take effect.

### 4. Verify Connection

In Claude Desktop, you should see an indicator that the MCP server is connected. You can now ask Claude questions about your database schema.

**Example queries:**
- "Show me the schema for the agent_templates table"
- "What tables exist in my database?"
- "What are the relationships between projects and discussion_logs tables?"
- "Help me write a migration to add a new column"

---

## Setup for Cursor IDE

### 1. Add to Cursor Configuration

Cursor IDE may support MCP through its settings. Check Cursor's documentation for the latest MCP integration details.

Alternatively, you can reference the `mcp-config.json` file in this repository.

### 2. Using MCP with Cursor

If Cursor supports MCP, it will automatically have context about your database schema when you:
- Write SQL queries
- Create migrations
- Work with database-related code
- Ask questions about data structure

---

## Setup for GitHub Copilot

While GitHub Copilot doesn't directly use MCP, you can provide database context through:

1. **Open database schema files** in your editor
2. **Keep migration files** visible in your workspace
3. **Reference documentation** from `ORIGO_ARCHITECTURE.md` and other docs

---

## What Can MCP Do?

With the Supabase MCP server configured, AI assistants can:

✅ **Read database schema**
- Table names and structure
- Column names and types
- Constraints and indexes
- Relationships between tables

✅ **Analyze migrations**
- Understand migration history
- Suggest migration improvements
- Check for schema issues

✅ **Help with queries**
- Generate SQL queries
- Optimize existing queries
- Suggest indexes

✅ **Provide context**
- Better code suggestions
- More accurate database-related code
- Schema-aware recommendations

❌ **Cannot modify data**
- MCP server is read-only
- No INSERT, UPDATE, DELETE operations
- No schema modifications
- Safe for production use

---

## Security Considerations

### Read-Only Access

The Supabase MCP server provides **read-only** access to your database schema. It:
- ✅ Can read table and column definitions
- ✅ Can read constraint information
- ❌ Cannot read actual data from tables
- ❌ Cannot modify schema
- ❌ Cannot execute write operations

### Project Reference

The MCP URL includes your Supabase project reference (`idsifdlczfhhabqaytma`). This is:
- ✅ Safe to share with team members
- ✅ Only provides schema information
- ✅ Does not expose API keys
- ⚠️ Should not be shared publicly if you want to keep schema private

### API Keys

The MCP server **does not** use your Supabase API keys. Schema information is accessible through the public MCP endpoint.

---

## Troubleshooting

### Claude Desktop Not Connecting

1. **Check file location:** Ensure the config file is in the correct location for your OS
2. **Check JSON syntax:** Validate your JSON using a JSON validator
3. **Restart Claude:** Close and restart Claude Desktop completely
4. **Check logs:** Look for error messages in Claude's logs

### Cannot See Database Schema

1. **Verify project reference:** Ensure `idsifdlczfhhabqaytma` is correct
2. **Check network:** MCP server requires internet connection
3. **Test URL:** Try accessing `https://mcp.supabase.com/mcp?project_ref=idsifdlczfhhabqaytma` in browser
4. **Wait for sync:** Initial connection may take a few seconds

### Outdated Schema Information

The MCP server caches schema information. If you've recently made changes:
1. Wait a few minutes for cache to refresh
2. Restart Claude Desktop
3. Ask Claude to "refresh the schema"

---

## Alternative: Manual Schema Documentation

If MCP setup doesn't work, you can provide schema context manually:

1. **Export schema:**
   ```bash
   supabase db dump --schema-only > schema.sql
   ```

2. **Keep schema visible:**
   - Open `schema.sql` in your editor
   - Keep migration files in workspace
   - Reference `supabase/migrations/` directory

3. **Use documentation:**
   - See `ORIGO_ARCHITECTURE.md` for database design
   - Reference migration files in `supabase/migrations/`

---

## Benefits for Zasterix Development

### For Origo Architecture

MCP helps maintain Origo principles by:
- **Database-first development:** AI has full schema context
- **No table bloat:** AI knows existing tables and suggests reuse
- **JSONB utilization:** AI can suggest JSONB column usage
- **Migration quality:** AI can review migrations for best practices

### For Multi-Agent System

MCP enables AI to:
- Understand agent_templates structure
- See discussion_logs relationships
- Analyze universal_history schema
- Suggest optimal data storage

### For Team Collaboration

Team members can:
- Get consistent schema information
- Receive accurate code suggestions
- Understand database structure quickly
- Collaborate on migrations with AI assistance

---

## Example Use Cases

### 1. Understanding the Schema

**Ask Claude:**
```
"Show me the structure of the agent_templates table and explain
how it relates to agent_blueprints and discussion_logs"
```

### 2. Writing Migrations

**Ask Claude:**
```
"I need to add a new field to track agent performance. 
What's the best table to add this to based on our schema?"
```

### 3. Query Optimization

**Ask Claude:**
```
"I'm writing a query to get all discussions for a project 
with their participating agents. Can you help optimize this?"
```

### 4. Schema Validation

**Ask Claude:**
```
"Review our current schema and tell me if we're following 
Origo Architecture principles of minimalism and data-centricity"
```

---

## Resources

### Official Documentation

- **MCP Documentation:** https://modelcontextprotocol.io/
- **Supabase MCP:** https://supabase.com/docs/guides/ai/mcp
- **Claude Desktop:** https://claude.ai/desktop

### Project Documentation

- **Origo Architecture:** See `ORIGO_ARCHITECTURE.md`
- **Database Schema:** See `supabase/migrations/`
- **Agent System:** See `AGENT_PARTICIPATION_GUIDE.md`

### Support

If you need help with MCP setup:
1. Check this guide first
2. Review official MCP documentation
3. Ask in team channels
4. Open an issue in the repository

---

## Summary

MCP provides AI assistants with database schema context, making them more helpful for database-related development tasks. The setup is simple and provides read-only access, making it safe for production environments.

**Quick Setup Checklist:**
- ✅ Add configuration to Claude Desktop config file
- ✅ Restart Claude Desktop
- ✅ Test connection with a schema query
- ✅ Start using enhanced AI assistance

**Status:** Ready to use with Claude Desktop and other MCP-compatible tools! 🚀
