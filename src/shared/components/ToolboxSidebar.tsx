/**
 * @MODULE_ID shared.components.toolbox-sidebar
 * @STAGE global
 * @DATA_INPUTS ["tools"]
 * @REQUIRED_TOOLS ["YuhConnector", "BoardroomLink"]
 */
import { YuhConnector } from "@/shared/tools/YuhConnector";
import { BoardroomLink } from "@/shared/components/BoardroomLink";
import Link from "next/link";

export const ToolboxSidebar = () => {
  const navigationLinks = [
    {
      id: "quick-links",
      label: "Quick Links",
      href: "/admin/links",
      description: "Command Center fuer App- und Infrastruktur-Links.",
    },
  ];

  const tools = [
    {
      id: "yuh-connector",
      name: "Yuh Connector",
      description: "Secure bridge into Yuh portfolios and cash rails.",
      action: <YuhConnector action="connect" label="Connect Yuh" />,
    },
    {
      id: "allocation-viewer",
      name: "Allocation Snapshot",
      description: "Preview allocation clarity once assets are mapped.",
      action: (
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Coming Soon
        </span>
      ),
    },
  ];

  return (
    <aside className="flex flex-col gap-6 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_12px_45px_rgba(15,23,42,0.08)] backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Toolbox
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Wealth Engineering Tools
        </h2>
      </div>
      <div className="flex flex-col gap-4">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {tool.name}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {tool.description}
                </p>
              </div>
            </div>
            <div className="mt-4">{tool.action}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Navigation</p>
        {navigationLinks.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
              {item.label}
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.description}</p>
          </Link>
        ))}
      </div>
      <div className="pt-2">
        <BoardroomLink />
      </div>
    </aside>
  );
};
