import {
  formatVisitDateLocalized,
  type PatientLanguage,
} from "@/lib/i18n/patient-language";

type Msg = { en: string; es: string };

const M = {
  thankYou: { en: "Thank you,", es: "Gracias," },
  soapPdfReadyChat: {
    en: "Your SOAP note {when} is ready — use the download button in this chat.",
    es: "Su nota SOAP {when} está lista — use el botón de descarga en este chat.",
  },
  soapPdfReadyEmail: {
    en: "Please find your SOAP note {when} attached as a PDF.",
    es: "Adjuntamos su nota SOAP {when} en PDF.",
  },
  visitOn: {
    en: "from your visit on {date}",
    es: "de su visita del {date}",
  },
  visitGeneric: {
    en: "from your visit",
    es: "de su visita",
  },
  clinicDataUnavailable: {
    en: "Our system cannot reach patient records right now (database access is not configured).",
    es: "En este momento no podemos acceder a los expedientes (falta configurar el acceso a la base de datos).",
  },
  clinicDataUnavailableHint: {
    en: "Please ask your clinic admin to enable patient read access in Supabase, then try again.",
    es: "Pida al administrador de la clínica que habilite el acceso de lectura en Supabase e intente de nuevo.",
  },
  chartNotFound: {
    en: "We could not find a patient chart matching that name and date of birth.",
    es: "No encontramos un expediente con ese nombre y fecha de nacimiento.",
  },
  chartNotFoundHint: {
    en: "Please check the spelling (as on file) and try again, or call the clinic.",
    es: "Revise que nombre y fecha coincidan con el expediente e intente de nuevo, o llame a la clínica.",
  },
  needIdentityIntro: {
    en: "To send your SOAP note as a PDF, please reply with:",
    es: "Para enviar su nota SOAP en PDF, responda con:",
  },
  needIdentityNameDob: {
    en: "• Your full name and date of birth exactly as they appear on file, or",
    es: "• Su nombre completo y fecha de nacimiento tal como figuran en el expediente, o",
  },
  needIdentityVisit: {
    en: "• The date of your visit (if you have had more than one visit).",
    es: "• La fecha de su visita (si ha tenido más de una).",
  },
  needIdentityAppointment: {
    en: "To look up your appointment, please reply with your full name and date of birth exactly as they appear on file.",
    es: "Para buscar su cita, responda con su nombre completo y fecha de nacimiento tal como figuran en el expediente.",
  },
  encounterNotFound: {
    en: "We could not find a SOAP note for that visit date.",
    es: "No encontramos una nota SOAP para esa fecha de visita.",
  },
  pickEncounter: {
    en: "Please reply with one of these visit dates:",
    es: "Responda con una de estas fechas de visita:",
  },
  multipleEncounters: {
    en: "We have SOAP notes for more than one visit.",
    es: "Tenemos notas SOAP de más de una visita.",
  },
  whichEncounter: {
    en: "Please reply with the visit date you need:",
    es: "Indique la fecha de visita que necesita:",
  },
  noSoapOnFile: {
    en: "We do not have a SOAP note on file for your chart.",
    es: "No tenemos una nota SOAP en su expediente.",
  },
  callClinic: {
    en: "Please call the clinic if you need assistance.",
    es: "Llame a la clínica si necesita ayuda.",
  },
  contactIntro: {
    en: "Thank you for contacting us. You can ask about our services or clinic locations, and we will be happy to help.",
    es: "Gracias por escribirnos. Puede preguntar por nuestros servicios o ubicaciones y con gusto le ayudamos.",
  },
  noServices: {
    en: "We do not have service information available by email at the moment. Please call the clinic.",
    es: "Por el momento no tenemos información de servicios por correo. Por favor llame a la clínica.",
  },
  servicesHeader: {
    en: "Here are the services we offer:",
    es: "Estos son los servicios que ofrecemos:",
  },
  servicesFooter: {
    en: "Reply if you would like more detail about a specific service.",
    es: "Responda si desea más información sobre algún servicio.",
  },
  noLocations: {
    en: "We do not have location information available by email at the moment. Please call the clinic.",
    es: "Por el momento no tenemos información de ubicaciones por correo. Por favor llame a la clínica.",
  },
  locationOne: {
    en: "Here is our clinic location:",
    es: "Esta es la ubicación de nuestra clínica:",
  },
  locationMany: {
    en: "Here are our clinic locations:",
    es: "Estas son las ubicaciones de nuestra clínica:",
  },
  locationFooter: {
    en: "Reply with your city or area if you need the location nearest to you.",
    es: "Responda con su ciudad o zona si necesita la ubicación más cercana.",
  },
  servicesSection: {
    en: "Services we offer:",
    es: "Servicios que ofrecemos:",
  },
  locationsSection: {
    en: "Clinic locations:",
    es: "Ubicaciones de la clínica:",
  },
  callForInfo: {
    en: "Please call the clinic for more information.",
    es: "Por favor llame a la clínica para más información.",
  },
} as const satisfies Record<string, Msg>;

function t(lang: PatientLanguage, key: keyof typeof M): string {
  return M[key][lang];
}

export function msgThankYou(lang: PatientLanguage): string {
  return t(lang, "thankYou");
}

export function msgSoapWhen(
  lang: PatientLanguage,
  encounterDate: string | null
): string {
  if (encounterDate) {
    const date = formatVisitDateLocalized(encounterDate, lang);
    return t(lang, "visitOn").replace("{date}", date);
  }
  return t(lang, "visitGeneric");
}

export { t as clinicMsg };
