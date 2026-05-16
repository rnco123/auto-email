import { getThreadMessages } from "@/lib/supabase/email-store";

export interface IdentityHints {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
}

const NAME_PATTERNS = [
  /(?:my name is|name is|i am|i'm)\s+([A-Za-z][A-Za-z\s.'-]{1,80})/i,
  /(?:full name|patient name)[:\s]+([A-Za-z][A-Za-z\s.'-]{1,80})/i,
];

const DOB_PATTERNS = [
  /(?:date of birth|dob|born on|birthday)(?:\s+is)?[:\s]+([^\n.]+)/i,
  /\band\s+dob\s+is\s+(\d{4}-\d{2}-\d{2})/i,
  /(\d{4}-\d{2}-\d{2})/,
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
  /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/i,
];

function extractKeyValueFields(text: string): IdentityHints {
  const first =
    /first[_\s-]?name\s*[:=]\s*([^\n,]+)/i.exec(text)?.[1]?.trim() ?? null;
  const last =
    /last[_\s-]?name\s*[:=]\s*([^\n,]+)/i.exec(text)?.[1]?.trim() ?? null;
  const dob =
    /(?:date[_\s-]?of[_\s-]?birth|dob)\s*[:=]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i.exec(
      text
    )?.[1]?.trim() ?? null;

  const name =
    first && last ? `${first} ${last}` : first ?? last;

  return {
    name,
    firstName: first,
    lastName: last,
    dob,
  };
}

export function extractIdentityFromText(text: string): IdentityHints {
  const kv = extractKeyValueFields(text);
  if (kv.name && kv.dob) return kv;

  let name: string | null = kv.name;
  let firstName: string | null = kv.firstName;
  let lastName: string | null = kv.lastName;
  let dob: string | null = kv.dob;

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

  return { name, firstName, lastName, dob };
}

export async function collectIdentityHints(
  currentBody: string,
  threadId: string,
  classifiedName: string | null,
  classifiedDob: string | null,
  classifiedFirstName: string | null = null,
  classifiedLastName: string | null = null
): Promise<IdentityHints> {
  let name = classifiedName;
  let firstName = classifiedFirstName;
  let lastName = classifiedLastName;
  let dob = classifiedDob;

  const fromCurrent = extractIdentityFromText(currentBody);
  name = name ?? fromCurrent.name;
  firstName = firstName ?? fromCurrent.firstName;
  lastName = lastName ?? fromCurrent.lastName;
  dob = dob ?? fromCurrent.dob;

  const messages = await getThreadMessages(threadId);
  const inboundBodies = messages
    .filter((m) => m.direction === "inbound" && m.body_text)
    .map((m) => m.body_text as string)
    .slice(-6);

  for (const body of inboundBodies) {
    const hints = extractIdentityFromText(body);
    name = name ?? hints.name;
    firstName = firstName ?? hints.firstName;
    lastName = lastName ?? hints.lastName;
    dob = dob ?? hints.dob;
  }

  if (!name && firstName && lastName) {
    name = `${firstName} ${lastName}`;
  }

  return { name, firstName, lastName, dob };
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
