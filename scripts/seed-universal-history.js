const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  console.error("Set them in the environment before running this script.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const entries = [
  {
    payload: {
      type: "management_log",
      agent_name: "Registrar",
      summary: "Willkommen im Zasterix Vault.",
      details: "Boardroom-Feed wurde initialisiert.",
      decisions: ["Vault aktiviert", "Audit-Feed gestartet"],
      open_tasks: ["Admin-Rollen testen"],
      flow_status: "bootstrapped",
    },
  },
  {
    payload: {
      type: "management_log",
      agent_name: "Resource-Controller",
      summary: "Systemstatus stabil.",
      details: "Kostenkontrolle aktiv, Latenz im grünen Bereich.",
      decisions: ["Provider-Monitoring eingeschaltet"],
      open_tasks: [],
      flow_status: "stable",
    },
  },
  {
    payload: {
      type: "management_log",
      agent_name: "Master-Manager",
      summary: "Executive Summary erstellt.",
      details: "Die wichtigsten Governance-Regeln wurden aktiviert.",
      decisions: ["Executive Approval Policy aktiv"],
      open_tasks: ["Team-Briefing vorbereiten"],
      flow_status: "approved",
    },
  },
  {
    payload: {
      type: "welcome_note",
      title: "Boardroom Feed",
      message: "Hier erscheinen alle Management-Protokolle in Echtzeit.",
    },
  },
];

const seed = async () => {
  const { data, error } = await supabase
    .from("universal_history")
    .insert(entries)
    .select("id");

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Inserted ${data?.length ?? 0} entries into universal_history.`);
};

seed().catch((error) => {
  console.error("Unexpected seed error:", error);
  process.exit(1);
});
