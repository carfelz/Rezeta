#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# seed-regression.sh
#
# Full regression seed for the Rezeta Medical ERP MVP.
# Creates a complete dataset for test@test.com covering every module.
#
# Usage:
#   ./tools/seed-regression.sh
#   API_URL=https://your-api.run.app ./tools/seed-regression.sh
#
# Requirements: curl, jq
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API="${API_URL:-http://localhost:3000}"
EMAIL="test@test.com"
PASSWORD="Test12345"
TOKEN=""

# ─── Colours ──────────────────────────────────────────────────────────────────
BOLD=$'\033[1m'
GREEN=$'\033[0;32m'
CYAN=$'\033[0;36m'
YELLOW=$'\033[0;33m'
RED=$'\033[0;31m'
RESET=$'\033[0m'

step()  { echo "${CYAN}${BOLD}▸ $*${RESET}"; }
ok()    { echo "${GREEN}  ✓ $*${RESET}"; }
warn()  { echo "${YELLOW}  ⚠ $*${RESET}"; }
fail()  { echo "${RED}  ✗ $*${RESET}"; exit 1; }

# ─── HTTP helpers ─────────────────────────────────────────────────────────────

post() {
  local path="$1" body="$2"
  curl -sf -X POST "${API}${path}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "${body}"
}

patch() {
  local path="$1" body="$2"
  curl -sf -X PATCH "${API}${path}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "${body}"
}

get() {
  local path="$1"
  curl -sf "${API}${path}" \
    -H "Authorization: Bearer ${TOKEN}"
}

post_public() {
  local path="$1" body="$2"
  curl -sf -X POST "${API}${path}" \
    -H "Content-Type: application/json" \
    -d "${body}"
}

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}Rezeta Regression Seed${RESET}"
echo "  API : ${API}"
echo "  User: ${EMAIL}"
echo ""

# ─── 1. Auth ──────────────────────────────────────────────────────────────────
step "1/8  Authentication & provisioning"

TOKEN_RESP=$(post_public "/v1/auth/dev/token" \
  "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
TOKEN=$(echo "$TOKEN_RESP" | jq -r '.data.access_token')
ok "Token obtained"

PROVISION_RESP=$(post "/v1/auth/provision" '{}')
USER_ID=$(echo "$PROVISION_RESP" | jq -r '.data.id')
TENANT_ID=$(echo "$PROVISION_RESP" | jq -r '.data.tenantId')
ok "User provisioned — userId=${USER_ID} tenantId=${TENANT_ID}"

# Onboarding (idempotent — 409 is fine if already seeded)
ONBOARD_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API}/v1/onboarding/default" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" -d '{}')
if [[ "$ONBOARD_HTTP" == "200" ]]; then
  ok "Onboarding completed — 5 default templates + types created"
elif [[ "$ONBOARD_HTTP" == "409" ]]; then
  ok "Onboarding already done — skipping"
else
  fail "Onboarding returned unexpected HTTP ${ONBOARD_HTTP}"
fi

# ─── 2. Locations ─────────────────────────────────────────────────────────────
step "2/8  Locations (3)"

LOC1=$(post "/v1/locations" '{
  "name": "Centro Médico Nacional",
  "address": "Av. Máximo Gómez 68, Santo Domingo",
  "city": "Santo Domingo",
  "phone": "809-221-0000",
  "isOwned": false,
  "commissionPercent": 30
}')
LOC1_ID=$(echo "$LOC1" | jq -r '.data.id')
ok "Centro Médico Nacional → ${LOC1_ID}"

LOC2=$(post "/v1/locations" '{
  "name": "Clínica Santiago Apóstol",
  "address": "Calle Duarte 45, Santiago de los Caballeros",
  "city": "Santiago",
  "phone": "809-583-0000",
  "isOwned": false,
  "commissionPercent": 25
}')
LOC2_ID=$(echo "$LOC2" | jq -r '.data.id')
ok "Clínica Santiago Apóstol → ${LOC2_ID}"

LOC3=$(post "/v1/locations" '{
  "name": "Consultorio Privado Dr. García",
  "address": "Av. Abraham Lincoln 304, Piantini, Santo Domingo",
  "city": "Santo Domingo",
  "phone": "809-541-0000",
  "isOwned": true,
  "commissionPercent": 0
}')
LOC3_ID=$(echo "$LOC3" | jq -r '.data.id')
ok "Consultorio Privado → ${LOC3_ID}"

# ─── 3. Patients ──────────────────────────────────────────────────────────────
step "3/8  Patients (10)"

PT1=$(post "/v1/patients" '{
  "fullName": "Ana María Reyes",
  "dateOfBirth": "1982-03-15",
  "sex": "female",
  "documentType": "cedula",
  "documentNumber": "001-1234567-8",
  "phone": "809-555-1001",
  "email": "ana.reyes@example.com",
  "bloodType": "O+",
  "allergies": ["Penicilina"],
  "chronicConditions": ["Hipertensión arterial", "Diabetes mellitus tipo 2"],
  "notes": "Paciente de seguimiento mensual. Buen cumplimiento de medicamentos."
}')
PT1_ID=$(echo "$PT1" | jq -r '.data.id')
ok "Ana María Reyes → ${PT1_ID}"

PT2=$(post "/v1/patients" '{
  "fullName": "Carlos José Martínez",
  "dateOfBirth": "1975-07-22",
  "sex": "male",
  "documentType": "cedula",
  "documentNumber": "001-9876543-2",
  "phone": "829-555-1002",
  "bloodType": "A+",
  "allergies": [],
  "chronicConditions": ["Dislipidemia", "Sobrepeso"],
  "notes": "Control lipídico cada 3 meses."
}')
PT2_ID=$(echo "$PT2" | jq -r '.data.id')
ok "Carlos Martínez → ${PT2_ID}"

PT3=$(post "/v1/patients" '{
  "fullName": "María Elena González",
  "dateOfBirth": "1990-11-08",
  "sex": "female",
  "documentType": "cedula",
  "documentNumber": "402-5555555-5",
  "phone": "849-555-1003",
  "email": "maria.gonzalez@example.com",
  "bloodType": "B+",
  "allergies": ["Aspirina", "AINEs"],
  "chronicConditions": [],
  "notes": "Alergia severa a AINEs documentada con anafilaxia en 2021."
}')
PT3_ID=$(echo "$PT3" | jq -r '.data.id')
ok "María González → ${PT3_ID}"

PT4=$(post "/v1/patients" '{
  "fullName": "Pedro Antonio Álvarez",
  "dateOfBirth": "1954-01-30",
  "sex": "male",
  "documentType": "cedula",
  "documentNumber": "001-1111111-1",
  "phone": "809-555-1004",
  "bloodType": "AB+",
  "allergies": [],
  "chronicConditions": ["Insuficiencia cardíaca congestiva FE 35%", "Fibrilación auricular permanente", "Hipertensión arterial"],
  "notes": "Paciente complejo. Última ecocardiografía: FE 35%. En anticoagulación oral."
}')
PT4_ID=$(echo "$PT4" | jq -r '.data.id')
ok "Pedro Álvarez → ${PT4_ID}"

PT5=$(post "/v1/patients" '{
  "fullName": "Laura Beatriz Fernández",
  "dateOfBirth": "2000-05-14",
  "sex": "female",
  "documentType": "cedula",
  "documentNumber": "402-6666666-6",
  "phone": "829-555-1005",
  "bloodType": "O-",
  "allergies": ["Sulfas"],
  "chronicConditions": ["Asma bronquial leve intermitente"],
  "notes": "Usa salbutamol PRN. Sin ingresos hospitalarios por asma en últimos 2 años."
}')
PT5_ID=$(echo "$PT5" | jq -r '.data.id')
ok "Laura Fernández → ${PT5_ID}"

PT6=$(post "/v1/patients" '{
  "fullName": "Roberto Antonio Santos",
  "dateOfBirth": "1968-09-03",
  "sex": "male",
  "documentType": "cedula",
  "documentNumber": "001-2222222-2",
  "phone": "809-555-1006",
  "bloodType": "A-",
  "allergies": [],
  "chronicConditions": ["Hipotiroidismo", "Dislipidemia"],
  "notes": "Control de TSH cada 6 meses. Buen control con levotiroxina 75mcg."
}')
PT6_ID=$(echo "$PT6" | jq -r '.data.id')
ok "Roberto Santos → ${PT6_ID}"

PT7=$(post "/v1/patients" '{
  "fullName": "Isabel Cristina Cruz",
  "dateOfBirth": "1988-12-20",
  "sex": "female",
  "documentType": "cedula",
  "documentNumber": "001-3333333-3",
  "phone": "849-555-1007",
  "email": "isabel.cruz@example.com",
  "bloodType": "B-",
  "allergies": ["Metformina"],
  "chronicConditions": ["Síndrome de intestino irritable", "Ansiedad generalizada"],
  "notes": "Sigue con gastroenterología. Psicóloga activa."
}')
PT7_ID=$(echo "$PT7" | jq -r '.data.id')
ok "Isabel Cruz → ${PT7_ID}"

