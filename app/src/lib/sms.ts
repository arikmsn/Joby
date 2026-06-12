// Joby — OTP delivery providers (mock / Green-API WhatsApp)

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Israeli phone normalization: 05XXXXXXXX → 9725XXXXXXXX
export function normalizeIsraeliPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("972") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return "972" + digits.slice(1);
  }
  return null;
}

async function sendViaMock(phone: string, message: string): Promise<SMSResult> {
  console.log(`\n========== [OTP MOCK] ==========`);
  console.log(`  Phone: ${phone}`);
  console.log(`  Message: ${message}`);
  console.log(`================================\n`);
  return { success: true, messageId: `mock_${Date.now()}` };
}

async function sendViaGreenApi(phone: string, message: string): Promise<SMSResult> {
  const baseUrl = process.env.GREEN_API_URL;
  const instanceId = process.env.GREEN_API_ID_INSTANCE;
  const token = process.env.GREEN_API_TOKEN;

  if (!baseUrl || !instanceId || !token) {
    console.error("[GREEN-API] Missing env vars: GREEN_API_URL, GREEN_API_ID_INSTANCE, GREEN_API_TOKEN");
    return { success: false, error: "Green-API not configured" };
  }

  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) {
    console.error(`[GREEN-API] Invalid Israeli phone: ${phone}`);
    return { success: false, error: "מספר טלפון לא תקין" };
  }

  const url = `${baseUrl}/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: `${normalized}@c.us`,
        message,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[GREEN-API] HTTP ${res.status}: ${text}`);
      return { success: false, error: `Green-API HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.idMessage || String(Date.now()) };
  } catch (err) {
    console.error("[GREEN-API] Request failed:", err);
    return { success: false, error: "Green-API request failed" };
  }
}

export async function sendSMS(phone: string, message: string): Promise<SMSResult> {
  const provider = process.env.OTP_PROVIDER || "mock";

  if (provider === "mock" || provider === "stub") {
    return sendViaMock(phone, message);
  }

  if (provider === "greenapi_whatsapp") {
    const result = await sendViaGreenApi(phone, message);

    if (!result.success && process.env.OTP_ALLOW_DEV_FALLBACK === "true") {
      console.warn("[OTP] Green-API failed, falling back to mock (OTP_ALLOW_DEV_FALLBACK=true)");
      return sendViaMock(phone, message);
    }

    return result;
  }

  console.error(`[OTP] Unknown provider: ${provider}`);
  return { success: false, error: "Unknown OTP provider" };
}
