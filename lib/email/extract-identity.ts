import { getThreadMessages } from "@/lib/supabase/email-store";

export interface IdentityHints {
  name: string | null;
  dob: string | null;
}

const NAME_PATTERNS = [
  /(?:my name is|name is|i am|i'm)\s+([A-Za-z][A-Za-z\s.'-]{1,80})/i,
  /(?:full name|patient name)[:\s]+([A-Za-z][A-Za-z\s.'-]{1,80})/i,
];

const DOB_PATTERNS = [
  /(?:date of birth|dob|born on|birthday)(?:\s+is)?[:\s]+([^\n.]+)/i,
  /(\d{4}-\d{2}-\d{2})/,
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
  /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/i,
];

export function extractIdentityFromText(text: string): IdentityHints {
  let name: string | null = null;
  let dob: string | null = null;

  for (const pattern of NAME_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      name = cleanName(match[1]);
      break;
    }
  }

  for (const pattern of DOB_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      dob = cleanDob(match[1]);
      break;
    }
  }

  return { name, dob };
}

export async function collectIdentityHints(
  currentBody: string,
  threadId: string,
  classifiedName: string | null,
  classifiedDob: string | null
): Promise<IdentityHints> {
  let name = classifiedName;
  let dob = classifiedDob;

  const fromCurrent = extractIdentityFromText(currentBody);
  name = name ?? fromCurrent.name;
  dob = dob ?? fromCurrent.dob;

  const messages = await getThreadMessages(threadId);
  const inboundBodies = messages
    .filter((m) => m.direction === "inbound" && m.body_text)
    .map((m) => m.body_text as string)
    .slice(-6);

  for (const body of inboundBodies) {
    const hints = extractIdentityFromText(body);
    name = name ?? hints.name;
    dob = dob ?? hints.dob;
  }

  return { name, dob };
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+(and|with|my|date|dob).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDob(raw: string): string {
  return raw
    .replace(/\s+and\s+.*$/i, "")
    .replace(/[.,]+$/, "")
    .trim();
}
