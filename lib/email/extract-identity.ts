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

  let name: string | null =
    first && last ? `${first} ${last}` : first ?? last;

  if (!name) {
    const labelName = /^name\s*[:=]\s*([^\n]+)/im.exec(text)?.[1]?.trim();
    if (labelName) {
      name = cleanName(labelName);
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return {
          name,
          firstName: parts[0],
          lastName: parts.slice(1).join(" "),
          dob,
        };
      }
    }
  }

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

function mergeHint(
  primary: string | null,
  ...fallbacks: (string | null | undefined)[]
): string | null {
  if (primary?.trim()) return primary.trim();
  for (const value of fallbacks) {
    if (value?.trim()) return value.trim();
  }
  return null;
}

export async function collectIdentityHints(
  currentBody: string,
  threadId: string,
  classifiedName: string | null,
  classifiedDob: string | null,
  classifiedFirstName: string | null = null,
  classifiedLastName: string | null = null
): Promise<IdentityHints> {
  const messages = await getThreadMessages(threadId);

  const { extractPatientIdentityFromConversation } = await import(
    "@/lib/openai/extract-identity"
  );
  const ai = await extractPatientIdentityFromConversation(
    messages,
    currentBody
  );

  const fromCurrent = extractIdentityFromText(currentBody);

  let firstName = mergeHint(
    ai.firstName,
    classifiedFirstName,
    fromCurrent.firstName
  );
  let lastName = mergeHint(
    ai.lastName,
    classifiedLastName,
    fromCurrent.lastName
  );
  let name = mergeHint(ai.name, classifiedName, fromCurrent.name);
  let dob = mergeHint(ai.dob, classifiedDob, fromCurrent.dob);

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
