/* ===========================================================
   Booking form — works on index.html#book and book.html
   Maps new fields onto the existing Supabase `bookings` schema
   so NO database migration is required.
   =========================================================== */

const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });

const $ = id => document.getElementById(id);

/* ---------- helpers ---------- */
const todayISO = () => new Date().toISOString().split('T')[0];

function generateRef() {
  const d = new Date();
  const ds = d.getFullYear()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  return 'ML' + ds + Math.floor(1000 + Math.random() * 9000);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${M[parseInt(m) - 1]} ${y}`;
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h), ap = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${m} ${ap}`;
}

function isHeavyLuggage(v) {
  return v === '3–4 suitcases' || v === '5+ suitcases';
}

/* ---------- wiring ---------- */
$('date').min = todayISO();

function checkCapacity() {
  const pax = parseInt($('passengers').value, 10);
  const heavy = isHeavyLuggage($('luggage').value);
  // 6 passengers max (light luggage); 4 max with full luggage. Driver not counted.
  $('capacityHint').classList.toggle('hidden', !(heavy && pax > 4));
}
$('passengers').addEventListener('change', checkCapacity);
$('luggage').addEventListener('change', checkCapacity);
checkCapacity();

/* ---------- validation ---------- */
const REQUIRED = ['pickup', 'dropoff', 'date', 'time', 'fullName', 'phone'];

function validate() {
  let ok = true;
  REQUIRED.forEach(id => {
    const el = $(id);
    const field = el.closest('.field');
    const valid = !!el.value.trim();
    field.classList.toggle('field--error', !valid);
    if (!valid) ok = false;
  });
  return ok;
}

REQUIRED.forEach(id =>
  $(id).addEventListener('input', () =>
    $(id).closest('.field').classList.remove('field--error')));

/* ---------- submit ---------- */
$('bookingForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate()) {
    document.querySelector('.field--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const pickup     = $('pickup').value.trim();
  const dropoff    = $('dropoff').value.trim();
  const dateISO    = $('date').value;
  const timeRaw    = $('time').value;
  const passengers = $('passengers').value;
  const luggage    = $('luggage').value;
  const babySeat   = $('babySeat').checked;
  const flight     = $('flight').value.trim();
  const userNotes  = $('notes').value.trim();
  const fullName   = $('fullName').value.trim();
  const phone      = $('phone').value.trim();
  const email      = $('email').value.trim();

  const ref         = generateRef();
  const displayDate = fmtDate(dateISO);
  const displayTime = fmtTime(timeRaw);
  const route       = `${pickup} → ${dropoff}`;

  // Pack the new fields into the existing `notes` column.
  const notesForDb = [
    `Pickup: ${pickup}`,
    `Drop-off: ${dropoff}`,
    `Luggage: ${luggage}`,
    babySeat ? 'Baby seat: REQUESTED' : null,
    userNotes ? `Notes: ${userNotes}` : null
  ].filter(Boolean).join(' | ');

  // ui
  $('submitBtn').disabled = true;
  $('btnText').textContent = 'Sending…';
  $('btnSpinner').classList.remove('hidden');
  $('errorMsg').classList.add('hidden');

  // 1) Save (critical)
  const { error: dbError } = await db.from('bookings').insert({
    booking_ref:   ref,
    full_name:     fullName,
    phone:         phone,
    email:         email || '-',
    pickup_date:   dateISO,
    pickup_time:   displayTime,
    airport:       route,                 // re-purposed: full route string
    passengers:    parseInt(passengers, 10),
    flight_number: flight || 'Not provided',
    notes:         notesForDb,
    status:        'NEW'
  });

  if (dbError) {
    $('errorMsg').textContent =
      'We couldn’t save your request (' + (dbError.message || 'unknown error') +
      '). Please call or WhatsApp 0449 188 872 and we’ll book you in directly.';
    $('errorMsg').classList.remove('hidden');
    $('submitBtn').disabled = false;
    $('btnText').textContent = 'Request Quote & Reserve';
    $('btnSpinner').classList.add('hidden');
    return;
  }

  // 2) Emails (best-effort)
  const summary =
    'Reference:   ' + ref + '\n' +
    'Route:       ' + route + '\n' +
    'Date:        ' + displayDate + '\n' +
    'Time:        ' + displayTime + '\n' +
    'Passengers:  ' + passengers + '\n' +
    'Luggage:     ' + luggage + '\n' +
    'Baby seat:   ' + (babySeat ? 'Requested' : 'Not required') + '\n' +
    'Flight no:   ' + (flight || 'Not provided') + '\n' +
    (userNotes ? 'Notes:       ' + userNotes + '\n' : '');

  if (email) {
    try {
      await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_CUSTOMER_TEMPLATE_ID, {
        to_name: fullName, cust_email: email,
        subject: 'Booking received — Ref ' + ref + ' | Manor Lakes Airport Transfers',
        message:
          'Hi ' + fullName + ',\n\n' +
          'Thanks for your booking request. Here’s a copy of what you sent:\n\n' +
          summary + '\n' +
          'We’ll text you on ' + phone + ' shortly with your fixed fare and ' +
          'pickup confirmation.\n\n' +
          'Need to change anything? Reply to this email or call/WhatsApp ' +
          '0449 188 872.\n\n' +
          '— Manor Lakes Airport Transfers'
      });
    } catch (err) { console.warn('Customer email failed:', err); }
  }

  try {
    await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_ADMIN_TEMPLATE_ID, {
      to_name: 'Admin', admin_email: CONFIG.ADMIN_EMAIL,
      subject: '🚗 NEW BOOKING ' + ref + ' — ' + fullName,
      message:
        '=== NEW BOOKING ===\n\n' +
        'Customer:    ' + fullName + '\n' +
        'Phone:       ' + phone + '\n' +
        'Email:       ' + (email || '—') + '\n\n' +
        summary
    });
  } catch (err) { console.warn('Admin email failed:', err); }

  // 3) Confirmation
  sessionStorage.setItem('lastBooking', JSON.stringify({
    ref, fullName, route, displayDate, displayTime,
    passengers, luggage, babySeat, phone
  }));
  window.location.href = 'confirmation.html';
});
