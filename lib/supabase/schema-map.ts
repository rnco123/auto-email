/**
 * Map your Supabase tables here.
 * Update table and column names to match your database.
 */
export const schemaMap = {
  patients: {
    table: "patients",
    id: "id",
    email: "email",
    firstName: "first_name",
    lastName: "last_name",
    dob: "date_of_birth",
  },
  appointments: {
    table: "appointments",
    id: "id",
    patientId: "patient_id",
    startsAt: "starts_at",
    locationId: "location_id",
  },
  locations: {
    table: "locations",
    id: "id",
    title: "title",
    address: "address",
    locationCode: "location_code",
  },
  services: {
    table: "services",
    id: "id",
    titleEn: "title_en",
    titleEs: "title_es",
  },
  encounters: {
    table: "encounters",
    id: "id",
    patientId: "patient_id",
    /** Column used when asking patient to pick a visit date */
    encounterDate: "created_at",
  },
  aiSoapNotes: {
    table: "ai_soapnotes",
    id: "id",
    encounterId: "encounter_id",
    subjective: "subjective_text",
    objective: "objective_text",
    assessment: "assessment_text",
    plan: "plan_text",
    createdAt: "created_at",
  },
} as const;

export type SchemaMap = typeof schemaMap;