PT8=$(post "/v1/patients" '{
  "fullName": "Miguel Ángel Herrera",
  "dateOfBirth": "1960-06-15",
  "sex": "male",
  "documentType": "cedula",
  "documentNumber": "001-4444444-4",
  "phone": "809-555-1008",
  "bloodType": "O+",
  "allergies": [],
  "chronicConditions": ["Enfermedad renal crónica estadio 3", "Diabetes mellitus tipo 2", "Hipertensión arterial"],
  "notes": "Control nefrológico y endocrinológico. HbA1c última 7.8%. TFG 42."
}')
PT8_ID=$(echo "$PT8" | jq -r '.data.id')
ok "Miguel Herrera → ${PT8_ID}"

PT9=$(post "/v1/patients" '{
  "fullName": "Carmen Dolores López",
  "dateOfBirth": "1995-03-25",
  "sex": "female",
  "documentType": "cedula",
  "documentNumber": "402-7777777-7",
  "phone": "829-555-1009",
  "bloodType": "AB-",
  "allergies": [],
  "chronicConditions": [],
  "notes": "Primera visita. Viene por chequeo general anual."
}')
PT9_ID=$(echo "$PT9" | jq -r '.data.id')
ok "Carmen López → ${PT9_ID}"

PT10=$(post "/v1/patients" '{
  "fullName": "Francisco Ramón Soto",
  "dateOfBirth": "1947-11-11",
  "sex": "male",
  "documentType": "cedula",
  "documentNumber": "001-5555555-5",
  "phone": "809-555-1010",
  "bloodType": "A+",
  "allergies": ["Contraste yodado"],
  "chronicConditions": ["Cardiopatía isquémica crónica", "Hipertensión arterial", "Dislipidemia"],
  "notes": "Stent coronario 2019. En doble antiagregación hasta 2025, ahora solo ASA."
}')
PT10_ID=$(echo "$PT10" | jq -r '.data.id')
ok "Francisco Soto → ${PT10_ID}"

# ─── 4. Appointments ──────────────────────────────────────────────────────────
step "4/8  Appointments (18 — 10 past completed, 8 upcoming)"

# ── Past / completed ──────────────────────────────────────────────────────────

APT_P1=$(post "/v1/appointments" "{
  \"patientId\": \"${PT1_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-04-02T09:00:00.000Z\",
  \"endsAt\":   \"2026-04-02T09:30:00.000Z\",
  \"reason\": \"Control de hipertensión y diabetes\"
}")
APT_P1_ID=$(echo "$APT_P1" | jq -r '.data.id')
patch "/v1/appointments/${APT_P1_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 1 — Ana Reyes @ CMN (completed)"

APT_P2=$(post "/v1/appointments" "{
  \"patientId\": \"${PT2_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-04-03T10:00:00.000Z\",
  \"endsAt\":   \"2026-04-03T10:30:00.000Z\",
  \"reason\": \"Control de lípidos\"
}")
APT_P2_ID=$(echo "$APT_P2" | jq -r '.data.id')
patch "/v1/appointments/${APT_P2_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 2 — Carlos Martínez @ CMN (completed)"

APT_P3=$(post "/v1/appointments" "{
  \"patientId\": \"${PT4_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"startsAt\": \"2026-04-07T11:00:00.000Z\",
  \"endsAt\":   \"2026-04-07T11:30:00.000Z\",
  \"reason\": \"Control de insuficiencia cardíaca\"
}")
APT_P3_ID=$(echo "$APT_P3" | jq -r '.data.id')
patch "/v1/appointments/${APT_P3_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 3 — Pedro Álvarez @ Consultorio (completed)"

APT_P4=$(post "/v1/appointments" "{
  \"patientId\": \"${PT5_ID}\",
  \"locationId\": \"${LOC2_ID}\",
  \"startsAt\": \"2026-04-09T08:30:00.000Z\",
  \"endsAt\":   \"2026-04-09T09:00:00.000Z\",
  \"reason\": \"Crisis asmática leve\"
}")
APT_P4_ID=$(echo "$APT_P4" | jq -r '.data.id')
patch "/v1/appointments/${APT_P4_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 4 — Laura Fernández @ Santiago (completed)"

APT_P5=$(post "/v1/appointments" "{
  \"patientId\": \"${PT8_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-04-14T09:00:00.000Z\",
  \"endsAt\":   \"2026-04-14T09:30:00.000Z\",
  \"reason\": \"Control ERC y diabetes\"
}")
APT_P5_ID=$(echo "$APT_P5" | jq -r '.data.id')
patch "/v1/appointments/${APT_P5_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 5 — Miguel Herrera @ CMN (completed)"

APT_P6=$(post "/v1/appointments" "{
  \"patientId\": \"${PT10_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"startsAt\": \"2026-04-15T10:30:00.000Z\",
  \"endsAt\":   \"2026-04-15T11:00:00.000Z\",
  \"reason\": \"Control post-stent anual\"
}")
APT_P6_ID=$(echo "$APT_P6" | jq -r '.data.id')
patch "/v1/appointments/${APT_P6_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 6 — Francisco Soto @ Consultorio (completed)"

APT_P7=$(post "/v1/appointments" "{
  \"patientId\": \"${PT3_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-04-21T14:00:00.000Z\",
  \"endsAt\":   \"2026-04-21T14:30:00.000Z\",
  \"reason\": \"Evaluación alergia AINEs\"
}")
APT_P7_ID=$(echo "$APT_P7" | jq -r '.data.id')
patch "/v1/appointments/${APT_P7_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 7 — María González @ CMN (completed)"

APT_P8=$(post "/v1/appointments" "{
  \"patientId\": \"${PT6_ID}\",
  \"locationId\": \"${LOC2_ID}\",
  \"startsAt\": \"2026-04-22T09:00:00.000Z\",
  \"endsAt\":   \"2026-04-22T09:30:00.000Z\",
  \"reason\": \"Control hipotiroidismo\"
}")
APT_P8_ID=$(echo "$APT_P8" | jq -r '.data.id')
patch "/v1/appointments/${APT_P8_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 8 — Roberto Santos @ Santiago (completed)"

APT_P9=$(post "/v1/appointments" "{
  \"patientId\": \"${PT9_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"startsAt\": \"2026-04-24T11:00:00.000Z\",
  \"endsAt\":   \"2026-04-24T11:30:00.000Z\",
  \"reason\": \"Chequeo general anual\"
}")
APT_P9_ID=$(echo "$APT_P9" | jq -r '.data.id')
patch "/v1/appointments/${APT_P9_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 9 — Carmen López @ Consultorio (completed)"

APT_P10=$(post "/v1/appointments" "{
  \"patientId\": \"${PT7_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-04-28T15:00:00.000Z\",
  \"endsAt\":   \"2026-04-28T15:30:00.000Z\",
  \"reason\": \"Control SII y ansiedad\"
}")
APT_P10_ID=$(echo "$APT_P10" | jq -r '.data.id')
patch "/v1/appointments/${APT_P10_ID}/status" '{"status":"completed"}' > /dev/null
ok "Past appt 10 — Isabel Cruz @ CMN (completed)"

# ── Upcoming / scheduled ──────────────────────────────────────────────────────

post "/v1/appointments" "{
  \"patientId\": \"${PT1_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-05-06T09:00:00.000Z\",
  \"endsAt\":   \"2026-05-06T09:30:00.000Z\",
  \"reason\": \"Control mensual HTA/DM2\"
}" > /dev/null
ok "Future appt — Ana Reyes @ CMN 06-may"

post "/v1/appointments" "{
  \"patientId\": \"${PT4_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"startsAt\": \"2026-05-08T10:00:00.000Z\",
  \"endsAt\":   \"2026-05-08T10:30:00.000Z\",
  \"reason\": \"Control ICC — ajuste de diuréticos\"
}" > /dev/null
ok "Future appt — Pedro Álvarez @ Consultorio 08-may"

post "/v1/appointments" "{
  \"patientId\": \"${PT2_ID}\",
  \"locationId\": \"${LOC2_ID}\",
  \"startsAt\": \"2026-05-12T11:00:00.000Z\",
  \"endsAt\":   \"2026-05-12T11:30:00.000Z\",
  \"reason\": \"Resultado de perfil lipídico\"
}" > /dev/null
ok "Future appt — Carlos Martínez @ Santiago 12-may"

post "/v1/appointments" "{
  \"patientId\": \"${PT8_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-05-14T09:00:00.000Z\",
  \"endsAt\":   \"2026-05-14T09:30:00.000Z\",
  \"reason\": \"Control ERC — resultados depuración creatinina\"
}" > /dev/null
ok "Future appt — Miguel Herrera @ CMN 14-may"

post "/v1/appointments" "{
  \"patientId\": \"${PT10_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"startsAt\": \"2026-05-19T15:00:00.000Z\",
  \"endsAt\":   \"2026-05-19T15:30:00.000Z\",
  \"reason\": \"Control cardiopatía isquémica\"
}" > /dev/null
ok "Future appt — Francisco Soto @ Consultorio 19-may"

