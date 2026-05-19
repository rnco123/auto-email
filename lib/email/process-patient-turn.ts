import { identityFromAnalysis } from "@/lib/email/identity-from-analysis";
import { effectiveIntentFromAnalysis } from "@/lib/email/effective-intent";
import {
  gatherFactsFromAnalysis,
  resolveOutboundSoapAttachment,
} from "@/lib/email/execute-system-actions";
import { resolvePatientOptional } from "@/lib/email/resolve-patient";
import { buildSoapNotePdf, soapNotePdfFilename } from "@/lib/email/soap-pdf";
import { isVerificationDisabled } from "@/lib/email/phi-policy";
import { resolveReplyLanguage } from "@/lib/i18n/patient-language";
import { appendResolutionPrompt } from "@/lib/supabase/thread-feedback";
import { analyzePatientMessage } from "@/lib/openai/analyze-patient-message";
import { generateReply } from "@/lib/openai/reply";
import type {
  ClassificationResult,
  EmailIntent,
  EmailMessage,
  EmailThread,
  PatientLanguage,
  ProcessorFacts,
} from "@/lib/types";

export function enrichFactsForReply(
  facts: ProcessorFacts,
  input: {
    analysis: ClassificationResult;
    intent: EmailIntent;
    replyLanguage: PatientLanguage;
    identityHints: { name: string | null; dob: string | null };
    resolvedPatientId: string | null;
    patientName: string | null | undefined;
    replyChannel?: "email" | "chat";
  }
): ProcessorFacts {
  return {
    ...facts,
    replyChannel: input.replyChannel ?? "email",
    replyLanguage: input.replyLanguage,
    identityHints: input.identityHints,
    resolvedPatientId: input.resolvedPatientId,
    patientName: input.patientName ?? facts.patientName,
    replyStrategy: input.analysis.replyStrategy ?? undefined,
    effectiveIntent: input.intent,
    systemActions: input.analysis.systemActions,
    isPolicyQuestion: input.analysis.isPolicyQuestion,
    attachSoapPdf: input.analysis.attachSoapPdf,
  };
}

export interface ProcessPatientTurnResult {
  intent: EmailIntent;
  replyText: string;
  facts: ProcessorFacts;
  analysis: ClassificationResult;
  attachment?: { filename: string; base64: string };
  patientId: string | null;
  patientName: string | null;
  feedbackPrompt?: { stage: "resolution" | "rating"; language: PatientLanguage } | null;
}

/**
 * AI-orchestrated turn: analyze → execute AI-chosen system actions → AI reply.
 */
export async function processPatientTurn(input: {
  thread: EmailThread;
  patientMessage: string;
  subject: string;
  fromEmail: string;
  history: EmailMessage[];
  replyChannel?: "email" | "chat";
}): Promise<ProcessPatientTurnResult> {
  if (!isVerificationDisabled()) {
    throw new Error(
      "processPatientTurn is for open-access mode; use the verified path in processor.ts."
    );
  }

  const usageThreadId =
    input.thread.id === "chat-sim" ? null : input.thread.id;

  const analysis = await analyzePatientMessage(
    input.subject,
    input.patientMessage,
    input.thread,
    input.history,
    { threadIdForUsage: usageThreadId }
  );

  const intent = effectiveIntentFromAnalysis(analysis, input.thread);

  const patientBodies = [
    ...input.history
      .filter((m) => m.direction === "inbound" && m.body_text)
      .map((m) => m.body_text as string),
    input.patientMessage,
  ];

  const identityHints = identityFromAnalysis(analysis, {
    patientBodies,
  });

  const needsLookup =
    (analysis.systemActions ?? []).includes("lookup_patient") ||
    (analysis.systemActions ?? []).includes("fetch_soap_note") ||
    (analysis.systemActions ?? []).includes("lookup_appointment");

  const { patient, dbError } = needsLookup
    ? await resolvePatientOptional(
        input.fromEmail,
        input.thread,
        input.patientMessage,
        analysis,
        identityHints
      )
    : { patient: null, dbError: null };

  const resolvedPatientId =
    patient?.id ?? input.thread.verified_patient_id ?? null;

  const facts = await gatherFactsFromAnalysis(analysis, {
    patientId: resolvedPatientId,
    body: input.patientMessage,
    identityHints,
    dbError,
    locationHint: analysis.extractedLocationHint,
    encounterDateHint: analysis.extractedEncounterDate,
  });

  const replyLanguage = resolveReplyLanguage(
    analysis,
    input.patientMessage,
    patientBodies
  );

  const factsForReply = enrichFactsForReply(facts, {
    analysis,
    intent,
    replyLanguage,
    identityHints: {
      name: identityHints.name,
      dob: identityHints.dob,
    },
    resolvedPatientId,
    patientName: patient?.fullName ?? facts.patientName,
    replyChannel: input.replyChannel,
  });

  let replyText = await generateReply(
    intent,
    input.patientMessage,
    factsForReply,
    input.history,
    input.thread,
    { threadIdForUsage: usageThreadId }
  );

  let feedbackPrompt: ProcessPatientTurnResult["feedbackPrompt"] = null;
  if (
    analysis.shouldAskResolutionFeedback &&
    (input.thread.feedback_stage ?? "none") === "none"
  ) {
    replyText = appendResolutionPrompt(replyText, replyLanguage);
    feedbackPrompt = { stage: "resolution", language: replyLanguage };
  }

  let attachment: { filename: string; base64: string } | undefined;
  const { attach, soapNote } = resolveOutboundSoapAttachment(analysis, factsForReply);
  if (attach && soapNote) {
    const pdf = await buildSoapNotePdf(soapNote);
    attachment = {
      filename: soapNotePdfFilename(soapNote),
      base64: pdf.toString("base64"),
    };
  }

  return {
    intent,
    replyText,
    facts: factsForReply,
    analysis,
    attachment,
    patientId: resolvedPatientId,
    patientName: patient?.fullName ?? null,
    feedbackPrompt,
  };
}
