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

export type ThreadFeedbackStage =
  | "none"
  | "awaiting_resolution"
  | "awaiting_rating"
  | "complete";

export interface EmailThread {
  id: string;
  patient_email: string;
  subject: string | null;
  status: ThreadStatus;
  last_intent: EmailIntent | null;
  verified_patient_id: string | null;
  message_id_root: string | null;
  feedback_stage?: ThreadFeedbackStage;
  resolved_at?: string | null;
  resolution_confirmed?: boolean | null;
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

export type PatientLanguage = "en" | "es";

export type SystemAction =
  | "lookup_patient"
  | "fetch_soap_note"
  | "list_locations"
  | "list_services"
  | "lookup_appointment"
  | "none";

export interface ClassificationResult {
  /** What the latest message literally is (e.g. provide_identity). */
  intent: EmailIntent;
  /** What the backend should execute (AI decides — used instead of regex rules). */
  effectiveIntent?: EmailIntent;
  /** Planned system steps from AI analysis. */
  systemActions?: SystemAction[];
  extractedName: string | null;
  extractedFirstName: string | null;
  extractedLastName: string | null;
  extractedDob: string | null;
  extractedLocationHint: string | null;
  extractedEncounterDate: string | null;
  /** Language the patient is using (for replies). */
  patientLanguage?: PatientLanguage;
  /** Short instruction for the reply model (this turn). */
  replyStrategy?: string | null;
  publicReplyScope?: PublicReplyScope;
  attachSoapPdf?: boolean;
  isPolicyQuestion?: boolean;
  /** AI believes the patient's request was fulfilled this turn. */
  issueLikelyResolved?: boolean;
  /** Ask resolution yes/no then 1–5 rating after this reply. */
  shouldAskResolutionFeedback?: boolean;
  confidence: number;
}

export interface AdminRule {
  id: string;
  title: string;
  body: string;
  category: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
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
  clinicDataUnavailable?: boolean;
  needsPatientInfo?: "soap" | "appointment";
  publicOnly?: boolean;
  /** email = Resend attachment; chat = dev UI download link */
  replyChannel?: "email" | "chat";
  /** Identity parsed from this turn + thread (for reply model). */
  identityHints?: {
    name: string | null;
    dob: string | null;
  };
  resolvedPatientId?: string | null;
  /** Reply language for this turn (en / es). */
  replyLanguage?: PatientLanguage;
  /** Copied from analysis for the reply model. */
  replyStrategy?: string | null;
  effectiveIntent?: EmailIntent;
  systemActions?: SystemAction[];
  isPolicyQuestion?: boolean;
  attachSoapPdf?: boolean;
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