post "/v1/appointments" "{
  \"patientId\": \"${PT5_ID}\",
  \"locationId\": \"${LOC2_ID}\",
  \"startsAt\": \"2026-05-21T08:00:00.000Z\",
  \"endsAt\":   \"2026-05-21T08:30:00.000Z\",
  \"reason\": \"Control asma — revisión técnica de inhalador\"
}" > /dev/null
ok "Future appt — Laura Fernández @ Santiago 21-may"

post "/v1/appointments" "{
  \"patientId\": \"${PT6_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"startsAt\": \"2026-06-03T10:00:00.000Z\",
  \"endsAt\":   \"2026-06-03T10:30:00.000Z\",
  \"reason\": \"TSH control semestral\"
}" > /dev/null
ok "Future appt — Roberto Santos @ CMN 03-jun"

post "/v1/appointments" "{
  \"patientId\": \"${PT3_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"startsAt\": \"2026-06-10T14:00:00.000Z\",
  \"endsAt\":   \"2026-06-10T14:30:00.000Z\",
  \"reason\": \"Revisión resultados pruebas alergia\"
}" > /dev/null
ok "Future appt — María González @ Consultorio 10-jun"

# ─── 5. Consultations ─────────────────────────────────────────────────────────
step "5/8  Consultations (8) + orders"

# Consult 1 — Ana Reyes HTA/DM2 (signed)
CONS1=$(post "/v1/consultations" "{
  \"patientId\": \"${PT1_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"appointmentId\": \"${APT_P1_ID}\",
  \"chiefComplaint\": \"Cefalea occipital y lecturas de PA en casa 160/95\",
  \"subjective\": \"Paciente femenina 44 años con HTA + DM2 conocida. Refiere cefalea occipital intermitente x3 días. PA en casa: 160/95. Glicemia capilar ayunas 145 mg/dL. Cumple medicamentos: Losartán 50mg OD, Metformina 850mg BID.\",
  \"objective\": \"PA: 158/94 mmHg. FC: 78 lpm. Peso: 72 kg. Talla: 162 cm. IMC: 27.4. Examen neurológico: sin focalidad. Fondo de ojo: cruzamiento AV grado I.\",
  \"assessment\": \"HTA no controlada. Posible efecto de bata blanca vs necesidad de ajuste. DM2 con control subóptimo.\",
  \"plan\": \"1. Aumentar Losartán a 100mg OD. 2. Agregar Amlodipino 5mg OD. 3. Reforzar dieta. 4. Control PA diario en casa. 5. HbA1c en próxima visita.\",
  \"vitals\": {\"bloodPressureSystolic\": 158, \"bloodPressureDiastolic\": 94, \"heartRate\": 78, \"weightKg\": 72, \"heightCm\": 162},
  \"diagnoses\": [\"Hipertensión arterial no controlada\", \"Diabetes mellitus tipo 2\"]
}")
CONS1_ID=$(echo "$CONS1" | jq -r '.data.id')

