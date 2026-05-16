export type ThreadStatus =
  | "active"
  | "needs_dob"
  | "verified"
  | "failed"
  | "unknown_sender";

export type EmailIntent =
  | "appointment"
  | "location"
  | "soap_note"
  | "provide_identity"
  | "provide_dob"
  | "alternate_email"
  | "greeting"
  | "unknown";

export type MessageDirection = "inbound" | "outbound";

export interface EmailThread {
  id: string;
  patient_email: string;
  subject: string | null;
  status: ThreadStatus;
  last_intent: EmailIntent | null;
  verified_patient_id: string | null;
  message_id_root: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  direction: MessageDirection;
  resend_email_id: string | null;
  body_text: string | null;
  raw_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PatientRecord {
  id: string;
  email: string;
  fullName: string;
  dateOfBirth: string;
}

export interface AppointmentRecord {
  id: string;
  startsAt: string;
  locationName: string | null;
  locationAddress: string | null;
}

export interface LocationRecord {
  id: string;
  name: string;
  address: string | null;
  hours: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  zip: string | null;
}

export interface SoapNoteRecord {
  id: string;
  visitDate: string | null;
  summary: string;
}

export interface ClassificationResult {
  intent: EmailIntent;
  extractedName: string | null;
  extractedDob: string | null;
  extractedLocationHint: string | null;
  confidence: number;
}

export interface ProcessorFacts {
  patientName?: string;
  appointment?: AppointmentRecord;
  locations?: LocationRecord[];
  nearestLocation?: LocationRecord;
  soapNote?: SoapNoteRecord;
  needsDob?: boolean;
  needsName?: boolean;
  alternateEmail?: boolean;
  verificationFailed?: boolean;
  unknownSender?: boolean;
  noSoapOnFile?: boolean;
  publicOnly?: boolean;
}

export interface InboundEmailPayload {
  emailId: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}
