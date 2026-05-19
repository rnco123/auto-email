import type { PatientLanguage } from "@/lib/types";

export type FeedbackStage = "resolution" | "rating";

const RESOLUTION = {
  en: {
    question: "Is your issue resolved?",
    yes: "Yes, resolved",
    no: "Not yet",
    emailHint:
      "Reply YES if your issue is resolved, or NO if you still need help.",
  },
  es: {
    question: "¿Se resolvió su consulta?",
    yes: "Sí, resuelta",
    no: "Aún no",
    emailHint:
      "Responda SÍ si su consulta quedó resuelta, o NO si aún necesita ayuda.",
  },
} as const;

const RATING = {
  en: {
    question: "How would you rate your experience? (1 = poor, 5 = excellent)",
    emailHint: "Reply with a number from 1 to 5.",
  },
  es: {
    question:
      "¿Cómo calificaría su experiencia? (1 = mala, 5 = excelente)",
    emailHint: "Responda con un número del 1 al 5.",
  },
} as const;

export function resolutionPromptBlock(lang: PatientLanguage): string {
  const t = RESOLUTION[lang];
  return `\n\n---\n${t.question}\n${t.emailHint}`;
}

export function ratingPromptBlock(lang: PatientLanguage): string {
  const t = RATING[lang];
  return `\n\n---\n${t.question}\n${t.emailHint}`;
}

export function feedbackUiLabels(lang: PatientLanguage, stage: FeedbackStage) {
  if (stage === "resolution") {
    const t = RESOLUTION[lang];
    return { question: t.question, yes: t.yes, no: t.no };
  }
  const t = RATING[lang];
  return { question: t.question, stars: [1, 2, 3, 4, 5] as const };
}

export function thanksAfterRating(lang: PatientLanguage): string {
  return lang === "es"
    ? "Gracias por su calificación. Si necesita algo más, escríbanos.\n\nGracias,"
    : "Thank you for your rating. If you need anything else, just reply.\n\nThank you,";
}
