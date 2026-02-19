import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing required environment variables:");
  if (!supabaseUrl) console.error("  SUPABASE_URL");
  if (!supabaseAnonKey) console.error("  SUPABASE_ANON_KEY");
  process.exit(1);
}

console.log(`Connecting to Supabase at: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log("\n--- Testing Supabase Connection ---\n");
  let passed = 0;
  let failed = 0;

  // 1. Database connectivity via a known table
  console.log("1. Testing database connectivity...");
  const { error: dbError } = await supabase
    .from("agent_templates")
    .select("count", { count: "exact", head: true });

  if (dbError) {
    // Fallback to another table
    const { error: fallbackError } = await supabase
      .from("user_flows")
      .select("count", { count: "exact", head: true });

    if (fallbackError) {
      console.error(`   FAIL: ${fallbackError.message}`);
      failed++;
    } else {
      console.log("   PASS: database reachable (user_flows)");
      passed++;
    }
  } else {
    console.log("   PASS: database reachable (agent_templates)");
    passed++;
  }

  // 2. Auth service check
  console.log("\n2. Testing auth service...");
  const { error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.error(`   FAIL: ${authError.message}`);
    failed++;
  } else {
    console.log("   PASS: auth service reachable");
    passed++;
  }

  // 3. Storage service check
  console.log("\n3. Testing storage service...");
  const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
  if (storageError) {
    console.error(`   FAIL: ${storageError.message}`);
    failed++;
  } else {
    console.log(`   PASS: storage service reachable (${buckets.length} bucket(s))`);
    if (buckets.length > 0) {
      buckets.forEach((b) => console.log(`     - ${b.name}`));
    }
    passed++;
  }

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

testConnection().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
