import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1?target=deno';

type AppointmentRecord = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  status: string;
  patient_id: string;
  doctor_id: string;
  patients: { user_id: string | null } | null;
  doctors: { user_id: string | null } | null;
};

function parseAppointmentDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const base = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;

  const timeParts = time.trim().toLowerCase();
  const match = timeParts.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  }
  if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  const local = new Date(base);
  local.setUTCHours(hours, minutes, 0, 0);
  return local;
}

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const leadMinutes = 120;
    const executionWindowMinutes = 10;
    const windowStart = new Date(now.getTime() - executionWindowMinutes * 60 * 1000);
    const windowEnd = new Date(now.getTime() + executionWindowMinutes * 60 * 1000);

    const dateStart = windowStart.toISOString().slice(0, 10);
    const dateEnd = windowEnd.toISOString().slice(0, 10);

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        appointment_time,
        appointment_type,
        status,
        patient_id,
        doctor_id,
        patients:patients(user_id),
        doctors:doctors(user_id)
      `)
      .eq('status', 'scheduled')
      .gte('appointment_date', dateStart)
      .lte('appointment_date', dateEnd);

    if (appointmentsError) throw appointmentsError;

    let notificationsCreated = 0;

    if (appointments && appointments.length > 0) {
      for (const appointment of appointments as AppointmentRecord[]) {
        const appointmentDateTime = parseAppointmentDateTime(
          appointment.appointment_date,
          appointment.appointment_time
        );
        if (!appointmentDateTime) continue;

        const notificationTime = new Date(appointmentDateTime.getTime() - leadMinutes * 60 * 1000);

        if (notificationTime <= now && appointmentDateTime > now) {
          const usersToNotify = [
            { user_id: appointment.patients?.user_id, role: 'patient' as const },
            { user_id: appointment.doctors?.user_id, role: 'doctor' as const },
          ].filter((entry) => !!entry.user_id);

          for (const entry of usersToNotify) {
            if (!entry.user_id) continue;

            const { data: existing } = await supabase
              .from('appointment_notifications')
              .select('id')
              .eq('appointment_id', appointment.id)
              .eq('user_id', entry.user_id)
              .eq('lead_minutes', leadMinutes)
              .maybeSingle();

            if (existing) continue;

            const message =
              entry.role === 'patient'
                ? `You have an appointment in ${leadMinutes / 60} hours with your specialist.`
                : `You have an appointment in ${leadMinutes / 60} hours with a patient.`;

            const { error: insertError } = await supabase
              .from('appointment_notifications')
              .insert({
                appointment_id: appointment.id,
                user_id: entry.user_id,
                role: entry.role,
                message,
                scheduled_for: notificationTime.toISOString(),
                lead_minutes: leadMinutes,
                status: 'sent',
                sent_at: new Date().toISOString(),
              });

            if (!insertError) {
              notificationsCreated += 1;
            } else {
              console.error('Failed to insert notification', insertError);
            }
          }
        }
      }
    }

    const responseBody = {
      processed: appointments?.length || 0,
      notificationsCreated,
      timestamp: now.toISOString(),
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Notification function error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});














