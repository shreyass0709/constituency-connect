import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Runs via `prisma db seed` (tsx). Idempotent: every write is an upsert keyed on a
// natural unique or a fixed id, so re-running never duplicates.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// SLA targets per category: [acknowledgeHours, resolveDays].
const SLA: Record<string, [number, number]> = {
  ROAD: [24, 7],
  DRAINAGE: [24, 5],
  STREET_LIGHT: [24, 3],
  WATER: [12, 3],
  ELECTRICITY: [12, 2],
  GARBAGE: [24, 2],
  SCHOOL: [48, 14],
  HOSPITAL: [12, 5],
  PENSION: [48, 30],
  HOUSING: [48, 30],
  PUBLIC_SAFETY: [6, 2],
  TRANSPORT: [48, 10],
  AGRICULTURE: [48, 14],
  ENVIRONMENT: [48, 10],
  OTHER: [48, 14],
};

// Department slug -> { name, categories it owns by default }.
const DEPARTMENTS = [
  { slug: "public-works", name: "Public Works", categories: ["ROAD", "DRAINAGE", "TRANSPORT"] },
  { slug: "water-supply", name: "Water Supply", categories: ["WATER"] },
  { slug: "electricity", name: "Electricity", categories: ["STREET_LIGHT", "ELECTRICITY"] },
  { slug: "sanitation", name: "Sanitation", categories: ["GARBAGE", "ENVIRONMENT"] },
  { slug: "health", name: "Health", categories: ["HOSPITAL", "PUBLIC_SAFETY"] },
  { slug: "education", name: "Education", categories: ["SCHOOL"] },
  { slug: "social-welfare", name: "Social Welfare", categories: ["PENSION", "HOUSING", "AGRICULTURE"] },
] as const;

