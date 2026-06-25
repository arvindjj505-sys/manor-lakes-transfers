const supabaseAdmin = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const STATUS_OPTIONS = ['NEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

function statusBadge(status) {
    return `<span class="status-badge status-${status}">${status}</span>`;
}

function statusDropdown(id, current) {
    const opts = STATUS_OPTIONS
        .map(s => `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`)
        .join('');
    return `<select class="form-select form-select-sm" style="width:130px"
                onchange="updateStatus('${id}', this.value)">${opts}</select>`;
}

async function login() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errDiv   = document.getElementById('loginError');
    errDiv.classList.add('d-none');

    const { error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
        errDiv.textContent = 'Login failed: ' + error.message;
        errDiv.classList.remove('d-none');
        return;
    }

    showDashboard(email);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginPassword').addEventListener('keypress', e => {
        if (e.key === 'Enter') login();
    });
});

function showDashboard(email) {
    document.getElementById('loginScreen').style.display   = 'none';
    document.getElementById('dashboard').style.display     = 'block';
    document.getElementById('logoutArea').style.display    = 'flex';
    document.getElementById('adminEmail').textContent      = email;
    loadBookings();
}

async function logout() {
    await supabaseAdmin.auth.signOut();
    location.reload();
}

async function loadBookings() {
    document.getElementById('tableLoading').style.display  = 'block';
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('noBookings').style.display    = 'none';

    const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        document.getElementById('tableLoading').textContent = 'Error: ' + error.message;
        return;
    }

    document.getElementById('statTotal').textContent     = data.length;
    document.getElementById('statNew').textContent       = data.filter(b => b.status === 'NEW').length;
    document.getElementById('statConfirmed').textContent = data.filter(b => b.status === 'CONFIRMED').length;
    document.getElementById('statCompleted').textContent = data.filter(b => b.status === 'COMPLETED').length;
    document.getElementById('tableLoading').style.display = 'none';

    if (data.length === 0) {
        document.getElementById('noBookings').style.display = 'block';
        return;
    }

    const rows = data.map(b => {
        const d = new Date(b.pickup_date + 'T00:00:00');
        const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
        return `
        <tr>
          <td><strong style="color:#1e3a5f">${b.booking_ref}</strong></td>
          <td>
            <div class="fw-bold">${b.full_name}</div>
            <div class="text-muted" style="font-size:.78em">${b.email}</div>
          </td>
          <td><a href="tel:${b.phone}" style="color:#1e3a5f">${b.phone}</a></td>
          <td>${dateStr}</td>
          <td>${b.pickup_time}</td>
          <td style="font-size:.8em">${b.airport}</td>
          <td class="text-center">${b.passengers}</td>
          <td style="font-size:.8em">${b.flight_number || '—'}</td>
          <td style="font-size:.78em;max-width:260px;white-space:normal">${b.notes || '—'}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${statusDropdown(b.id, b.status)}</td>
        </tr>`;
    }).join('');

    document.getElementById('bookingsTable').innerHTML = rows;
    document.getElementById('tableContainer').style.display = 'block';
}

async function updateStatus(id, newStatus) {
    const { error } = await supabaseAdmin
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        alert('Failed to update: ' + error.message);
        loadBookings();
    }
}

// Auto-login if session exists
supabaseAdmin.auth.getSession().then(({ data: { session } }) => {
    if (session) showDashboard(session.user.email);
});
