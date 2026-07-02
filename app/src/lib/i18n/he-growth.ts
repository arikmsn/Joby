// ============================================================
// Growth Engine — Hebrew strings (admin-only namespace).
// ISOLATION RULE: imported ONLY by (admin)/growth components and
// growth API handlers — never by shared, worker, employer, or
// public bundles.
// ============================================================

const growthStrings = {
  "growth.nav.title": "צמיחה",
  "growth.nav.sources": "מקורות",
  "growth.nav.observations": "תצפיות",

  // Sources
  "growth.sources.title": "מקורות איסוף",
  "growth.sources.propose": "הצעת מקור חדש",
  "growth.sources.name": "שם המקור",
  "growth.sources.url": "כתובת (URL)",
  "growth.sources.type": "סוג מקור",
  "growth.sources.method": "שיטת איסוף",
  "growth.sources.risk": "רמת סיכון",
  "growth.sources.status": "סטטוס",
  "growth.sources.notes": "הערות TOS / robots",
  "growth.sources.approve": "אישור",
  "growth.sources.pause": "השהיה",
  "growth.sources.approved": "מאושר",
  "growth.sources.proposed": "ממתין לאישור",
  "growth.sources.paused": "מושהה",
  "growth.sources.empty": "אין מקורות עדיין — הציעו מקור ראשון",
  "growth.sources.high_risk_note": "מקור בסיכון גבוה — אישור סופר-אדמין בלבד",

  "growth.source_type.board": "לוח דרושים",
  "growth.source_type.fb_group": "קבוצת פייסבוק",
  "growth.source_type.telegram": "ערוץ טלגרם",
  "growth.source_type.career_page": "עמוד קריירה",
  "growth.source_type.agency": "חברת השמה",
  "growth.source_type.gov": "מקור ממשלתי",
  "growth.source_type.other": "אחר",

  "growth.method.manual": "ידני (אנליסט)",
  "growth.method.fetch": "איסוף אוטומטי",
  "growth.method.api": "API רשמי",

  "growth.risk.low": "נמוך",
  "growth.risk.medium": "בינוני",
  "growth.risk.high": "גבוה",

  // Observations
  "growth.obs.title": "תצפיות ביקוש",
  "growth.obs.new": "תצפית חדשה",
  "growth.obs.channel": "מקור",
  "growth.obs.observed_at": "מועד תצפית",
  "growth.obs.role_family": "משפחת תפקיד",
  "growth.obs.role_title": "כותרת תפקיד (מנורמלת)",
  "growth.obs.region": "אזור",
  "growth.obs.city": "עיר",
  "growth.obs.employer": "שם מעסיק (אם פומבי)",
  "growth.obs.employer_type": "סוג מעסיק",
  "growth.obs.employer_type.direct": "מעסיק ישיר",
  "growth.obs.employer_type.agency": "חברת השמה",
  "growth.obs.employer_type.unknown": "לא ידוע",
  "growth.obs.salary_min": "שכר מינימום",
  "growth.obs.salary_max": "שכר מקסימום",
  "growth.obs.salary_unit": "יחידת שכר",
  "growth.obs.salary_unit.hourly": "שעתי",
  "growth.obs.salary_unit.monthly": "חודשי",
  "growth.obs.shift_tags": "משמרות (בוקר/ערב/לילה/סופ״ש)",
  "growth.obs.requirements": "דרישות (רישיון/עברית/פיזי)",
  "growth.obs.urgency": "דחיפות (0-10)",
  "growth.obs.source_ref": "קישור / מזהה מקור",
  "growth.obs.raw_text": "טקסט מקור (יימחק אוטומטית לאחר 30 יום)",
  "growth.obs.raw_text_note": "עובדות בלבד! אין להעתיק נוסח מודעה לשדות אחרים",
  "growth.obs.needs_review": "ממתין לבדיקה",
  "growth.obs.duplicate": "תצפית כפולה — נרשמה כבר ב-14 הימים האחרונים",
  "growth.obs.saved": "התצפית נשמרה",
  "growth.obs.empty": "אין תצפיות עדיין",

  // Intake review queue
  "growth.nav.intake": "קליטת מועמדים",
  "growth.intake.title": "קליטת מועמדים",
  "growth.intake.pending": "ממתינים לבדיקה",
  "growth.intake.all": "הכל",
  "growth.intake.reviewed": "נבדק",
  "growth.intake.flagged": "מסומן",
  "growth.intake.mark_reviewed": "סימון כנבדק",
  "growth.intake.mark_flagged": "סימון לבירור",
  "growth.intake.unmask": "חשיפת פרטי קשר",
  "growth.intake.unmask_reason": "נימוק לחשיפה (חובה, נרשם ביומן)",
  "growth.intake.completeness": "שלמות",
  "growth.intake.consent_marketing": "הסכמת דיוור",
  "growth.intake.empty": "אין הגשות עדיין",
  "growth.intake.submitted_at": "הוגש",

  // Metrics panel (Stage 1 collection health)
  "growth.nav.metrics": "מדדים",
  "growth.metrics.title": "בריאות איסוף — שלב 1",
  "growth.metrics.obs_today": "תצפיות היום",
  "growth.metrics.obs_7d": "תצפיות 7 ימים",
  "growth.metrics.queue_depth": "ממתינות לבדיקה",
  "growth.metrics.unclassified": "לא מסווגות",
  "growth.metrics.median_review": "חציון זמן בדיקה",
  "growth.metrics.median_review_target": "יעד: עד 2 דק׳ (3 דק׳ לפריטי איסוף)",
  "growth.metrics.freshness": "טריות מקורות (48 שעות)",
  "growth.metrics.channels_title": "מקורות מאושרים — תפוקה 7 ימים",
  "growth.metrics.channel_yield": "תפוקה",
  "growth.metrics.channel_fresh": "טרי",
  "growth.metrics.channel_stale": "לא טרי",
  "growth.metrics.channel_error": "שגיאה",
  "growth.metrics.clusters_title": "אשכולות ביקוש",
  "growth.metrics.clusters_total": "סה״כ אשכולות",
  "growth.metrics.clusters_ad_worthy": "כשירים למודעה",
  "growth.metrics.cluster_obs": "תצפיות",
  "growth.metrics.cluster_employers": "מעסיקים",
  "growth.metrics.trend.rising": "בעלייה",
  "growth.metrics.trend.stable": "יציב",
  "growth.metrics.trend.falling": "בירידה",
  "growth.metrics.no_data": "אין נתונים עדיין",
  "growth.metrics.resolved_7d": "נבדקו ב-7 ימים",

  // Queue ergonomics
  "growth.obs.classify": "סיווג",
  "growth.obs.save_resolve": "שמירה וסיום בדיקה",
  "growth.obs.show_raw": "הצגת טקסט מקור",
  "growth.obs.hide_raw": "הסתרת טקסט מקור",
  "growth.obs.filter_all": "הכל",
  "growth.obs.filter_queue": "ממתינות לבדיקה",

  // Shared
  "growth.save": "שמירה",
  "growth.cancel": "ביטול",
  "growth.loading": "טוען...",
  "growth.error": "אירעה שגיאה. נסה שוב",
  "growth.forbidden": "אין הרשאה לצפייה בעמוד זה",
  "growth.required": "שדה חובה",
} as const;

export type GrowthStringKey = keyof typeof growthStrings;

export function tGrowth(key: GrowthStringKey): string {
  return growthStrings[key];
}