async function main() {
  // ── Representative (single-tenant row) ──
  await db.representative.upsert({
    where: { id: "rep-1" },
    update: {},
    create: {
      id: "rep-1",
      name: "Hon. A. Kumar",
      type: "MLA",
      constituencyName: "Model Constituency",
      party: "Independent",
      bio: "Serving the constituency with a focus on visible, accountable outcomes.",
      vision: "Every civic issue heard, triaged, and resolved — in the open.",
      contactEmail: "office@constituency.example",
      officeHours: "Mon–Sat, 10:00–17:00",
    },
  });

  // ── Wards + villages ──
  const wards = [
    { number: 1, name: "Ward 1 — Market" },
    { number: 7, name: "Ward 7 — Riverside" },
    { number: 12, name: "Ward 12 — Hilltop" },
  ];
  for (const w of wards) {
    await db.ward.upsert({ where: { number: w.number }, update: { name: w.name }, create: w });
  }
  const ward1 = await db.ward.findUniqueOrThrow({ where: { number: 1 } });
  const ward7 = await db.ward.findUniqueOrThrow({ where: { number: 7 } });
  const villages = [
    { id: "vil-1a", name: "Central Bazaar", wardId: ward1.id },
    { id: "vil-7a", name: "Riverside East", wardId: ward7.id },
  ];
  for (const v of villages) {
    await db.village.upsert({ where: { id: v.id }, update: { name: v.name }, create: v });
  }

  // ── Departments ──
  for (const d of DEPARTMENTS) {
    await db.department.upsert({
      where: { slug: d.slug },
      update: { name: d.name, categories: [...d.categories] as never },
      create: { slug: d.slug, name: d.name, categories: [...d.categories] as never },
    });
  }
  const publicWorks = await db.department.findUniqueOrThrow({ where: { slug: "public-works" } });

  // ── SLA policies (one per category) ──
  for (const [category, [acknowledgeHours, resolveDays]] of Object.entries(SLA)) {
    await db.slaPolicy.upsert({
      where: { category: category as never },
      update: { acknowledgeHours, resolveDays },
      create: { category: category as never, acknowledgeHours, resolveDays },
    });
  }

  // ── Users: one per role (login via phone OTP once auth is wired) ──
  const users = [
    { id: "u-super", name: "Super Admin", email: "super@constituency.example", phone: "+919000000001", role: "SUPER_ADMIN" },
    { id: "u-admin", name: "Admin", email: "admin@constituency.example", phone: "+919000000002", role: "ADMIN" },
    { id: "u-rep", name: "Hon. A. Kumar", email: "rep@constituency.example", phone: "+919000000003", role: "REPRESENTATIVE" },
    { id: "u-staff", name: "Office Staff", email: "staff@constituency.example", phone: "+919000000004", role: "OFFICE_STAFF" },
    { id: "u-dept", name: "PW Dept Officer", email: "dept@constituency.example", phone: "+919000000005", role: "DEPARTMENT_OFFICER", departmentId: publicWorks.id },
    { id: "u-field", name: "PW Field Officer", email: "field@constituency.example", phone: "+919000000006", role: "FIELD_OFFICER", departmentId: publicWorks.id, wardId: ward1.id },
    { id: "u-cit1", name: "Ravi Citizen", email: "ravi@example.com", phone: "+919000000101", role: "CITIZEN", wardId: ward1.id },
    { id: "u-cit2", name: "Sita Citizen", email: "sita@example.com", phone: "+919000000102", role: "CITIZEN", wardId: ward7.id },
  ] as const;
  for (const u of users) {
    const data = {
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role as never,
      departmentId: "departmentId" in u ? u.departmentId : null,
      wardId: "wardId" in u ? u.wardId : null,
    };
    await db.user.upsert({ where: { id: u.id }, update: data, create: { id: u.id, ...data } });
  }

  // ── Sample complaints (so later phases have data; dashboards stay near-empty for M0) ──
  await db.complaint.upsert({
    where: { code: "CC-2026-00001" },
    update: {},
    create: {
      code: "CC-2026-00001",
      title: "Pothole on Market Road",
      description: "Large pothole near the bus stop causing two-wheeler skids.",
      category: "ROAD",
      status: "SUBMITTED",
      priority: "HIGH",
      citizenId: "u-cit1",
      wardId: ward1.id,
      villageId: "vil-1a",
      latitude: 12.9716,
      longitude: 77.5946,
      address: "Market Road, near bus stop",
      timeline: {
        create: [
          { id: "tl-c1-1", type: "STATUS_CHANGE", toStatus: "SUBMITTED", note: "Complaint submitted", actorId: "u-cit1" },
        ],
      },
    },
  });
  await db.complaint.upsert({
    where: { code: "CC-2026-00002" },
    update: {},
    create: {
      code: "CC-2026-00002",
      title: "Street light not working",
      description: "Two street lights out on Riverside East lane for a week.",
      category: "STREET_LIGHT",
      status: "SUBMITTED",
      priority: "MEDIUM",
      citizenId: "u-cit2",
      wardId: ward7.id,
      latitude: 12.98,
      longitude: 77.6,
      address: "Riverside East lane",
      timeline: {
        create: [
          { id: "tl-c2-1", type: "STATUS_CHANGE", toStatus: "SUBMITTED", note: "Complaint submitted", actorId: "u-cit2" },
        ],
      },
    },
  });

  // ── Action Dashboard counters ──
  const stats = [
    { key: "citizens_assisted", label: "Citizens Assisted", value: 0, autoComputed: true, sortOrder: 1 },
    { key: "roads_improved", label: "Roads Improved", value: 0, autoComputed: true, sortOrder: 2 },
    { key: "trees_planted", label: "Trees Planted", value: 1200, autoComputed: false, sortOrder: 3 },
    { key: "health_camps", label: "Health Camps", value: 18, autoComputed: false, sortOrder: 4 },
  ];
  for (const s of stats) {
    await db.actionStat.upsert({ where: { key: s.key }, update: s, create: s });
  }

  // ── FAQs ──
  const faqs = [
    { id: "faq-1", question: "How do I raise a complaint?", answer: "Tap 'Raise a Concern', sign in with your phone, and follow the 3-step form.", sortOrder: 1 },
    { id: "faq-2", question: "How do I track my complaint?", answer: "Use your complaint code on the public Track page, or open 'My Complaints' after signing in.", sortOrder: 2 },
    { id: "faq-3", question: "Who resolves my issue?", answer: "The office triages it to the right department and a field officer, and you're notified at every step.", sortOrder: 3 },
  ];
  for (const f of faqs) {
    await db.faq.upsert({ where: { id: f.id }, update: f, create: f });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
