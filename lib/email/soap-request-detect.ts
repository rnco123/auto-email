import { detectSoapNoteFromText } from "@/lib/email/public-intent";

/** Policy / privacy questions — not a request to send the patient's SOAP note. */
const SOAP_POLICY_PATTERNS = [
  /\b(anyone(?:'s|s)?|someone else|somebody else|other (?:people|patients?|person)|another patient|cualquier persona|otra persona|otros pacientes)\b/i,
  /\b(can|could|am i allowed|is it possible|are patients allowed)\b[^?.]{0,80}\b(get|obtain|receive|request|access)\b/i,
  /\b(why|how)\b[^?.]{0,60}\b(verify|verification|need my name|need.{0,20}dob)/i,
  /\b(policy|privacy|hipaa|confidential)\b/i,
  /\bwithout (?:giving|providing|sharing).{0,30}(?:name|dob|birth)/i,
];

export function isSoapPolicyOrMetaQuestion(body: string): boolean {
  const text = body.trim();
  if (!text) return false;

  if (!detectSoapNoteFromText(text) && !/\b(verify|verification|records?)\b/i.test(text)) {
    return false;
  }

  for (const pattern of SOAP_POLICY_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  const isQuestion = /\?/.test(text);
  const mentionsOthers =
    /\b(anyone|someone else|other patients?|other people|everyone)\b/i.test(text);
  const mentionsOwn = /\b(my|mine|my records|for me)\b/i.test(text);

  if (isQuestion && detectSoapNoteFromText(text) && mentionsOthers && !mentionsOwn) {
    return true;
  }

  return false;
}

/** Patient is asking to receive their own SOAP note (not a policy chat). */
export function isRequestingOwnSoapNote(body: string): boolean {
  if (isSoapPolicyOrMetaQuestion(body)) return false;
  if (!detectSoapNoteFromText(body)) return false;

  if (/\b(my|mine|my records|for me)\b/i.test(body)) return true;

  if (
    /\b(request|need|send|would like|please provide|get me)\b/i.test(body) &&
    !/\?/.test(body.trim())
  ) {
    return true;
  }

  if (/\b(request|need|would like)\b/i.test(body) && /\bfor my\b/i.test(body)) {
    return true;
  }

  return false;
}
