// Staff console is internal Rezeta-staff tooling (not the patient-facing
// product), so its copy is English per the feature spec §7.
export const staffStrings = {
  consoleTitle: 'Rezeta Staff',
  pageTitle: 'New institution',
  pageSubtitle: 'Create a new institution and its initial super admin.',
  fieldInstitutionName: 'Institution name',
  fieldType: 'Type',
  fieldPlan: 'Plan',
  fieldAdminName: 'Admin name',
  fieldAdminEmail: 'Admin email',
  typeOptions: {
    solo: 'Solo',
    practice: 'Practice',
    clinic: 'Clinic',
    enterprise: 'Enterprise',
  },
  planOptions: {
    free: 'Free',
    solo: 'Solo',
    practice: 'Practice',
    clinic: 'Clinic',
  },
  submit: 'Create institution',
  submitting: 'Creating…',
  error: 'Could not create the institution. Check the details and try again.',
  successTitle: 'Institution created',
  successBody: (email: string): string => `A set-password email was sent to ${email}.`,
} as const
