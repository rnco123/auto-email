/**
 * Integration scenarios: Supabase lookup + 3-turn chat simulation.
 * Run: npx tsx scripts/run-scenario-tests.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { extractIdentityFromText } from "../lib/email/extract-identity";
import { simulateOpenAccessChatTurn } from "../lib/email/simulate-chat-turn";
import { lookupPatientByIdentity } from "../lib/supabase/patient-lookup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const resultPath = join(root, "result.md");

function loadEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

async function main() {
const lines: string[] = [];
const log = (s: string) => {
  console.log(s);
  lines.push(s);
};

log(`## Integration run — ${new Date().toISOString()}\n`);

log("### 1. Supabase patient lookup\n");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  log("- **SKIP** Missing Supabase URL or key\n");
} else {
  const sb = createClient(url, key);
  const { data: byDob, error: e1 } = await sb
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, email")
    .eq("date_of_birth", "2026-03-01")
    .ilike("first_name", "Aleeza")
    .ilike("last_name", "Hussain");

  if (e1) {
    log(`- **FAIL** patients query: ${e1.message}\n`);
  } else {
    log(
      `- **OK** Aleeza Hussain + DOB 2026-03-01: ${byDob?.length ?? 0} row(s)`
    );
    for (const p of byDob ?? []) {
      const { data: enc } = await sb
        .from("encounters")
        .select("id")
        .eq("patient_id", p.id);
      const encIds = (enc ?? []).map((e) => e.id);
      let soapCount = 0;
      if (encIds.length) {
        const { data: notes } = await sb
          .from("ai_soapnotes")
          .select("id")
          .in("encounter_id", encIds);
        soapCount = notes?.length ?? 0;
      }
      log(
        `  - patient \`${p.id}\` encounters=${encIds.length} soap=${soapCount}`
      );
    }
    log("");
  }
}

log("### 2. Identity extraction (regex)\n");
const hints = extractIdentityFromText("Name: Aleeza Hussain\nDOB: 2026-03-01");
log(`- **OK** name=\`${hints.name}\` dob=\`${hints.dob}\`\n`);

log("### 3. lookupPatientByIdentity\n");
const lookup = await lookupPatientByIdentity({
  fullName: "Aleeza Hussain",
  firstName: "Aleeza",
  lastName: "Hussain",
  dob: "2026-03-01",
});
if (lookup.status === "found") {
  log(
    `- **OK** patient id \`${lookup.patient.id}\` — ${lookup.patient.fullName}, ${lookup.patient.dateOfBirth}\n`
  );
} else if (lookup.status === "db_error") {
  log(`- **FAIL** db_error: ${lookup.message}\n`);
} else {
  log(`- **FAIL** not_found\n`);
}

log("### 4. Chat simulation (3 turns, OpenAI)\n");

if (!process.env.OPENAI_API_KEY) {
  log("- **SKIP** No OPENAI_API_KEY\n");
} else {
  const thread = {
    id: "test-scenario",
    patient_email: "tester@example.com",
    subject: "SOAP test",
    status: "active" as const,
    last_intent: null,
    verified_patient_id: null,
    message_id_root: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  log("#### Turn 1\n");
  log("**Patient:** I need my SOAP note from my last visit.\n");
  const t1 = await simulateOpenAccessChatTurn({
    thread,
    transcriptBeforeThisMessage: [],
    patientMessage: "I need my SOAP note from my last visit.",
  });
  log(`- intent: \`${t1.intent}\` | facts: ${Object.keys(t1.facts).join(", ") || "none"}`);
  log(`**Clinic:**\n\n${t1.replyText}\n`);

  const transcript = [
    { role: "patient" as const, text: "I need my SOAP note from my last visit." },
    { role: "clinic" as const, text: t1.replyText },
  ];

  log("#### Turn 2\n");
  log("**Patient:** Name: Aleeza Hussain / DOB: 2026-03-01\n");
  const t2 = await simulateOpenAccessChatTurn({
    thread: { ...thread, last_intent: "soap_note" },
    transcriptBeforeThisMessage: transcript,
    patientMessage: "Name: Aleeza Hussain\nDOB: 2026-03-01",
  });
  log(`- intent: \`${t2.intent}\` | facts: ${Object.keys(t2.facts).join(", ") || "none"}`);
  if (t2.facts.soapNotePdfAttached) log("- soapNotePdfAttached: **yes**");
  if (t2.facts.soapPatientNotFound) log("- soapPatientNotFound: **yes**");
  if (t2.facts.needsPatientForSoap) log("- needsPatientForSoap: **yes**");
  if (t2.facts.noSoapOnFile) log("- noSoapOnFile: **yes**");
  log(`**Clinic:**\n\n${t2.replyText}\n`);

  log("#### Turn 3 — locations\n");
  log("**Patient:** What are your clinic locations?\n");
  const t3 = await simulateOpenAccessChatTurn({
    thread: { ...thread, last_intent: "soap_note" },
    transcriptBeforeThisMessage: [
      ...transcript,
      { role: "patient", text: "Name: Aleeza Hussain\nDOB: 2026-03-01" },
      { role: "clinic", text: t2.replyText },
    ],
    patientMessage: "What are your clinic locations?",
  });
  log(`- intent: \`${t3.intent}\` | locations: ${t3.facts.locations?.length ?? 0}`);
  log(`**Clinic (excerpt):**\n\n${t3.replyText.slice(0, 500)}${t3.replyText.length > 500 ? "…" : ""}\n`);
}

log("---\n");

const prev = existsSync(resultPath) ? readFileSync(resultPath, "utf8") : "";
writeFileSync(resultPath, lines.join("\n") + "\n" + prev);
console.log("\nWrote results to result.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
