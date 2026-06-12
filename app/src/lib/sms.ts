// ============================================================
// Joby/ShiftMatch — SMS adapter
// TODO(PROD): Replace stub with real provider (InforUMobile/Twilio)
// ============================================================

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSMS(
  phone: string,
  message: string
): Promise<SMSResult> {
  const provider = process.env.SMS_PROVIDER || "stub";

  if (provider === "stub") {
    // TODO(PROD): Replace with real SMS provider
    console.log(`[SMS STUB] To: ${phone} | Message: ${message}`);
    return { success: true, messageId: `stub_${Date.now()}` };
  }

  // TODO(PROD): Implement real provider here
  // if (provider === "informobile") { ... }
  // if (provider === "twilio") { ... }

  console.error(`[SMS] Unknown provider: ${provider}`);
  return { success: false, error: "Unknown SMS provider" };
}
