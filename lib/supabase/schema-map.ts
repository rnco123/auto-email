/**
 * Map your Supabase clinical tables here.
 * Update table and column names to match your database.
 */
export const schemaMap = {
  patients: {
    table: "patients",
    id: "id",
    email: "email",
    fullName: "full_name",
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
    name: "name",
    address: "address",
    hours: "hours",
    phone: "phone",
    lat: "lat",
    lng: "lng",
    city: "city",
    zip: "zip",
    isPublic: "is_public",
  },
  soapNotes: {
    table: "soap_notes",
    id: "id",
    patientId: "patient_id",
    content: "summary",
    visitDate: "visit_date",
  },
} as const;

export type SchemaMap = typeof schemaMap;
