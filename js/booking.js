  const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });

  document.getElementById('pickupDate').min = new Date().toISOString().split('T')[0];

  function generateRef() {
      const d = new Date();
      const dateStr = d.getFullYear()
          + String(d.getMonth() + 1).padStart(2, '0')
          + String(d.getDate()).padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      return 'ML' + dateStr + rand;
  }

  function formatDate(dateStr) {
      const [y, m, d] = dateStr.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  function formatTime(timeStr) {
      const [h, m] = timeStr.split(':');
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const displayHr = hr % 12 || 12;
      return `${displayHr}:${m} ${ampm}`;
  }

  document.getElementById('bookingForm').addEventListener('submit', async function (e) {
      e.preventDefault();

      const form = e.target;
      if (!form.checkValidity()) {
          form.classList.add('was-validated');
          return;
      }

      const fullName   = document.getElementById('fullName').value.trim();
      const phone      = document.getElementById('phone').value.trim();
      const email      = document.getElementById('email').value.trim();
      const pickupDate = document.getElementById('pickupDate').value;
      const pickupTime = document.getElementById('pickupTime').value;
      const airport    = document.getElementById('airport').value;
      const passengers = document.getElementById('passengers').value;
      const flightNum  = document.getElementById('flightNumber').value.trim() || 'Not provided';
      const notes      = document.getElementById('notes').value.trim() || 'None';

      const bookingRef  = generateRef();
      const displayDate = formatDate(pickupDate);
      const displayTime = formatTime(pickupTime);

      document.getElementById('submitBtn').disabled = true;
      document.getElementById('loadingSpinner').style.display = 'inline-block';
      document.getElementById('btnText').textContent = 'Processing...';
      document.getElementById('errorMsg').classList.add('d-none');

      try {
          const { error: dbError } = await db
              .from('bookings')
              .insert({
                  booking_ref:   bookingRef,
                  full_name:     fullName,
                  phone:         phone,
                  email:         email,
                  pickup_date:   pickupDate,
                  pickup_time:   displayTime,
                  airport:       airport,
                  passengers:    parseInt(passengers),
                  flight_number: flightNum,
                  notes:         notes,
                  status:        'NEW'
              });

          if (dbError) throw new Error(dbError.message);

          await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, {
              to_name:  fullName,
              to_email: email,
              subject:  'Booking Confirmed — Ref: ' + bookingRef + ' | Manor Lakes Airport Transfers',
              message:
                  'Dear ' + fullName + ',\n\n' +
                  'Your airport transfer has been booked!\n\n' +
                  'BOOKING DETAILS\n' +
                  '================================\n' +
                  'Reference:   ' + bookingRef + '\n' +
                  'Date:        ' + displayDate + '\n' +
                  'Time:        ' + displayTime + '\n' +
                  'Airport:     ' + airport + '\n' +
                  'Passengers:  ' + passengers + '\n' +
                  'Flight No:   ' + flightNum + '\n\n' +
                  'PAYMENT\n' +
                  '================================\n' +
                  'Amount Due:  $100.00\n' +
                  'Method:      Cash or Bank Transfer on the day\n\n' +
                  'We will contact you shortly to confirm your pickup.\n' +
                  'Questions? Call/Text: 0449 188 872\n\n' +
                  'Thank you for choosing Manor Lakes Airport Transfers!'
          });

          await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, {
              to_name:  'Admin',
              to_email: CONFIG.ADMIN_EMAIL,
              subject:  'NEW BOOKING: ' + bookingRef + ' | ' + fullName,
              message:
                  '=== NEW BOOKING RECEIVED ===\n\n' +
                  'Reference:   ' + bookingRef + '\n' +
                  'Customer:    ' + fullName + '\n' +
                  'Phone:       ' + phone + '\n' +
                  'Email:       ' + email + '\n\n' +
                  'Date:        ' + displayDate + '\n' +
                  'Time:        ' + displayTime + '\n' +
                  'Airport:     ' + airport + '\n' +
                  'Passengers:  ' + passengers + '\n' +
                  'Flight No:   ' + flightNum + '\n' +
                  'Notes:       ' + notes
          });

          sessionStorage.setItem('lastBooking', JSON.stringify({
              bookingRef, fullName, pickupDate: displayDate,
              pickupTime: displayTime, airport, passengers
          }));

          window.location.href = 'confirmation.html';

      } catch (err) {
          console.error(err);
          document.getElementById('errorMsg').textContent =
              'Something went wrong: ' + err.message +
              '. Please try again or call 0449 188 872.';
          document.getElementById('errorMsg').classList.remove('d-none');
          document.getElementById('submitBtn').disabled = false;
          document.getElementById('loadingSpinner').style.display = 'none';
          document.getElementById('btnText').textContent = 'Confirm Booking';
      }
  });
