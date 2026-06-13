// ============================================================
// Joby — Occupation catalog defaults
// Used as the migration seed and as a fallback if occupation_catalog is empty.
// Keys are immutable once stored in occupation_catalog.
// ============================================================

export interface OccupationOption {
  key: string;
  label_he: string;
}

export const DEFAULT_OCCUPATIONS: OccupationOption[] = [
  { key: "waiter", label_he: "מלצרות" },
  { key: "bartender", label_he: "ברמנות" },
  { key: "hostess", label_he: "קבלת אורחים" },
  { key: "sales-promoter", label_he: "קידום מכירות" },
  { key: "cashier", label_he: "קופאות" },
  { key: "customer-service", label_he: "שירות לקוחות" },
  { key: "kitchen", label_he: "עבודת מטבח" },
  { key: "dishwashing", label_he: "שטיפת כלים" },
  { key: "courier", label_he: "שליחויות" },
  { key: "picker-packer", label_he: "ליקוט ואריזה" },
  { key: "warehouse", label_he: "עבודת מחסן" },
  { key: "steward", label_he: "סדרנות" },
  { key: "setup-teardown", label_he: "הקמה ופירוק" },
  { key: "logistics", label_he: "לוגיסטיקה" },
  { key: "driver", label_he: "נהיגה" },
  { key: "security", label_he: "אבטחה" },
  { key: "brand-promotion", label_he: "פרומוטרים" },
  { key: "events-general", label_he: "צוות אירועים כללי" },
  { key: "cleaning", label_he: "ניקיון" },
  { key: "general", label_he: "כללי" },
];
