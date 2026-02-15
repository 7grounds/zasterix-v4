# Zasterix v4 - Multi-Agent System

This is a [Next.js](https://nextjs.org) project implementing an Origo Architecture-based multi-agent system with Supabase backend.

<!-- redeploy trigger -->
<!-- redeploy trigger 2 -->

## Quick Links

- 📚 [Origo Architecture Guide](ORIGO_ARCHITECTURE.md)
- 🤖 [Agent Participation Guide](AGENT_PARTICIPATION_GUIDE.md)
- 🔧 [MCP Setup Guide](MCP_SETUP_GUIDE.md) - Connect AI assistants to database
- 💬 [Discussion Flow Documentation](DISCUSSION_FLOW_FIX.md)
- 🎨 [Claude Integration](CLAUDE_INTEGRATION.md)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Main Features

- **Multi-Agent Discussions** - Navigate to `/main-dashboard` for AI-powered multi-agent meetings
- **Manager Alpha** - Interactive AI manager at `/manager-alpha`
- **Meeting History** - View completed discussions at `/meetings`
- **Agent Management** - Configure agents and templates

### MCP Setup (Optional)

To enable AI assistants like Claude Desktop to access your database schema:

1. See [MCP_SETUP_GUIDE.md](MCP_SETUP_GUIDE.md) for detailed instructions
2. Quick setup: Add `mcp-config.json` content to your Claude Desktop config
3. Benefits: Enhanced AI assistance with full database context

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