post "/v1/consultations/${CONS1_ID}/prescriptions" "{
  \"groupTitle\": \"Receta 1 — Antihipertensivos\",
  \"groupOrder\": 1,
  \"items\": [
    {\"drug\": \"Losartán\", \"dose\": \"100 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día en la mañana\", \"duration\": \"90 días\", \"notes\": \"Tomar con o sin alimentos\"},
    {\"drug\": \"Amlodipino\", \"dose\": \"5 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día\", \"duration\": \"90 días\", \"notes\": \"Si mareos al inicio, tomar al acostarse\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS1_ID}/prescriptions" "{
  \"groupTitle\": \"Receta 2 — Antidiabéticos\",
  \"groupOrder\": 2,
  \"items\": [
    {\"drug\": \"Metformina\", \"dose\": \"850 mg\", \"route\": \"Oral\", \"frequency\": \"Dos veces al día con las comidas\", \"duration\": \"90 días\", \"notes\": \"Continuar dosis actual\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS1_ID}/lab-orders" "{
  \"groupTitle\": \"Laboratorios de control\",
  \"groupOrder\": 1,
  \"orders\": [
    {\"test_name\": \"Hemoglobina glicosilada (HbA1c)\", \"indication\": \"Control DM2 trimestral\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Perfil lipídico completo\", \"indication\": \"Control cardiovascular\", \"urgency\": \"routine\", \"fasting_required\": true, \"sample_type\": \"blood\"},
    {\"test_name\": \"Creatinina y BUN\", \"indication\": \"Monitoreo función renal en HTA\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Electrolitos séricos\", \"indication\": \"Control con ARAs\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS1_ID}/sign" '{}' > /dev/null
ok "Consult 1 signed — Ana Reyes (HTA/DM2) — 2 rx + labs"

# Consult 2 — Carlos Martínez dislipidemia (signed)
CONS2=$(post "/v1/consultations" "{
  \"patientId\": \"${PT2_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"appointmentId\": \"${APT_P2_ID}\",
  \"chiefComplaint\": \"Resultado de perfil lipídico — LDL 175 mg/dL\",
  \"subjective\": \"Paciente masculino 50 años con dislipidemia conocida y sobrepeso. LDL 175 (meta <100 por DM familiar). Sin dolor torácico ni disnea.\",
  \"objective\": \"PA: 128/82 mmHg. FC: 80 lpm. Peso: 92 kg. IMC: 30.1. Sin xantelasmas. Sin S3/S4.\",
  \"assessment\": \"Dislipidemia mal controlada. Meta LDL no alcanzada. Riesgo cardiovascular moderado.\",
  \"plan\": \"1. Iniciar Atorvastatina 40mg cada noche. 2. Dieta estricta baja en grasas saturadas. 3. Ejercicio aeróbico 150 min/semana. 4. Control lipídico en 3 meses.\",
  \"vitals\": {\"bloodPressureSystolic\": 128, \"bloodPressureDiastolic\": 82, \"heartRate\": 80, \"weightKg\": 92, \"heightCm\": 175},
  \"diagnoses\": [\"Dislipidemia mixta\", \"Sobrepeso\"]
}")
CONS2_ID=$(echo "$CONS2" | jq -r '.data.id')

post "/v1/consultations/${CONS2_ID}/prescriptions" "{
  \"groupOrder\": 1,
  \"items\": [
    {\"drug\": \"Atorvastatina\", \"dose\": \"40 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día en la noche\", \"duration\": \"90 días\", \"notes\": \"Tomar al acostarse para mayor eficacia\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS2_ID}/sign" '{}' > /dev/null
ok "Consult 2 signed — Carlos Martínez (dislipidemia) — 1 rx"

# Consult 3 — Pedro Álvarez ICC (signed, complex)
CONS3=$(post "/v1/consultations" "{
  \"patientId\": \"${PT4_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"appointmentId\": \"${APT_P3_ID}\",
  \"chiefComplaint\": \"Disnea al caminar 2 cuadras y edema bilateral de tobillos\",
  \"subjective\": \"Paciente masculino 72 años con ICC FE 35% + FA permanente + HTA. Disnea clase funcional II-III (empeoró de II). Edema tobillos + 2 bilat. Peso ganó 2 kg en 7 días. Cumple: Furosemida 40mg, Carvedilol 25mg BID, Sacubitrilo/Valsartán 49/51mg BID, Spironolactona 25mg, Apixaban 5mg BID.\",
  \"objective\": \"PA: 118/76 mmHg. FC: 88 lpm. SpO2: 95% aa. Peso: 84 kg. Crepitantes bibasales. Edema grado 2 bilateral. JVP elevada a 45 grados.\",
  \"assessment\": \"Descompensación leve de ICC. Posible causa: trasgresión dietética con sodio o adherencia a diuréticos.\",
  \"plan\": \"1. Aumentar Furosemida a 80mg AM x7 días, luego volver a 40mg. 2. Pesar diario. 3. Restricción de sal estricta. 4. BNP si no mejora en 5 días. 5. Control en 1 semana.\",
  \"vitals\": {\"bloodPressureSystolic\": 118, \"bloodPressureDiastolic\": 76, \"heartRate\": 88, \"oxygenSaturation\": 95, \"weightKg\": 84},
  \"diagnoses\": [\"Insuficiencia cardíaca descompensada leve\", \"Fibrilación auricular permanente\"]
}")
CONS3_ID=$(echo "$CONS3" | jq -r '.data.id')

post "/v1/consultations/${CONS3_ID}/prescriptions" "{
  \"groupTitle\": \"Ajuste temporal diurético\",
  \"groupOrder\": 1,
  \"items\": [
    {\"drug\": \"Furosemida\", \"dose\": \"80 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día en la mañana\", \"duration\": \"7 días\", \"notes\": \"Luego regresar a 40mg OD. Monitorear electrolitos.\"},
    {\"drug\": \"Cloruro de potasio\", \"dose\": \"10 mEq\", \"route\": \"Oral\", \"frequency\": \"Dos veces al día con las comidas\", \"duration\": \"7 días\", \"notes\": \"Suplemento preventivo mientras dure la furosemida 80mg\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS3_ID}/lab-orders" "{
  \"groupOrder\": 1,
  \"orders\": [
    {\"test_name\": \"BNP o Pro-BNP\", \"indication\": \"Evaluar severidad de descompensación ICC\", \"urgency\": \"urgent\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Electrolitos séricos (Na, K, Cl)\", \"indication\": \"Control con diurético\", \"urgency\": \"urgent\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Creatinina\", \"indication\": \"Control función renal con ajuste diurético\", \"urgency\": \"urgent\", \"fasting_required\": false, \"sample_type\": \"blood\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS3_ID}/imaging-orders" "{
  \"groupOrder\": 1,
  \"orders\": [
    {\"study_type\": \"Radiografía de tórax PA\", \"indication\": \"Evaluar congestión pulmonar en ICC descompensada\", \"urgency\": \"urgent\", \"contrast\": false, \"fasting_required\": false}
  ]
}" > /dev/null

post "/v1/consultations/${CONS3_ID}/sign" '{}' > /dev/null
ok "Consult 3 signed — Pedro Álvarez (ICC) — 1 rx + labs + imagen"

# Consult 4 — Laura Fernández asma (signed)
CONS4=$(post "/v1/consultations" "{
  \"patientId\": \"${PT5_ID}\",
  \"locationId\": \"${LOC2_ID}\",
  \"appointmentId\": \"${APT_P4_ID}\",
  \"chiefComplaint\": \"Tos nocturna y sibilancias leves desde hace 3 días\",
  \"subjective\": \"Femenina 26 años con asma leve intermitente. Sibilancias y tos nocturna x3 días. Desencadenante: pintaron su apartamento. Usa salbutamol 2-3 veces al día.\",
  \"objective\": \"FR: 18 rpm. SpO2: 98%. Auscultación: sibilancias espiratorias difusas leves. Sin uso de músculos accesorios.\",
  \"assessment\": \"Crisis asmática leve. Posible asma persistente leve dado uso de rescate >2 veces/semana.\",
  \"plan\": \"1. Nebulización con salbutamol 2.5mg en consultorio. 2. Agregar Budesonida/Formoterol inhalado. 3. Referir a neumología para espirometría. 4. Aléjarse del apartamento mientras se ventila.\",
  \"vitals\": {\"respiratoryRate\": 18, \"oxygenSaturation\": 98, \"heartRate\": 92},
  \"diagnoses\": [\"Crisis asmática leve\", \"Posible asma persistente leve\"]
}")
CONS4_ID=$(echo "$CONS4" | jq -r '.data.id')

post "/v1/consultations/${CONS4_ID}/prescriptions" "{
  \"groupOrder\": 1,
  \"items\": [
    {\"drug\": \"Budesonida/Formoterol\", \"dose\": \"160/4.5 mcg\", \"route\": \"Inhalado\", \"frequency\": \"2 inhalaciones cada 12 horas\", \"duration\": \"30 días\", \"notes\": \"Enjuagar boca después de cada uso\"},
    {\"drug\": \"Salbutamol\", \"dose\": \"100 mcg/dosis\", \"route\": \"Inhalado\", \"frequency\": \"2 inhalaciones PRN (máx cada 4 horas)\", \"duration\": \"30 días\", \"notes\": \"Solo usar si síntomas — no preventivo\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS4_ID}/sign" '{}' > /dev/null
ok "Consult 4 signed — Laura Fernández (asma)"

# Consult 5 — Miguel Herrera ERC+DM2 (signed, complex)
CONS5=$(post "/v1/consultations" "{
  \"patientId\": \"${PT8_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"appointmentId\": \"${APT_P5_ID}\",
  \"chiefComplaint\": \"Control trimestral ERC + DM2\",
  \"subjective\": \"Masculino 65 años con ERC estadio 3 (TFG 42), DM2 e HTA. HbA1c última 7.8%. Creatinina 1.9 mg/dL estable. Sin síntomas urinarios ni edema. Cumple tratamiento.\",
  \"objective\": \"PA: 136/86 mmHg. FC: 76 lpm. Peso: 78 kg. Sin edema. Sensibilidad plantar disminuida bilateral.\",
  \"assessment\": \"ERC estadio 3 estable. DM2 subóptimamente controlada. HTA parcialmente controlada. Neuropatía periférica leve.\",
  \"plan\": \"1. Ajustar Glipizida a 10mg BID (suspender Metformina - TFG <45). 2. Intensificar control glucémico. 3. Referir a nutrición. 4. Repetir TFG en 3 meses. 5. Derivar a neurología por neuropatía.\",
  \"vitals\": {\"bloodPressureSystolic\": 136, \"bloodPressureDiastolic\": 86, \"heartRate\": 76, \"weightKg\": 78},
  \"diagnoses\": [\"Enfermedad renal crónica estadio 3\", \"Diabetes mellitus tipo 2 subóptima\", \"Neuropatía periférica diabética\"]
}")
CONS5_ID=$(echo "$CONS5" | jq -r '.data.id')

post "/v1/consultations/${CONS5_ID}/prescriptions" "{
  \"groupOrder\": 1,
  \"items\": [
    {\"drug\": \"Glipizida\", \"dose\": \"10 mg\", \"route\": \"Oral\", \"frequency\": \"Dos veces al día con el desayuno y cena\", \"duration\": \"90 días\", \"notes\": \"Reemplaza Metformina (contraindicada TFG<45)\"},
    {\"drug\": \"Amlodipino\", \"dose\": \"10 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día\", \"duration\": \"90 días\", \"notes\": \"Continuar\"},
    {\"drug\": \"Atorvastatina\", \"dose\": \"20 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día en la noche\", \"duration\": \"90 días\", \"notes\": \"Dosis reducida por ERC\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS5_ID}/lab-orders" "{
  \"groupOrder\": 1,
  \"orders\": [
    {\"test_name\": \"Tasa de filtración glomerular (TFG) estimada\", \"indication\": \"Monitoreo ERC trimestral\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Hemoglobina glicosilada (HbA1c)\", \"indication\": \"Control DM2\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Microalbuminuria en orina de 24h\", \"indication\": \"Estadificación proteinuria ERC\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"urine\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS5_ID}/sign" '{}' > /dev/null
ok "Consult 5 signed — Miguel Herrera (ERC+DM2)"

# Consult 6 — Francisco Soto cardiopatía (signed)
CONS6=$(post "/v1/consultations" "{
  \"patientId\": \"${PT10_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"appointmentId\": \"${APT_P6_ID}\",
  \"chiefComplaint\": \"Control anual post-stent. Sin síntomas.\",
  \"subjective\": \"Masculino 78 años con cardiopatía isquémica crónica. Stent coronario 2019. Actualmente solo ASA 100mg. Sin angina, sin disnea de reposo. Camina 20 min sin síntomas.\",
  \"objective\": \"PA: 130/80 mmHg. FC: 68 lpm. Peso: 75 kg. Soplo sistólico aórtico 2/6. Sin S3.\",
  \"assessment\": \"Cardiopatía isquémica crónica estable. Control adecuado.\",
  \"plan\": \"1. Continuar ASA 100mg. 2. Continuar Atorvastatina 40mg. 3. Ecocardiograma anual. 4. Prueba de esfuerzo si empeoran síntomas. 5. Próximo control en 6 meses.\",
  \"vitals\": {\"bloodPressureSystolic\": 130, \"bloodPressureDiastolic\": 80, \"heartRate\": 68, \"weightKg\": 75},
  \"diagnoses\": [\"Cardiopatía isquémica crónica estable\"]
}")
CONS6_ID=$(echo "$CONS6" | jq -r '.data.id')

post "/v1/consultations/${CONS6_ID}/prescriptions" "{
  \"groupOrder\": 1,
  \"items\": [
    {\"drug\": \"Ácido acetilsalicílico\", \"dose\": \"100 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día con el desayuno\", \"duration\": \"180 días\", \"notes\": \"Antiagregante plaquetario de por vida\"},
    {\"drug\": \"Atorvastatina\", \"dose\": \"40 mg\", \"route\": \"Oral\", \"frequency\": \"Una vez al día en la noche\", \"duration\": \"180 días\", \"notes\": \"Meta LDL <70 mg/dL\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS6_ID}/imaging-orders" "{
  \"groupOrder\": 1,
  \"orders\": [
    {\"study_type\": \"Ecocardiograma transtorácico\", \"indication\": \"Control anual función ventricular post-stent\", \"urgency\": \"routine\", \"contrast\": false, \"fasting_required\": false, \"special_instructions\": \"Comparar con ecocardiograma previo de 2025\"}
  ]
}" > /dev/null

post "/v1/consultations/${CONS6_ID}/sign" '{}' > /dev/null
ok "Consult 6 signed — Francisco Soto (cardiopatía)"

# Consult 7 — Carmen López chequeo general (draft — not yet signed)
CONS7=$(post "/v1/consultations" "{
  \"patientId\": \"${PT9_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"appointmentId\": \"${APT_P9_ID}\",
  \"chiefComplaint\": \"Chequeo general anual\",
  \"subjective\": \"Femenina 31 años sin antecedentes patológicos. Viene por chequeo de rutina. Refiere fatiga ocasional que atribuye al trabajo. Sin síntomas cardiorrespiratorios ni digestivos. No fuma, bebe socialmente.\",
  \"objective\": \"PA: 112/70 mmHg. FC: 72 lpm. Peso: 60 kg. Talla: 165 cm. IMC: 22.0. Examen físico normal.\",
  \"assessment\": \"Paciente sana. Leve fatiga que puede corresponder a anemia ferropénica leve o simplemente estrés laboral.\",
  \"plan\": \"1. Hemograma para descartar anemia. 2. Perfil tiroideo. 3. Vitamina B12 y D. 4. Consejería sobre higiene del sueño y manejo del estrés.\",
  \"vitals\": {\"bloodPressureSystolic\": 112, \"bloodPressureDiastolic\": 70, \"heartRate\": 72, \"weightKg\": 60, \"heightCm\": 165},
  \"diagnoses\": [\"Chequeo general — sin hallazgos significativos\", \"Fatiga a estudiar\"]
}")
CONS7_ID=$(echo "$CONS7" | jq -r '.data.id')

post "/v1/consultations/${CONS7_ID}/lab-orders" "{
  \"groupOrder\": 1,
  \"orders\": [
    {\"test_name\": \"Hemograma completo\", \"indication\": \"Descartar anemia\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"TSH (hormona estimulante de tiroides)\", \"indication\": \"Tamizaje hipotiroidismo en fatiga\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Vitamina B12\", \"indication\": \"Descartar déficit en fatiga\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"},
    {\"test_name\": \"Vitamina D 25-OH\", \"indication\": \"Tamizaje déficit vitamínico\", \"urgency\": \"routine\", \"fasting_required\": false, \"sample_type\": \"blood\"}
  ]
}" > /dev/null
ok "Consult 7 DRAFT — Carmen López (chequeo general) — labs pendientes"

# Consult 8 — Isabel Cruz SII/ansiedad (draft)
CONS8=$(post "/v1/consultations" "{
  \"patientId\": \"${PT7_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"appointmentId\": \"${APT_P10_ID}\",
  \"chiefComplaint\": \"Dolor abdominal recurrente y diarrea alternando con estreñimiento\",
  \"subjective\": \"Femenina 38 años con SII diagnósticado. Dolor periumbilical recurrente, evacuaciones 3-5 x día alternando con estreñimiento. Ansiedad generalizada en control con psicóloga. Refiere que estrés laboral empeora síntomas digestivos.\",
  \"objective\": \"PA: 118/76. FC: 84. Abdomen blando, dolor leve a palpación en fosa ilíaca derecha. Ruidos intestinales aumentados. Sin signos de alarma.\",
  \"assessment\": \"SII patrón mixto activo. Asociación clara con ansiedad.\",
  \"plan\": \"1. Mebeverina 135mg TID AC. 2. Rifaximina 400mg TID x10 días si no mejora. 3. Coordinación con psicología. 4. Dieta baja en FODMAP.\",
  \"vitals\": {\"bloodPressureSystolic\": 118, \"bloodPressureDiastolic\": 76, \"heartRate\": 84, \"weightKg\": 62},
  \"diagnoses\": [\"Síndrome de intestino irritable patrón mixto\", \"Ansiedad generalizada\"]
}")
CONS8_ID=$(echo "$CONS8" | jq -r '.data.id')
ok "Consult 8 DRAFT — Isabel Cruz (SII)"

# ─── 6. Invoices ──────────────────────────────────────────────────────────────
step "6/8  Invoices (8)"

# Paid invoices (2)
INV1=$(post "/v1/invoices" "{
  \"patientId\": \"${PT1_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"consultationId\": \"${CONS1_ID}\",
  \"currency\": \"DOP\",
  \"items\": [{\"description\": \"Consulta médica de control — HTA/DM2\", \"quantity\": 1, \"unitPrice\": 3500, \"total\": 3500}]
}")
INV1_ID=$(echo "$INV1" | jq -r '.data.id')
patch "/v1/invoices/${INV1_ID}/status" '{"status":"issued"}' > /dev/null
patch "/v1/invoices/${INV1_ID}/status" '{"status":"paid","paymentMethod":"cash"}' > /dev/null
ok "Invoice 1 PAID — Ana Reyes — RD\$ 3,500"

INV2=$(post "/v1/invoices" "{
  \"patientId\": \"${PT2_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"consultationId\": \"${CONS2_ID}\",
  \"currency\": \"DOP\",
  \"items\": [{\"description\": \"Consulta médica de control — dislipidemia\", \"quantity\": 1, \"unitPrice\": 3500, \"total\": 3500}]
}")
INV2_ID=$(echo "$INV2" | jq -r '.data.id')
patch "/v1/invoices/${INV2_ID}/status" '{"status":"issued"}' > /dev/null
patch "/v1/invoices/${INV2_ID}/status" '{"status":"paid","paymentMethod":"card"}' > /dev/null
ok "Invoice 2 PAID — Carlos Martínez — RD\$ 3,500"

INV3=$(post "/v1/invoices" "{
  \"patientId\": \"${PT4_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"consultationId\": \"${CONS3_ID}\",
  \"currency\": \"DOP\",
  \"items\": [
    {\"description\": \"Consulta médica de control — ICC\", \"quantity\": 1, \"unitPrice\": 5000, \"total\": 5000},
    {\"description\": \"Electrocardiograma de 12 derivaciones\", \"quantity\": 1, \"unitPrice\": 1500, \"total\": 1500}
  ]
}")
INV3_ID=$(echo "$INV3" | jq -r '.data.id')
patch "/v1/invoices/${INV3_ID}/status" '{"status":"issued"}' > /dev/null
patch "/v1/invoices/${INV3_ID}/status" '{"status":"paid","paymentMethod":"transfer"}' > /dev/null
ok "Invoice 3 PAID — Pedro Álvarez — RD\$ 6,500"

# Issued invoices (3)
INV4=$(post "/v1/invoices" "{
  \"patientId\": \"${PT5_ID}\",
  \"locationId\": \"${LOC2_ID}\",
  \"consultationId\": \"${CONS4_ID}\",
  \"currency\": \"DOP\",
  \"items\": [
    {\"description\": \"Consulta médica — crisis asmática\", \"quantity\": 1, \"unitPrice\": 3000, \"total\": 3000},
    {\"description\": \"Nebulización con salbutamol\", \"quantity\": 1, \"unitPrice\": 800, \"total\": 800}
  ]
}")
INV4_ID=$(echo "$INV4" | jq -r '.data.id')
patch "/v1/invoices/${INV4_ID}/status" '{"status":"issued"}' > /dev/null
ok "Invoice 4 ISSUED — Laura Fernández — RD\$ 3,800"

INV5=$(post "/v1/invoices" "{
  \"patientId\": \"${PT8_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"consultationId\": \"${CONS5_ID}\",
  \"currency\": \"DOP\",
  \"items\": [{\"description\": \"Consulta médica de control — ERC/DM2\", \"quantity\": 1, \"unitPrice\": 3500, \"total\": 3500}]
}")
INV5_ID=$(echo "$INV5" | jq -r '.data.id')
patch "/v1/invoices/${INV5_ID}/status" '{"status":"issued"}' > /dev/null
ok "Invoice 5 ISSUED — Miguel Herrera — RD\$ 3,500"

INV6=$(post "/v1/invoices" "{
  \"patientId\": \"${PT10_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"consultationId\": \"${CONS6_ID}\",
  \"currency\": \"DOP\",
  \"items\": [{\"description\": \"Consulta médica anual — cardiopatía isquémica\", \"quantity\": 1, \"unitPrice\": 5000, \"total\": 5000}]
}")
INV6_ID=$(echo "$INV6" | jq -r '.data.id')
patch "/v1/invoices/${INV6_ID}/status" '{"status":"issued"}' > /dev/null
ok "Invoice 6 ISSUED — Francisco Soto — RD\$ 5,000"

# Draft invoices (2)
post "/v1/invoices" "{
  \"patientId\": \"${PT9_ID}\",
  \"locationId\": \"${LOC3_ID}\",
  \"currency\": \"DOP\",
  \"items\": [{\"description\": \"Chequeo médico general\", \"quantity\": 1, \"unitPrice\": 5000, \"total\": 5000}]
}" > /dev/null
ok "Invoice 7 DRAFT — Carmen López — RD\$ 5,000"

post "/v1/invoices" "{
  \"patientId\": \"${PT7_ID}\",
  \"locationId\": \"${LOC1_ID}\",
  \"currency\": \"DOP\",
  \"items\": [{\"description\": \"Consulta médica — SII\", \"quantity\": 1, \"unitPrice\": 3500, \"total\": 3500}]
}" > /dev/null
ok "Invoice 8 DRAFT — Isabel Cruz — RD\$ 3,500"

# ─── 7. Protocols ─────────────────────────────────────────────────────────────
step "7/8  Protocols (5 with content)"

# Get the default protocol types created during onboarding
TYPES_RESP=$(get "/v1/protocol-types")
TYPE_EMERGENCIA=$(echo "$TYPES_RESP" | jq -r '.data[] | select(.name == "Emergencia") | .id')
TYPE_DIAGNOSTICO=$(echo "$TYPES_RESP" | jq -r '.data[] | select(.name == "Diagnóstico") | .id')
TYPE_MEDICACION=$(echo "$TYPES_RESP" | jq -r '.data[] | select(.name == "Medicación") | .id')
TYPE_PROCEDIMIENTO=$(echo "$TYPES_RESP" | jq -r '.data[] | select(.name == "Procedimiento") | .id')
TYPE_FISIOTERAPIA=$(echo "$TYPES_RESP" | jq -r '.data[] | select(.name == "Fisioterapia") | .id')

ok "Protocol types resolved: Emergencia=${TYPE_EMERGENCIA} Diagnóstico=${TYPE_DIAGNOSTICO}"

# Protocol 1 — Manejo de Anafilaxia (Emergencia)
PROT1=$(post "/v1/protocols" "{\"typeId\": \"${TYPE_EMERGENCIA}\", \"title\": \"Manejo de Anafilaxia en Adultos\"}")
PROT1_ID=$(echo "$PROT1" | jq -r '.data.id')

post "/v1/protocols/${PROT1_ID}/versions" '{
  "publish": true,
  "changeSummary": "Versión inicial basada en guías WAO 2025",
  "content": {
    "version": "1.0",
    "template_version": "1.0",
    "blocks": [
      {
        "id": "sec_indications",
        "type": "section",
        "title": "Indicaciones",
        "blocks": [
          {
            "id": "blk_ind_01",
            "type": "text",
            "content": "Reacción alérgica sistémica aguda con compromiso de al menos 2 sistemas orgánicos. Criterios: urticaria generalizada + disnea o hipotensión; angioedema laríngeo; anafilaxia por exposición a alérgeno conocido."
          }
        ]
      },
      {
        "id": "sec_contraindications",
        "type": "section",
        "title": "Contraindicaciones Relativas",
        "blocks": [
          {
            "id": "blk_contra_01",
            "type": "alert",
            "severity": "danger",
            "title": "Sin contraindicaciones absolutas para epinefrina en anafilaxia",
            "content": "En anafilaxia, el beneficio de la epinefrina siempre supera el riesgo. No retrasar por ninguna comorbilidad cardíaca."
          }
        ]
      },
      {
        "id": "sec_assessment",
        "type": "section",
        "title": "Evaluación Inicial — ABC",
        "blocks": [
          {
            "id": "blk_asm_01",
            "type": "checklist",
            "title": "Evaluación primaria rápida",
            "items": [
              {"id": "itm_01", "text": "Permeabilidad de vía aérea (estridor, angioedema)", "critical": true},
              {"id": "itm_02", "text": "Trabajo respiratorio (sibilancias, SpO2)", "critical": true},
              {"id": "itm_03", "text": "Circulación: pulso, PA, llene capilar", "critical": true},
              {"id": "itm_04", "text": "Estado de consciencia (AVPU)", "critical": true},
              {"id": "itm_05", "text": "Exposición a alérgeno identificada", "critical": false}
            ]
          }
        ]
      },
      {
        "id": "sec_intervention",
        "type": "section",
        "title": "Intervención",
        "blocks": [
          {
            "id": "blk_warn_01",
            "type": "alert",
            "severity": "warning",
            "title": "Tiempo crítico",
            "content": "Administrar epinefrina PRIMERO. Antihistamínicos y corticosteroides son adyuvantes, nunca reemplazo. Cada minuto de retraso aumenta mortalidad."
          },
          {
            "id": "blk_int_meds",
            "type": "dosage_table",
            "title": "Medicamentos de primera línea",
            "columns": ["drug","dose","route","frequency","notes"],
            "rows": [
              {"id":"row_01","drug":"Epinefrina","dose":"0.3 mg (0.3 mL de 1:1000)","route":"IM muslo lateral","frequency":"Cada 5-15 min PRN","notes":"Máximo 3 dosis. Si no hay respuesta → IV"},
              {"id":"row_02","drug":"Difenhidramina","dose":"25-50 mg","route":"IV o IM","frequency":"Una sola dosis","notes":"Adyuvante — no sustituye epinefrina"},
              {"id":"row_03","drug":"Metilprednisolona","dose":"125 mg","route":"IV","frequency":"Una sola dosis","notes":"Previene recurrencia bifásica"},
              {"id":"row_04","drug":"Salbutamol","dose":"2.5 mg","route":"Nebulizado","frequency":"Cada 20 min PRN","notes":"Solo si broncoespasmo prominente"}
            ]
          },
          {
            "id": "blk_steps_01",
            "type": "steps",
            "title": "Secuencia de manejo",
            "steps": [
              {"id":"stp_01","order":1,"title":"Posición","detail":"Supino + piernas elevadas 30° (shock). Fowler si dificultad respiratoria predominante."},
              {"id":"stp_02","order":2,"title":"Epinefrina IM","detail":"Músculo vasto externo, anterolateral del muslo. Registrar hora."},
              {"id":"stp_03","order":3,"title":"Oxígeno","detail":"Mascarilla no recirculante a 15 L/min. Meta SpO2 ≥95%."},
              {"id":"stp_04","order":4,"title":"Acceso IV x2","detail":"Grueso calibre. Bolo SF 0.9% 1-2L si hipotensión."},
              {"id":"stp_05","order":5,"title":"Monitoreo","detail":"ECG, SpO2, PA cada 5 min durante la primera hora."},
              {"id":"stp_06","order":6,"title":"Observación mínima","detail":"4 horas post-resolución por anafilaxia bifásica. 24h si grave."}
            ]
          }
        ]
      },
      {
        "id": "sec_escalation",
        "type": "section",
        "title": "Criterios de Escalada",
        "blocks": [
          {
            "id": "blk_esc_01",
            "type": "decision",
            "condition": "¿Respuesta adecuada a epinefrina IM x1-2 dosis?",
            "branches": [
              {"id":"brn_si","label":"Sí — mejora clínica","action":"Continuar observación 4-6 horas. Prescribir antihistamínico oral x5 días + corticosteroide oral x3 días. Referir a alergología. Prescribir autoinyector de epinefrina (EpiPen)."},
              {"id":"brn_no","label":"No — anafilaxia refractaria","action":"Activar código de emergencias. Epinefrina IV infusión continua. Glucagón si beta-bloqueado. Considerar intubación/IOT. Traslado inmediato a UCI."}
            ]
          }
        ]
      }
    ]
  }
}' > /dev/null
ok "Protocol 1 published — Manejo de Anafilaxia → ${PROT1_ID}"

# Protocol 2 — Evaluación de Dolor Torácico Agudo (Diagnóstico)
PROT2=$(post "/v1/protocols" "{\"typeId\": \"${TYPE_DIAGNOSTICO}\", \"title\": \"Evaluación de Dolor Torácico Agudo\"}")
PROT2_ID=$(echo "$PROT2" | jq -r '.data.id')

post "/v1/protocols/${PROT2_ID}/versions" '{
  "publish": true,
  "changeSummary": "Versión inicial — guías ACC/AHA 2024",
  "content": {
    "version": "1.0",
    "template_version": "1.0",
    "blocks": [
      {
        "id": "sec_presentation",
        "type": "section",
        "title": "Presentación",
        "blocks": [
          {
            "id": "blk_pres_01",
            "type": "text",
            "content": "Algoritmo para estratificación de riesgo en dolor torácico agudo. Objetivo primario: descartar STEMI, disección aórtica y TEP masivo en la primera evaluación."
          }
        ]
      },
      {
        "id": "sec_redflags",
        "type": "section",
        "title": "Signos de Alarma Inmediata",
        "blocks": [
          {
            "id": "blk_rf_check",
            "type": "checklist",
            "title": "Evaluar en primeros 10 minutos:",
            "items": [
              {"id":"itm_rf_01","text":"Dolor opresivo irradiado a brazo izquierdo o mandíbula","critical":true},
              {"id":"itm_rf_02","text":"Diaforesis y náuseas asociadas","critical":true},
              {"id":"itm_rf_03","text":"PA sistólica <90 mmHg o diferencia >20 mmHg entre brazos","critical":true},
              {"id":"itm_rf_04","text":"SpO2 <92% o taquicardia sinusal inexplicada","critical":true},
              {"id":"itm_rf_05","text":"Dolor desgarrador que irradia al dorso (disección)","critical":true},
              {"id":"itm_rf_06","text":"Dolor pleurítico + disnea + factor de riesgo TEP","critical":true}
            ]
          },
          {
            "id":"blk_rf_alert",
            "type":"alert",
            "severity":"danger",
            "title":"STEMI — tiempo es músculo",
            "content":"Si EKG muestra elevación ST ≥1mm en ≥2 derivaciones contiguas: activar protocolo STEMI INMEDIATAMENTE. Meta puerta-balón <90 min."
          }
        ]
      },
      {
        "id": "sec_pathway",
        "type": "section",
        "title": "Algoritmo de Decisión",
        "blocks": [
          {
            "id": "blk_path_01",
            "type": "decision",
            "condition": "¿EKG con cambios isquémicos agudos (elevación ST, nuevo BCRI)?",
            "branches": [
              {"id":"brn_stemi","label":"Sí — STEMI o BCRI nuevo","action":"ACTIVAR PROTOCOLO STEMI. Aspirina 325mg VO stat. Heparina no fraccionada 60 U/kg IV (máx 4000U). Llamar a cardiología de guardia. Preparar para cateterismo de emergencia."},
              {"id":"brn_nstemi","label":"No — posible NSTEMI/AI","action":"Troponinas 0h, 3h, 6h. Considerar anticoagulación según score GRACE. Monitoreo continuo. Ecocardiograma urgente si inestabilidad."},
              {"id":"brn_normal","label":"EKG normal o inespecífico","action":"Troponinas seriadas. Rx tórax PA. BMP básico. Score HEART o TIMI para estratificación. Considerar causas no cardíacas (ERGE, costocondritis, ansiedad)."}
            ]
          }
        ]
      }
    ]
  }
}' > /dev/null
ok "Protocol 2 published — Evaluación Dolor Torácico → ${PROT2_ID}"

# Protocol 3 — Manejo Farmacológico HTA (Medicación)
PROT3=$(post "/v1/protocols" "{\"typeId\": \"${TYPE_MEDICACION}\", \"title\": \"Manejo Farmacológico de la Hipertensión Arterial\"}")
PROT3_ID=$(echo "$PROT3" | jq -r '.data.id')

post "/v1/protocols/${PROT3_ID}/versions" '{
  "publish": true,
  "changeSummary": "Basado en guías JNC-8 y ESC/ESH 2023",
  "content": {
    "version": "1.0",
    "template_version": "1.0",
    "blocks": [
      {
        "id": "sec_indications",
        "type": "section",
        "title": "Indicaciones",
        "blocks": [
          {
            "id": "blk_ind_01",
            "type": "text",
            "content": "Inicio o ajuste de medicación antihipertensiva. Usar en pacientes con PAS ≥140 o PAD ≥90 mmHg en ≥2 mediciones en condiciones adecuadas, o PAS ≥130/80 en DM o ERC."
          }
        ]
      },
      {
        "id": "sec_warnings",
        "type": "section",
        "title": "Advertencias y Contraindicaciones",
        "blocks": [
          {
            "id": "blk_warn_eca",
            "type": "alert",
            "severity": "danger",
            "title": "IECAs y ARAs — contraindicados en embarazo",
            "content": "Losartán, Enalapril y similares son TERATOGÉNICOS. Confirmar no embarazo antes de prescribir. Si mujer en edad fértil, usar método anticonceptivo."
          },
          {
            "id": "blk_warn_bb",
            "type": "alert",
            "severity": "warning",
            "title": "Beta-bloqueadores — precaución en asma",
            "content": "Evitar en asma bronquial activa. Usar con cautela en EPOC. Si indispensable, preferir betabloqueadores cardioselectivos (Atenolol, Bisoprolol)."
          }
        ]
      },
      {
        "id": "sec_dosing",
        "type": "section",
        "title": "Esquemas de Primera Línea",
        "blocks": [
          {
            "id": "blk_dose_table",
            "type": "dosage_table",
            "title": "Antihipertensivos — dosis habituales",
            "columns": ["drug","dose","route","frequency","notes"],
            "rows": [
              {"id":"row_01","drug":"Losartán (ARA-II)","dose":"50-100 mg","route":"Oral","frequency":"Una vez al día","notes":"De elección en DM2, ERC. Monitorear K+ y creatinina."},
              {"id":"row_02","drug":"Enalapril (IECA)","dose":"5-20 mg","route":"Oral","frequency":"Una o dos veces al día","notes":"Tos seca en 10-15% — cambiar a ARA si ocurre."},
              {"id":"row_03","drug":"Amlodipino (BCC)","dose":"5-10 mg","route":"Oral","frequency":"Una vez al día","notes":"Edema perimaleolar frecuente. Buena tolerancia general."},
              {"id":"row_04","drug":"Hidroclorotiazida","dose":"12.5-25 mg","route":"Oral","frequency":"Una vez al día en la mañana","notes":"Monitorear Na+, K+, glucosa y ácido úrico."},
              {"id":"row_05","drug":"Carvedilol (BB no selectivo)","dose":"6.25-25 mg","route":"Oral","frequency":"Dos veces al día con comidas","notes":"De elección en ICC + HTA. Titular gradualmente."}
            ]
          }
        ]
      },
      {
        "id": "sec_decision",
        "type": "section",
        "title": "Algoritmo de Elección",
        "blocks": [
          {
            "id": "blk_dec_01",
            "type": "decision",
            "condition": "¿Paciente tiene diabetes mellitus tipo 2 o enfermedad renal crónica?",
            "branches": [
              {"id":"brn_si","label":"Sí — DM2 o ERC","action":"Primera línea: IECA (Enalapril) o ARA-II (Losartán). Protección renal demostrada. Meta PA <130/80. Si no alcanza meta con 1 fármaco, agregar BCC (Amlodipino)."},
              {"id":"brn_no","label":"No — HTA sin comorbilidades","action":"Primera línea: cualquier clase. Considerar Tiazida (Hidroclorotiazida) en >60 años. ARA o IECA en <60. Si no alcanza meta, combinación IECA/ARA + BCC."}
            ]
          }
        ]
      },
      {
        "id": "sec_monitoring",
        "type": "section",
        "title": "Monitoreo",
        "blocks": [
          {
            "id": "blk_mon_01",
            "type": "checklist",
            "title": "Controles en cada visita:",
            "items": [
              {"id":"itm_m01","text":"PA en ambos brazos, 2 mediciones separadas 5 min","critical":true},
              {"id":"itm_m02","text":"Peso corporal y cálculo de IMC","critical":false},
              {"id":"itm_m03","text":"Creatinina y electrolitos (con IECAs/ARAs)","critical":true},
              {"id":"itm_m04","text":"Cumplimiento terapéutico y efectos adversos","critical":true}
            ]
          }
        ]
      }
    ]
  }
}' > /dev/null
ok "Protocol 3 published — Manejo Farmacológico HTA → ${PROT3_ID}"

# Protocol 4 — Infiltración Articular (Procedimiento)
PROT4=$(post "/v1/protocols" "{\"typeId\": \"${TYPE_PROCEDIMIENTO}\", \"title\": \"Infiltración Articular con Corticosteroide\"}")
PROT4_ID=$(echo "$PROT4" | jq -r '.data.id')

post "/v1/protocols/${PROT4_ID}/versions" '{
  "publish": true,
  "changeSummary": "Técnica estándar para rodilla, hombro y tobillo",
  "content": {
    "version": "1.0",
    "template_version": "1.0",
    "blocks": [
      {
        "id": "sec_indications",
        "type": "section",
        "title": "Indicaciones",
        "blocks": [
          {
            "id": "blk_ind_01",
            "type": "text",
            "content": "Artritis inflamatoria activa (AR, gota, artritis reactiva), osteoartritis sintomática con respuesta insuficiente a AINEs orales, bursitis, tendinopatías crónicas. Máximo 3-4 infiltraciones por articulación por año."
          }
        ]
      },
      {
        "id": "sec_preparation",
        "type": "section",
        "title": "Preparación",
        "blocks": [
          {
            "id": "blk_prep_check",
            "type": "checklist",
            "title": "Lista de verificación pre-procedimiento:",
            "items": [
              {"id":"itm_p01","text":"Consentimiento informado firmado","critical":true},
              {"id":"itm_p02","text":"Descartar infección local (celulitis, septic arthritis)","critical":true},
              {"id":"itm_p03","text":"Verificar alergias a anestésicos locales y corticosteroides","critical":true},
              {"id":"itm_p04","text":"PA y glucosa si paciente diabético","critical":true},
              {"id":"itm_p05","text":"Suspender anticoagulantes orales 3-5 días si es posible","critical":false},
              {"id":"itm_p06","text":"Preparar campo estéril y material","critical":true}
            ]
          },
          {
            "id": "blk_prep_alert",
            "type": "alert",
            "severity": "info",
            "title": "Material necesario",
            "content": "Jeringa 5mL + aguja 21G o 23G, solución corticosteroide (Betametasona 6mg/mL o Triamcinolona 40mg/mL), Lidocaína 2% 1-2mL, guantes estériles, gasa, clorhexidina."
          }
        ]
      },
      {
        "id": "sec_steps",
        "type": "section",
        "title": "Técnica del Procedimiento",
        "blocks": [
          {
            "id": "blk_stp_01",
            "type": "steps",
            "title": "Pasos — Rodilla (acceso superolateral):",
            "steps": [
              {"id":"stp_01","order":1,"title":"Posicionamiento","detail":"Paciente decúbito supino, rodilla extendida o en ligera flexión (20°). Marcar el punto de entrada: borde superior de la rótula, 1 cm lateral."},
              {"id":"stp_02","order":2,"title":"Asepsia","detail":"Limpiar zona con clorhexidina. Circular hacia afuera x3 veces. Colocar campo estéril."},
              {"id":"stp_03","order":3,"title":"Anestesia local","detail":"Infiltrar piel y tejido subcutáneo con Lidocaína 2% 1mL. Esperar 30 segundos."},
              {"id":"stp_04","order":4,"title":"Aspiración","detail":"Si derrame articular: aspirar líquido antes de inyectar. Enviar a análisis si es primera vez."},
              {"id":"stp_05","order":5,"title":"Infiltración","detail":"Inyectar solución corticosteroide + Lidocaína. Resistencia mínima = posición intraarticular correcta. No forzar."},
              {"id":"stp_06","order":6,"title":"Post-procedimiento","detail":"Movilizar articulación suavemente. Comprimir 2 min. Cubrir con gasa estéril. Observar 15 min."}
            ]
          }
        ]
      },
      {
        "id": "sec_post",
        "type": "section",
        "title": "Instrucciones Post-procedimiento",
        "blocks": [
          {
            "id": "blk_post_check",
            "type": "checklist",
            "title": "Indicaciones al paciente:",
            "items": [
              {"id":"itm_po01","text":"Reposo relativo de la articulación 24-48 horas","critical":false},
              {"id":"itm_po02","text":"Hielo local 15 min cada 4 horas el primer día","critical":false},
              {"id":"itm_po03","text":"Consultar si: fiebre, enrojecimiento, dolor severo (signos de infección)","critical":true},
              {"id":"itm_po04","text":"Efecto analgésico inicia en 24-48h, antiinflamatorio en 3-5 días","critical":false},
              {"id":"itm_po05","text":"No infiltrar misma articulación en <3 meses","critical":true}
            ]
          }
        ]
      }
    ]
  }
}' > /dev/null
ok "Protocol 4 published — Infiltración Articular → ${PROT4_ID}"

# Protocol 5 — Rehabilitación de Hombro Post-Impingement (Fisioterapia)
PROT5=$(post "/v1/protocols" "{\"typeId\": \"${TYPE_FISIOTERAPIA}\", \"title\": \"Rehabilitación de Hombro — Síndrome de Impingement\"}")
PROT5_ID=$(echo "$PROT5" | jq -r '.data.id')

post "/v1/protocols/${PROT5_ID}/versions" '{
  "publish": true,
  "changeSummary": "Protocolo de 3 fases — 8-12 semanas",
  "content": {
    "version": "1.0",
    "template_version": "1.0",
    "blocks": [
      {
        "id": "sec_goals",
        "type": "section",
        "title": "Objetivos del Tratamiento",
        "blocks": [
          {
            "id": "blk_goals_01",
            "type": "text",
            "content": "Fase 1 (sem 1-3): alivio del dolor y recuperación de rango de movimiento pasivo. Fase 2 (sem 4-7): fortalecimiento del manguito rotador y estabilizadores escapulares. Fase 3 (sem 8-12): retorno a actividades funcionales y deportivas."
          }
        ]
      },
      {
        "id": "sec_assessment",
        "type": "section",
        "title": "Evaluación Funcional",
        "blocks": [
          {
            "id": "blk_eval_check",
            "type": "checklist",
            "title": "Medir en cada sesión:",
            "items": [
              {"id":"itm_ev01","text":"Dolor en escala EVA (0-10) en reposo y movimiento","critical":true},
              {"id":"itm_ev02","text":"Rango de movimiento activo y pasivo (flexión, abducción, rotación)","critical":true},
              {"id":"itm_ev03","text":"Fuerza del manguito rotador (RER, RIR, ABD)","critical":true},
              {"id":"itm_ev04","text":"Score DASH o ASES para funcionalidad","critical":false}
            ]
          }
        ]
      },
      {
        "id": "sec_progression",
        "type": "section",
        "title": "Criterios de Progresión",
        "blocks": [
          {
            "id": "blk_prog_01",
            "type": "decision",
            "condition": "¿Dolor EVA ≤3/10 y flexión activa ≥120°?",
            "branches": [
              {"id":"brn_si","label":"Sí — avanzar a Fase 2","action":"Iniciar ejercicios de fortalecimiento isotónico. Agregar Theraband grado inicial. Aumentar carga progresivamente según tolerancia."},
              {"id":"brn_no","label":"No — mantener Fase 1","action":"Continuar movilización pasiva y analgesia física. Reevaluar en 1 semana. Considerar infiltración si EVA >6/10 persistente."}
            ]
          }
        ]
      },
      {
        "id": "sec_plan",
        "type": "section",
        "title": "Plan de Tratamiento — Fase 1",
        "blocks": [
          {
            "id": "blk_plan_01",
            "type": "steps",
            "title": "Sesión de Fase 1 (45 min):",
            "steps": [
              {"id":"stp_01","order":1,"title":"Termoterapia","detail":"Calor húmedo en hombro afectado 10-15 min. Reduce espasmo muscular y facilita movilización."},
              {"id":"stp_02","order":2,"title":"Movilización glenohumeral","detail":"Distracción caudal y deslizamientos A-P y P-A grado III-IV. 3 series x 10 repeticiones."},
              {"id":"stp_03","order":3,"title":"Pendular de Codman","detail":"Paciente inclinado 45°, brazo péndulo. Círculos pequeños 2x30 seg, flexo-extensión 2x30 seg."},
              {"id":"stp_04","order":4,"title":"Estiramiento capsular posterior","detail":"Brazos cruzados sobre el pecho, llevar codo hacia hombro contralateral. Mantener 30 seg x3."},
              {"id":"stp_05","order":5,"title":"TENS analgésico","detail":"Electrodos paravertebrales C5-C6 + hombro anterior. 80Hz, 100μs, 20 min."},
              {"id":"stp_06","order":6,"title":"Crioterapia final","detail":"Hielo sobre espacio subacromial 10 min. Nunca directo — envuelto en tela."}
            ]
          }
        ]
      },
      {
        "id": "sec_home",
        "type": "section",
        "title": "Programa de Ejercicios en Casa",
        "blocks": [
          {
            "id": "blk_home_01",
            "type": "steps",
            "title": "Ejercicios diarios (15 min, 2 veces al día):",
            "steps": [
              {"id":"stp_h01","order":1,"title":"Péndulos de Codman","detail":"2 minutos. Círculos hacia ambos lados. Sin cargar peso."},
              {"id":"stp_h02","order":2,"title":"Flexión de hombro asistida","detail":"Usar palo de escoba. Brazo sano ayuda al afectado. Subir hasta tolerancia x10."},
              {"id":"stp_h03","order":3,"title":"Estiramiento capsular posterior","detail":"Brazo cruzado sobre pecho x30 seg. 3 repeticiones."},
              {"id":"stp_h04","order":4,"title":"Retracción escapular","detail":"Juntar omóplatos manteniendo 5 seg. x15. Fundamental para mecánica del hombro."}
            ]
          }
        ]
      },
      {
        "id": "sec_precautions",
        "type": "section",
        "title": "Precauciones",
        "blocks": [
          {
            "id": "blk_prec_01",
            "type": "text",
            "content": "EVITAR: elevar brazo por encima del hombro con carga, movimientos de impingement (brazo elevado con rotación interna — arco doloroso 70-120°), actividades que reproduzcan el dolor agudo. Si dolor >4/10 durante ejercicio: detener y consultar."
          }
        ]
      }
    ]
  }
}' > /dev/null
ok "Protocol 5 published — Rehabilitación Hombro → ${PROT5_ID}"

# Mark protocols 1 and 3 as favorites
post "/v1/protocols/${PROT1_ID}/favorite" '{}' > /dev/null
post "/v1/protocols/${PROT3_ID}/favorite" '{}' > /dev/null
ok "Protocols 1 & 3 marked as favorites"

# ─── 8. Summary ───────────────────────────────────────────────────────────────
step "8/8  Done"

echo ""
echo "${BOLD}${GREEN}✅ Seed complete${RESET}"
echo ""
echo "  Tenant  : ${TENANT_ID}"
echo "  User    : ${USER_ID}"
echo ""
echo "  Locations     : 3  (Centro Médico Nacional, Clínica Santiago Apóstol, Consultorio Privado)"
echo "  Patients      : 10 (HTA, DM2, ICC, asma, ERC, cardiopatía, SII, chequeo)"
echo "  Appointments  : 18 (10 completed past, 8 upcoming)"
echo "  Consultations : 8  (6 signed, 2 draft)"
echo "  Prescriptions : 7  (rx groups across consultations)"
echo "  Lab orders    : 5  (order groups across consultations)"
echo "  Imaging orders: 3  (order groups across consultations)"
echo "  Invoices      : 8  (3 paid, 3 issued, 2 draft)"
echo "  Protocols     : 5  (1 published per type; 2 favorited)"
echo ""
echo "  Login: ${EMAIL} / ${PASSWORD}"
echo "  API:   ${API}"
echo ""
