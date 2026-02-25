import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getMe, login, signup } from './api/auth';
import { fetchEntriesByYear, fetchYears, saveEntry } from './api/entries';
import YearHeatmap from './components/YearHeatmap';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function cookieGet(name) {
  const pairs = document.cookie.split(';').map((item) => item.trim());
  const row = pairs.find((item) => item.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.split('=').slice(1).join('=')) : null;
}

function cookieSet(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function cookieDelete(name) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function readPersistedAuth() {
  const token = localStorage.getItem(TOKEN_KEY) || cookieGet(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY) || cookieGet(USER_KEY);

  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  return { token: token || null, user };
}

function persistAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  cookieSet(TOKEN_KEY, token);
  cookieSet(USER_KEY, JSON.stringify(user));
}

function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  cookieDelete(TOKEN_KEY);
  cookieDelete(USER_KEY);
}

function toDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateFromKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function describeEntry(entry) {
  if (!entry) return 'No entry';
  return entry.isSick ? `Sick (${entry.severity}/5)` : 'Healthy';
}

function AuthPage({ type, onAuthSuccess }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isLogin = type === 'login';

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload = isLogin
        ? { email: form.email.trim(), password: form.password }
        : { name: form.name.trim(), email: form.email.trim(), password: form.password };

      const response = isLogin ? await login(payload) : await signup(payload);
      onAuthSuccess(response.token, response.user);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark">PulseMap</div>
        <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <p>{isLogin ? 'Track your health pattern year-round.' : 'Start building your health timeline.'}</p>

        <form onSubmit={onSubmit} className="auth-form">
          {!isLogin && (
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
              minLength={6}
            />
          </label>

          {error ? <div className="error-text">{error}</div> : null}

          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? 'Please wait...' : isLogin ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? 'New here?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => navigate(isLogin ? '/signup' : '/login')}
            className="text-btn"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateButton({ value, onClick }) {
  return (
    <button type="button" className="date-button" onClick={onClick}>
      {value || 'Select date'}
    </button>
  );
}

function HomePage({ token, user, onLogout }) {
  const nowYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(nowYear);
  const [yearsFromApi, setYearsFromApi] = useState([]);
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const [formDate, setFormDate] = useState(new Date(Date.UTC(nowYear, new Date().getMonth(), new Date().getDate())));
  const [isSick, setIsSick] = useState(false);
  const [severity, setSeverity] = useState(1);

  const [existingEntryNotice, setExistingEntryNotice] = useState(null);
  const [updatePreview, setUpdatePreview] = useState(null);

  const entryMap = useMemo(() => {
    const map = {};
    entries.forEach((entry) => {
      map[entry.dateKey] = entry;
    });
    return map;
  }, [entries]);

  const healthyCount = useMemo(() => entries.filter((e) => !e.isSick).length, [entries]);
  const sickCount = useMemo(() => entries.filter((e) => e.isSick).length, [entries]);

  const yearOptions = useMemo(() => {
    const set = new Set(yearsFromApi);
    for (let year = nowYear - 20; year <= nowYear + 10; year += 1) set.add(year);
    set.add(selectedYear);

    return [...set]
      .sort((a, b) => b - a)
      .map((year) => ({ value: year, label: String(year) }));
  }, [yearsFromApi, selectedYear, nowYear]);

  const selectedYearOption = yearOptions.find((item) => item.value === selectedYear) || {
    value: selectedYear,
    label: String(selectedYear)
  };

  useEffect(() => {
    fetchYears(token)
      .then((data) => setYearsFromApi(Array.isArray(data.years) ? data.years : []))
      .catch(() => setYearsFromApi([]));
  }, [token]);

  useEffect(() => {
    setBusy(true);
    setError('');

    fetchEntriesByYear(selectedYear, token)
      .then((data) => setEntries(Array.isArray(data.entries) ? data.entries : []))
      .catch((err) => setError(err.message || 'Failed to load entries'))
      .finally(() => setBusy(false));
  }, [selectedYear, token]);

  function onSelectDate(date) {
    if (!date) return;

    const normalized = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    setFormDate(normalized);

    const key = toDateKey(normalized);
    const existing = entryMap[key];

    if (existing) {
      setExistingEntryNotice(existing);
      setIsSick(existing.isSick);
      setSeverity(existing.severity || 1);
    } else {
      setExistingEntryNotice(null);
    }
  }

  async function commitSave(payload) {
    setBusy(true);
    setError('');
    setInfo('');

    try {
      const response = await saveEntry(payload, token);
      const saved = response.entry;

      setEntries((prev) => {
        const next = prev.filter((item) => item.dateKey !== saved.dateKey);
        next.push(saved);
        next.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return next;
      });

      setYearsFromApi((prev) => (prev.includes(selectedYear) ? prev : [...prev, selectedYear]));
      setExistingEntryNotice(saved);
      setUpdatePreview(null);
      setInfo('Entry saved.');
    } catch (err) {
      setError(err.message || 'Failed to save entry');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();

    const dateKey = toDateKey(formDate);
    const payload = {
      date: parseDateFromKey(dateKey).toISOString(),
      isSick,
      severity: isSick ? Number(severity) : null
    };

    const existing = entryMap[dateKey];
    if (existing) {
      setUpdatePreview({ existing, next: payload, dateKey });
      return;
    }

    await commitSave(payload);
  }

  function onHeatmapDayClick(date) {
    onSelectDate(date);
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="logo">PulseMap</div>
        <div className="user-box">
          <span className="user-name">{user?.name || user?.email || 'User'}</span>
          <button type="button" className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="main-layout">
        <section className="entry-card">
          <h2>Daily Entry</h2>
          <form className="entry-form" onSubmit={onSubmit}>
            <label className="field">
              Date
              <DatePicker
                selected={formDate}
                onChange={onSelectDate}
                dateFormat="dd/MM/yyyy"
                customInput={<DateButton />}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                shouldCloseOnSelect
                popperPlacement="bottom-start"
              />
            </label>

            <div className="field">
              <span>Did you feel sick today?</span>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`toggle-btn ${!isSick ? 'active-yes' : ''}`}
                  onClick={() => setIsSick(false)}
                >
                  No
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${isSick ? 'active-no' : ''}`}
                  onClick={() => setIsSick(true)}
                >
                  Yes
                </button>
              </div>
            </div>

            <div className={`severity-holder ${isSick ? 'show' : 'hide'}`}>
              <label className="field">
                How bad was it? (1-5)
                <div className="severity-chips">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`chip ${severity === value ? 'selected' : ''}`}
                      onClick={() => setSeverity(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <button type="submit" className="primary-btn full" disabled={busy}>
              Save Entry
            </button>

            {info ? <div className="info-text">{info}</div> : null}
            {error ? <div className="error-text">{error}</div> : null}
          </form>
        </section>

        <section className="heatmap-card">
          <div className="heatmap-top-row">
            <h2>Yearly Heatmap</h2>

            <div className="mini-stats">
              <span>Healthy: {healthyCount}</span>
              <span>Sick: {sickCount}</span>
            </div>

            <div className="year-tools">
              <button type="button" className="year-nav" onClick={() => setSelectedYear((y) => y - 1)}>
                ◀
              </button>

              <Select
                value={selectedYearOption}
                options={yearOptions}
                onChange={(option) => setSelectedYear(option.value)}
                isSearchable={false}
                classNamePrefix="year-select"
                menuPlacement="auto"
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: 38,
                    borderRadius: 12,
                    borderColor: '#1f2937',
                    background: '#0f172a',
                    boxShadow: 'none',
                    cursor: 'pointer'
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: '#e2e8f0',
                    width: '100%',
                    textAlign: 'center',
                    fontWeight: 700
                  }),
                  valueContainer: (base) => ({
                    ...base,
                    justifyContent: 'center'
                  }),
                  indicatorSeparator: () => ({ display: 'none' }),
                  dropdownIndicator: () => ({ display: 'none' }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#0b1325'
                  }),
                  option: (base, state) => ({
                    ...base,
                    cursor: 'pointer',
                    background: state.isFocused ? '#1e293b' : '#0b1325',
                    color: '#e2e8f0'
                  })
                }}
              />

              <button type="button" className="year-nav" onClick={() => setSelectedYear((y) => y + 1)}>
                ▶
              </button>
            </div>
          </div>

          <div className="heatmap-content">
            {busy ? <div className="muted">Loading...</div> : <YearHeatmap year={selectedYear} entries={entries} onDayClick={onHeatmapDayClick} />}
          </div>

          <div className="legend">
            <span><i style={{ background: '#ffffff' }} />No entry</span>
            <span><i style={{ background: '#2ecc71' }} />Healthy</span>
            <span><i style={{ background: '#f6b1b1' }} />1</span>
            <span><i style={{ background: '#ef8a8a' }} />2</span>
            <span><i style={{ background: '#e35d5d' }} />3</span>
            <span><i style={{ background: '#ce3030' }} />4</span>
            <span><i style={{ background: '#990f0f' }} />5</span>
          </div>
        </section>
      </main>

      {existingEntryNotice ? (
        <div className="modal" onClick={() => setExistingEntryNotice(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Entry already exists</h3>
            <p>{format(parseDateFromKey(existingEntryNotice.dateKey), 'dd/MM/yyyy')}</p>
            <p>Current value: {describeEntry(existingEntryNotice)}</p>
            <button type="button" className="primary-btn" onClick={() => setExistingEntryNotice(null)}>
              Continue editing
            </button>
          </div>
        </div>
      ) : null}

      {updatePreview ? (
        <div className="modal" onClick={() => setUpdatePreview(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Update this entry?</h3>
            <p>Date: {format(parseDateFromKey(updatePreview.dateKey), 'dd/MM/yyyy')}</p>
            <p>Current value: {describeEntry(updatePreview.existing)}</p>
            <p>
              New value:{' '}
              {updatePreview.next.isSick
                ? `Sick (${updatePreview.next.severity}/5)`
                : 'Healthy'}
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setUpdatePreview(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => commitSave(updatePreview.next)}
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProtectedRoute({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ token, children }) {
  if (token) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const [auth, setAuth] = useState(() => readPersistedAuth());

  useEffect(() => {
    if (!auth.token) return;

    getMe(auth.token)
      .then((data) => {
        if (data?.user) {
          persistAuth(auth.token, data.user);
          setAuth((prev) => ({ ...prev, user: data.user }));
        }
      })
      .catch(() => {
        clearAuthStorage();
        setAuth({ token: null, user: null });
      });
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token && location.pathname === '/') {
      window.history.replaceState({}, '', '/login');
    }
  }, [auth.token, location.pathname]);

  function onAuthSuccess(token, user) {
    persistAuth(token, user);
    setAuth({ token, user });
  }

  function onLogout() {
    clearAuthStorage();
    setAuth({ token: null, user: null });
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute token={auth.token}>
            <AuthPage type="login" onAuthSuccess={onAuthSuccess} />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute token={auth.token}>
            <AuthPage type="signup" onAuthSuccess={onAuthSuccess} />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute token={auth.token}>
            <HomePage token={auth.token} user={auth.user} onLogout={onLogout} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={auth.token ? '/home' : '/login'} replace />} />
    </Routes>
  );
}
