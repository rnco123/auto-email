import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const raw = readFileSync(resolve(".env"), "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const name = "meera khan";
const dob = "2001-04-25";

const { data, error } = await supabase
  .from("patients")
  .select("id, email, first_name, last_name, date_of_birth")
  .limit(50);

if (error) {
  console.log("PATIENTS QUERY FAILED:", error.message);
  console.log(
    "\nRun supabase/migrations/006_patients_read_policy_fix.sql in Supabase SQL Editor"
  );
  console.log(
    "(must include GRANT lines — policy alone is not enough). Then re-run this script."
  );
  process.exit(1);
}

console.log(`Found ${data.length} patients\n`);

for (const row of data) {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
  const line = `${row.id} | ${fullName} | ${row.date_of_birth} | ${row.email}`;
  console.log(line);
  if (fullName.toLowerCase().includes("meera")) {
    console.log("  ^^^ MEERA MATCH");
  }
}

const meera = data.filter((r) => {
  const fn = [r.first_name, r.last_name].join(" ").toLowerCase();
  return fn.includes("meera");
});

console.log("\nMeera rows:", meera.length ? JSON.stringify(meera, null, 2) : "NONE");
