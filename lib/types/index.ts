export type ThreadStatus =
  | "active"
  | "needs_dob"
  | "verified"
  | "failed"
  | "unknown_sender";

export type EmailIntent =
  | "appointment"
  | "location"
  | "general_info"
  | "soap_note"
  | "provide_identity"
  | "provide_dob"
  | "provide_encounter_date"
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

export interface EmailMessageWithThread extends EmailMessage {
  patient_email: string;
  thread_subject: string | null;
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
  title: string;
  address: string | null;
  locationCode: string | null;
}

export interface ServiceRecord {
  id: string;
  titleEn: string;
  titleEs: string | null;
}

export interface SoapNoteRecord {
  id: string;
  encounterId: string | null;
  encounterDate: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}

export interface EncounterOption {
  encounterId: string;
  encounterDate: string | null;
}

export interface ClassificationResult {
  intent: EmailIntent;
  extractedName: string | null;
  extractedDob: string | null;
  extractedLocationHint: string | null;
  extractedEncounterDate: string | null;
  confidence: number;
}

export type PublicReplyScope = "services" | "locations" | "both" | "none";

export interface ProcessorFacts {
  patientName?: string;
  appointment?: AppointmentRecord;
  replyScope?: PublicReplyScope;
  locations?: LocationRecord[];
  nearestLocation?: LocationRecord;
  services?: ServiceRecord[];
  soapNote?: SoapNoteRecord;
  soapNotePdfAttached?: boolean;
  needsEncounterDate?: boolean;
  encounterOptions?: EncounterOption[];
  encounterDateNotFound?: boolean;
  needsDob?: boolean;
  needsName?: boolean;
  alternateEmail?: boolean;
  verificationFailed?: boolean;
  unknownSender?: boolean;
  noSoapOnFile?: boolean;
  needsPatientForSoap?: boolean;
  soapPatientNotFound?: boolean;
  needsPatientInfo?: "soap" | "appointment";
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
