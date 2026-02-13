/**
 * @MODULE_ID app.admin.links
 * @STAGE admin
 * @DATA_INPUTS ["resource_links"]
 * @REQUIRED_TOOLS ["Card", "Button"]
 */
"use client";

import Link from "next/link";
import { Card } from "@/shared/components/Card";
import { getButtonClasses } from "@/shared/components/Button";

export const dynamic = "force-dynamic";

type QuickLinkItem = {
  label: string;
  href: string;
  description: string;
  external?: boolean;
};

type QuickLinkCategory = {
  id: string;
  title: string;
  subtitle: string;
  links: QuickLinkItem[];
};

const categories: QuickLinkCategory[] = [
  {
    id: "live-app",
    title: "Live-App",
    subtitle: "Schneller Zugriff auf Kernseiten",
    links: [
      {
        label: "Dashboard",
        href: "/",
        description: "Hauptansicht der Live-App.",
      },
      {
        label: "Agenten-Verwaltung",
        href: "/admin/agents",
        description: "Admin-Zugang zur Agentensteuerung.",
      },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastruktur",
    subtitle: "Externe Plattformen und Deployment-Status",
    links: [
      {
        label: "Supabase Dashboard",
        href: "https://supabase.com/dashboard/project/idsifdlczfhhabqaytma",
        description: "Datenbank, Auth und SQL-Editor.",
        external: true,
      },
      {
        label: "Vercel Projekt-Uebersicht",
        href: "https://vercel.com/all-namesxyz-d99d5b7f/workspace",
        description: "Builds, Deployments und Runtime-Logs.",
        external: true,
      },
      {
        label: "GitHub Repo",
        href: "https://github.com/7grounds/zasterix-v4",
        description: "Codebasis, Branches und Commits.",
        external: true,
      },
    ],
  },
];

const LinkAction = ({ item }: { item: QuickLinkItem }) => {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={getButtonClasses("secondary", "sm")}
      >
        Open
      </a>
    );
  }

  return (
    <Link href={item.href} className={getButtonClasses("secondary", "sm")}>
      Open
    </Link>
  );
};

export default function AdminLinksPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Command Center
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Quick Links</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">
          Zentrale Uebersicht fuer Live-App und Infrastruktur-Ressourcen.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {categories.map((category) => (
          <Card
            key={category.id}
            className="border-slate-800/70 bg-slate-950 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {category.title}
            </p>
            <p className="mt-2 text-sm text-slate-300">{category.subtitle}</p>

            <div className="mt-5 space-y-3">
              {category.links.map((item) => (
                <div
                  key={item.href}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                  </div>
                  <LinkAction item={item} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
