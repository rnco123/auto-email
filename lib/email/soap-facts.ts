import {
  listPatientSoapNotes,
  matchSoapNoteByEncounterDate,
  toEncounterOptions,
} from "@/lib/supabase/clinical-queries";
import type { ProcessorFacts, SoapNoteRecord } from "@/lib/types";

export async function gatherSoapNoteFacts(
  patientId: string,
  encounterDateHint: string | null
): Promise<ProcessorFacts> {
  const notes = await listPatientSoapNotes(patientId);
  if (notes.length === 0) return { noSoapOnFile: true };

  const options = toEncounterOptions(notes);

  if (options.length === 1) {
    const note = pickNoteForEncounter(notes, options[0].encounterId);
    if (!note) return { noSoapOnFile: true };
    return { soapNote: note, soapNotePdfAttached: true };
  }

  if (encounterDateHint) {
    const matched = matchSoapNoteByEncounterDate(notes, encounterDateHint);
    if (matched) {
      return { soapNote: matched, soapNotePdfAttached: true };
    }
    return {
      needsEncounterDate: true,
      encounterOptions: options,
      encounterDateNotFound: true,
    };
  }

  return {
    needsEncounterDate: true,
    encounterOptions: options,
  };
}

function pickNoteForEncounter(
  notes: SoapNoteRecord[],
  encounterId: string
): SoapNoteRecord | null {
  return notes.find((n) => n.encounterId === encounterId) ?? null;
}
