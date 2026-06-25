import twilio from 'twilio';
import { env } from '../../config/env.js';

export class EmergencyService {
  private static client: any;

  private static getClient() {
    if (!this.client && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
    return this.client;
  }

  /**
   * Sends emergency SMS containing GPS coordinates and medical details to the rescue contacts
   */
  public static async triggerEmergencySMS(session: any, user: any, location: { lat: number; lng: number; alt?: number }) {
    console.log(`🚨 TRIGGER EMERGENCY SMS for Session: ${session.id}, User: ${user.fullName}`);

    const message = `ALLERTA SOCCORSO VALLE CASTELLANA!\n` +
      `Escursionista: ${user.fullName}\n` +
      `Cell: ${user.phone || 'N/D'}\n` +
      `Posizione GPS: Lat ${location.lat.toFixed(5)}, Lng ${location.lng.toFixed(5)}\n` +
      `Quota: ${location.alt ? Math.round(location.alt) + 'm' : 'N/D'}\n` +
      `Scheda Medica: Gr. Sanguigno ${user.medicalProfile?.blood_type || 'N/D'}, Allergie: ${user.medicalProfile?.allergies?.join(', ') || 'Nessuna'}\n` +
      `Contatto Emergenza: ${user.emergencyContactName || 'N/D'} (${user.emergencyContactPhone || 'N/D'})\n` +
      `Visualizza sulla mappa del Comune: ${env.FRONTEND_URL}/admin/live-map`;

    const smsNumbers = process.env.EMERGENCY_SMS_NUMBERS ? process.env.EMERGENCY_SMS_NUMBERS.split(',') : ['118'];
    const twilioNumber = env.TWILIO_PHONE_NUMBER;
    const client = this.getClient();

    const results = [];

    for (const num of smsNumbers) {
      const targetNumber = num.trim();
      try {
        if (client && twilioNumber) {
          const res = await client.messages.create({
            body: message,
            to: targetNumber,
            from: twilioNumber,
          });
          console.log(`  ✅ SMS sent to ${targetNumber}. SID: ${res.sid}`);
          results.push({ number: targetNumber, success: true, sid: res.sid });
        } else {
          console.warn(`  ⚠️ Twilio not configured. Simulated SMS to ${targetNumber}:\n${message}`);
          results.push({ number: targetNumber, success: true, simulated: true });
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to send SMS to ${targetNumber}:`, error.message);
        results.push({ number: targetNumber, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Initiates automated call speaking the emergency location and details (text-to-speech)
   */
  public static async triggerEmergencyCall(session: any, user: any, location: { lat: number; lng: number }) {
    console.log(`🚨 TRIGGER EMERGENCY CALL for Session: ${session.id}, User: ${user.fullName}`);

    const emergencyNumber = process.env.EMERGENCY_CALL_NUMBER || '+39XXXXXXXXXX';
    const twilioNumber = env.TWILIO_PHONE_NUMBER;
    const client = this.getClient();

    const bloodType = user.medicalProfile?.blood_type || 'non dichiarato';
    const allergies = user.medicalProfile?.allergies?.length > 0 
      ? user.medicalProfile.allergies.join(', ') 
      : 'nessuna allergia nota';

    // TwiML text-to-speech instructions
    const twiml = `<Response>
      <Say voice="alice" language="it-IT" loop="2">
        Attenzione! Allerta escursione in emergenza nel Comune di Valle Castellana.
        L'escursionista ${user.fullName} non risponde ai tentativi di contatto.
        Ultima posizione geografica registrata: Latitudine ${location.lat.toFixed(5)} gradi, Longitudine ${location.lng.toFixed(5)} gradi.
        Informazioni mediche: Gruppo sanguigno ${bloodType}. Allergie: ${allergies}.
        Numero di telefono dell'utente: ${user.phone || 'non disponibile'}.
        Ripeto. Allerta emergenza per escursionista ${user.fullName}. Latitudine ${location.lat.toFixed(5)}, Longitudine ${location.lng.toFixed(5)}.
      </Say>
    </Response>`;

    try {
      if (client && twilioNumber) {
        const call = await client.calls.create({
          twiml,
          to: emergencyNumber,
          from: twilioNumber,
        });
        console.log(`  ✅ Emergency Call initiated to ${emergencyNumber}. SID: ${call.sid}`);
        return { success: true, sid: call.sid };
      } else {
        console.warn(`  ⚠️ Twilio not configured. Simulated emergency call to ${emergencyNumber} with TwiML:\n${twiml}`);
        return { success: true, simulated: true };
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to initiate emergency call to ${emergencyNumber}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}
