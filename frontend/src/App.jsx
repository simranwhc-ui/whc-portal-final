import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Clock3,
  Code2,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Gift,
  GraduationCap,
  Heart,
  History as HistoryIcon,
  Layers3,
  Laptop,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Trophy,
  Pencil,
  PartyPopper,
  Phone,
  Plus,
  Search,
  Smile,
  ShieldCheck,
  ContactRound,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

const applauseSound = `${import.meta.env.BASE_URL}leaderboard-applause.mp3`;
const courseTypeOptions = ['Regular', 'Premium', 'Platinum', 'Pro Platinum', '6-week Industrial Training', '6 month Industrial Training'];
const courseTypeLabel = (value) => value === 'Pro Platinum' ? 'Platinum Pro' : value;
const studentStatusOptions = ['Active', 'Completed', 'Dropped'];
const studentStatusApiValues = { Active: 'active', Completed: 'completed', Dropped: 'drop' };

const initialCounselors = [];
const initialTrainers = [];

const initialLeads = [];

const trainerAssignments = {};

const trainerProjects = {};
const trainerBatches = {};

const trainerAttendanceStorageKey = (trainerId) => `whc-trainer-attendance-${trainerId}-v2`;
const trainerEvaluationsStorageKey = (trainerId) => `whc-trainer-evaluations-${trainerId}-v2`;
const trainerProjectsStorageKey = (trainerId) => `whc-trainer-projects-${trainerId}-v2`;
const trainerBatchesStorageKey = (trainerId) => `whc-trainer-batches-${trainerId}-v2`;

function readStoredArray(key) {
  try {
    const storedValue = window.localStorage.getItem(key);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function readStoredValue(key, fallback) {
  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallback;
  } catch {
    return fallback;
  }
}

async function authenticatedRequest(path, options = {}) {
  const token = window.localStorage.getItem('whc-auth-token');
  if (!token) throw new Error('Your sign-in session has expired. Please sign in again.');

  const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }
  return result;
}

function usePersistentState(key, initialValue, normalize = (value) => value) {
  const fallback = typeof initialValue === 'function' ? initialValue() : initialValue;
  const [value, setValue] = useState(() => normalize(readStoredValue(key, fallback)));

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function normalizeTrainerProjects(trainerId, records = trainerProjects[trainerId] ?? []) {
  const assignment = trainerAssignments[trainerId] ?? { subjects: [] };
  return (Array.isArray(records) ? records : []).map((project, index) => ({
    ...project,
    id: project.id ?? `${project.name}-${index}`,
    status: project.status ?? 'ACTIVE',
    description: project.description ?? 'No description',
    subject: project.subject ?? assignment.subjects[index % (assignment.subjects.length || 1)] ?? 'AI',
    studentEntries: Array.isArray(project.studentEntries) ? project.studentEntries : (project.studentNames ?? []).map((name, studentIndex) => ({
      id: `${project.id ?? `${project.name}-${index}`}-student-${studentIndex}`,
      name,
      email: '',
      phone: '',
      course: project.subject ?? assignment.subjects[0] ?? 'AI',
    })),
  }));
}

function normalizeTrainerBatches(trainerId, records = trainerBatches[trainerId] ?? []) {
  const assignment = trainerAssignments[trainerId] ?? { subjects: [] };
  return (Array.isArray(records) ? records : []).map((batch, index) => {
    const studentNames = batch.studentNames ?? [];
    return {
      ...batch,
      id: batch.id ?? `${batch.name}-${index}`,
      status: batch.status ?? 'ACTIVE',
      subject: batch.subject ?? assignment.subjects[index % (assignment.subjects.length || 1)] ?? 'AI',
      studentNames,
      studentEntries: Array.isArray(batch.studentEntries) ? batch.studentEntries : studentNames.map((name, studentIndex) => ({
        id: `${batch.id ?? `${batch.name}-${index}`}-student-${studentIndex}`,
        name,
        email: '',
        phone: '',
        course: batch.subject ?? assignment.subjects[0] ?? 'AI',
      })),
    };
  });
}

const enrolledStudents = [];

function dateAfterDuration(startDate, duration) {
  if (!startDate || !duration || /confirm|unknown/i.test(duration)) return '';
  const match = String(duration).match(/(\d+)\s*(day|week|month|year)/i);
  if (!match) return '';
  const date = new Date(`${startDate}T12:00:00`);
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('day')) date.setDate(date.getDate() + amount);
  else if (unit.startsWith('week')) date.setDate(date.getDate() + amount * 7);
  else if (unit.startsWith('month')) date.setMonth(date.getMonth() + amount);
  else date.setFullYear(date.getFullYear() + amount);
  return date.toISOString().slice(0, 10);
}

function normalizeStudentRecords(records) {
  return (Array.isArray(records) ? records : []).map((student) => {
    const courseStartDate = student.courseStartDate || student.enrolledDate || '';
    return {
      ...student,
      registrationDate: student.registrationDate || student.enrolledDate || '',
      courseStartDate,
      courseEndDate: student.courseEndDate || dateAfterDuration(courseStartDate, student.duration),
      courseType: student.courseType || 'Full time',
      duration: student.duration || '6 months',
      tier: student.tier || 'Regular',
      trainingDurations: ['6 weeks', '6 months'],
    };
  });
}

const studentNavigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'complaints', label: 'Complaints', icon: MessageCircle },
  { id: 'batches', label: 'My Batch', icon: UsersRound },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays },
  { id: 'projects', label: 'Projects', icon: BookOpen },
  { id: 'evaluations', label: 'Monthly Evaluations', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function studentDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return 'Not available';
  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-IN', options);
}

function studentDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function studentPlanLabel(plan) {
  return String(plan || 'Student')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StudentComplaintsView() {
  const [complaints, setComplaints] = useState([]);
  const [options, setOptions] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      authenticatedRequest('/complaints/student/options'),
      authenticatedRequest('/complaints/student'),
    ]).then(([optionResult, complaintResult]) => {
      if (!active) return;
      setOptions(optionResult.options ?? []);
      setComplaints(complaintResult.complaints ?? []);
      setError('');
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load complaints.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    const refreshVisibleComplaints = () => {
      if (document.visibilityState === 'visible') setRefreshKey((key) => key + 1);
    };
    window.addEventListener('focus', refreshVisibleComplaints);
    document.addEventListener('visibilitychange', refreshVisibleComplaints);
    return () => {
      window.removeEventListener('focus', refreshVisibleComplaints);
      document.removeEventListener('visibilitychange', refreshVisibleComplaints);
    };
  }, []);

  async function submitComplaint(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      const result = await authenticatedRequest('/complaints/student', {
        method: 'POST',
        body: JSON.stringify({ title, description, roles: selectedRoles }),
      });
      setComplaints((items) => [result.complaint, ...items]);
      setTitle('');
      setDescription('');
      setSelectedRoles([]);
      setNotice('Your complaint has been sent to the selected staff.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your complaint.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="student-complaints-layout">
    <section className="student-card student-full-card">
      <div className="student-card-heading"><div className="student-card-title"><MessageCircle size={21} /><h2>Raise a complaint</h2></div></div>
      <form className="student-complaint-form" onSubmit={submitComplaint}>
        <label>Complaint title<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Briefly describe the issue" /></label>
        <label>Details<textarea required minLength={5} maxLength={3000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what happened and how we can help" /></label>
        <fieldset className="complaint-recipient-options">
          <legend>Who should see this complaint?</legend>
          {options.length ? options.map((option) => <label key={option.role}>
            <input type="checkbox" checked={selectedRoles.includes(option.role)} onChange={(event) => setSelectedRoles((roles) => event.target.checked ? [...roles, option.role] : roles.filter((role) => role !== option.role))} />
            <span>{option.label}</span>
          </label>) : <span className="student-muted-copy">No staff recipients are currently available.</span>}
        </fieldset>
        {error && <p className="complaint-error" role="alert">{error}</p>}
        {notice && <p className="complaint-success" role="status">{notice}</p>}
        <button className="primary-action" type="submit" disabled={isSubmitting || !selectedRoles.length || !options.length}>{isSubmitting ? 'Sending…' : 'Submit complaint'} <ArrowRight size={16} /></button>
      </form>
    </section>
    <section className="student-card student-full-card">
      <div className="student-card-heading"><div className="student-card-title"><ClipboardList size={21} /><h2>My complaints</h2></div><button className="student-link" type="button" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></div>
      {isLoading ? <div className="student-loading">Loading complaints…</div> : complaints.length ? <div className="student-complaint-list">
        {complaints.map((complaint) => <article className="student-complaint-card" key={complaint.id}>
          <div className="complaint-card-heading"><div><h3>{complaint.title}</h3><small>Raised {studentDate(complaint.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div><span className={`complaint-status ${complaint.status}`}>{complaint.status === 'resolved' ? 'Resolved' : 'In progress'}</span></div>
          <p className="complaint-description">{complaint.description}</p>
          <div className="complaint-recipient-list"><strong>Shared with</strong>{complaint.recipients.map((recipient, index) => <div key={`${recipient.role}-${index}`}><span>{recipient.name} · {studentPlanLabel(recipient.role)}</span><span className={recipient.resolvedAt ? 'recipient-resolved' : 'recipient-pending'}>{recipient.resolvedAt ? 'Resolved' : 'Awaiting response'}</span>{recipient.response && <p>{recipient.response}</p>}</div>)}</div>
          {complaint.deleteAt && <small className="complaint-retention-note">Scheduled for removal {studentDateTime(complaint.deleteAt)}.</small>}
        </article>)}
      </div> : <div className="student-empty-state"><MessageCircle size={23} /><strong>No complaints yet</strong><span>Complaints you submit and replies from staff will appear here.</span></div>}
    </section>
  </div>;
}

function StaffComplaintsView() {
  const [complaints, setComplaints] = useState([]);
  const [responses, setResponses] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    authenticatedRequest('/complaints/staff').then((result) => {
      if (!active) return;
      const records = result.complaints ?? [];
      setComplaints(records);
      setResponses(Object.fromEntries(records.map((complaint) => [complaint.id, complaint.myRecipient?.response ?? ''])));
      setError('');
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load complaints.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [refreshKey]);

  async function resolveComplaint(complaintId) {
    setError('');
    setNotice('');
    setSavingId(complaintId);
    try {
      await authenticatedRequest(`/complaints/staff/${complaintId}/response`, {
        method: 'PATCH',
        body: JSON.stringify({ response: responses[complaintId] ?? '', resolved: true }),
      });
      setNotice('Your resolution was saved.');
      setRefreshKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the resolution.');
    } finally {
      setSavingId('');
    }
  }

  return <section className="panel staff-complaints-panel">
    <div className="panel-heading"><div><h2>Student complaints</h2><p>Only complaints shared with your account are shown here.</p></div><button className="secondary-action" type="button" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></div>
    {error && <p className="complaint-error" role="alert">{error}</p>}
    {notice && <p className="complaint-success" role="status">{notice}</p>}
    {isLoading ? <div className="empty-state">Loading complaints…</div> : complaints.length ? <div className="staff-complaint-list">
      {complaints.map((complaint) => <article className="staff-complaint-card" key={complaint.id}>
        <div className="complaint-card-heading"><div><h3>{complaint.title}</h3><small>{complaint.student?.name || 'Student'}{complaint.student?.course ? ` · ${complaint.student.course}` : ''} · Raised {studentDate(complaint.createdAt)}</small></div><span className={`complaint-status ${complaint.status}`}>{complaint.status === 'resolved' ? 'Resolved' : 'In progress'}</span></div>
        <p className="complaint-description">{complaint.description}</p>
        <div className="complaint-progress-list">{complaint.recipients.map((recipient, index) => <span key={`${recipient.role}-${index}`} className={recipient.resolvedAt ? 'recipient-resolved' : 'recipient-pending'}>{recipient.name}: {recipient.resolvedAt ? 'resolved' : 'pending'}</span>)}</div>
        {complaint.myRecipient?.resolvedAt ? <div className="staff-own-resolution"><strong>Your resolution</strong><p>{complaint.myRecipient.response}</p><small>Marked resolved {studentDate(complaint.myRecipient.resolvedAt)}</small></div> : <form className="staff-resolution-form" onSubmit={(event) => { event.preventDefault(); resolveComplaint(complaint.id); }}>
          <label htmlFor={`resolution-${complaint.id}`}>Write a resolution for the student</label>
          <textarea id={`resolution-${complaint.id}`} required maxLength={3000} rows={3} value={responses[complaint.id] ?? ''} onChange={(event) => setResponses((items) => ({ ...items, [complaint.id]: event.target.value }))} placeholder="Explain what you did or how the issue was resolved" />
          <button className="primary-action" type="submit" disabled={savingId === complaint.id}>{savingId === complaint.id ? 'Saving…' : 'Mark resolved'} <CheckCircle2 size={16} /></button>
        </form>}
      </article>)}
    </div> : <div className="empty-state"><MessageCircle size={24} /><strong>No complaints assigned to you</strong><span>Complaints shared with you by students will appear here.</span></div>}
  </section>;
}

function StudentPortal({ student, onLogout }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [portalData, setPortalData] = useState({});
  const [dataErrors, setDataErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [expandedProject, setExpandedProject] = useState('');
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const initialsText = String(student.name || 'Student').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    const controller = new AbortController();
    const token = window.localStorage.getItem('whc-auth-token');
    const endpoints = [
      ['dashboard', 'Dashboard', '/student/dashboard'],
      ['attendance', 'Attendance', '/student/attendance'],
      ['projects', 'Projects', '/student/projects'],
      ['evaluations', 'Monthly evaluations', '/student/monthly-evaluations'],
      ['profile', 'Profile', '/student/profile'],
      ['course', 'Course and batch', '/student/course'],
    ];

    async function loadPortalData() {
      setIsLoading(true);
      setDataErrors([]);
      if (!token) {
        setDataErrors([{ label: 'Student session', message: 'Your sign-in session has expired. Please sign in again.' }]);
        setIsLoading(false);
        return;
      }

      const results = await Promise.allSettled(endpoints.map(async ([key, , path]) => {
        const response = await fetch(`${apiBase}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.message || `Request failed (${response.status})`);
        }
        return [key, result];
      }));

      if (controller.signal.aborted) return;
      const nextData = {};
      const nextErrors = [];
      results.forEach((result, index) => {
        const [, label] = endpoints[index];
        if (result.status === 'fulfilled') {
          const [key, payload] = result.value;
          nextData[key] = payload;
        } else {
          nextErrors.push({ label, message: result.reason?.message || 'Unable to load this information.' });
        }
      });
      setPortalData((current) => ({ ...current, ...nextData }));
      setDataErrors(nextErrors);
      setIsLoading(false);
    }

    loadPortalData();
    return () => controller.abort();
  }, [apiBase, refreshKey]);

  useEffect(() => {
    const refreshVisiblePortal = () => {
      if (document.visibilityState === 'visible') setRefreshKey((key) => key + 1);
    };
    window.addEventListener('focus', refreshVisiblePortal);
    document.addEventListener('visibilitychange', refreshVisiblePortal);
    return () => {
      window.removeEventListener('focus', refreshVisiblePortal);
      document.removeEventListener('visibilitychange', refreshVisiblePortal);
    };
  }, []);

  const dashboard = portalData.dashboard?.dashboard;
  const profile = portalData.profile?.profile ?? dashboard?.profile ?? student;
  const actualAttendanceRecords = portalData.attendance?.attendance ?? [];
  const actualProjects = portalData.projects?.projects ?? [];
  const actualEvaluations = portalData.evaluations?.evaluations ?? [];
  const attendanceRecords = actualAttendanceRecords;
  const attendanceSummary = portalData.attendance?.summary ?? {};
  const projects = actualProjects;
  const evaluations = actualEvaluations;
  const batches = dashboard?.batches ?? portalData.course?.batches ?? [];
  const attendancePercent = dashboard?.attendance?.percentage ?? attendanceSummary.attendancePercentage;
  const projectPercent = dashboard?.projects?.percentage;
  const evaluationPercent = dashboard?.monthlyEvaluation?.averageScore;
  const overallScore = dashboard?.performance?.overallScore;
  const placementEligibility = dashboard?.performance?.placementEligibility;
  const calendarLookup = new Map(attendanceRecords.map((record) => [String(record.date).slice(0, 10), record.status]));
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const monthDays = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const monthOffset = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const calendarCells = [
    ...Array.from({ length: monthOffset }, (_, index) => ({ key: `empty-${index}` })),
    ...Array.from({ length: monthDays }, (_, index) => {
      const day = index + 1;
      const dateKey = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key: dateKey, day, status: calendarLookup.get(dateKey) };
    }),
  ];
  const moveCalendar = (offset) => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  const changeView = (view) => {
    setActiveView(view);
    setExpandedProject('');
  };
  const activeTitle = studentNavigation.find((item) => item.id === activeView)?.label ?? 'Dashboard';
  const planLabel = studentPlanLabel(profile.plan ?? student.plan);
  const accountLabel = profile.email || profile.username || student.email || 'Account not available';
  const trainer = dashboard?.trainer ?? portalData.course?.course?.assignedTrainer ?? profile.trainer;

  function retryData() {
    setRefreshKey((key) => key + 1);
  }

  function renderAttendanceCalendar(compact = false) {
    return <section className={`student-card student-attendance-card${compact ? ' is-compact' : ''}`}>
      <div className="student-card-heading"><div className="student-card-title"><CalendarDays size={21} /><h2>Attendance</h2></div>{compact && <button className="student-link" type="button" onClick={() => changeView('attendance')}>View all <ArrowRight size={14} /></button>}</div>
      <div className="student-calendar-toolbar">
        <button type="button" aria-label="Previous month" onClick={() => moveCalendar(-1)}><ChevronLeft size={17} /></button>
        <strong>{calendarMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveCalendar(1)}><ChevronRight size={17} /></button>
      </div>
      <div className="student-calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span className="student-calendar-weekday" key={day}>{day}</span>)}
        {calendarCells.map((cell) => <span className="student-calendar-cell" key={cell.key}>{cell.day && <span className={cell.status ? `attendance-${cell.status}` : ''}>{cell.day}</span>}</span>)}
      </div>
      <div className="student-calendar-legend"><span><i className="present-dot" />Present</span><span><i className="absent-dot" />Absent</span><span><i className="no-class-dot" />No class</span></div>
    </section>;
  }

  function renderBatchCards(compact = false) {
    const listedBatches = compact ? batches.slice(0, 2) : batches;
    return <div className="student-batch-list">
      {listedBatches.length ? listedBatches.map((batch) => {
        const schedule = [Array.isArray(batch.daysOfWeek) ? batch.daysOfWeek.map((day) => day.slice(0, 3)).join(', ') : '', batch.startTime && batch.endTime ? `${batch.startTime} – ${batch.endTime}` : 'Schedule to be announced'].filter(Boolean).join(' · ');
        return <article className="student-batch-row" key={batch._id ?? batch.id ?? batch.name}>
          <span className="student-batch-icon"><Code2 size={26} /></span>
          <span className="student-batch-info"><strong>{batch.name}</strong><small><CalendarDays size={14} />{schedule}</small><small><Clock3 size={14} />{batch.trainer?.name ? `Trainer: ${batch.trainer.name}` : 'Your current learning batch'}</small></span>
          <span className={`student-status-pill ${batch.active === false ? 'upcoming' : 'active'}`}>{batch.active === false ? 'Completed' : 'Active'}</span>
          {compact && <button className="student-outline-button" type="button" onClick={() => changeView('batches')}>View details</button>}
        </article>;
      }) : <div className="student-empty-state"><UsersRound size={23} /><strong>No batch has been assigned yet</strong><span>Your batch details will appear here once they are available.</span></div>}
    </div>;
  }

  function renderProjects(compact = false) {
    const listedProjects = compact ? projects.slice(0, 2) : projects;
    return <div className="student-project-list">
      {listedProjects.length ? listedProjects.map((project) => {
        const isExpanded = expandedProject === String(project.id);
        return <article className="student-project-row" key={project.id}>
          <span className="student-project-icon"><Laptop size={25} /></span>
          <div className="student-project-copy"><strong>{project.title}</strong><p>{project.description || project.subject || 'Project assignment'}</p><small>{project.subject}{project.trainer?.name ? ` · Trainer: ${project.trainer.name}` : ''}</small>{!compact && <small className="student-project-due">Due {studentDate(project.effectiveDueDate || project.originalDueDate)}</small>}</div>
          <div className="student-project-actions"><span className={`student-status-pill ${project.submission?.status === 'submitted' ? 'active' : 'upcoming'}`}>{project.submission?.status === 'submitted' ? 'Submitted' : 'In progress'}</span><button className="student-outline-button" type="button" aria-expanded={isExpanded} onClick={() => setExpandedProject(isExpanded ? '' : String(project.id))}>{isExpanded ? 'Hide details' : 'View details'}</button></div>
          {isExpanded && <div className="student-project-detail"><span>Submission: {studentPlanLabel(project.submission?.status || 'not submitted')}</span><span>Evaluation: {project.evaluation?.status === 'evaluated' ? `${project.evaluation.marks} / ${project.totalMarks} marks` : 'Not evaluated yet'}</span>{project.submission?.remarks && <span>Trainer note: {project.submission.remarks}</span>}</div>}
        </article>;
      }) : <div className="student-empty-state"><BookOpen size={23} /><strong>No projects assigned yet</strong><span>New project work from your trainer will appear here.</span></div>}
    </div>;
  }

  function renderProfileCard(compact = false) {
    const accountDetails = accountLabel.includes('@')
      ? <a href={`mailto:${accountLabel}`}>{accountLabel}</a>
      : <span className="student-account-name">{accountLabel}</span>;
    const content = <><div className="student-profile-identity"><span className="student-profile-avatar">{initialsText}</span><div><strong>{profile.name || student.name}</strong>{accountDetails}<span className="student-profile-role">Student</span></div></div><div className="student-profile-details"><span><Phone size={15} />{profile.phone || 'Phone not available'}</span><span><BookOpen size={15} />{profile.course || 'Course not assigned'}</span><span><CreditCard size={15} />{planLabel}</span><span><CalendarDays size={15} />Enrolled {studentDate(profile.enrollmentDate)}</span>{trainer?.name && <span><UserRound size={15} />Trainer: {trainer.name}</span>}</div></>;
    return <section className={`student-card student-profile-card${compact ? ' is-compact' : ''}`}><div className="student-card-heading"><div className="student-card-title"><UserRound size={21} /><h2>My Profile</h2></div>{compact && <button className="student-link" type="button" onClick={() => changeView('profile')}>View profile <ArrowRight size={14} /></button>}</div>{content}</section>;
  }

  return <div className="student-portal">
    <aside className="student-sidebar">
      <a className="student-brand" href="#student-dashboard" onClick={(event) => { event.preventDefault(); changeView('dashboard'); }}><span className="student-brand-mark"><GraduationCap size={27} /></span><strong><span className="student-brand-accent">WHC</span> Portal</strong></a>
      <nav className="student-navigation" aria-label="Student sections">{studentNavigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`student-nav-item${activeView === id ? ' active' : ''}`} onClick={() => changeView(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <button className="student-logout" type="button" onClick={onLogout}><LogOut size={18} />Logout</button>
    </aside>

    <div className="student-main">
      <header className="student-topbar"><div className="student-mobile-brand"><GraduationCap size={22} /><span><span className="student-brand-accent">WHC</span> Portal</span></div><div className="student-topbar-user"><span>{initialsText}</span></div></header>
      <main className="student-content">
        {activeView === 'dashboard' ? <div className="student-page-heading"><div><h1>Hello, {profile.name || student.name}!</h1><p>Welcome back to your learning journey</p></div><span className="student-heading-avatar">{initialsText}</span></div> : <div className="student-page-heading"><div><h1>{activeTitle}</h1><p>{activeView === 'complaints' ? 'Raise a concern and read updates from the staff you select.' : activeView === 'projects' ? 'Track your assignments and project feedback.' : activeView === 'attendance' ? 'Review your attendance record by class date.' : activeView === 'evaluations' ? 'Review your monthly scores and trainer feedback.' : activeView === 'batches' ? 'Your enrolled classes and trainer schedule.' : 'Your student details and learning plan.'}</p></div></div>}
        {dataErrors.length > 0 && <div className="student-data-alert" role="status"><div><strong>Some student information could not be loaded.</strong><span>{dataErrors.map((error) => `${error.label}: ${error.message}`).join(' · ')}</span></div><button type="button" onClick={retryData}>Retry</button></div>}
        {isLoading && <div className="student-loading" role="status">Loading your learning dashboard…</div>}

        {activeView === 'dashboard' && <>
          <div className="student-overview-grid">
            <section className="student-card student-performance-card"><div className="student-card-heading"><div className="student-card-title"><LayoutDashboard size={21} /><h2>Dashboard</h2></div></div><div className="student-performance-content"><div className="student-score-column"><div className="student-score-ring" style={{ '--student-score': `${Math.max(0, Math.min(100, overallScore ?? 0))}%` }}><div><strong>{overallScore == null ? '—' : `${Math.round(overallScore)}%`}</strong><span>Overall Score</span></div></div><span className={`student-placement-pill ${placementEligibility === 'eligible' ? 'eligible' : ''}`}><CheckCircle size={15} />{placementEligibility === 'eligible' ? 'Eligible for placements' : placementEligibility === 'not_eligible' ? 'Placement score in progress' : 'Placement eligibility pending'}</span></div><div className="student-score-metrics"><span><CalendarDays size={18} /><span>Attendance<strong>{attendancePercent == null ? '—' : `${Math.round(attendancePercent)}%`}</strong></span></span><span><Code2 size={18} /><span>Projects<strong>{projectPercent == null ? '—' : `${Math.round(projectPercent)}%`}</strong></span></span><span><BarChart3 size={18} /><span>Monthly Evaluation<strong>{evaluationPercent == null ? '—' : `${Math.round(evaluationPercent)}%`}</strong></span></span><span className="student-current-batch"><Layers3 size={18} /><span>Current Batch<strong>{batches[0]?.name || 'Not assigned'}</strong></span></span></div></div></section>
            <section className="student-card student-batches-card"><div className="student-card-heading"><div className="student-card-title"><UsersRound size={22} /><h2>My Batches</h2></div><button className="student-link" type="button" onClick={() => changeView('batches')}>View all <ArrowRight size={14} /></button></div>{renderBatchCards(true)}</section>
          </div>
          <div className="student-detail-grid">{renderAttendanceCalendar(true)}<section className="student-card student-projects-card"><div className="student-card-heading"><div className="student-card-title"><Code2 size={21} /><h2>Projects</h2></div><button className="student-link" type="button" onClick={() => changeView('projects')}>View all <ArrowRight size={14} /></button></div>{renderProjects(true)}</section>{renderProfileCard(true)}</div>
        </>}
        {activeView === 'batches' && <section className="student-card student-full-card"><div className="student-card-heading"><div className="student-card-title"><UsersRound size={22} /><h2>My Batches</h2></div></div>{renderBatchCards()}</section>}
        {activeView === 'complaints' && <StudentComplaintsView />}
        {activeView === 'attendance' && <div className="student-attendance-page">{renderAttendanceCalendar()}<section className="student-card student-attendance-history"><div className="student-card-heading"><div className="student-card-title"><Clock3 size={21} /><h2>Class History</h2></div><span>{attendanceSummary.totalClasses ?? dashboard?.attendance?.totalClasses ?? 0} classes</span></div>{attendanceRecords.length ? attendanceRecords.map((record, index) => <div className="student-attendance-record" key={`${record.date}-${record.batch?._id ?? index}`}><span className="student-record-date">{studentDate(record.date)}</span><strong>{record.batch?.name || 'Class session'}</strong><span className={`student-attendance-status ${record.status}`}>{studentPlanLabel(record.status)}</span></div>) : <div className="student-empty-state"><CalendarDays size={23} /><strong>No class attendance recorded yet</strong><span>Completed class sessions will be listed here.</span></div>}</section></div>}
        {activeView === 'projects' && <section className="student-card student-full-card"><div className="student-card-heading"><div className="student-card-title"><BookOpen size={22} /><h2>My Projects</h2></div><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span></div>{renderProjects()}</section>}
        {activeView === 'evaluations' && <section className="student-card student-full-card"><div className="student-card-heading"><div className="student-card-title"><BarChart3 size={21} /><h2>Monthly Evaluations</h2></div><span>{evaluations.length} {evaluations.length === 1 ? 'evaluation' : 'evaluations'}</span></div>{evaluations.length ? <div className="student-evaluation-list">{evaluations.map((evaluation, index) => <article className="student-evaluation-row" key={`${evaluation.year}-${evaluation.month}-${index}`}><div className="student-evaluation-month"><strong>{new Date(evaluation.year, evaluation.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong><small>{evaluation.trainer?.name ? `Trainer: ${evaluation.trainer.name}` : 'Monthly progress review'}</small></div><strong className="student-evaluation-score">{evaluation.score}%</strong><p>{evaluation.feedback || 'No trainer feedback added.'}</p></article>)}</div> : <div className="student-empty-state"><BarChart3 size={23} /><strong>No monthly evaluations recorded yet</strong><span>Your trainer’s monthly scores and feedback will appear here.</span></div>}</section>}
        {activeView === 'profile' && <div className="student-profile-page">{renderProfileCard()}<section className="student-card student-learning-card"><div className="student-card-heading"><div className="student-card-title"><BarChart3 size={21} /><h2>Learning Progress</h2></div></div><div className="student-progress-list"><span>Overall score<strong>{overallScore == null ? 'Not available' : `${Math.round(overallScore)}%`}</strong></span><span>Attendance<strong>{attendancePercent == null ? 'Not available' : `${Math.round(attendancePercent)}%`}</strong></span><span>Monthly evaluations<strong>{evaluations.length}</strong></span><span>Projects completed<strong>{dashboard?.projects?.evaluatedProjects ?? projects.filter((project) => project.evaluation?.status === 'evaluated').length} / {projects.length}</strong></span></div></section></div>}
      </main>
    </div>
  </div>;
}

function feeStatus(student) {
  if (!Number.isFinite(student.fullFees) || !student.nextDueDate) return 'Later';
  if (student.totalPaid >= student.fullFees) return 'Paid';
  const daysUntilDue = Math.ceil((new Date(`${student.nextDueDate}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
  if (daysUntilDue < 0) return 'Overdue';
  if (daysUntilDue <= 7) return 'Upcoming';
  return 'Later';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

let sharedAudioContext;

function unlockAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  sharedAudioContext ??= new AudioContextClass();
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume();
  return sharedAudioContext;
}

const welcomeCompliments = [
  { greeting: 'Hey cutie', message: 'Your energy is lovely and your ideas are already moving in the right direction.' },
  { greeting: 'Hey genius', message: 'Your mind is sharp, and your effort is turning into real momentum today.' },
  { greeting: 'Hey sparkle', message: 'You carry a calm confidence that makes everything feel more possible.' },
  { greeting: 'Hey superstar', message: 'Your ambition is inspiring. Keep leading with focus and grace.' },
  { greeting: 'Hey sunshine', message: 'You bring warmth, clarity, and a steady drive that is hard to ignore.' },
  { greeting: 'Hey powerhouse', message: 'Your consistency is quietly creating big wins. Keep building with purpose.' },
  { greeting: 'Hey dreamer', message: 'You are thinking bigger than most people, and your effort is proving it.' },
  { greeting: 'Hey trailblazer', message: 'The way you move forward is thoughtful, strong, and genuinely inspiring.' },
  { greeting: 'Hey darling', message: 'You have the kind of discipline that turns small steps into big results.' },
  { greeting: 'Hey brilliant one', message: 'Your ideas and instincts are powerful. Trust the momentum you are creating.' },
  { greeting: 'Hey star', message: 'You are doing more than you realise, and it is shaping something beautiful.' },
  { greeting: 'Hey glow-up', message: 'Your focus is strong, and your next move is already full of potential.' },
];

function buildWelcomeMessage(accountName, role) {
  const safeName = String(accountName || (role === 'admin' ? 'Admin' : 'Counselor')).trim();
  const baseName = safeName ? safeName.split(' ')[0] : 'there';
  const avoidDarlingGreeting = role === 'trainer' && ['akshit', 'rydham'].includes(baseName.toLowerCase());
  const availableCompliments = avoidDarlingGreeting
    ? welcomeCompliments.filter((item) => item.greeting !== 'Hey darling')
    : welcomeCompliments;
  const variant = availableCompliments[Math.floor(Math.random() * availableCompliments.length)];

  return {
    greeting: `${variant.greeting}, ${baseName}!`,
    message: `${variant.message} ${role === 'admin' ? 'Your leadership is setting the pace for the whole team.' : 'Your dedicated work is helping students move forward with clarity.'}`,
  };
}

const courseCatalog = [
  { id: 'genai', name: 'GenAI', short: 'GenAI', color: '#4ca7c7', keywords: ['genai', 'generative ai', 'generative-ai', 'ai'] },
  { id: 'fullstack', name: 'Full Stack', short: 'Full Stack', color: '#5d7ce8', keywords: ['full stack', 'full-stack', 'fullstack', 'web development'] },
  { id: 'data-analytics', name: 'Data Analytics', short: 'Analytics', color: '#7a65d8', keywords: ['data analytics', 'data analysis', 'analytics', 'analytics and reporting'] },
  { id: 'machine-learning', name: 'Machine Learning', short: 'ML', color: '#ff9b54', keywords: ['machine learning', 'ml'] },
  { id: 'ai', name: 'AI', short: 'AI', color: '#ea6c86', keywords: ['ai'] },
  { id: 'data-science', name: 'Data Science', short: 'DS', color: '#53b98d', keywords: ['data science', 'datascience'] },
  { id: 'cyber-security', name: 'Cyber Security', short: 'Cyber', color: '#f0b23a', keywords: ['cyber security', 'security'] },
];

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'complaints', label: 'Complaints', icon: MessageCircle },
  { id: 'leads', label: 'Leads', icon: ClipboardList },
  { id: 'students', label: 'Students', icon: ContactRound },
  { id: 'counselors', label: 'Counselors', icon: UsersRound },
  { id: 'trainers', label: 'Trainers', icon: GraduationCap },
  { id: 'fees', label: 'Fees', icon: CreditCard },
  { id: 'my-students', label: 'New admission', icon: ContactRound, counselorOnly: true },
  { id: 'courses', label: 'Analytics', icon: BookOpen, adminOnly: true },
  { id: 'counselor-performance', label: 'Counselor Performance', icon: BarChart3, adminOnly: true },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];

function LoginPage({ counselors, trainers = initialTrainers, onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginAccounts = [
    { name: 'Administrator', role: 'Admin', email: 'adminwhc@gmail.com', password: 'AdminDemo26' },
    ...counselors.map((person) => ({ name: person.name, role: 'Counselor', email: person.email, password: 'CounselorDemo26' })),
    ...trainers.map((trainer) => ({ name: trainer.name, role: 'Trainer', email: trainer.email, password: trainer.password })),
  ];

  
async function handleSubmit(event) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  if (!acceptedTerms) {
    setNotice("Please accept the terms and privacy policy to continue.");
    return;
  }

  const username = String(form.get("email") || "")
    .trim()
    .toLowerCase();

  const passwordValue = String(form.get("password") || "");

  if (!username || !passwordValue) {
    setNotice("Please enter your username and password.");
    return;
  }

  setNotice("Signing in...");

  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
  ).replace(/\/$/, "");

  try {
    // First attempt employee login.
    let response = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password: passwordValue,
      }),
    });

    let result = await response.json().catch(() => ({}));

    // If no employee account matches, attempt student login.
    if (response.status === 401) {
      response = await fetch(`${apiBase}/auth/student-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: passwordValue,
        }),
      });

      result = await response.json().catch(() => ({}));

      if (response.ok && result.success && result.token && result.student) {
        window.localStorage.setItem("whc-auth-token", result.token);

        const studentAccount = {
          ...result.student,
          id: result.student.id,
          role: "student",
          email: result.student.username,
        };

        onLogin(studentAccount);
        return;
      }
    }

    if (!response.ok || !result.success || !result.token || !result.user) {
      throw new Error(
        result.message || "Invalid username or password."
      );
    }

    window.localStorage.setItem("whc-auth-token", result.token);

    const role =
      result.user.role === "counsellor"
        ? "counselor"
        : result.user.role;

    const account = {
      ...result.user,
      id: result.user.id,
      role,
      email: result.user.email || result.user.username,
      trainerId: result.user.id,
      counselorId: result.user.id,
    };

    unlockAudioContext();
    onLogin(account);

  } catch (error) {
    setNotice(
      error.message ||
      "Unable to connect to the WHC server. Check the API URL."
    );
  }
}


  return (
    <div className="page-shell simple-login-shell">
      <main className="login-layout simple-login-layout">
        <section className="form-panel simple-login-panel" aria-labelledby="login-title">
          <div className="login-card simple-login-card">
            <p className="login-brand-mark"><strong>WHC</strong><span>LEARNING &amp; CREATIVE STUDIO</span></p>
            <div className="login-heading">
              <h2 id="login-title">Login</h2>
              <p>Sign in to your workspace</p>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <label className="field-label" htmlFor="email">Email or username</label>
              <input id="email" name="email" type="text" placeholder="Email or username" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
              <div className="password-label-row"><label className="field-label" htmlFor="password">Password</label></div>
              <div className="password-field">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="visibility-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              <a className="forgot-link" href="#forgot-password" onClick={(event) => { event.preventDefault(); setNotice('Password recovery will be connected when authentication is added.'); }}>Forgot Password?</a>
              <label className="terms-row">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                <span>I accept the Terms &amp; Conditions and Privacy Policy of WHC.</span>
              </label>
              <div className="submit-row"><button className="login-button" type="submit">Login <ArrowRight size={17} /></button></div>
              <p className="form-notice" aria-live="polite">{notice}</p>
            </form>
          </div>
        </section>
        <aside className="login-account-panel" aria-labelledby="workspace-access-title">
          <div className="login-account-heading"><div><p>WHC PORTAL</p><h2 id="workspace-access-title">One workspace. Every role.</h2></div></div>
          <div className="login-account-list">
            <div className="login-account-row"><span className="login-account-identity"><strong>Administrator</strong><small>Manage the organization</small></span><span className="login-account-credentials"><span>Secure account access</span></span></div>
            <div className="login-account-row"><span className="login-account-identity"><strong>Counselor</strong><small>Leads and student admissions</small></span><span className="login-account-credentials"><span>Assigned account access</span></span></div>
            <div className="login-account-row"><span className="login-account-identity"><strong>Trainer</strong><small>Batches and student progress</small></span><span className="login-account-credentials"><span>Assigned account access</span></span></div>
            <div className="login-account-row"><span className="login-account-identity"><strong>Student</strong><small>Learning and placement progress</small></span><span className="login-account-credentials"><span>Student account access</span></span></div>
          </div>
          <p className="login-account-hint">Use the credentials created by your WHC administrator.</p>
        </aside>
      </main>
    </div>
  );
}

function initials(name) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeCompliment, setWelcomeCompliment] = useState(welcomeCompliments[0]);
  const [typedCompliment, setTypedCompliment] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [counselors, setCounselors] = useState(initialCounselors);
  const [trainers, setTrainers] = useState(initialTrainers);
  const [trainerAssignmentsState, setTrainerAssignmentsState] = useState(trainerAssignments);
  const [leads, setLeads] = useState(initialLeads);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [leaderboardLoadError, setLeaderboardLoadError] = useState('');
  const [showCounselorForm, setShowCounselorForm] = useState(false);
  const [showTrainerForm, setShowTrainerForm] = useState(false);
  const [employeeCredentials, setEmployeeCredentials] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [toast, setToast] = useState('');
  const [toastGeneration, setToastGeneration] = useState(0);
  const [students, setStudents] = useState(enrolledStudents);
  const [studentFeeRecords, setStudentFeeRecords] = useState(null);
  const [studentFeeLoadError, setStudentFeeLoadError] = useState('');
  const [studentCourse, setStudentCourse] = useState('All');
  const [studentCounselor, setStudentCounselor] = useState('All');
  const [studentTier, setStudentTier] = useState('All');
  const [studentStatus, setStudentStatus] = useState('All');
  const [studentCourseType, setStudentCourseType] = useState('All');
  const [studentDuration, setStudentDuration] = useState('All');
  const [studentStartDate, setStudentStartDate] = useState('');
  const [studentEndDate, setStudentEndDate] = useState('');
  const [studentRegistrationStartDate, setStudentRegistrationStartDate] = useState('');
  const [studentRegistrationEndDate, setStudentRegistrationEndDate] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [callingStudent, setCallingStudent] = useState(null);
  const [assigningTrainerStudentId, setAssigningTrainerStudentId] = useState(null);
  const [updatingStudentStatusId, setUpdatingStudentStatusId] = useState(null);
  const [handoffTargetId, setHandoffTargetId] = useState('');
  const [registrationNotice, setRegistrationNotice] = useState('');
  const [studentAdmissionCredentials, setStudentAdmissionCredentials] = useState(null);
  const [feeFilter, setFeeFilter] = useState('All');
  const [feeCollectionStudentId, setFeeCollectionStudentId] = useState(null);
  const [feeReceipt, setFeeReceipt] = useState(null);
  const [celebration, setCelebration] = useState(false);

  function showToast(message) {
    setToast(message);
    setToastGeneration((generation) => generation + 1);
  }

  useEffect(() => {
    if (!toast) return undefined;
    const dismissTimer = window.setTimeout(() => setToast(''), 11000);
    return () => window.clearTimeout(dismissTimer);
  }, [toast, toastGeneration]);

  useEffect(() => {
    if (!showWelcomePopup) {
      setTypedCompliment('');
      return undefined;
    }

    let characterIndex = 0;
    const typingTimer = window.setInterval(() => {
      characterIndex += 1;
      setTypedCompliment(welcomeCompliment.message.slice(0, characterIndex));
      if (characterIndex >= welcomeCompliment.message.length) window.clearInterval(typingTimer);
    }, 32);

    return () => window.clearInterval(typingTimer);
  }, [showWelcomePopup, welcomeCompliment]);

  useEffect(() => {
    if (!showWelcomePopup) return undefined;
    const dismissTimer = window.setTimeout(() => setShowWelcomePopup(false), 4500);
    return () => window.clearTimeout(dismissTimer);
  }, [showWelcomePopup]);

  useEffect(() => {
    if (!loggedIn || !currentUser || currentUser.role === 'student') return undefined;
    let active = true;

    async function loadWorkspaceRecords() {
      try {
        const isAdmin = currentUser.role === 'admin';
        const isTrainer = currentUser.role === 'trainer';
        const [leadResult, studentResult, counselorResult, trainerResult, leaderboardResult] = await Promise.all([
          isTrainer ? Promise.resolve({ leads: [] }) : authenticatedRequest(isAdmin ? '/leads' : '/counsellor/leads'),
          authenticatedRequest(isAdmin ? '/students' : isTrainer ? '/trainer/students' : '/counsellor/students'),
          isAdmin ? authenticatedRequest('/employees/counsellors') : Promise.resolve(null),
          isAdmin ? authenticatedRequest('/employees/trainers') : Promise.resolve(null),
          isTrainer ? Promise.resolve({ leaderboard: [] }) : authenticatedRequest('/leaderboard'),
        ]);
        if (!active) return;

        if (!isTrainer) {
          setLeaderboardEntries((leaderboardResult.leaderboard ?? []).map((entry) => ({
            id: entry.counsellorId,
            name: entry.name,
            convertedLeads: entry.convertedLeads ?? 0,
          })));
          setLeaderboardLoadError('');
        }

        const dbLeads = (leadResult.leads ?? []).map((lead) => ({
          id: lead._id,
          student: lead.studentName,
          course: lead.course,
          phone: lead.phone,
          counselorId: lead.assignedCounsellor?._id ?? lead.assignedCounsellor ?? null,
          followUpCounts: {
            call: lead.followUpCounts?.call ?? 0,
            whatsapp: lead.followUpCounts?.whatsapp ?? 0,
          },
          followUpHistory: lead.followUpHistory ?? [],
          status: ({ pending: 'New', contacted: 'Follow-up', follow_up: 'Follow-up', converted: 'Enrolled', lost: 'Dead' })[lead.status] ?? 'New',
          createdAt: lead.createdAt ?? null,
          convertedAt: lead.convertedAt ?? null,
          created: new Date(lead.createdAt).toLocaleDateString('en-IN'),
        }));
        const dbStudents = (studentResult.students ?? []).map((student) => ({
          id: student._id,
          name: student.name,
          age: 18,
          email: student.email ?? '',
          username: student.username,
          phone: student.phone,
          college: student.college ?? '',
          course: student.course,
          status: ({ active: 'Active', 'non-active': 'Non-active', completed: 'Completed', drop: 'Dropped' })[student.status] ?? 'Active',
          batchId: student.batch?._id ?? student.batch ?? null,
          trainerId: student.trainer?._id ?? student.trainer ?? null,
          trainerName: student.trainer?.name ?? '',
          leadId: student.lead?._id ?? student.lead ?? null,
          tier: ({ regular: 'Regular', premium: 'Premium', platinum: 'Platinum', platinum_pro: 'Pro Platinum', industrial_training_6_weeks: '6-week Industrial Training', industrial_training_6_months: '6 month Industrial Training' })[student.plan] ?? 'Regular',
          fatherName: student.fatherName ?? '',
          counselorId: student.counsellor?._id ?? student.counsellor ?? null,
          counselorName: student.counsellor?.name ?? '',
          enrolledDate: student.enrollmentDate ? String(student.enrollmentDate).slice(0, 10) : '',
          registrationDate: student.enrollmentDate ? String(student.enrollmentDate).slice(0, 10) : '',
          evaluations: [],
          history: [],
          fullFees: 0,
          totalPaid: 0,
          registrationAmount: 0,
          nextDueAmount: 0,
          nextDueDate: '',
          payments: [],
        }));
        setLeads(dbLeads);
        setStudents(normalizeStudentRecords(dbStudents));
        setTrainerAssignmentsState(dbStudents.reduce((assignments, student) => {
          if (!student.trainerId) return assignments;
          const trainerId = String(student.trainerId);
          const assignment = assignments[trainerId] ?? { students: [], subjects: [], courses: [] };
          if (!assignment.students.includes(student.name)) assignment.students.push(student.name);
          if (student.course && !assignment.subjects.includes(student.course)) assignment.subjects.push(student.course);
          if (student.course && !assignment.courses.includes(student.course)) assignment.courses.push(student.course);
          assignments[trainerId] = assignment;
          return assignments;
        }, {}));

        if (counselorResult) {
          setCounselors((counselorResult.counsellors ?? []).map((person) => ({
            id: person._id,
            name: person.name,
            email: person.email,
            phone: person.phone,
            username: person.username,
            active: person.status === 'active',
            onLeave: person.employmentStatus === 'on_leave',
          })));
        }
        if (trainerResult) {
          setTrainers((trainerResult.trainers ?? []).map((person) => ({
            id: person._id,
            name: person.name,
            email: person.email,
            phone: person.phone,
            username: person.username,
            specialty: person.subjects?.join(', ') || '',
            active: person.status === 'active',
            onLeave: person.employmentStatus === 'on_leave',
          })));
        }
      } catch (error) {
        if (active) {
          setLeaderboardLoadError(error.message);
          showToast(`Could not load live workspace records: ${error.message}`);
        }
      }
    }

    loadWorkspaceRecords();
    return () => { active = false; };
  }, [loggedIn, currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!loggedIn || currentUser?.role !== 'admin' || !['students', 'counselor-performance'].includes(activeView)) return undefined;
    let active = true;
    setStudentFeeRecords(null);
    setStudentFeeLoadError('');

    authenticatedRequest('/fees')
      .then(({ fees = [] }) => {
        if (active) setStudentFeeRecords(fees);
      })
      .catch((error) => {
        if (active) {
          setStudentFeeRecords(null);
          setStudentFeeLoadError(error.message);
        }
      });

    return () => { active = false; };
  }, [loggedIn, currentUser?.role, activeView]);

  async function addCounselor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('name')).trim();
    const email = String(values.get('email')).trim();
    const phone = String(values.get('phone')).trim();
    const username = String(values.get('username')).trim();
    const password = String(values.get('password'));
    try {
      const { employee } = await authenticatedRequest('/employees/counsellors', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, username, password }),
      });
      setCounselors((items) => [...items, {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        username: employee.username,
        active: employee.status === 'active',
        onLeave: false,
      }]);
      setEmployeeCredentials((current) => ({ ...current, [employee.id]: { username: employee.username, password } }));
      form.reset();
      setShowCounselorForm(false);
      showToast(`Counselor account created. Share the username and password shown in the team list securely.`);
    } catch (error) {
      showToast(`Could not create counselor login: ${error.message}`);
    }
  }

  async function addTrainer(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('name')).trim();
    const email = String(values.get('email')).trim();
    const phone = String(values.get('phone')).trim();
    const username = String(values.get('username')).trim();
    const password = String(values.get('password'));
    try {
      const { employee } = await authenticatedRequest('/employees/trainers', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, username, password, specialty: String(values.get('specialty')).trim() }),
      });
      setTrainers((items) => [...items, {
        id: employee.id,
        name: employee.name,
        specialty: String(values.get('specialty')).trim(),
        email: employee.email,
        phone: employee.phone,
        username: employee.username,
      }]);
      setEmployeeCredentials((current) => ({ ...current, [employee.id]: { username: employee.username, password } }));
      form.reset();
      setShowTrainerForm(false);
      showToast(`Trainer account created. Share the username and password shown in the team list securely.`);
    } catch (error) {
      showToast(`Could not create trainer login: ${error.message}`);
    }
  }

  async function updateCounselor(id, event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const employee = {
      name: String(values.get('name')).trim(),
      email: String(values.get('email')).trim(),
      phone: String(values.get('phone')).trim(),
      username: String(values.get('username')).trim(),
    };
    const password = String(values.get('password'));
    if (password) employee.password = password;

    try {
      await authenticatedRequest(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(employee),
      });
      setCounselors((items) => items.map((counselor) => counselor.id === id ? {
        ...counselor,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        username: employee.username,
      } : counselor));
      if (password) setEmployeeCredentials((current) => ({ ...current, [id]: { username: employee.username, password } }));
      showToast('Counselor information updated.');
      return true;
    } catch (error) {
      showToast(`Could not update counselor: ${error.message}`);
      return false;
    }
  }

  async function updateTrainer(id, event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const employee = {
      name: String(values.get('name')).trim(),
      email: String(values.get('email')).trim(),
      phone: String(values.get('phone')).trim(),
      username: String(values.get('username')).trim(),
      specialty: String(values.get('specialty')).trim(),
    };
    const password = String(values.get('password'));
    if (password) employee.password = password;

    try {
      await authenticatedRequest(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(employee),
      });
      setTrainers((items) => items.map((trainer) => trainer.id === id ? {
        ...trainer,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        username: employee.username,
        specialty: employee.specialty,
      } : trainer));
      if (password) setEmployeeCredentials((current) => ({ ...current, [id]: { username: employee.username, password } }));
      showToast('Trainer information updated.');
      return true;
    } catch (error) {
      showToast(`Could not update trainer: ${error.message}`);
      return false;
    }
  }

  async function addLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const studentName = String(values.get('student')).trim();
    const phone = String(values.get('phone')).trim();
    const course = String(values.get('course')).trim();
    const assignedCounsellor = String(values.get('counselorId') || '');
    try {
      const { lead } = await authenticatedRequest('/leads', {
        method: 'POST',
        body: JSON.stringify({ studentName, phone, course, assignedCounsellor: assignedCounsellor || null }),
      });
      setLeads((items) => [{
        id: lead._id,
        student: lead.studentName,
        course: lead.course,
        phone: lead.phone,
        counselorId: lead.assignedCounsellor?._id ?? lead.assignedCounsellor ?? null,
        followUpCounts: { call: 0, whatsapp: 0 },
        followUpHistory: lead.followUpHistory ?? [],
        status: 'New',
        createdAt: lead.createdAt ?? new Date().toISOString(),
        convertedAt: lead.convertedAt ?? null,
        created: new Date(lead.createdAt).toLocaleDateString('en-IN'),
      }, ...items]);
      form.reset();
      showToast('New lead assigned.');
    } catch (error) {
      showToast(`Could not create lead: ${error.message}`);
    }
  }

  async function updateCounselorLead(id, event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const updatedDetails = {
      studentName: String(values.get('studentName')).trim(),
      phone: String(values.get('phone')).trim(),
      course: String(values.get('course')).trim(),
    };

    try {
      await authenticatedRequest(`/counsellor/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedDetails),
      });
      setLeads((items) => items.map((lead) => lead.id === id ? {
        ...lead,
        student: updatedDetails.studentName,
        phone: updatedDetails.phone,
        course: updatedDetails.course,
      } : lead));
      showToast('Lead details updated.');
      return true;
    } catch (error) {
      showToast(`Could not update lead: ${error.message}`);
      return false;
    }
  }

  async function updateAdminLead(id, event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const updatedDetails = {
      studentName: String(values.get('studentName')).trim(),
      phone: String(values.get('phone')).trim(),
      course: String(values.get('course')).trim(),
      assignedCounsellor: String(values.get('assignedCounsellor') || '') || null,
    };

    try {
      const { lead: updatedLead } = await authenticatedRequest(`/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedDetails),
      });
      setLeads((items) => items.map((lead) => lead.id === id ? {
        ...lead,
        student: updatedLead.studentName,
        phone: updatedLead.phone,
        course: updatedLead.course,
        counselorId: updatedLead.assignedCounsellor?._id ?? updatedLead.assignedCounsellor ?? null,
      } : lead));
      showToast('Lead details updated.');
      return true;
    } catch (error) {
      showToast(`Could not update lead: ${error.message}`);
      return false;
    }
  }

  async function addRegistration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('studentName')).trim();
    const fatherName = String(values.get('fatherName')).trim();
    const phone = String(values.get('phone')).trim();
    const course = String(values.get('course')).trim();
    let credentials;
    let createdStudent;
    try {
      ({ credentials, student: createdStudent } = await authenticatedRequest('/counsellor/students', {
        method: 'POST',
        body: JSON.stringify({ name, fatherName, phone, course }),
      }));
    } catch (error) {
      setRegistrationNotice(`Admission was not created: ${error.message}`);
      return;
    }
    const registrationDate = createdStudent.enrollmentDate ? String(createdStudent.enrollmentDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const registration = {
      id: createdStudent.id,
      username: credentials.username,
      name,
      fatherName: createdStudent.fatherName ?? fatherName,
      age: Number(values.get('age')) || 18,
      email: String(values.get('email')).trim(),
      phone,
      alternativePhone: String(values.get('alternativePhone')).trim(),
      course,
      enrolledDate: registrationDate,
      registrationDate,
      courseType: 'Full time',
      duration: '6 months',
      courseStartDate: String(values.get('courseStartDate')) || new Date().toISOString().slice(0, 10),
      courseEndDate: String(values.get('courseEndDate')) || dateAfterDuration(String(values.get('courseStartDate')) || new Date().toISOString().slice(0, 10), String(values.get('duration')).trim()),
      tier: String(values.get('tier')),
      fullFees: Number(values.get('fullFees')),
      registrationAmount: Number(values.get('registrationAmount')),
      totalPaid: Number(values.get('registrationAmount')),
      nextDueAmount: Number(values.get('nextDueAmount')),
      nextDueDate: String(values.get('nextDueDate')),
      counselorId: currentUser.counselorId,
      evaluations: [],
      history: ['Registration submitted by ' + currentUser.name],
      payments: [{ id: `${Date.now()}-registration`, amount: Number(values.get('registrationAmount')), date: new Date().toISOString().slice(0, 10), note: 'Registration received' }],
    };
    setStudents((items) => [registration, ...items]);
    setRegistrationNotice(`${registration.name}'S ADMISSION WAS CREATED. Save these login details now.`);
    setStudentAdmissionCredentials({
      username: credentials.username,
      password: credentials.password,
      passwordSource: credentials.passwordSource,
    });
    showToast('Student admission and login created.');
    form.reset();
  }

  function recordFeePayment(studentId, event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const amount = Number(values.get('amount'));
    if (!amount) return;
    const student = students.find((item) => item.id === studentId);
    if (!student || amount > Math.max(0, student.fullFees - student.totalPaid)) return;
    const nextDueAmount = Math.max(0, Number(values.get('nextDueAmount')) || 0);
    const nextDueDate = String(values.get('nextDueDate')).trim();
    const payment = {
      id: Date.now(),
      amount,
      date: new Date().toISOString().slice(0, 10),
      mode: String(values.get('mode')),
      note: String(values.get('note')).trim() || 'Fee payment received',
    };
    setStudents((items) => items.map((student) => student.id === studentId ? {
      ...student,
      totalPaid: Math.min(student.fullFees, student.totalPaid + amount),
      nextDueAmount,
      nextDueDate: nextDueDate || student.nextDueDate,
      payments: [payment, ...(student.payments ?? [])],
    } : student));
    setFeeReceipt({ student, payment, balanceAfter: Math.max(0, student.fullFees - student.totalPaid - amount) });
    setFeeCollectionStudentId(null);
    showToast('Payment recorded. Receipt is ready.');
  }

  async function deleteLeadRecord(lead) {
    if (!window.confirm(`Permanently delete the lead for ${lead.student}?`)) return;
    try {
      if (!/^[a-f\d]{24}$/i.test(String(lead.id))) throw new Error('Lead has no valid database ID.');
      await authenticatedRequest(`/leads/${lead.id}`, { method: 'DELETE' });
      setLeads((items) => items.filter((item) => item.id !== lead.id));
      showToast(`${lead.student}'s lead was permanently deleted.`);
    } catch (error) {
      showToast(`Could not delete lead: ${error.message}`);
    }
  }

  async function deleteStudentRecord(student) {
    if (!window.confirm(`Permanently delete ${student.name}'s student record?`)) return;
    try {
      if (!/^[a-f\d]{24}$/i.test(String(student.id))) throw new Error('Student has no valid database ID.');
      await authenticatedRequest(`/students/${student.id}`, { method: 'DELETE' });
      setStudents((items) => items.filter((item) => String(item.id) !== String(student.id)));
      if (student.leadId) {
        setLeads((items) => items.filter((item) => String(item.id) !== String(student.leadId)));
        try {
          const { leaderboard = [] } = await authenticatedRequest('/leaderboard');
          setLeaderboardEntries(leaderboard.map((entry) => ({
            id: entry.counsellorId,
            name: entry.name,
            convertedLeads: entry.convertedLeads ?? 0,
          })));
        } catch (refreshError) {
          showToast(`${student.name} was deleted, but the leaderboard could not be refreshed: ${refreshError.message}`);
          return;
        }
      }
      showToast(`${student.name}'s student record was permanently deleted.`);
    } catch (error) {
      showToast(`Could not delete student: ${error.message}`);
    }
  }

  async function recordLeadFollowUp(id, channel) {
    try {
      if (!/^[a-f\d]{24}$/i.test(String(id))) throw new Error('Lead has no valid database ID.');
      const path = currentUser.role === 'counselor'
        ? `/counsellor/leads/${id}/follow-ups`
        : `/leads/${id}/follow-ups`;
      const { lead } = await authenticatedRequest(path, {
        method: 'POST',
        body: JSON.stringify({ channel }),
      });
      setLeads((items) => items.map((item) => item.id === id
        ? { ...item, followUpCounts: lead.followUpCounts, followUpHistory: lead.followUpHistory ?? item.followUpHistory }
        : item));
      showToast(`${channel === 'call' ? 'Call' : 'WhatsApp'} follow-up recorded.`);
      return true;
    } catch (error) {
      showToast(`Could not record follow-up: ${error.message}`);
      return false;
    }
  }

  async function assignStudentTrainer(student, trainerId) {
    if (!trainerId || !/^[a-f\d]{24}$/i.test(String(student.id))) return;
    setAssigningTrainerStudentId(student.id);
    try {
      const { student: updatedStudent } = await authenticatedRequest(`/students/${student.id}/trainer`, {
        method: 'PATCH',
        body: JSON.stringify({ trainerId }),
      });
      setStudents((items) => items.map((item) => item.id === student.id
        ? {
          ...item,
          trainerId: updatedStudent.trainer?._id ?? updatedStudent.trainer ?? trainerId,
          trainerName: updatedStudent.trainer?.name ?? trainers.find((trainer) => trainer.id === trainerId)?.name ?? '',
        }
        : item));
      showToast(`${student.name} assigned to ${updatedStudent.trainer?.name ?? 'the selected trainer'}.`);
    } catch (error) {
      showToast(`Could not assign trainer: ${error.message}`);
    } finally {
      setAssigningTrainerStudentId(null);
    }
  }

  async function updateStudentStatus(student, status) {
    if (!/^[a-f\d]{24}$/i.test(String(student.id))) {
      showToast('Could not update student status: student has no valid database ID.');
      return;
    }

    setUpdatingStudentStatusId(student.id);
    try {
      const { student: updatedStudent } = await authenticatedRequest(`/students/${student.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: studentStatusApiValues[status] }),
      });
      const updatedStatus = ({ active: 'Active', completed: 'Completed', drop: 'Dropped', 'non-active': 'Non-active' })[updatedStudent.status] ?? status;
      setStudents((items) => items.map((item) => item.id === student.id ? { ...item, status: updatedStatus } : item));
      showToast(`${student.name}'s status changed to ${updatedStatus}.`);
    } catch (error) {
      showToast(`Could not update student status: ${error.message}`);
    } finally {
      setUpdatingStudentStatusId(null);
    }
  }

  async function removeCounselor(id) {
    const counselor = counselors.find((person) => String(person.id) === String(id));
    if (!counselor || !window.confirm(`Permanently delete counselor ${counselor.name}?`)) return;
    try {
      if (!/^[a-f\d]{24}$/i.test(String(id))) throw new Error('Counselor has no valid database ID.');
      await authenticatedRequest(`/employees/${id}`, { method: 'DELETE' });
      setCounselors((items) => items.filter((person) => String(person.id) !== String(id)));
      setLeaderboardEntries((items) => items.filter((entry) => String(entry.id) !== String(id)));
      showToast(`${counselor.name} was permanently deleted.`);
    } catch (error) {
      showToast(`Could not delete counselor: ${error.message}`);
    }
  }

  function toggleCounselorLeave(id) {
    const counselor = counselors.find((person) => person.id === id);
    if (!counselor) return;
    setCounselors((items) => items.map((person) => person.id === id ? { ...person, onLeave: !person.onLeave } : person));
    setHandoffTargetId('');
    showToast(`${counselor.name} marked ${counselor.onLeave ? 'available' : 'on leave'}.`);
  }

  function transferCounselorWork(fromId, toId) {
    const target = counselors.find((person) => person.id === Number(toId));
    const source = counselors.find((person) => person.id === fromId);
    const openLeadIds = leads.filter((lead) => lead.counselorId === fromId && lead.status !== 'Enrolled').map((lead) => lead.id);
    if (!source?.onLeave || !target || target.onLeave || openLeadIds.length === 0) return;
    const leadIdSet = new Set(openLeadIds);
    setLeads((items) => items.map((lead) => leadIdSet.has(lead.id) ? { ...lead, counselorId: target.id } : lead));
    showToast(`${openLeadIds.length} open ${openLeadIds.length === 1 ? 'lead' : 'leads'} transferred to ${target.name}.`);
    setHandoffTargetId('');
  }

  async function removeTrainer(id) {
    const trainer = trainers.find((person) => String(person.id) === String(id));
    if (!trainer || !window.confirm(`Permanently delete trainer ${trainer.name}?`)) return;
    try {
      if (!/^[a-f\d]{24}$/i.test(String(id))) throw new Error('Trainer has no valid database ID.');
      await authenticatedRequest(`/employees/${id}`, { method: 'DELETE' });
      setTrainers((items) => items.filter((person) => String(person.id) !== String(id)));
      showToast(`${trainer.name} was permanently deleted.`);
    } catch (error) {
      showToast(`Could not delete trainer: ${error.message}`);
    }
  }

  async function setLeadStatus(id, status) {
    if (currentUser.role !== 'counselor') {
      showToast('Only counselors can change lead status.');
      return;
    }
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;
    try {
      if (/^[a-f\d]{24}$/i.test(String(id))) {
        if (status === 'Enrolled') {
          const { student, credentials } = await authenticatedRequest(`/counsellor/students/convert-lead/${id}`, { method: 'POST' });
          const registrationDate = student.enrollmentDate ? String(student.enrollmentDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
          setStudents((items) => [{
            id: student._id,
            name: student.name,
            age: 18,
            email: student.email ?? '',
            username: student.username,
            phone: student.phone,
            course: student.course,
            enrolledDate: registrationDate,
            registrationDate,
            tier: 'Regular',
            fatherName: student.fatherName ?? '',
            counselorId: student.counsellor?._id ?? student.counsellor ?? null,
            evaluations: [],
            history: [],
            fullFees: 0,
            totalPaid: 0,
            payments: [],
          }, ...items]);
          setStudentAdmissionCredentials(credentials);
          setRegistrationNotice(`${student.name}'s admission is complete. Share the login details shown on My Students.`);
          showToast(`Admission created for ${student.name}. Username: ${credentials.username}; initial password: phone number.`);
          if (currentUser.role === 'counselor') setActiveView('my-students');
        } else {
          const dbStatus = ({ New: 'pending', 'Follow-up': 'follow_up', Dead: 'lost' })[status];
          await authenticatedRequest(`/counsellor/leads/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: dbStatus }),
          });
          showToast(`Lead status updated to ${status}.`);
        }
      } else {
        throw new Error('Lead has no valid database ID.');
      }
      setLeads((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    } catch (error) {
      showToast(`Could not update lead: ${error.message}`);
    }
  }

  async function saveStudent(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const updatedStudent = {
      ...editingStudent,
      name: String(values.get('name')).trim(),
      email: String(values.get('email')).trim(),
      phone: String(values.get('phone')).trim(),
      fatherName: String(values.get('fatherName')).trim(),
      course: String(values.get('course')).trim(),
      courseType: editingStudent.courseType || 'Full time',
      duration: editingStudent.duration || '6 months',
      courseStartDate: String(values.get('courseStartDate')),
      courseEndDate: String(values.get('courseEndDate')) || dateAfterDuration(String(values.get('courseStartDate')), editingStudent.duration || '6 months'),
      tier: String(values.get('tier')),
      trainingDurations: ['6 weeks', '6 months'],
    };
    try {
      if (currentUser.role === 'admin') {
        await authenticatedRequest(`/students/${updatedStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify({ fatherName: updatedStudent.fatherName }),
        });
      }
      setStudents((items) => items.map((student) => student.id === updatedStudent.id ? updatedStudent : student));
      setEditingStudent(null);
      showToast(`${updatedStudent.name}'s record updated.`);
    } catch (error) {
      showToast(`Could not update student: ${error.message}`);
    }
  }

  if (!loggedIn) {
    return <LoginPage counselors={counselors} trainers={trainers} onLogin={(account) => {
      const initialGreeting = buildWelcomeMessage(account.name, account.role);
      setEmployeeCredentials({});
      setStudentAdmissionCredentials(null);
      setRegistrationNotice('');
      setCurrentUser(account);
      setAdminEmail(account.email);
      setActiveView('overview');
      setWelcomeCompliment(initialGreeting);
      setLoggedIn(true);
      setShowWelcomePopup(account.role !== 'student');
    }} />;
  }

  if (currentUser?.role === 'student') {
    return <StudentPortal
      student={currentUser}
      onLogout={() => {
        window.localStorage.removeItem('whc-auth-token');
        setLoggedIn(false);
        setCurrentUser(null);
        setActiveView('overview');
      }}
    />;
  }

  const activeTitle = navigation.find((item) => item.id === activeView)?.label ?? 'Overview';
  const trainerNavigation = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'complaints', label: 'Complaints', icon: MessageCircle },
    { id: 'attendance', label: 'Mark Attendance', icon: ClipboardList },
    { id: 'students', label: 'Students', icon: ContactRound },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'evaluations', label: 'Evaluations', icon: Trophy },
    { id: 'projects', label: 'Projects', icon: BookOpen },
    { id: 'batches', label: 'Batches', icon: GraduationCap },
  ];
  const visibleNavigation = currentUser.role === 'trainer'
    ? trainerNavigation
    : navigation.filter((item) => (!item.adminOnly || currentUser.role === 'admin') && (!item.counselorOnly || currentUser.role === 'counselor') && (currentUser.role === 'admin' || !['counselors', 'trainers', 'courses'].includes(item.id)));
  const activeLeads = leads.filter((lead) => lead.status !== 'Enrolled');
  const trainerAssignment = currentUser.role === 'trainer'
    ? trainerAssignmentsState[currentUser.trainerId] ?? {
      students: students.filter((student) => String(student.trainerId) === String(currentUser.trainerId)).map((student) => student.name),
      subjects: [...new Set(students.filter((student) => String(student.trainerId) === String(currentUser.trainerId)).map((student) => student.course).filter(Boolean))],
      courses: [...new Set(students.filter((student) => String(student.trainerId) === String(currentUser.trainerId)).map((student) => student.course).filter(Boolean))],
    }
    : null;
  const counselorStudents = students.filter((student) => (
    currentUser.counselorId != null &&
    student.counselorId != null &&
    String(student.counselorId) === String(currentUser.counselorId)
  ));
  const roleStudents = currentUser.role === 'admin'
    ? students
    : currentUser.role === 'trainer'
      ? students.filter((student) => trainerAssignment.students.includes(student.name))
      : counselorStudents;
  const coursePopularity = courseCatalog.map((course) => {
    const liveMatches = [...students, ...leads].reduce((count, item) => {
      const normalizedCourse = String(item.course ?? '').toLowerCase().replace(/[^a-z\s-]/g, ' ');
      return count + (course.keywords.some((keyword) => normalizedCourse.includes(keyword)) ? 1 : 0);
    }, 0);

    const count = liveMatches;
    return { ...course, count };
  }).sort((a, b) => b.count - a.count);
  const filteredStudents = roleStudents.filter((student) => {
    const matchesCourse = studentCourse === 'All' || student.course === studentCourse;
    const matchesCounselor = studentCounselor === 'All' || String(student.counselorId) === studentCounselor;
    const matchesTier = studentTier === 'All' || student.tier === studentTier;
    const matchesStatus = currentUser.role !== 'admin' || studentStatus === 'All' || (student.status ?? 'Active') === studentStatus;
    const registrationDate = student.registrationDate || student.enrolledDate || '';
    const courseStart = student.courseStartDate || student.enrolledDate || '';
    const courseEnd = student.courseEndDate || dateAfterDuration(courseStart, student.duration);
    const matchesStart = currentUser.role === 'admin' || !studentStartDate || (courseStart && courseStart >= studentStartDate);
    const matchesEnd = currentUser.role === 'admin' || !studentEndDate || (courseEnd && courseEnd <= studentEndDate);
    const matchesRegistrationStart = !studentRegistrationStartDate || (registrationDate && registrationDate >= studentRegistrationStartDate);
    const matchesRegistrationEnd = !studentRegistrationEndDate || (registrationDate && registrationDate <= studentRegistrationEndDate);
    const assignedCounselor = counselors.find((person) => person.id === student.counselorId)?.name ?? 'Unassigned';
    const matchesSearch = `${student.name} ${student.id ?? ''} ${student.username ?? ''} ${student.phone} ${student.email} ${student.course} ${student.college ?? ''} ${student.courseType} ${student.duration} ${student.tier} ${assignedCounselor}`.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesCourse && matchesCounselor && matchesTier && matchesStatus && matchesStart && matchesEnd && matchesRegistrationStart && matchesRegistrationEnd && matchesSearch;
  });
  const roleLeads = currentUser.role === 'admin'
    ? activeLeads
    : currentUser.role === 'counselor'
      ? leads.filter((lead) => lead.counselorId === currentUser.counselorId)
      : [];
  const dueFeeStudents = roleStudents.filter((student) => feeFilter === 'All' || feeStatus(student) === feeFilter);
  const assignedCount = activeLeads.filter((lead) => lead.counselorId).length;
  const availableCounselorCount = counselors.filter((person) => !person.onLeave).length;

  return (
    <div className={`admin-app cream-dashboard${currentUser.role === 'trainer' ? ' trainer-app' : ''}`}>
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <a className="admin-brand" href="#dashboard" onClick={(event) => { event.preventDefault(); setActiveView('overview'); }}>
          <span className="admin-brand-icon">&lt;/&gt;</span><span><strong><span className="brand-whitehat">WhiteHat</span><br /><span className="brand-coders">Coders</span></strong><small>{currentUser.role === 'admin' ? 'ADMIN PORTAL' : currentUser.role === 'trainer' ? 'TRAINER PORTAL' : 'COUNSELOR PORTAL'}</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label={currentUser.role === 'admin' ? 'Admin sections' : currentUser.role === 'trainer' ? 'Trainer sections' : 'Counselor sections'}>
          {visibleNavigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`nav-item${activeView === id ? ' active' : ''}`} onClick={() => { setActiveView(id); setSidebarOpen(false); }}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><div className="help-icon"><MessageCircle size={18} /></div><strong>Need a hand?</strong><span>Ask your workspace admin</span></div>
          <button className="profile-row" type="button" onClick={() => { window.localStorage.removeItem('whc-auth-token'); setLoggedIn(false); setCurrentUser(null); }}>
            <span className="avatar admin-avatar">{initials(currentUser.name)}</span><span className="profile-copy"><strong>{currentUser.name}</strong><small>{adminEmail}</small></span><LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu" type="button" aria-label="Open menu" onClick={() => setSidebarOpen((value) => !value)}><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeTitle}</strong></div>
          <div className="topbar-right"><span className="today-label">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="topbar-avatar">{initials(currentUser.name)}</span></div>
        </header>
        <main className="dashboard-content">
          <div className={`page-heading${currentUser.role === 'admin' && activeView === 'students' ? ' admin-students-page-heading' : ''}`}>
            <div><p className="section-kicker">{currentUser.role === 'admin' ? 'ADMINISTRATION' : 'COUNSELOR WORKSPACE'}</p><h1>{activeView === 'overview' ? `Good morning, ${currentUser.role === 'admin' ? 'Admin' : currentUser.name}` : currentUser.role === 'admin' && activeView === 'students' ? 'Manage Students' : activeTitle}</h1><p className="page-subtitle">{activeView === 'overview' ? currentUser.role === 'admin' ? 'Here is what is happening across your workspace today.' : 'Here are your assigned enquiries and registered students.' : currentUser.role === 'admin' && activeView === 'students' ? 'Search, filter, and manage student records, courses, and registrations.' : pageDescription(activeView, currentUser.role)}</p></div>
            <div className="heading-actions">
              {activeView === 'overview' && currentUser.role === 'admin' && <button className="primary-action" type="button" onClick={() => setActiveView('leads')}><Plus size={17} /> Assign new lead</button>}
              {activeView === 'my-students' && <button className="primary-action" type="button" onClick={() => { setRegistrationNotice(''); setStudentAdmissionCredentials(null); }}><Plus size={17} /> Register student</button>}
              {activeView === 'counselors' && <button className="primary-action" type="button" onClick={() => setShowCounselorForm((value) => !value)}><UserPlus size={17} /> Add counselor</button>}
              {activeView === 'trainers' && <button className="primary-action" type="button" onClick={() => setShowTrainerForm((value) => !value)}><UserPlus size={17} /> Add trainer</button>}
              {activeView === 'counselor-performance' && currentUser.role === 'admin' && <button className="secondary-action" type="button" onClick={() => setActiveView('overview')}>Center Performance</button>}
            </div>
          </div>

          {activeView === 'overview' && currentUser.role === 'admin' && <Overview counselors={counselors} trainers={trainers} leads={activeLeads} students={students} assignedCount={assignedCount} availableCounselorCount={availableCounselorCount} onNavigate={setActiveView} />}
          {activeView === 'overview' && currentUser.role === 'counselor' && <CounselorOverview counselor={currentUser} counselors={counselors} students={roleStudents} leads={roleLeads} onNavigate={setActiveView} onStatusChange={setLeadStatus} />}
          {activeView === 'overview' && currentUser.role === 'trainer' && <TrainerOverview trainer={currentUser} students={students} assignments={trainerAssignmentsState} onNavigate={setActiveView} />}
          {activeView === 'complaints' && <StaffComplaintsView />}
          {activeView === 'attendance' && currentUser.role === 'trainer' && <TrainerAttendanceView trainer={currentUser} students={students} assignments={trainerAssignmentsState} />}
          {activeView === 'students' && currentUser.role === 'trainer' && <TrainerStudentsView trainer={currentUser} students={students} assignments={trainerAssignmentsState} counselors={counselors} />}
          {activeView === 'history' && currentUser.role === 'trainer' && <TrainerHistoryView trainer={currentUser} students={students} assignments={trainerAssignmentsState} />}
          {activeView === 'evaluations' && currentUser.role === 'trainer' && <TrainerEvaluationsView trainer={currentUser} students={students} assignments={trainerAssignmentsState} />}
          {activeView === 'projects' && currentUser.role === 'trainer' && <TrainerProjectsApiView trainer={currentUser} students={students} assignments={trainerAssignmentsState} />}
          {activeView === 'batches' && currentUser.role === 'trainer' && <TrainerBatchesApiView trainer={currentUser} students={students} assignments={trainerAssignmentsState} />}
          {activeView === 'leads' && <LeadsView isAdmin={currentUser.role === 'admin'} counselors={currentUser.role === 'admin' ? counselors.filter((person) => !person.onLeave) : counselors.filter((person) => person.id === currentUser.counselorId)} allCounselors={counselors} leads={currentUser.role === 'admin' ? activeLeads : leads.filter((lead) => lead.counselorId === currentUser.counselorId)} onAdd={addLead} onStatusChange={setLeadStatus} onDelete={deleteLeadRecord} onFollowUp={recordLeadFollowUp} onEditLead={updateCounselorLead} onUpdateAdminLead={updateAdminLead} />}
          {activeView === 'students' && currentUser.role !== 'trainer' && <StudentsView students={currentUser.role === 'counselor' ? roleStudents : filteredStudents} allStudents={roleStudents} feeRecords={currentUser.role === 'admin' ? studentFeeRecords : null} feeLoadError={currentUser.role === 'admin' ? studentFeeLoadError : ''} courses={[...new Set([...students.map((student) => student.course), ...courseCatalog.map((course) => course.name)])].sort()} counselors={counselors} trainers={trainers} assigningTrainerStudentId={assigningTrainerStudentId} onAssignTrainer={assignStudentTrainer} updatingStudentStatusId={updatingStudentStatusId} onUpdateStudentStatus={updateStudentStatus} course={studentCourse} counselor={studentCounselor} tier={studentTier} status={studentStatus} startDate={studentStartDate} endDate={studentEndDate} registrationStartDate={studentRegistrationStartDate} registrationEndDate={studentRegistrationEndDate} search={studentSearch} onResetFilters={() => { setStudentCourse('All'); setStudentCounselor('All'); setStudentTier('All'); setStudentStatus('All'); setStudentStartDate(''); setStudentEndDate(''); setStudentRegistrationStartDate(''); setStudentRegistrationEndDate(''); setStudentSearch(''); }} onCourseChange={setStudentCourse} onCounselorChange={setStudentCounselor} onTierChange={setStudentTier} onStudentStatusChange={setStudentStatus} onStartDateChange={setStudentStartDate} onEndDateChange={setStudentEndDate} onRegistrationStartDateChange={setStudentRegistrationStartDate} onRegistrationEndDateChange={setStudentRegistrationEndDate} onSearch={setStudentSearch} onCall={setCallingStudent} onEdit={setEditingStudent} onHistory={setHistoryStudent} onDelete={deleteStudentRecord} canDelete={currentUser.role === 'admin'} showCounselor={currentUser.role === 'admin'} isCounselorView={currentUser.role === 'counselor'} />}
          {activeView === 'counselors' && currentUser.role === 'admin' && <CounselorsView counselors={counselors} leads={leads} credentials={employeeCredentials} showForm={showCounselorForm} handoffTargetId={handoffTargetId} onHandoffTargetChange={setHandoffTargetId} onToggleLeave={toggleCounselorLeave} onTransfer={transferCounselorWork} onAdd={addCounselor} onUpdateCounselor={updateCounselor} onRemove={removeCounselor} onCancelForm={() => setShowCounselorForm(false)} />}
          {activeView === 'trainers' && currentUser.role === 'admin' && <TrainersView trainers={trainers} credentials={employeeCredentials} showForm={showTrainerForm} onAdd={addTrainer} onUpdateTrainer={updateTrainer} onRemove={removeTrainer} onCancelForm={() => setShowTrainerForm(false)} />}
          {activeView === 'fees' && currentUser.role !== 'trainer' && <FeesView students={dueFeeStudents} allStudents={roleStudents} filter={feeFilter} onFilter={setFeeFilter} onCollect={setFeeCollectionStudentId} />}
          {activeView === 'my-students' && currentUser.role === 'counselor' && <CounselorStudentsView counselor={currentUser} students={roleStudents} notice={registrationNotice} credentials={studentAdmissionCredentials} onRegister={addRegistration} />}
          {activeView === 'courses' && currentUser.role === 'admin' && <CoursesView courses={coursePopularity} />}
          {activeView === 'counselor-performance' && currentUser.role === 'admin' && <CounselorPerformanceView counselors={counselors} leads={leads} students={students} feeRecords={studentFeeRecords} feeLoadError={studentFeeLoadError} />}
          {activeView === 'leaderboard' && <LeaderboardView entries={leaderboardEntries} loadError={leaderboardLoadError} onCelebrate={() => { setCelebration(true); window.setTimeout(() => setCelebration(false), 3500); }} />}
        </main>
      </div>
      {showWelcomePopup && <div className="welcome-modal-backdrop" role="presentation"><section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="admin-welcome-title"><span className="welcome-modal-mark"><ShieldCheck size={22} /></span><p className="welcome-modal-kicker">A LITTLE NOTE FOR YOU</p><h2 id="admin-welcome-title">{welcomeCompliment.greeting}</h2><div className="compliment-wrap"><Smile className="compliment-pop compliment-smile" size={25} aria-hidden="true" /><p className="welcome-compliment" aria-live="polite">{typedCompliment}<span className="type-cursor" aria-hidden="true" /></p><span className="heart-bundle" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <Heart key={index} className="floating-heart" size={15 + (index % 3) * 4} style={{ left: `${8 + index * 7.5}%`, animationDelay: `${index * 0.32}s`, animationDuration: `${5.5 + (index % 4) * 0.65}s`, '--heart-drift': `${(index % 2 ? 1 : -1) * (16 + (index % 4) * 8)}px` }} />)}</span></div><button className="primary-action" type="button" onClick={() => setShowWelcomePopup(false)}>Enter dashboard <ArrowRight size={16} /></button></section></div>}
      {editingStudent && <StudentEditModal student={editingStudent} courses={[...new Set([...students.map((student) => student.course), ...courseCatalog.map((course) => course.name)])].sort()} onSave={saveStudent} onClose={() => setEditingStudent(null)} />}
      {historyStudent && <StudentHistoryModal student={historyStudent} trainers={trainers} onClose={() => setHistoryStudent(null)} />}
      {feeCollectionStudentId && <FeeCollectionPage students={roleStudents} studentId={feeCollectionStudentId} onBack={() => setFeeCollectionStudentId(null)} onSubmit={recordFeePayment} />}
      {feeReceipt && <FeeReceiptModal receipt={feeReceipt} onClose={() => setFeeReceipt(null)} />}
      {callingStudent && <div className="call-card" role="status"><span className="call-card-icon"><Phone size={18} /></span><span><strong>{callingStudent.name}</strong><small>{callingStudent.phone}</small></span><a href={`tel:${callingStudent.phone.replace(/[^+\d]/g, '')}`} aria-label={`Call ${callingStudent.name}`}><Phone size={17} /></a><button type="button" aria-label="Close phone number" onClick={() => setCallingStudent(null)}><X size={16} /></button></div>}
      {celebration && <div className="celebration-burst" role="status"><div><PartyPopper size={32} /><h2>CONGRATULATIONS!</h2><p>YOUR HARD WORK IS SHINING.</p></div>{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ left: `${(index * 37 + 11) % 100}%`, animationDelay: `${index * 0.025}s` }} />)}</div>}
      {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
    </div>
  );
}

function pageDescription(view, role) {
  if (view === 'leads') return role === 'counselor' ? 'Students assigned to you by the admin.' : 'Review new leads and assign each student to a counselor.';
  if (view === 'students') return 'Complete student records, course types, and learning progress.';
  if (view === 'counselors') return 'Manage the team handling prospective student admissions.';
  if (view === 'fees') return 'Track outstanding balances, upcoming instalments, and payments.';
  if (view === 'my-students') return 'Register learners and manage your assigned student roster.';
  if (view === 'courses') return 'Track the most in-demand courses and see which program is leading demand.';
  if (view === 'leaderboard') return 'Celebrate counselor registrations and student success.';
  if (view === 'counselor-performance') return 'Review admissions, follow-ups, conversions, and fee collection by counselor.';
  return 'Manage the trainers delivering your creative courses.';
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isPerformanceDateInRange(value, fromDate, toDate) {
  if (!value) return false;
  const date = String(value).slice(0, 10);
  return date >= fromDate && date <= toDate;
}

function formatPerformanceDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CounselorPerformanceView({ counselors, leads, students, feeRecords, feeLoadError }) {
  const [initialRange] = useState(() => {
    const today = new Date();
    const end = dateInputValue(today);
    return { from: `${end.slice(0, 7)}-01`, to: end };
  });
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [dateError, setDateError] = useState('');

  function applyDateRange(event) {
    event.preventDefault();
    if (!fromDate || !toDate || fromDate > toDate) {
      setDateError('Choose a valid date range.');
      return;
    }
    setDateError('');
    setAppliedRange({ from: fromDate, to: toDate });
  }

  function selectThisMonth() {
    const today = new Date();
    const end = dateInputValue(today);
    const range = { from: `${end.slice(0, 7)}-01`, to: end };
    setFromDate(range.from);
    setToDate(range.to);
    setAppliedRange(range);
    setDateError('');
  }

  const feeRows = Array.isArray(feeRecords) ? feeRecords : [];
  const rows = counselors.map((counselor) => {
    const counselorId = String(counselor.id);
    const counselorLeads = leads.filter((lead) => String(lead.counselorId) === counselorId);
    const periodLeads = counselorLeads.filter((lead) => isPerformanceDateInRange(lead.createdAt, appliedRange.from, appliedRange.to));
    const converted = counselorLeads.filter((lead) => (
      lead.status === 'Enrolled' &&
      isPerformanceDateInRange(lead.convertedAt || lead.createdAt, appliedRange.from, appliedRange.to)
    )).length;
    const followUps = counselorLeads.reduce((count, lead) => {
      const history = Array.isArray(lead.followUpHistory) ? lead.followUpHistory : [];
      const datedFollowUps = history.filter((event) => isPerformanceDateInRange(event.followedUpAt, appliedRange.from, appliedRange.to)).length;
      const storedFollowUps = (Number(lead.followUpCounts?.call) || 0) + (Number(lead.followUpCounts?.whatsapp) || 0);
      const legacyFollowUps = Math.max(0, storedFollowUps - history.length);
      return count + datedFollowUps + (
        isPerformanceDateInRange(lead.createdAt, appliedRange.from, appliedRange.to) ? legacyFollowUps : 0
      );
    }, 0);
    const counselorStudents = students.filter((student) => String(student.counselorId) === counselorId);
    const cohortStudents = counselorStudents.filter((student) => isPerformanceDateInRange(student.enrolledDate, appliedRange.from, appliedRange.to));
    const counselorStudentIds = new Set(counselorStudents.map((student) => String(student.id)));
    const counselorFees = feeRows.filter((fee) => {
      const studentId = String(fee.student?._id ?? fee.student);
      return counselorStudentIds.has(studentId);
    });
    const sumAmount = (fees, amountKey) => fees.reduce((total, fee) => total + (Number(fee[amountKey]) || 0), 0);
    const feesByStudent = new Map();
    counselorFees.forEach((fee) => {
      const studentId = String(fee.student?._id ?? fee.student);
      const studentFees = feesByStudent.get(studentId) ?? [];
      studentFees.push(fee);
      feesByStudent.set(studentId, studentFees);
    });
    const collectionFromFee = (fee) => {
      const history = Array.isArray(fee.paymentHistory) ? fee.paymentHistory : [];
      if (history.length) {
        return history.reduce((feeTotal, payment) => (
          feeTotal + (isPerformanceDateInRange(payment.paidAt, appliedRange.from, appliedRange.to) ? Number(payment.amount) || 0 : 0)
        ), 0);
      }
      return isPerformanceDateInRange(fee.paidDate, appliedRange.from, appliedRange.to) ? Number(fee.paidAmount) || 0 : 0;
    };
    const collection = counselorStudents.reduce((total, student) => {
      const payments = Array.isArray(student.payments) ? student.payments : [];
      if (payments.length) {
        return total + payments.reduce((studentTotal, payment) => (
          studentTotal + (isPerformanceDateInRange(payment.date, appliedRange.from, appliedRange.to) ? Number(payment.amount) || 0 : 0)
        ), 0);
      }
      return total + (feesByStudent.get(String(student.id)) ?? []).reduce((studentTotal, fee) => studentTotal + collectionFromFee(fee), 0);
    }, 0);
    const cohortTotals = cohortStudents.reduce((totals, student) => {
      const packageValue = Number(student.fullFees) || 0;
      if (packageValue > 0) {
        const paidValue = Math.min(packageValue, Number(student.totalPaid) || 0);
        return {
          totalPackage: totals.totalPackage + packageValue,
          cohortPaid: totals.cohortPaid + paidValue,
          cohortPending: totals.cohortPending + Math.max(0, packageValue - paidValue),
        };
      }
      const studentFees = feesByStudent.get(String(student.id)) ?? [];
      const studentPackage = sumAmount(studentFees, 'amount');
      const studentPaid = sumAmount(studentFees, 'paidAmount');
      return {
        totalPackage: totals.totalPackage + studentPackage,
        cohortPaid: totals.cohortPaid + studentPaid,
        cohortPending: totals.cohortPending + studentFees.reduce((sum, fee) => sum + Math.max(0, (Number(fee.amount) || 0) - (Number(fee.paidAmount) || 0)), 0),
      };
    }, { totalPackage: 0, cohortPaid: 0, cohortPending: 0 });
    const admissions = cohortStudents.length;
    return {
      ...counselor,
      leadCount: periodLeads.length,
      followUps,
      converted,
      admissions,
      conversionRate: periodLeads.length ? (converted / periodLeads.length) * 100 : 0,
      totalPackage: cohortTotals.totalPackage,
      collection,
      cohortPaid: cohortTotals.cohortPaid,
      cohortPending: cohortTotals.cohortPending,
    };
  }).sort((left, right) => right.admissions - left.admissions || right.converted - left.converted || right.leadCount - left.leadCount);
  const total = (key) => rows.reduce((sum, row) => sum + row[key], 0);
  const feeTotalsAvailable = Array.isArray(feeRecords);

  return <section className="counselor-performance-page">
    <form className="counselor-performance-filters" onSubmit={applyDateRange}>
      <label><span>From date</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required /></label>
      <label><span>To date</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required /></label>
      <button className="primary-action" type="submit">Apply</button>
      <button className="secondary-action" type="button" onClick={selectThisMonth}>This Month</button>
    </form>
    {dateError && <p className="counselor-performance-error" role="alert">{dateError}</p>}
    {feeLoadError && <p className="counselor-performance-error" role="status">Fee totals could not be loaded: {feeLoadError}</p>}
    <div className="counselor-performance-summary">
      <article><span>Leads</span><strong>{total('leadCount')}</strong></article>
      <article><span>Admissions</span><strong>{total('admissions')}</strong></article>
      <article><span>Total package</span><strong>{feeTotalsAvailable ? formatCurrency(total('totalPackage')) : '—'}</strong></article>
      <article className="collection"><span>Collection</span><strong>{feeTotalsAvailable ? formatCurrency(total('collection')) : '—'}</strong></article>
      <article className="cohort-paid"><span>Cohort paid</span><strong>{feeTotalsAvailable ? formatCurrency(total('cohortPaid')) : '—'}</strong></article>
      <article className="cohort-pending"><span>Pending</span><strong>{feeTotalsAvailable ? formatCurrency(total('cohortPending')) : '—'}</strong></article>
    </div>
    <section className="panel counselor-performance-panel">
      <header className="counselor-performance-table-heading">
        <h2>{formatPerformanceDate(appliedRange.from)} – {formatPerformanceDate(appliedRange.to)}</h2>
        <span>{counselors.length} counselors</span>
      </header>
      <div className="counselor-performance-table-scroll">
        <table className="counselor-performance-table">
          <thead><tr>
            <th>Counselor</th><th>Leads</th><th title="Dated events are counted in this period; older un-dated counts use the lead creation date.">Follow-ups</th><th>Converted</th><th>Admissions</th><th>Conversion</th><th>Total package</th><th title="Dated payment events are counted in this period.">Collection in period</th><th>Paid on cohort</th><th>Cohort pending</th>
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td><strong>{row.name}</strong><small className={row.active ? 'performance-active' : 'performance-inactive'}>{row.onLeave ? 'On leave' : row.active ? 'Active' : 'Inactive'}</small></td>
            <td>{row.leadCount}</td><td>{row.followUps}</td><td>{row.converted}</td><td className="performance-admissions">{row.admissions}</td><td><span className="performance-conversion">{row.conversionRate.toFixed(1)}%</span></td>
            <td>{feeTotalsAvailable ? formatCurrency(row.totalPackage) : '—'}</td><td className="performance-collection">{feeTotalsAvailable ? formatCurrency(row.collection) : '—'}</td><td className="performance-collection">{feeTotalsAvailable ? formatCurrency(row.cohortPaid) : '—'}</td><td className="performance-pending">{feeTotalsAvailable ? formatCurrency(row.cohortPending) : '—'}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <div className="empty-state"><UsersRound size={24} /><strong>No counselors to report</strong><span>Add counselors to see their performance.</span></div>}
      </div>
    </section>
  </section>;
}

function StudentsView({ students, allStudents, feeRecords, feeLoadError, courses, counselors, trainers, assigningTrainerStudentId, onAssignTrainer, updatingStudentStatusId, onUpdateStudentStatus, course, counselor, tier, status, startDate, endDate, registrationStartDate, registrationEndDate, search, onResetFilters, onCourseChange, onCounselorChange, onTierChange, onStudentStatusChange, onStartDateChange, onEndDateChange, onRegistrationStartDateChange, onRegistrationEndDateChange, onSearch, onCall, onEdit, onHistory, onDelete, canDelete, showCounselor, isCounselorView = false }) {
  const [adminFilters, setAdminFilters] = useState({
    search,
    counselor,
    tier,
    status,
    registrationStartDate,
    registrationEndDate,
  });
  const [counselorFilters, setCounselorFilters] = useState({
    search: '',
    tier: 'All',
    status: 'All',
    joiningFrom: '',
    joiningTo: '',
  });
  const [appliedCounselorFilters, setAppliedCounselorFilters] = useState(counselorFilters);
  const counselorStudents = isCounselorView
    ? students.filter((student) => {
      const matchesSearch = `${student.name} ${student.id ?? ''} ${student.phone ?? ''} ${student.email ?? ''} ${student.course ?? ''} ${student.college ?? ''}`.toLowerCase().includes(appliedCounselorFilters.search.toLowerCase());
      const matchesType = appliedCounselorFilters.tier === 'All' || student.tier === appliedCounselorFilters.tier;
      const matchesStatus = appliedCounselorFilters.status === 'All' || (student.status ?? 'Active') === appliedCounselorFilters.status;
      const registrationDate = student.registrationDate || student.enrolledDate || '';
      const matchesJoiningFrom = !appliedCounselorFilters.joiningFrom || registrationDate >= appliedCounselorFilters.joiningFrom;
      const matchesJoiningTo = !appliedCounselorFilters.joiningTo || registrationDate <= appliedCounselorFilters.joiningTo;
      return matchesSearch && matchesType && matchesStatus && matchesJoiningFrom && matchesJoiningTo;
    })
    : students;
  const displayedStudents = isCounselorView ? counselorStudents : students;
  const visibleStudentIds = new Set(displayedStudents.map((student) => String(student.id)));
  const visibleFeeRecords = Array.isArray(feeRecords)
    ? feeRecords.filter((fee) => visibleStudentIds.has(String(fee.student?._id ?? fee.student)))
    : [];
  const totalFees = visibleFeeRecords.reduce((total, fee) => total + (Number(fee.amount) || 0), 0);
  const receivedFees = visibleFeeRecords.reduce((total, fee) => total + (Number(fee.paidAmount) || 0), 0);
  const pendingFees = visibleFeeRecords.reduce((total, fee) => total + Math.max(0, (Number(fee.amount) || 0) - (Number(fee.paidAmount) || 0)), 0);

  function applyAdminFilters(event) {
    event.preventDefault();
    onSearch(adminFilters.search.trim());
    onCounselorChange(adminFilters.counselor);
    onTierChange(adminFilters.tier);
    onStudentStatusChange(adminFilters.status);
    onRegistrationStartDateChange(adminFilters.registrationStartDate);
    onRegistrationEndDateChange(adminFilters.registrationEndDate);
  }

  function clearAdminFilters() {
    setAdminFilters({
      search: '',
      counselor: 'All',
      tier: 'All',
      status: 'All',
      registrationStartDate: '',
      registrationEndDate: '',
    });
    onResetFilters();
  }

  function applyCounselorFilters(event) {
    event.preventDefault();
    setAppliedCounselorFilters({
      ...counselorFilters,
      search: counselorFilters.search.trim().toLowerCase(),
    });
  }

  function clearCounselorFilters() {
    const emptyFilters = { search: '', tier: 'All', status: 'All', joiningFrom: '', joiningTo: '' };
    setCounselorFilters(emptyFilters);
    setAppliedCounselorFilters(emptyFilters);
  }

  return <div className={`students-page-layout${canDelete ? ' admin-students-page-layout' : ''}`}>
    {canDelete && <div className="admin-student-summary-grid" aria-label="Student and fee summary">
      <article className="admin-student-summary-card"><span>Filtered students</span><strong>{students.length}</strong></article>
      <article className="admin-student-summary-card"><span>Total fees</span><strong>{feeRecords === null ? '—' : formatCurrency(totalFees)}</strong></article>
      <article className="admin-student-summary-card received"><span>Received</span><strong>{feeRecords === null ? '—' : formatCurrency(receivedFees)}</strong></article>
      <article className="admin-student-summary-card pending"><span>Pending</span><strong>{feeRecords === null ? '—' : formatCurrency(pendingFees)}</strong></article>
    </div>}
    {canDelete && feeLoadError && <p className="admin-student-fee-error" role="status">Fee totals could not be loaded: {feeLoadError}</p>}
    <section className={`panel data-panel students-panel${canDelete ? ' admin-students-panel' : ' counselor-students-panel'}${isCounselorView ? ' counselor-records-panel admin-students-panel' : ''}`}>
    {canDelete ? <form className="students-toolbar admin-students-toolbar" onSubmit={applyAdminFilters}>
      <label className="student-filter-control admin-student-search"><span>Search student</span><div className="admin-student-search-input"><Search size={17} /><input aria-label="Search students" placeholder="Name, ID, phone, email, course or college" value={adminFilters.search} onChange={(event) => setAdminFilters((current) => ({ ...current, search: event.target.value }))} /></div></label>
      <label className="student-filter-control admin-student-type"><span>Course type</span><select aria-label="Filter by course type" value={adminFilters.tier} onChange={(event) => setAdminFilters((current) => ({ ...current, tier: event.target.value }))}><option value="All">All types</option>{courseTypeOptions.map((item) => <option key={item} value={item}>{courseTypeLabel(item)}</option>)}</select></label>
      <label className="student-filter-control admin-student-status"><span>Student status</span><select aria-label="Filter by student status" value={adminFilters.status} onChange={(event) => setAdminFilters((current) => ({ ...current, status: event.target.value }))}><option value="All">All statuses</option>{studentStatusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="student-filter-control admin-student-counselor"><span>Counsellor</span><select aria-label="Filter by counsellor" value={adminFilters.counselor} onChange={(event) => setAdminFilters((current) => ({ ...current, counselor: event.target.value }))}><option value="All">All counsellors</option>{counselors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <button className="primary-action admin-student-filter-button" type="submit">Filter</button>
      <button className="secondary-action admin-student-clear-button" type="button" aria-label="Clear student filters" title="Clear filters" onClick={clearAdminFilters}><X size={17} /></button>
      <label className="student-filter-control admin-student-joining-from"><span>Joining from</span><input aria-label="Joining from" type="date" value={adminFilters.registrationStartDate} onChange={(event) => setAdminFilters((current) => ({ ...current, registrationStartDate: event.target.value }))} /></label>
      <label className="student-filter-control admin-student-joining-to"><span>Joining to</span><input aria-label="Joining to" type="date" value={adminFilters.registrationEndDate} onChange={(event) => setAdminFilters((current) => ({ ...current, registrationEndDate: event.target.value }))} /></label>
    </form> : isCounselorView ? <form className="students-toolbar counselor-records-toolbar" onSubmit={applyCounselorFilters}>
      <label className="student-filter-control counselor-record-search"><span>Search student</span><div className="counselor-student-search-box"><Search size={17} /><input aria-label="Search students" placeholder="Name, ID, phone, email, course or college" value={counselorFilters.search} onChange={(event) => setCounselorFilters((current) => ({ ...current, search: event.target.value }))} /></div></label>
      <label className="student-filter-control counselor-record-type"><span>Course type</span><select aria-label="Filter by course type" value={counselorFilters.tier} onChange={(event) => setCounselorFilters((current) => ({ ...current, tier: event.target.value }))}><option value="All">All types</option>{courseTypeOptions.map((item) => <option key={item} value={item}>{courseTypeLabel(item)}</option>)}</select></label>
      <label className="student-filter-control counselor-record-status"><span>Student status</span><select aria-label="Filter by student status" value={counselorFilters.status} onChange={(event) => setCounselorFilters((current) => ({ ...current, status: event.target.value }))}><option value="All">All statuses</option>{[...studentStatusOptions, 'Non-active'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button className="primary-action counselor-record-filter" type="submit">Filter</button>
      <button className="secondary-action counselor-record-clear" type="button" aria-label="Clear student filters" title="Clear filters" onClick={clearCounselorFilters}><X size={17} /></button>
      <label className="student-filter-control counselor-record-joining-from"><span>Joining from</span><input aria-label="Joining from" type="date" value={counselorFilters.joiningFrom} onChange={(event) => setCounselorFilters((current) => ({ ...current, joiningFrom: event.target.value }))} /></label>
      <label className="student-filter-control counselor-record-joining-to"><span>Joining to</span><input aria-label="Joining to" type="date" value={counselorFilters.joiningTo} onChange={(event) => setCounselorFilters((current) => ({ ...current, joiningTo: event.target.value }))} /></label>
    </form> : <div className="students-toolbar">
      <button className={`tier-filter${course === 'All' && tier === 'All' && !startDate && !endDate ? ' selected' : ''}`} type="button" onClick={onResetFilters}>All <span>{allStudents.length}</span></button>
      <label className="student-filter-control"><span>Course</span><select aria-label="Filter by course" value={course} onChange={(event) => onCourseChange(event.target.value)}><option value="All">All courses</option>{courses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="student-filter-control"><span>Course type</span><select aria-label="Filter by course type" value={tier} onChange={(event) => onTierChange(event.target.value)}><option value="All">All course types</option>{courseTypeOptions.map((item) => <option key={item} value={item}>{courseTypeLabel(item)}</option>)}</select></label>
      <label className="student-filter-control date-filter"><span>Course start</span><input aria-label="Filter from course start date" type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} /></label>
      <label className="student-filter-control date-filter"><span>Course end</span><input aria-label="Filter through course end date" type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} /></label>
      <label className="search-box student-search"><Search size={17} /><input aria-label="Search students" placeholder="Search name, course, email or phone" value={search} onChange={(event) => onSearch(event.target.value)} /></label>
    </div>}
    {(canDelete || isCounselorView) && <div className="student-records-heading"><h2>Student records</h2><span>{displayedStudents.length} students</span></div>}
    <div className="student-table-scroll"><table className="student-table"><thead><tr><th>{canDelete || isCounselorView ? 'STUDENT' : 'STUDENT / FATHER'}</th>{(canDelete || isCounselorView) && <th>FATHER</th>}{showCounselor && <th>COUNSELLOR</th>}<th>TRAINER</th><th>PHONE</th><th>COURSE</th><th>COURSE TYPE</th><th>REGISTRATION DATE</th>{canDelete ? <th>STATUS</th> : isCounselorView ? <th>STATUS</th> : <><th>START DATE</th><th>END DATE</th><th>LAST EVALUATION</th></>}<th>ACTIONS</th></tr></thead>
      <tbody>{displayedStudents.map((student, index) => <tr key={student.id}>
        <td><span className={`avatar color-${index % 5}`}>{initials(student.name)}</span><span className="student-identity"><strong>{student.name}</strong>{!canDelete && !isCounselorView && <small>Father: {student.fatherName || 'Not provided'}</small>}</span></td>
        {(canDelete || isCounselorView) && <td data-label="Father">{student.fatherName || '—'}</td>}
        {showCounselor && <td data-label="Counsellor">{counselors.find((person) => person.id === student.counselorId)?.name ?? 'Unassigned'}</td>}
        <td data-label="Trainer">{canDelete ? <select className="student-trainer-select" aria-label={`Assign trainer to ${student.name}`} value={student.trainerId ?? ''} disabled={assigningTrainerStudentId === student.id || trainers.filter((person) => person.active && !person.onLeave).length === 0} onChange={(event) => onAssignTrainer(student, event.target.value)}><option value="" disabled>{trainers.length ? 'Choose trainer' : 'No trainers yet'}</option>{trainers.filter((person) => person.active && !person.onLeave).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select> : student.trainerName || trainers.find((person) => person.id === student.trainerId)?.name || 'Unassigned'}</td>
        <td data-label="Phone">{student.phone}</td><td data-label="Course">{student.course}</td><td data-label="Course type"><span className={`tier-badge tier-${student.tier.toLowerCase().replace(/\s+/g, '-')}`}>{courseTypeLabel(student.tier)}</span></td><td data-label="Registration date">{student.registrationDate || student.enrolledDate || '—'}</td>
        {canDelete ? <td data-label="Status"><select className="admin-student-status-select" aria-label={`Change status for ${student.name}`} value={student.status ?? 'Active'} disabled={updatingStudentStatusId !== null} onChange={(event) => onUpdateStudentStatus(student, event.target.value)}>{!studentStatusOptions.includes(student.status) && <option value={student.status} disabled>{student.status}</option>}{studentStatusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></td> : isCounselorView ? <td data-label="Status"><span className="counselor-student-status">{student.status ?? 'Active'}</span></td> : <><td data-label="Start date">{student.courseStartDate || student.enrolledDate || '—'}</td><td data-label="End date">{student.courseEndDate || dateAfterDuration(student.courseStartDate || student.enrolledDate, student.duration) || '—'}</td><td data-label="Last evaluation">{student.evaluations.at(-1) == null ? <span className="evaluation-score">—</span> : <><span className="evaluation-score">{student.evaluations.at(-1)}%</span><span className="evaluation-track"><i style={{ width: `${student.evaluations.at(-1)}%` }} /></span></>}</td></>}
        <td data-label="Actions"><div className="student-actions"><button className="icon-action" type="button" aria-label={`Show ${student.name} phone number`} title="Show phone number" onClick={() => onCall(student)}><Phone size={17} /></button><button className="icon-action" type="button" aria-label={`Edit ${student.name}`} title="Edit student" onClick={() => onEdit(student)}><Pencil size={17} /></button><button className="icon-action" type="button" aria-label={`View ${student.name} history`} title="Evaluation history" onClick={() => onHistory(student)}><HistoryIcon size={17} /></button>{canDelete && <button className="student-delete-button remove-action" type="button" aria-label={`Delete ${student.name}`} title="Delete student" onClick={() => onDelete(student)}><Trash2 size={15} /></button>}</div></td>
      </tr>)}</tbody>
    </table>{displayedStudents.length === 0 && <div className="empty-state"><ContactRound size={24} /><strong>No students match</strong><span>Adjust your search or filters.</span></div>}</div>
    {!canDelete && <div className="student-table-footer">Showing <strong>{displayedStudents.length}</strong> matching students out of <strong>{allStudents.length}</strong></div>}
    </section>
  </div>;
}

function StudentEditModal({ student, courses, onSave, onClose }) {
  return <div className="record-modal-backdrop"><form className="record-modal edit-student-modal" onSubmit={onSave} role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
    <div className="record-modal-heading"><div><p className="section-kicker">STUDENT PROFILE</p><h2 id="edit-student-title">EDIT STUDENT</h2><p>Update contact, course, and course type details.</p></div><button className="icon-action" type="button" aria-label="Close edit student" onClick={onClose}><X size={18} /></button></div>
    <div className="student-edit-fields"><label>Full name<input name="name" defaultValue={student.name} required /></label><label>Father name<input name="fatherName" defaultValue={student.fatherName ?? ''} required /></label><label>Email address<input name="email" type="email" defaultValue={student.email} required /></label><label>Phone number<input name="phone" type="tel" defaultValue={student.phone} required /></label><label className="student-edit-wide">Course<select name="course" defaultValue={student.course} required>{courses.map((course) => <option key={course} value={course}>{course}</option>)}</select></label><label>Course start date<input name="courseStartDate" type="date" defaultValue={student.courseStartDate || student.enrolledDate || ''} /></label><label>Course end date<input name="courseEndDate" type="date" defaultValue={student.courseEndDate || dateAfterDuration(student.courseStartDate || student.enrolledDate, student.duration)} /></label><label>Course type<select name="tier" defaultValue={student.tier}>{courseTypeOptions.map((item) => <option key={item} value={item}>{courseTypeLabel(item)}</option>)}</select></label></div>
    <div className="form-actions"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit"><Check size={16} /> Save changes</button></div>
  </form></div>;
}

function StudentHistoryModal({ student, trainers, onClose }) {
  const trainerIds = trainers.map((trainer) => trainer.id);
  const attendanceRecords = trainerIds.flatMap((trainerId) => {
    const records = readStoredValue(trainerAttendanceStorageKey(trainerId), {});
    return Object.entries(records).flatMap(([key, studentsById]) => {
      const status = studentsById?.[student.id];
      if (!status) return [];
      const [date, subject] = key.split('::');
      return [{ date, subject, status }];
    });
  }).sort((left, right) => left.date.localeCompare(right.date));
  const savedAssessments = trainerIds.flatMap((trainerId) => readStoredArray(trainerEvaluationsStorageKey(trainerId)))
    .filter((record) => record.studentId === student.id);
  const profileEvaluations = (student.evaluations ?? []).map((score, index) => ({
    id: `profile-${index}`,
    type: 'Evaluation',
    score,
    date: `Eval ${index + 1}`,
  }));
  const allEvaluations = [...profileEvaluations, ...savedAssessments];
  const presentDays = attendanceRecords.filter((record) => record.status === 'Present').length;
  const graphData = [
    {
      title: 'Attendance',
      unit: `${presentDays}/${attendanceRecords.length} present`,
      values: attendanceRecords.map((record) => record.status === 'Present' ? 100 : 0),
      labels: attendanceRecords.map((record) => record.date.slice(5)),
      colors: attendanceRecords.map((record) => record.status === 'Present' ? '#34845d' : '#c7473d'),
      tags: attendanceRecords.map((record) => record.status === 'Present' ? 'P' : 'A'),
    },
    ...['Evaluation', 'Mock Interview', 'Project'].map((type) => {
      const records = allEvaluations.filter((record) => (record.type ?? 'Evaluation') === type);
      return {
        title: type === 'Project' ? 'Project Marks' : `${type} Marks`,
        unit: `${records.length} recorded`,
        values: records.map((record) => Number(record.score || 0)),
        labels: records.map((record, index) => record.date === 'Student profile' || !record.date ? `${type.slice(0, 4)} ${index + 1}` : String(record.date).startsWith('Eval ') ? String(record.date) : String(record.date).slice(5)),
      };
    }),
  ];
  const evaluationCount = allEvaluations.length;
  const latestEvaluation = allEvaluations.at(-1)?.score ?? 0;
  return <div className="record-modal-backdrop"><section className="record-modal history-modal" role="dialog" aria-modal="true" aria-labelledby="student-history-title">
    <div className="record-modal-heading"><div><p className="section-kicker">STUDENT RECORD</p><h2 id="student-history-title">{student.name.toUpperCase()} · HISTORY</h2><p>{student.course} · {courseTypeLabel(student.tier)} course type</p></div><button className="icon-action" type="button" aria-label="Close student history" onClick={onClose}><X size={18} /></button></div>
    <div className="history-summary"><div><span>AGE</span><strong>{student.age ?? '—'}</strong></div><div><span>EVALUATIONS</span><strong>{evaluationCount}</strong></div><div><span>PRESENT DAYS</span><strong>{presentDays}</strong></div><div><span>LATEST SCORE</span><strong>{latestEvaluation}%</strong></div></div>
    <section className="admin-history-graphs" aria-label={`${student.name} attendance and assessment graphs`}>{graphData.map((graph) => <HistoryMiniGraph key={graph.title} {...graph} />)}</section>
    <div className="history-timeline"><h3>ACTIVITY HISTORY</h3>{student.history.map((item, index) => <div className="history-event" key={`${student.id}-history-${index}`}><span className="history-event-dot" /><span><strong>{item}</strong><small>{['26 Oct 2026', '22 Oct 2026', '18 Oct 2026'][index % 3]}</small></span><span className="history-event-score">{student.evaluations[Math.max(student.evaluations.length - 1 - index, 0)]}%</span></div>)}</div>
  </section></div>;
}

function TrainerOverview({ trainer, students, assignments, onNavigate }) {
  const assignment = assignments[trainer.trainerId] ?? { subjects: [], students: [] };
  const [todayRecords, setTodayRecords] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  useEffect(() => {
    let active = true;
    authenticatedRequest('/trainer/dashboard')
      .then(({ dashboard }) => {
        if (active) setTodayRecords(dashboard?.today?.attendance?.totalRecords ?? 0);
      })
      .catch((requestError) => { if (active) setDashboardError(requestError.message); });
    return () => { active = false; };
  }, [trainer.trainerId]);
  const summaryCards = [
    { label: 'Your Subjects', value: assignment.subjects.length, tone: 'orange' },
    { label: 'Assigned Students', value: assignment.students.length, tone: 'green' },
    { label: 'Today\'s Records', value: todayRecords ?? '—', tone: 'purple' },
  ];

  const actionCards = [
    { title: 'Mark Attendance', subtitle: 'Select a subject and date to mark student attendance', icon: Check, tone: 'green' },
    { title: 'View Students', subtitle: 'View your assigned students with their details', icon: ContactRound, tone: 'orange' },
    { title: 'History & Stats', subtitle: 'View attendance records for your students', icon: HistoryIcon, tone: 'blue' },
    { title: 'My Batches', subtitle: 'Create and manage your teaching batches', icon: GraduationCap, tone: 'amber' },
  ];

  return (
    <div className="trainer-page-shell">
      <header className="trainer-page-header">
        <h1>Hello, {trainer.name} <span aria-hidden="true">👋</span></h1>
        <span className="trainer-page-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </header>

      <div className="trainer-summary-grid" aria-label="Trainer summary cards">
        {summaryCards.map((card) => (
          <div key={card.label} className={`trainer-summary-card ${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
      {dashboardError && <p role="alert" className="form-error">{dashboardError}</p>}

      <section className="trainer-subjects-panel" aria-label="Assigned subjects">
        <span className="trainer-subjects-label">Your assigned subjects</span>
        <div className="trainer-subject-list">
          {assignment.subjects.map((subject) => <span key={subject} className="trainer-subject-chip">{subject}</span>)}
        </div>
      </section>

      <div className="trainer-action-grid" aria-label="Trainer quick actions">
        {actionCards.map(({ title, subtitle, icon: Icon, tone }) => (
          <button key={title} type="button" className={`trainer-action-card ${tone}`} onClick={() => {
            if (title === 'Mark Attendance') onNavigate('attendance');
            if (title === 'View Students') onNavigate('students');
            if (title === 'History & Stats') onNavigate('history');
            if (title === 'My Batches') onNavigate('batches');
          }}>
            <span className="trainer-action-icon">
              <Icon size={21} />
            </span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrainerAttendanceView({ trainer, students, assignments }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [searchText, setSearchText] = useState('');
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [attendanceMap, setAttendanceMap] = useState({});
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [classUnavailable, setClassUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    authenticatedRequest('/trainer/batches')
      .then(({ batches: records = [] }) => {
        if (!active) return;
        setBatches(records);
        setSelectedBatchId((current) => current || records[0]?._id || '');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => { active = false; };
  }, [trainer.trainerId]);

  const selectedBatch = batches.find((batch) => String(batch._id) === String(selectedBatchId));
  const batchStudents = (selectedBatch?.students ?? []).map((batchStudent) => (
    typeof batchStudent === 'string'
      ? students.find((student) => String(student.id) === batchStudent)
      : students.find((student) => String(student.id) === String(batchStudent._id)) ?? batchStudent
  )).filter(Boolean);
  const viewStudents = batchStudents.filter((student) => (
    `${student.name} ${student.email ?? ''} ${student.phone ?? ''} ${student.course ?? ''}`.toLowerCase().includes(searchText.toLowerCase())
  ));

  useEffect(() => {
    if (!selectedBatchId) {
      setIsLoading(false);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError('');
    setNotice('');
    setClassUnavailable(false);
    authenticatedRequest(`/trainer/attendance/${selectedBatchId}?date=${selectedDate}`)
      .then((result) => {
        if (!active) return;
        setSession(result.session ?? null);
        setAttendanceMap(Object.fromEntries((result.attendance ?? []).map((record) => [
          String(record.student?._id ?? record.student),
          record.status,
        ])));
        if (result.classStatus?.isScheduled === false) {
          setClassUnavailable(true);
          setNotice(`No class is scheduled: ${result.classStatus.reason}`);
        }
      })
      .catch((requestError) => {
        if (active) {
          setAttendanceMap({});
          setSession(null);
          setError(requestError.message);
        }
      })
      .finally(() => { if (active) setIsLoading(false); });

    return () => { active = false; };
  }, [selectedBatchId, selectedDate]);

  function updateStatus(studentId, status) {
    setAttendanceMap((current) => ({ ...current, [studentId]: status }));
  }

  function markAll(status) {
    setAttendanceMap(Object.fromEntries(batchStudents.map((student) => [String(student.id ?? student._id), status])));
  }

  async function saveAttendance() {
    if (!selectedBatch || !batchStudents.length || classUnavailable) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const attendance = batchStudents.map((student) => {
        const studentId = String(student.id ?? student._id);
        const status = attendanceMap[studentId];
        if (!status) throw new Error(`Please mark attendance for ${student.name}.`);
        return { studentId, status };
      });
      const saved = await authenticatedRequest(`/trainer/attendance/${selectedBatchId}`, {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate, attendance }),
      });
      await authenticatedRequest(`/trainer/sessions/${saved.session.id}/complete`, { method: 'PATCH' });
      setSession({ ...(saved.session ?? {}), status: 'completed' });
      setNotice('Attendance saved and published to the student portal.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const presentCount = batchStudents.filter((student) => attendanceMap[String(student.id ?? student._id)] === 'present').length;
  const absentCount = batchStudents.filter((student) => attendanceMap[String(student.id ?? student._id)] === 'absent').length;
  const isComplete = session?.status === 'completed';

  return (
    <section className="trainer-attendance-page panel data-panel">
      <div className="trainer-attendance-header">
        <div>
          <h2>Mark Attendance</h2>
          <p>Save and publish attendance for a batch to make it visible to its students.</p>
        </div>
      </div>

      <div className="trainer-attendance-controls">
        <label className="trainer-form-field">
          <span>Batch</span>
          <select value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)}>
            <option value="">Select a batch</option>
            {batches.map((batch) => (
              <option key={batch._id} value={batch._id}>{batch.name}</option>
            ))}
          </select>
        </label>

        <label className="trainer-form-field">
          <span>Date</span>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </div>

      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-success">{notice}</p>}
      {!batches.length && !isLoading && <div className="attendance-empty-state"><div className="empty-icon"><ClipboardList size={28} /></div><p>Create a batch and assign students before marking attendance.</p></div>}
      {selectedBatch && (
        <>
          <div className="trainer-record-summary">
            <div className="record-stat-box">
              <span>Assigned Students</span>
              <strong>{batchStudents.length}</strong>
            </div>
            <div className="record-stat-box present-box">
              <span>Present</span>
              <strong>{isLoading ? '—' : presentCount}</strong>
            </div>
            <div className="record-stat-box absent-box">
              <span>Absent</span>
              <strong>{isLoading ? '—' : absentCount}</strong>
            </div>
          </div>

          <div className="trainer-attendance-toolbar">
            <label className="search-box trainer-search-box">
              <Search size={15} />
              <input
                aria-label="Search students"
                placeholder="Search students by name, email, phone or roll number"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>

            <div className="attendance-bulk-actions">
              <button type="button" className="bulk-button mark-present" onClick={() => markAll('present')} disabled={isLoading || isComplete || classUnavailable}>Mark All Present</button>
              <button type="button" className="bulk-button mark-absent" onClick={() => markAll('absent')} disabled={isLoading || isComplete || classUnavailable}>Mark All Absent</button>
            </div>
          </div>

          <div className="trainer-attendance-list">
            {viewStudents.map((student, index) => {
              const studentId = String(student.id ?? student._id);
              const status = attendanceMap[studentId];

              return (
                <div key={student.id} className="attendance-student-row">
                  <div className="attendance-student-meta">
                    <span className="attendance-index">{index + 1}</span>
                    <div className="attendance-student-copy">
                      <strong>{student.name}</strong>
                      <small>
                        {student.course}
                        {student.fatherName ? ` • Father: ${student.fatherName}` : ''}
                      </small>
                    </div>
                  </div>

                  <div className="attendance-student-identity">
                    <span className="attendance-status-tag">{student.email}</span>
                  </div>

                  <div className="attendance-toggle-group">
                    <button
                      type="button"
                      className={`attendance-mark present${status === 'present' ? ' active' : ''}`}
                      onClick={() => updateStatus(studentId, 'present')}
                      disabled={isLoading || isComplete || classUnavailable}
                    >
                      P
                    </button>
                    <button
                      type="button"
                      className={`attendance-mark absent${status === 'absent' ? ' active' : ''}`}
                      onClick={() => updateStatus(studentId, 'absent')}
                      disabled={isLoading || isComplete || classUnavailable}
                    >
                      A
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="form-actions"><button type="button" className="primary-action" onClick={saveAttendance} disabled={isLoading || isSaving || isComplete || classUnavailable || batchStudents.length === 0}>{isSaving ? 'Saving…' : isComplete ? 'Attendance published' : 'Save & publish attendance'}</button></div>
        </>
      )}
    </section>
  );
}

function TrainerStudentsView({ trainer, students, assignments, counselors = initialCounselors }) {
  const assignment = assignments[trainer.trainerId] ?? { students: [], subjects: [], courses: [] };
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [searchTerm, setSearchTerm] = useState('');

  const subjectOptions = ['All Subjects', ...assignment.subjects];
  const assignedStudents = students.filter((student) => assignment.students.includes(student.name));

  const getCourseSubjects = (student) => {
    const courseText = `${student.course ?? ''}`.toLowerCase();
    return assignment.subjects.filter((subject) => courseText.includes(subject.toLowerCase()));
  };

  const filteredStudents = assignedStudents.filter((student) => {
    const matchesSubject = selectedSubject === 'All Subjects' || getCourseSubjects(student).includes(selectedSubject) || String(student.course ?? '').toLowerCase().includes(selectedSubject.toLowerCase());
    const haystack = `${student.name} ${student.fatherName ?? ''} ${student.email} ${student.phone} ${student.course}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  function clearFilters() {
    setSelectedSubject('All Subjects');
    setSearchTerm('');
  }

  function exportCsv() {
    const headers = ['Name', "Father's Name", 'Email', 'Phone', 'Batch Type', 'Mode', 'Enrolled Subjects', 'Counsellor'];
    const rows = filteredStudents.map((student) => {
      const enrolledSubjects = getCourseSubjects(student).length ? getCourseSubjects(student).join(' / ') : (student.course ?? '');
      const counselorName = student.counselorName
        || counselors.find((counselor) => String(counselor.id) === String(student.counselorId))?.name
        || '—';
      return [
        student.name,
        student.fatherName ?? '—',
        student.email,
        student.phone,
        student.tier ?? 'Regular',
        'Online',
        enrolledSubjects,
        counselorName,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trainer.name.toLowerCase()}-students.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <section className="panel trainer-students-panel">
      <div className="trainer-students-header">
        <div>
          <h2>Students</h2>
          <p>Students enrolled in your subjects: {assignment.subjects.join(', ')}</p>
        </div>
        <div className="trainer-export-actions">
          <button type="button" className="primary-action small-export" onClick={exportCsv}>CSV View</button>
          <button type="button" className="primary-action small-export" onClick={exportPdf}>PDF All</button>
        </div>
      </div>

      <div className="trainer-students-toolbar">
        <label className="search-box trainer-students-search">
          <Search size={15} />
          <input
            aria-label="Search students"
            placeholder="Search by name, email, father name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <select className="trainer-students-select" value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>{subject}</option>
          ))}
        </select>

        <button type="button" className="clear-filter-button" onClick={clearFilters}>Clear</button>
        <span className="trainer-results-count">{filteredStudents.length} results</span>
      </div>

      <div className="trainer-students-table-wrap">
        <table className="trainer-students-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>FATHER'S NAME</th>
              <th>EMAIL</th>
              <th>PHONE</th>
              <th>BATCH TYPE</th>
              <th>MODE</th>
              <th>ENROLLED SUBJECTS</th>
              <th>COUNSELLOR</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length > 0 ? filteredStudents.map((student) => {
              const enrolledSubjectList = getCourseSubjects(student);
              const batchType = student.tier ?? 'Regular';
              const mode = 'Online';
              const counselorName = student.counselorName
                || counselors.find((counselor) => String(counselor.id) === String(student.counselorId))?.name
                || '—';

              return (
                <tr key={student.id}>
                  <td className="name-cell">
                    <span className="student-name-strong">{student.name}</span>
                  </td>
                  <td>{student.fatherName ?? '—'}</td>
                  <td>{student.email}</td>
                  <td>{student.phone}</td>
                  <td><span className={`batch-pill batch-${String(batchType).toLowerCase()}`}>{batchType}</span></td>
                  <td><span className="mode-pill">{mode}</span></td>
                  <td>
                    {enrolledSubjectList.length > 0 ? (
                      <span className="subject-badges">
                        {enrolledSubjectList.map((subject) => (
                          <span key={`${student.id}-${subject}`} className="subject-pill">{subject}</span>
                        ))}
                      </span>
                    ) : (
                      <span className="subject-badges"><span className="subject-pill">{student.course ?? 'General'}</span></span>
                    )}
                  </td>
                  <td>{counselorName}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="8">
                  <div className="trainer-empty-state">
                    <span className="empty-graduation">🎓</span>
                    <p>No students match your filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TrainerHistoryView({ trainer, students, assignments }) {
  const assignment = assignments[trainer.trainerId] ?? { students: [], subjects: [] };
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [evaluationRecords, setEvaluationRecords] = useState([]);
  const [projectList, setProjectList] = useState([]);
  const [batchList, setBatchList] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      authenticatedRequest('/trainer/attendance/history'),
      authenticatedRequest('/trainer/monthly-evaluations'),
      authenticatedRequest('/trainer/projects'),
      authenticatedRequest('/trainer/batches'),
    ]).then(([attendanceResult, evaluationResult, projectResult, batchResult]) => {
      if (!active) return;
      setAttendanceRecords(attendanceResult.attendance ?? []);
      setEvaluationRecords(evaluationResult.evaluations ?? []);
      setProjectList(projectResult.projects ?? []);
      setBatchList(batchResult.batches ?? []);
    }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [trainer.trainerId]);
  const historyRoster = students
    .filter((student) => assignment.students.includes(student.name))
    .map((student, index) => ({ ...student, subject: student.course, color: ['orange', 'cyan', 'green', 'magenta', 'blue'][index % 5] }));
  const allSubjects = ['All Subjects', ...new Set(historyRoster.map((student) => student.subject))];

  const filteredStudents = historyRoster.filter((student) => {
    const matchesSubject = selectedSubject === 'All Subjects' || student.subject.toLowerCase() === selectedSubject.toLowerCase();
    const searchValue = searchTerm.trim().toLowerCase();
    const matchesSearch = !searchValue || student.name.toLowerCase().includes(searchValue);
    return matchesSubject && matchesSearch;
  });

  const getAttendanceStats = (studentId) => {
    const records = attendanceRecords.filter((record) => String(record.student?._id ?? record.student) === String(studentId));
    const present = records.filter((record) => record.status === 'present').length;
    return { present, marked: records.length, percentage: records.length ? Math.round((present / records.length) * 100) : 0 };
  };

  const selectedEvaluations = selectedStudent ? [
    ...evaluationRecords
      .filter((record) => String(record.student?._id ?? record.student) === String(selectedStudent.id))
      .map((record) => ({
        id: record._id,
        name: 'Monthly evaluation',
        date: `${record.year}-${String(record.month).padStart(2, '0')}`,
        score: record.score,
        type: 'Evaluation',
      })),
    ...projectList.flatMap((project) => project.evaluations
      .filter((record) => String(record.student?._id ?? record.student) === String(selectedStudent.id) && record.status === 'evaluated')
      .map((record) => ({
        id: `${project._id}-${selectedStudent.id}`,
        project: project.title,
        date: project.dueDate ? String(project.dueDate).slice(0, 10) : 'Project',
        score: Math.round((record.marks / project.totalMarks) * 100),
        type: 'Project',
      }))),
  ] : [];
  const selectedAttendance = selectedStudent ? attendanceRecords
    .filter((record) => String(record.student?._id ?? record.student) === String(selectedStudent.id))
    .map((record) => ({
      date: new Date(record.date).toISOString().slice(0, 10),
      subject: record.batch?.name ?? 'Batch',
      status: record.status === 'present' ? 'Present' : 'Absent',
    }))
    .sort((left, right) => right.date.localeCompare(left.date)) : [];
  const selectedProjects = selectedStudent ? projectList.filter((project) => project.evaluations.some((record) => String(record.student?._id ?? record.student) === String(selectedStudent.id))) : [];
  const selectedBatches = selectedStudent ? batchList.filter((batch) => batch.students.some((student) => String(student?._id ?? student) === String(selectedStudent.id))) : [];
  const averageScore = selectedEvaluations.length ? Math.round(selectedEvaluations.reduce((total, item) => total + Number(item.score || 0), 0) / selectedEvaluations.length) : 0;
  const presentDays = selectedAttendance.filter((record) => record.status === 'Present').length;
  const historyGraphs = selectedStudent ? [
    { title: 'Attendance', unit: `${presentDays}/${selectedAttendance.length} present`, values: selectedAttendance.slice().reverse().map((record) => record.status === 'Present' ? 100 : 0), labels: selectedAttendance.slice().reverse().map((record) => record.date.slice(5)), colors: selectedAttendance.slice().reverse().map((record) => record.status === 'Present' ? '#34845d' : '#c7473d'), tags: selectedAttendance.slice().reverse().map((record) => record.status === 'Present' ? 'P' : 'A') },
    ...['Evaluation', 'Mock Interview', 'Project'].map((type) => {
      const records = selectedEvaluations.filter((item) => (item.type ?? 'Evaluation') === type);
      return { title: `${type} Marks`, unit: `${records.length} recorded`, values: records.map((item) => Number(item.score || 0)), labels: records.map((item) => item.date === 'Student profile' ? item.name.replace('Evaluation ', 'Eval ') : item.date.slice(5)) };
    }),
  ] : [];

  return (
    <>
      <section className="panel trainer-history-panel">
        <div className="trainer-history-header"><h2>History &amp; Stats</h2><span className="history-total-count">{filteredStudents.length} students found</span></div>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="trainer-history-toolbar">
          <label className="search-box trainer-history-search"><Search size={15} /><input type="text" aria-label="Search student history" placeholder="Search student..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
          <select className="trainer-history-select" value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>{allSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
          <span className="history-result-label">{filteredStudents.length} students</span>
        </div>
        <div className="trainer-history-grid">
          {filteredStudents.length > 0 ? filteredStudents.map((student) => {
            const studentEvaluations = evaluationRecords.filter((record) => String(record.student?._id ?? record.student) === String(student.id));
            const latestScore = studentEvaluations.at(0)?.score ?? 0;
            const scoreColor = latestScore < 75 ? '#c7473d' : '#287a55';
            const attendance = getAttendanceStats(student.id);
            const attendanceColor = attendance.percentage < 75 ? '#c7473d' : '#287a55';
            return <button key={student.id} type="button" className="history-student-card" onClick={() => setSelectedStudent(student)} aria-label={`Open full history for ${student.name}`}>
              <span className="history-card-main"><span className="history-avatar">{student.name.charAt(0).toUpperCase()}</span><span className="history-card-copy"><strong>{student.name}</strong><small>{student.subject}</small></span><ArrowRight className="history-card-open-icon" size={16} /></span>
              <span className="history-card-metrics"><span><small>Latest mark</small><strong style={{ color: scoreColor }}>{latestScore}%</strong></span><span><small>Attendance</small><strong style={{ color: attendanceColor }}>{attendance.marked ? `${attendance.percentage}%` : 'Not marked'}</strong></span></span>
              <span className="history-card-score-wrap"><span className="history-score-total">{studentEvaluations.length} evaluations · {attendance.present}/{attendance.marked} present</span><span className="history-score-bar"><i style={{ width: `${Math.min(latestScore, 100)}%`, background: scoreColor }} /></span></span>
            </button>;
          }) : <div className="trainer-history-empty"><span className="empty-graduation">🎓</span><p>No assigned students found.</p><small>Check the selected subject or assigned roster.</small></div>}
        </div>
      </section>
      {selectedStudent && <>
        <button className="trainer-history-drawer-backdrop" type="button" aria-label="Close student history" onClick={() => setSelectedStudent(null)} />
        <aside className="trainer-history-drawer" role="dialog" aria-modal="true" aria-labelledby="trainer-history-student-name">
          <header className="history-drawer-header"><div><p className="section-kicker">STUDENT HISTORY</p><h2 id="trainer-history-student-name">{selectedStudent.name}</h2><p>{selectedStudent.course} · {selectedStudent.email}</p></div><button type="button" className="history-drawer-close" aria-label="Close student history" onClick={() => setSelectedStudent(null)}><X size={20} /></button></header>
          <div className="history-drawer-stats"><div><span>AVERAGE MARKS</span><strong>{averageScore}%</strong></div><div><span>EVALUATIONS</span><strong>{selectedEvaluations.length}</strong></div><div><span>PRESENT DAYS</span><strong>{presentDays}</strong></div><div><span>PROJECTS</span><strong>{selectedProjects.length}</strong></div></div>
          <section className="history-graphs" aria-label="Student performance graphs">{historyGraphs.map((graph) => <HistoryMiniGraph key={graph.title} {...graph} />)}</section>
          <section className="history-detail-section"><h3>Evaluations &amp; Marks</h3>{selectedEvaluations.length ? <div className="history-detail-list">{selectedEvaluations.map((item, index) => <article className="history-detail-row" key={item.id ?? `${item.project}-${item.date}-${index}`}><span><strong>{item.project ?? item.name}</strong><small>{item.date}</small></span><b>{item.score}/100</b></article>)}</div> : <p className="history-detail-empty">No evaluation marks recorded yet.</p>}</section>
          <section className="history-detail-section"><h3>Attendance · {presentDays} present of {selectedAttendance.length} marked days</h3>{selectedAttendance.length ? <div className="history-detail-list">{selectedAttendance.map((record, index) => <article className="history-detail-row" key={`${record.date}-${record.subject}-${index}`}><span><strong>{record.date}</strong><small>{record.subject}</small></span><b className={`history-attendance-status ${record.status.toLowerCase()}`}>{record.status}</b></article>)}</div> : <p className="history-detail-empty">No attendance has been marked for this student yet.</p>}</section>
          <section className="history-detail-section"><h3>Projects · {selectedProjects.length}</h3>{selectedProjects.length ? <div className="history-detail-list">{selectedProjects.map((project) => <article className="history-detail-row" key={project._id}><span><strong>{project.title}</strong><small>{project.subject} · Due {studentDate(project.dueDate)}</small></span><b>{project.evaluations.find((record) => String(record.student?._id ?? record.student) === String(selectedStudent.id))?.status ?? 'Assigned'}</b></article>)}</div> : <p className="history-detail-empty">No project linked yet.</p>}</section>
          <section className="history-detail-section"><h3>Batches · {selectedBatches.length}</h3>{selectedBatches.length ? <div className="history-detail-list">{selectedBatches.map((batch) => <article className="history-detail-row" key={batch._id}><span><strong>{batch.name}</strong><small>{batch.startTime} – {batch.endTime}</small></span><b>{batch.active ? 'Active' : 'Inactive'}</b></article>)}</div> : <p className="history-detail-empty">No batch linked yet.</p>}</section>
          <section className="history-detail-section"><h3>Student Activity</h3>{(selectedStudent.history ?? []).length ? <div className="history-detail-list">{selectedStudent.history.map((item, index) => <article className="history-detail-row" key={`${selectedStudent.id}-activity-${index}`}><span><strong>{item}</strong></span></article>)}</div> : <p className="history-detail-empty">No other activity recorded yet.</p>}</section>
        </aside>
      </>}
    </>
  );
}

function HistoryMiniGraph({ title, unit, values, labels, colors = [], tags = [] }) {
  const width = 300;
  const height = 88;
  const points = values.map((value, index) => {
    const slot = (width - 24) / Math.max(values.length, 1);
    const barWidth = Math.min(18, slot * 0.58);
    const barHeight = Math.max(4, (Math.max(0, Math.min(100, value)) / 100) * 42);
    return {
      x: 12 + index * slot + (slot - barWidth) / 2,
      y: height - 23 - barHeight,
      width: barWidth,
      height: barHeight,
      value,
      label: labels[index],
      color: colors[index] ?? '#397c91',
      tag: tags[index] ?? `${value}%`,
    };
  });

  return <article className="history-graph-card">
    <div className="history-graph-heading"><h3>{title}</h3><span>{unit}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={points.length ? `${title} bar graph: ${points.map((point) => `${point.label} ${point.value}`).join(', ')}` : `${title} bar graph, no records yet`}>
      <line x1="10" y1={height - 22} x2={width - 10} y2={height - 22} />
      {points.map((point, index) => <g key={`${point.label}-${index}`}><rect x={point.x} y={point.y} width={point.width} height={point.height} rx="2" fill={point.color} /><text className="history-graph-value" x={point.x + point.width / 2} y={point.y - 3} textAnchor="middle">{point.tag}</text><text className="history-graph-label" x={point.x + point.width / 2} y={height - 5} textAnchor="middle">{point.label}</text></g>)}
      {points.length === 0 && <text className="history-graph-empty-label" x={width / 2} y={height / 2} textAnchor="middle">No records yet</text>}
    </svg>
  </article>;
}

function TrainerEvaluationsView({ trainer, students, assignments }) {
  const assignment = assignments[trainer.trainerId] ?? { students: [], subjects: [] };
  const assignedStudents = students.filter((student) => assignment.students.includes(student.name));
  const [evaluationRecords, setEvaluationRecords] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    authenticatedRequest('/trainer/monthly-evaluations')
      .then(({ evaluations = [] }) => { if (active) setEvaluationRecords(evaluations); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [trainer.trainerId]);

  async function saveEvaluation(event) {
    event.preventDefault();
    if (!studentId || !month) return;
    const [yearValue, monthValue] = month.split('-').map(Number);
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const { evaluation } = await authenticatedRequest('/trainer/monthly-evaluations', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          year: yearValue,
          month: monthValue,
          score: Number(score),
          feedback,
        }),
      });
      setEvaluationRecords((records) => [
        evaluation,
        ...records.filter((record) => !(
          String(record.student?._id ?? record.student) === String(studentId)
          && record.month === monthValue
          && record.year === yearValue
        )),
      ].sort((left, right) => right.year - left.year || right.month - left.month));
      setNotice('Monthly evaluation saved and published to the student portal.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="trainer-evaluation-page">
      <div className="trainer-evaluation-header">
        <h1>Monthly Evaluations</h1>
        <p>Save a score and feedback that will appear in the student portal.</p>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-success">{notice}</p>}
      <form className="trainer-evaluation-form" onSubmit={saveEvaluation}>
        <div className="trainer-evaluation-field">
          <label htmlFor="monthly-evaluation-student">Student</label>
          <select id="monthly-evaluation-student" className="trainer-evaluation-select" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
            <option value="">Select a student</option>
            {assignedStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
        </div>
        <div className="trainer-evaluation-field">
          <label htmlFor="monthly-evaluation-month">Month</label>
          <input id="monthly-evaluation-month" className="trainer-evaluation-date" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
        </div>
        <div className="trainer-evaluation-field">
          <label htmlFor="monthly-evaluation-score">Score (0-100)</label>
          <input id="monthly-evaluation-score" type="number" min="0" max="100" value={score} onChange={(event) => setScore(event.target.value)} required />
        </div>
        <div className="trainer-evaluation-field">
          <label htmlFor="monthly-evaluation-feedback">Feedback</label>
          <textarea id="monthly-evaluation-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} rows="2" />
        </div>
        <button type="submit" className="primary-action trainer-save-evaluations" disabled={isSaving || assignedStudents.length === 0}><Check size={16} /> {isSaving ? 'Saving…' : 'Save evaluation'}</button>
      </form>
      <section className="trainer-evaluation-grid">
        {evaluationRecords.map((record) => (
          <article className="evaluation-card" key={record._id}>
            <span className="evaluation-details"><strong>{record.student?.name ?? 'Student'}</strong><small>{new Date(record.year, record.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</small></span>
            <strong>{record.score}%</strong>
            {record.feedback && <p>{record.feedback}</p>}
          </article>
        ))}
      </section>
    </section>
  );
}

function TrainerProjectsView({ trainer, students, assignments }) {
  const assignment = assignments[trainer.trainerId] ?? { subjects: [], courses: [] };
  const assignedStudents = students.filter((student) => assignment.students.includes(student.name));
  const [projectList, setProjectList] = usePersistentState(trainerProjectsStorageKey(trainer.trainerId), () => normalizeTrainerProjects(trainer.trainerId), (records) => normalizeTrainerProjects(trainer.trainerId, records));
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [studentModalProjectId, setStudentModalProjectId] = useState(null);
  const [draftProject, setDraftProject] = useState({
    name: '',
    subject: assignment.subjects[0] ?? 'AI',
    description: '',
    students: 0,
    startDate: '2026-10-29',
    endDate: '2026-10-29',
  });
  const [studentDraft, setStudentDraft] = useState({ name: '', email: '', phone: '', course: assignment.subjects[0] ?? 'AI' });

  function openNewProjectModal() {
    setEditingProjectId(null);
    setDraftProject({
      name: '',
      subject: assignment.subjects[0] ?? 'AI',
      description: '',
      students: 0,
      startDate: '2026-10-29',
      endDate: '2026-10-29',
    });
    setShowProjectModal(true);
  }

  function openEditProject(project) {
    setEditingProjectId(project.id);
    setDraftProject({
      name: project.name,
      subject: project.subject,
      description: project.description,
      students: project.students,
      startDate: project.startDate,
      endDate: project.endDate,
    });
    setShowProjectModal(true);
  }

  function openAddProjectStudents(projectId) {
    const targetProject = projectList.find((project) => project.id === projectId);
    setStudentModalProjectId(projectId);
    setStudentDraft({
      name: '',
      email: '',
      phone: '',
      course: targetProject?.subject ?? assignment.subjects[0] ?? 'AI',
    });
  }

  function handleProjectSave(event) {
    event.preventDefault();

    const normalizedName = draftProject.name.trim();
    if (!normalizedName) return;

    const newProject = {
      id: editingProjectId ?? `project-${Date.now()}`,
      name: normalizedName,
      subject: draftProject.subject,
      description: draftProject.description || 'No description',
      students: Number(draftProject.students) || 0,
      startDate: draftProject.startDate,
      endDate: draftProject.endDate,
      status: 'ACTIVE',
      studentEntries: editingProjectId ? projectList.find((project) => project.id === editingProjectId)?.studentEntries ?? [] : [],
    };

    setProjectList((currentProjects) => {
      if (editingProjectId) {
        return currentProjects.map((project) => (project.id === editingProjectId ? { ...project, ...newProject, id: project.id } : project));
      }
      return [newProject, ...currentProjects];
    });

    setShowProjectModal(false);
    setEditingProjectId(null);
  }

  function handleProjectStudentSave(event) {
    event.preventDefault();
    const normalizedName = studentDraft.name.trim();
    if (!normalizedName) return;

    setProjectList((currentProjects) => currentProjects.map((project) => {
      if (project.id !== studentModalProjectId) return project;
      const nextEntry = {
        id: `student-${Date.now()}`,
        name: normalizedName,
        email: studentDraft.email.trim(),
        phone: studentDraft.phone.trim(),
        course: studentDraft.course || project.subject,
      };
      return {
        ...project,
        studentEntries: [...(project.studentEntries ?? []), nextEntry],
        students: Number(project.students || 0) + 1,
      };
    }));

    setStudentModalProjectId(null);
    setStudentDraft({ name: '', email: '', phone: '', course: assignment.subjects[0] ?? 'AI' });
  }

  function handleDeleteProject(projectId) {
    setProjectList((currentProjects) => currentProjects.filter((project) => project.id !== projectId));
  }

  return (
    <section className="trainer-projects-shell">
      <div className="trainer-projects-header">
        <div>
          <h2>Projects</h2>
          <p>Create and manage student projects</p>
        </div>
        <button type="button" className="new-project-button" onClick={openNewProjectModal}>
          <Plus size={13} /> New Project
        </button>
      </div>

      <div className="trainer-projects-grid">
        {projectList.map((project) => (
          <article className="trainer-project-card" key={project.id}>
            <div className="trainer-project-topline">
              <span className="project-status">{project.status}</span>
            </div>
            <div className="trainer-project-title-row">
              <strong>{project.name}</strong>
            </div>
            <div className="trainer-project-subject">{project.subject}</div>
            <p className="trainer-project-description">{project.description}</p>
            <div className="trainer-project-meta">
              <span>{project.students} students</span>
            </div>
            <div className="trainer-project-student-list">
              {(project.studentEntries ?? []).length > 0 ? (
                <div className="student-entry-chips">
                  {(project.studentEntries ?? []).slice(0, 4).map((entry) => (
                    <span key={entry.id ?? `${project.id}-${entry.name}`} className="student-entry-chip">{entry.name}</span>
                  ))}
                  {(project.studentEntries ?? []).length > 4 && (
                    <span className="student-entry-chip more">+{(project.studentEntries ?? []).length - 4}</span>
                  )}
                </div>
              ) : (
                <span className="student-entry-empty">No students yet</span>
              )}
            </div>
            <div className="trainer-project-date-range">
              <span>{project.startDate}</span>
              <span>—</span>
              <span>{project.endDate}</span>
            </div>
            <div className="trainer-project-actions">
              <button type="button" className="project-action add" onClick={() => openAddProjectStudents(project.id)}>+ Add Students</button>
              <button type="button" className="project-action edit" onClick={() => openEditProject(project)}>Edit</button>
              <button type="button" className="project-action delete" onClick={() => handleDeleteProject(project.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      {showProjectModal && (
        <div className="project-modal-backdrop" onClick={() => setShowProjectModal(false)}>
          <div className="project-modal" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-header">
              <h3>{editingProjectId ? 'Edit Project' : 'New Project'}</h3>
              <button type="button" className="modal-close" onClick={() => setShowProjectModal(false)}><X size={16} /></button>
            </div>

            <form className="project-modal-form" onSubmit={handleProjectSave}>
              <label>
                <span>Project name</span>
                <input
                  type="text"
                  value={draftProject.name}
                  onChange={(event) => setDraftProject((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Project name"
                  required
                />
              </label>

              <label>
                <span>Subject</span>
                <select
                  value={draftProject.subject}
                  onChange={(event) => setDraftProject((current) => ({ ...current, subject: event.target.value }))}
                >
                  {(assignment.subjects.length ? assignment.subjects : ['AI']).map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Description</span>
                <textarea
                  rows="3"
                  value={draftProject.description}
                  onChange={(event) => setDraftProject((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Project description"
                />
              </label>

              <div className="project-modal-row">
                <label>
                  <span>Students</span>
                  <input
                    type="number"
                    min="1"
                    value={draftProject.students}
                    onChange={(event) => setDraftProject((current) => ({ ...current, students: event.target.value }))}
                  />
                </label>

                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={draftProject.startDate}
                    onChange={(event) => setDraftProject((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </label>

                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    value={draftProject.endDate}
                    onChange={(event) => setDraftProject((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </label>
              </div>

              <div className="project-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowProjectModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">{editingProjectId ? 'Save Project' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {studentModalProjectId && (
        <div className="project-modal-backdrop" onClick={() => setStudentModalProjectId(null)}>
          <div className="project-modal" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-header">
              <h3>Add Student</h3>
              <button type="button" className="modal-close" onClick={() => setStudentModalProjectId(null)}><X size={16} /></button>
            </div>

            <form className="project-modal-form" onSubmit={handleProjectStudentSave}>
              <label>
                <span>Student name</span>
                <select value={studentDraft.name} onChange={(event) => {
                  const person = assignedStudents.find((student) => student.name === event.target.value);
                  setStudentDraft((current) => ({ ...current, name: event.target.value, email: person?.email ?? '', phone: person?.phone ?? '', course: person?.course ?? current.course }));
                }} required>
                  <option value="" disabled>Select assigned student</option>
                  {assignedStudents.map((student) => <option key={student.id} value={student.name}>{student.name}</option>)}
                </select>
              </label>

              <div className="project-modal-row">
                <label>
                  <span>Email</span>
                  <input type="email" value={studentDraft.email} onChange={(event) => setStudentDraft((current) => ({ ...current, email: event.target.value }))} placeholder="student@email.com" />
                </label>
                <label>
                  <span>Phone</span>
                  <input type="tel" value={studentDraft.phone} onChange={(event) => setStudentDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="9876543210" />
                </label>
              </div>

              <label>
                <span>Course / subject</span>
                <select value={studentDraft.course} onChange={(event) => setStudentDraft((current) => ({ ...current, course: event.target.value }))}>
                  {(assignment.subjects.length ? assignment.subjects : ['AI']).map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>

              <div className="project-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setStudentModalProjectId(null)}>Cancel</button>
                <button type="submit" className="primary-button">Add Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function TrainerBatchesView({ trainer, students, assignments }) {
  const assignment = assignments[trainer.trainerId] ?? { subjects: [] };
  const assignedStudents = students.filter((student) => assignment.students.includes(student.name));
  const [batchList, setBatchList] = usePersistentState(trainerBatchesStorageKey(trainer.trainerId), () => normalizeTrainerBatches(trainer.trainerId), (records) => normalizeTrainerBatches(trainer.trainerId, records));
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [studentModalBatchId, setStudentModalBatchId] = useState(null);
  const [topicModalBatchId, setTopicModalBatchId] = useState(null);
  const [topicDraft, setTopicDraft] = useState('');
  const [draftBatch, setDraftBatch] = useState({
    name: '',
    subject: assignment.subjects[0] ?? 'AI',
    duration: '6 months',
    students: 0,
    maxStudents: 30,
    schedule: '10:30 - 12:00',
    mode: 'offline',
    startDate: '2026-10-20',
    endDate: '2027-10-20',
    topics: ['New topic'],
    studentNames: [],
  });
  const [studentDraft, setStudentDraft] = useState({ name: '', email: '', phone: '', course: assignment.subjects[0] ?? 'AI' });

  function openNewBatchModal() {
    setEditingBatchId(null);
    setDraftBatch({
      name: '',
      subject: assignment.subjects[0] ?? 'AI',
      duration: '6 months',
      students: 0,
      maxStudents: 30,
      schedule: '10:30 - 12:00',
      mode: 'offline',
      startDate: '2026-10-20',
      endDate: '2027-10-20',
      topics: [],
      studentNames: [],
    });
    setShowBatchModal(true);
  }

  function openEditBatch(batch) {
    setEditingBatchId(batch.id);
    setDraftBatch({
      name: batch.name,
      subject: batch.subject,
      duration: batch.duration,
      students: batch.students,
      maxStudents: batch.maxStudents ?? 30,
      schedule: batch.schedule,
      mode: batch.mode ?? 'offline',
      startDate: batch.startDate ?? '2026-10-20',
      endDate: batch.endDate ?? '2027-10-20',
      topics: batch.topics?.length ? [...batch.topics] : [],
      studentNames: batch.studentNames?.length ? [...batch.studentNames] : [],
    });
    setShowBatchModal(true);
  }

  function openAddBatchStudents(batchId) {
    const targetBatch = batchList.find((batch) => batch.id === batchId);
    setStudentModalBatchId(batchId);
    setStudentDraft({
      name: '',
      email: '',
      phone: '',
      course: targetBatch?.subject ?? assignment.subjects[0] ?? 'AI',
    });
  }

  function handleBatchSave(event) {
    event.preventDefault();
    const normalizedName = draftBatch.name.trim();
    if (!normalizedName) return;

    const nextBatch = {
      id: editingBatchId ?? `batch-${Date.now()}`,
      name: normalizedName,
      subject: draftBatch.subject,
      duration: draftBatch.duration,
      students: Number(draftBatch.students) || 0,
      maxStudents: Number(draftBatch.maxStudents) || 30,
      schedule: draftBatch.schedule,
      mode: draftBatch.mode,
      startDate: draftBatch.startDate,
      endDate: draftBatch.endDate,
      topics: draftBatch.topics.filter((topic) => topic && topic.trim()),
      studentNames: draftBatch.studentNames.filter((name) => name && name.trim()),
      studentEntries: draftBatch.studentNames.filter((name) => name && name.trim()).map((name, index) => ({
            id: `draft-${Date.now()}-${index}`,
            name,
            email: '',
            phone: '',
            course: draftBatch.subject,
          })),
      status: 'ACTIVE',
    };

    setBatchList((currentBatches) => {
      if (editingBatchId) {
        return currentBatches.map((batch) => (batch.id === editingBatchId ? nextBatch : batch));
      }
      return [nextBatch, ...currentBatches];
    });

    setShowBatchModal(false);
    setEditingBatchId(null);
  }

  function handleBatchStudentSave(event) {
    event.preventDefault();
    const normalizedName = studentDraft.name.trim();
    if (!normalizedName) return;

    setBatchList((currentBatches) => currentBatches.map((batch) => {
      if (batch.id !== studentModalBatchId) return batch;
      const nextEntry = {
        id: `student-${Date.now()}`,
        name: normalizedName,
        email: studentDraft.email.trim(),
        phone: studentDraft.phone.trim(),
        course: studentDraft.course || batch.subject,
      };
      const names = [...(batch.studentNames ?? []), normalizedName];
      return {
        ...batch,
        studentEntries: [...(batch.studentEntries ?? []), nextEntry],
        studentNames: names,
        students: Number(batch.students || 0) + 1,
      };
    }));

    setStudentModalBatchId(null);
    setStudentDraft({ name: '', email: '', phone: '', course: assignment.subjects[0] ?? 'AI' });
  }

  function handleAddTopic(batchId) {
    setTopicModalBatchId(batchId);
    setTopicDraft('');
  }

  function handleTopicSave(event) {
    event.preventDefault();
    const topicName = topicDraft.trim();
    if (!topicName || !topicModalBatchId) return;
    setBatchList((currentBatches) => currentBatches.map((batch) => batch.id === topicModalBatchId ? { ...batch, topics: [...(batch.topics ?? []), topicName] } : batch));
    setTopicModalBatchId(null);
    setTopicDraft('');
  }

  function handleDeleteTopic(batchId, topicIndex) {
    setBatchList((currentBatches) => currentBatches.map((batch) => batch.id === batchId ? { ...batch, topics: batch.topics.filter((_, index) => index !== topicIndex) } : batch));
  }

  function handleDeleteBatch(batchId) {
    setBatchList((currentBatches) => currentBatches.filter((batch) => batch.id !== batchId));
  }

  return (
    <section className="trainer-batches-shell">
      <div className="trainer-batches-header">
        <div>
          <h2>My Batches</h2>
          <p>Create and manage your teaching batches</p>
        </div>
        <button type="button" className="new-batch-button" onClick={openNewBatchModal}><Plus size={13} /> New Batch</button>
      </div>

      <div className="trainer-batches-grid">
        {batchList.map((batch) => (
          <article className="trainer-batch-card" key={batch.id}>
            <div className="trainer-batch-topline">
              <h3>{batch.name}</h3>
              <span className="batch-status-badge">ACTIVE</span>
            </div>

            <div className="trainer-batch-meta">
              <span>{batch.duration}</span>
              <span>{batch.students} students</span>
              <span>Max: {batch.maxStudents}</span>
            </div>

            <div className="trainer-batch-times">
              <span>{batch.schedule}</span>
              <span>{batch.mode}</span>
            </div>

            <div className="trainer-batch-subject-row">
              <span className="trainer-batch-subject">{batch.subject}</span>
            </div>

            <div className="batch-topic-box">
              <div className="batch-topic-header">
                <strong>Topics Covered ({batch.topics?.length ?? 0})</strong>
                <button type="button" className="batch-topic-add" onClick={() => handleAddTopic(batch.id)}>+ Add Topic</button>
              </div>

              <ul className="batch-topic-list">
                {(batch.topics ?? []).map((topic, index) => (
                  <li key={`${batch.id}-${topic}-${index}`}>
                    <span>{topic}</span>
                    <button type="button" aria-label={`Delete ${topic}`} onClick={() => handleDeleteTopic(batch.id, index)}><X size={12} /></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="trainer-batch-students">
              <span>Students:</span>
              <div className="batch-student-chips">
                {(batch.studentEntries ?? []).map((entry, index) => (
                  <span key={`${batch.id}-${entry.name}-${index}`} className="batch-student-chip">{entry.name}</span>
                ))}
              </div>
            </div>

            <div className="trainer-batch-actions">
              <button type="button" className="project-action add" onClick={() => openAddBatchStudents(batch.id)}>Add Students</button>
              <button type="button" className="project-action edit" onClick={() => openEditBatch(batch)}>Edit</button>
              <button type="button" className="project-action delete" onClick={() => handleDeleteBatch(batch.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      {showBatchModal && (
        <div className="project-modal-backdrop" onClick={() => setShowBatchModal(false)}>
          <div className="project-modal" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-header">
              <h3>{editingBatchId ? 'Edit Batch' : 'New Batch'}</h3>
              <button type="button" className="modal-close" onClick={() => setShowBatchModal(false)}><X size={16} /></button>
            </div>

            <form className="project-modal-form" onSubmit={handleBatchSave}>
              <label>
                <span>Batch name</span>
                <input type="text" value={draftBatch.name} onChange={(event) => setDraftBatch((current) => ({ ...current, name: event.target.value }))} placeholder="Batch name" required />
              </label>

              <div className="project-modal-row">
                <label>
                  <span>Subject</span>
                  <select value={draftBatch.subject} onChange={(event) => setDraftBatch((current) => ({ ...current, subject: event.target.value }))}>
                    {(assignment.subjects.length ? assignment.subjects : ['AI']).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                </label>
                <label>
                  <span>Duration</span>
                  <input type="text" value={draftBatch.duration} onChange={(event) => setDraftBatch((current) => ({ ...current, duration: event.target.value }))} placeholder="6 months" />
                </label>
                <label>
                  <span>Mode</span>
                  <select value={draftBatch.mode} onChange={(event) => setDraftBatch((current) => ({ ...current, mode: event.target.value }))}>
                    <option value="offline">offline</option>
                    <option value="online">online</option>
                  </select>
                </label>
              </div>

              <div className="project-modal-row">
                <label>
                  <span>Students</span>
                  <input type="number" min="1" value={draftBatch.students} onChange={(event) => setDraftBatch((current) => ({ ...current, students: event.target.value }))} />
                </label>
                <label>
                  <span>Max students</span>
                  <input type="number" min="1" value={draftBatch.maxStudents} onChange={(event) => setDraftBatch((current) => ({ ...current, maxStudents: event.target.value }))} />
                </label>
                <label>
                  <span>Schedule</span>
                  <input type="text" value={draftBatch.schedule} onChange={(event) => setDraftBatch((current) => ({ ...current, schedule: event.target.value }))} placeholder="10:30 - 12:00" />
                </label>
              </div>

              <div className="project-modal-row">
                <label>
                  <span>Start date</span>
                  <input type="date" value={draftBatch.startDate} onChange={(event) => setDraftBatch((current) => ({ ...current, startDate: event.target.value }))} />
                </label>
                <label>
                  <span>End date</span>
                  <input type="date" value={draftBatch.endDate} onChange={(event) => setDraftBatch((current) => ({ ...current, endDate: event.target.value }))} />
                </label>
                <label>
                  <span>Students list</span>
                  <input type="text" value={draftBatch.studentNames.join(', ')} onChange={(event) => setDraftBatch((current) => ({ ...current, studentNames: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) }))} />
                </label>
              </div>

              <label>
                <span>Topics</span>
                <textarea rows="3" value={draftBatch.topics.join('\n')} onChange={(event) => setDraftBatch((current) => ({ ...current, topics: event.target.value.split('\n').map((topic) => topic.trim()).filter(Boolean) }))} placeholder="One topic per line" />
              </label>

              <div className="project-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowBatchModal(false)}>Cancel</button>
                <button type="submit" className="primary-button">{editingBatchId ? 'Save Batch' : 'Create Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {studentModalBatchId && (
        <div className="project-modal-backdrop" onClick={() => setStudentModalBatchId(null)}>
          <div className="project-modal" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-header">
              <h3>Add Student</h3>
              <button type="button" className="modal-close" onClick={() => setStudentModalBatchId(null)}><X size={16} /></button>
            </div>

            <form className="project-modal-form" onSubmit={handleBatchStudentSave}>
              <label>
                <span>Student name</span>
                <select value={studentDraft.name} onChange={(event) => {
                  const person = assignedStudents.find((student) => student.name === event.target.value);
                  setStudentDraft((current) => ({ ...current, name: event.target.value, email: person?.email ?? '', phone: person?.phone ?? '', course: person?.course ?? current.course }));
                }} required>
                  <option value="" disabled>Select assigned student</option>
                  {assignedStudents.map((student) => <option key={student.id} value={student.name}>{student.name}</option>)}
                </select>
              </label>

              <div className="project-modal-row">
                <label>
                  <span>Email</span>
                  <input type="email" value={studentDraft.email} onChange={(event) => setStudentDraft((current) => ({ ...current, email: event.target.value }))} placeholder="student@email.com" />
                </label>
                <label>
                  <span>Phone</span>
                  <input type="tel" value={studentDraft.phone} onChange={(event) => setStudentDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="9876543210" />
                </label>
              </div>

              <label>
                <span>Course / subject</span>
                <select value={studentDraft.course} onChange={(event) => setStudentDraft((current) => ({ ...current, course: event.target.value }))}>
                  {(assignment.subjects.length ? assignment.subjects : ['AI']).map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>

              <div className="project-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setStudentModalBatchId(null)}>Cancel</button>
                <button type="submit" className="primary-button">Add Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {topicModalBatchId && (
        <div className="project-modal-backdrop" onClick={() => setTopicModalBatchId(null)}>
          <div className="project-modal topic-modal" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-header">
              <h3>Add Topic</h3>
              <button type="button" className="modal-close" onClick={() => setTopicModalBatchId(null)}><X size={16} /></button>
            </div>
            <form className="project-modal-form" onSubmit={handleTopicSave}>
              <label>
                <span>Topic name</span>
                <input autoFocus type="text" value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} placeholder="e.g. Data cleaning" required />
              </label>
              <div className="project-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setTopicModalBatchId(null)}>Cancel</button>
                <button type="submit" className="primary-button">Save Topic</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function TrainerBatchesApiView({ trainer, students, assignments }) {
  const assignment = assignments[trainer.trainerId] ?? { students: [] };
  const assignedStudents = students.filter((student) => assignment.students.includes(student.name));
  const [batches, setBatches] = useState([]);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('10:30');
  const [endTime, setEndTime] = useState('12:00');
  const [studentIds, setStudentIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadBatches() {
    const result = await authenticatedRequest('/trainer/batches');
    setBatches(result.batches ?? []);
  }

  useEffect(() => {
    let active = true;
    authenticatedRequest('/trainer/batches')
      .then((result) => { if (active) setBatches(result.batches ?? []); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [trainer.trainerId]);

  const assignedBatchStudentIds = new Set(batches.flatMap((batch) => (batch.students ?? []).map((student) => String(student._id ?? student))));
  const availableStudents = assignedStudents.filter((student) => !assignedBatchStudentIds.has(String(student.id)) && !student.batchId);

  async function createBatch(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await authenticatedRequest('/trainer/batches', {
        method: 'POST',
        body: JSON.stringify({ name, startTime, endTime, students: studentIds }),
      });
      setName('');
      setStudentIds([]);
      await loadBatches();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleStudent(id) {
    setStudentIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return (
    <section className="trainer-batches-shell trainer-batches-api">
      <header className="trainer-batches-header">
        <div><p className="section-kicker">TRAINING WORKSPACE</p><h2>My Batches</h2><p>Organize your assigned students into scheduled classes.</p></div>
        <span className="trainer-batch-total">{batches.length} {batches.length === 1 ? 'batch' : 'batches'}</span>
      </header>
      {error && <p role="alert" className="form-error">{error}</p>}
      <form className="trainer-batch-create" onSubmit={createBatch}>
        <div className="trainer-batch-create-heading"><div><h3>Create a batch</h3><p>Choose a name, class time, and students to get started.</p></div></div>
        <div className="trainer-batch-create-fields">
          <label className="trainer-batch-field"><span>Batch name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Python Evening" required /></label>
          <label className="trainer-batch-field"><span>Start time</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
          <label className="trainer-batch-field"><span>End time</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
        </div>
        <fieldset className="trainer-batch-student-picker">
          <legend>Assign students <span>{studentIds.length} selected</span></legend>
          {availableStudents.length ? <div className="trainer-batch-student-options">{availableStudents.map((student) => (
            <label key={student.id} className={`trainer-batch-student-option${studentIds.includes(String(student.id)) ? ' selected' : ''}`}>
              <input type="checkbox" checked={studentIds.includes(String(student.id))} onChange={() => toggleStudent(String(student.id))} />
              <span className="trainer-batch-student-avatar">{initials(student.name)}</span>
              <span className="trainer-batch-student-copy"><strong>{student.name}</strong><small>{student.course}</small></span>
            </label>
          ))}</div> : <p className="trainer-batch-empty">{isLoading ? 'Loading assigned students…' : 'All assigned students are already in a batch.'}</p>}
        </fieldset>
        <div className="trainer-batch-create-footer">
          <span>Only students not already assigned to a batch are listed.</span>
          <button type="submit" className="primary-action" disabled={isSaving || !studentIds.length}>{isSaving ? 'Creating…' : 'Create batch'}</button>
        </div>
      </form>
      <div className="trainer-batch-list-heading"><h3>Your batches</h3><span>Attendance and projects are managed by batch.</span></div>
      {batches.length ? <div className="trainer-batches-grid">
        {batches.map((batch) => (
          <article className="trainer-batch-card" key={batch._id}>
            <div className="trainer-batch-card-heading">
              <div><span className="trainer-batch-card-kicker">CLASS BATCH</span><h3>{batch.name}</h3></div>
              <span className={`trainer-batch-state${batch.active ? ' active' : ''}`}><i />{batch.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="trainer-batch-card-stats"><span><Clock3 size={16} />{batch.startTime} – {batch.endTime}</span><span><UsersRound size={16} />{batch.students?.length ?? 0} students</span></div>
            <div className="trainer-batch-card-roster">
              <strong>Students</strong>
              {(batch.students ?? []).length ? <div className="batch-student-chips">{batch.students.map((student) => <span key={student._id} className="batch-student-chip">{student.name}</span>)}</div> : <p>No students assigned.</p>}
            </div>
          </article>
        ))}
      </div> : !isLoading && <div className="trainer-batch-empty-list"><GraduationCap size={24} /><strong>No batches yet</strong><span>Create your first batch above to assign your students.</span></div>}
      {isLoading && <p className="trainer-batch-loading">Loading your batches…</p>}
    </section>
  );
}

function TrainerProjectsApiView({ trainer, students, assignments }) {
  const assignment = assignments[trainer.trainerId] ?? { students: [], subjects: [] };
  const [batches, setBatches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [draft, setDraft] = useState({ title: '', description: '', subject: assignment.subjects[0] ?? '', batchId: '', totalMarks: '100', dueDate: '' });
  const [marks, setMarks] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSubmissions(records) {
    const results = await Promise.all(records.map(async (project) => {
      const result = await authenticatedRequest(`/trainer/projects/${project._id}/submissions`);
      return [String(project._id), result.submissions ?? []];
    }));
    setSubmissions(Object.fromEntries(results));
  }

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      authenticatedRequest('/trainer/batches'),
      authenticatedRequest('/trainer/projects'),
    ]).then(async ([batchResult, projectResult]) => {
      if (!active) return;
      const loadedBatches = batchResult.batches ?? [];
      const loadedProjects = projectResult.projects ?? [];
      setBatches(loadedBatches);
      setProjects(loadedProjects);
      setDraft((current) => ({
        ...current,
        batchId: current.batchId || loadedBatches.find((batch) => batch.active)?._id || '',
        subject: current.subject || assignment.subjects[0] || '',
      }));
      const results = await Promise.all(loadedProjects.map(async (project) => {
        const submissionResult = await authenticatedRequest(`/trainer/projects/${project._id}/submissions`);
        return [String(project._id), submissionResult.submissions ?? []];
      }));
      if (active) setSubmissions(Object.fromEntries(results));
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [trainer.trainerId]);

  async function createProject(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      const { project } = await authenticatedRequest('/trainer/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          subject: draft.subject,
          batchId: draft.batchId,
          totalMarks: Number(draft.totalMarks),
          dueDate: draft.dueDate || null,
        }),
      });
      setProjects((current) => [project, ...current]);
      const result = await authenticatedRequest(`/trainer/projects/${project._id}/submissions`);
      setSubmissions((current) => ({ ...current, [String(project._id)]: result.submissions ?? [] }));
      setDraft((current) => ({ ...current, title: '', description: '', dueDate: '' }));
      setNotice('Project assigned to the selected batch.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function markSubmitted(projectId, studentId) {
    setError('');
    try {
      const { submission } = await authenticatedRequest(`/trainer/projects/${projectId}/submissions/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'submitted' }),
      });
      setSubmissions((current) => ({
        ...current,
        [String(projectId)]: (current[String(projectId)] ?? []).map((record) => String(record.student?._id ?? record.student) === String(studentId) ? submission : record),
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveProjectMark(projectId, studentId) {
    setError('');
    setNotice('');
    try {
      const result = await authenticatedRequest(`/trainer/projects/${projectId}/evaluate/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'evaluated', marks: Number(marks[`${projectId}:${studentId}`]) }),
      });
      setProjects((current) => current.map((project) => String(project._id) === String(projectId) ? result.project : project));
      setNotice('Project marks saved and published to the student portal.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteProject(projectId) {
    setError('');
    try {
      await authenticatedRequest(`/trainer/projects/${projectId}`, { method: 'DELETE' });
      setProjects((current) => current.filter((project) => String(project._id) !== String(projectId)));
      setSubmissions((current) => {
        const next = { ...current };
        delete next[String(projectId)];
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const activeBatches = batches.filter((batch) => batch.active);
  const projectStudents = (project) => project.evaluations ?? [];
  const submissionFor = (projectId, studentId) => (submissions[String(projectId)] ?? []).find((record) => String(record.student?._id ?? record.student) === String(studentId));
  const canSaveMark = (projectId, studentId, existingMark) => {
    const value = marks[`${projectId}:${studentId}`] ?? existingMark;
    return value !== undefined && value !== null && value !== '';
  };

  return (
    <section className="trainer-projects-shell">
      <div className="trainer-projects-header"><div><h2>Projects</h2><p>Assign projects to a batch, record submissions, and publish marks.</p></div></div>
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-success">{notice}</p>}
      <form className="trainer-evaluation-form" onSubmit={createProject}>
        <label className="trainer-evaluation-field"><span>Project title</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required /></label>
        <label className="trainer-evaluation-field"><span>Batch</span><select value={draft.batchId} onChange={(event) => setDraft((current) => ({ ...current, batchId: event.target.value }))} required><option value="">Select a batch</option>{activeBatches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name}</option>)}</select></label>
        <label className="trainer-evaluation-field"><span>Subject</span><select value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} required><option value="">Select a subject</option>{assignment.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
        <label className="trainer-evaluation-field"><span>Total marks</span><input type="number" min="1" value={draft.totalMarks} onChange={(event) => setDraft((current) => ({ ...current, totalMarks: event.target.value }))} required /></label>
        <label className="trainer-evaluation-field"><span>Due date</span><input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
        <label className="trainer-evaluation-field"><span>Description</span><textarea rows="2" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
        <button type="submit" className="primary-action" disabled={isSaving || !activeBatches.length || !assignment.subjects.length}>{isSaving ? 'Assigning…' : 'Assign project'}</button>
      </form>
      {!activeBatches.length && !isLoading && <p>Create a batch and assign students before creating a project.</p>}
      <div className="trainer-projects-grid">
        {projects.map((project) => (
          <article className="trainer-project-card" key={project._id}>
            <div className="trainer-project-topline"><span className="project-status">ASSIGNED</span><button type="button" className="project-action delete" onClick={() => deleteProject(project._id)}>Delete</button></div>
            <div className="trainer-project-title-row"><strong>{project.title}</strong></div>
            <div className="trainer-project-subject">{project.subject} · {project.batch?.name ?? 'Batch'}</div>
            <p className="trainer-project-description">{project.description || 'No description'}</p>
            <div className="trainer-project-meta"><span>{project.totalMarks} total marks</span><span>Due {studentDate(project.dueDate)}</span></div>
            <div className="trainer-project-student-list">
              {projectStudents(project).map((evaluation) => {
                const student = typeof evaluation.student === 'object'
                  ? evaluation.student
                  : students.find((item) => String(item.id) === String(evaluation.student));
                if (!student) return null;
                const submission = submissionFor(project._id, student._id ?? student.id);
                const studentId = student._id ?? student.id;
                return (
                  <div className="evaluation-card" key={studentId}>
                    <span className="evaluation-details"><strong>{student.name}</strong><small>{submission?.status === 'submitted' ? 'Submitted' : 'Not submitted'}</small></span>
                    {submission?.status !== 'submitted'
                      ? <button type="button" className="project-action add" onClick={() => markSubmitted(project._id, studentId)}>Record submission</button>
                      : <><input aria-label={`Marks for ${student.name}`} type="number" min="0" max={project.totalMarks} value={marks[`${project._id}:${studentId}`] ?? evaluation.marks ?? ''} onChange={(event) => setMarks((current) => ({ ...current, [`${project._id}:${studentId}`]: event.target.value }))} /><button type="button" className="project-action edit" disabled={!canSaveMark(project._id, studentId, evaluation.marks)} onClick={() => saveProjectMark(project._id, studentId)}>{evaluation.status === 'evaluated' ? 'Update mark' : 'Save mark'}</button></>}
                    {evaluation.status === 'evaluated' && <strong>{evaluation.marks}/{project.totalMarks}</strong>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      {isLoading && <p>Loading batches and projects…</p>}
    </section>
  );
}

function Overview({ counselors, trainers, leads, students, assignedCount, availableCounselorCount, onNavigate }) {
  const [selectedTeamRole, setSelectedTeamRole] = useState('preview');
  const joinedStudents = students.slice(0, 6);
  const teamMembers = selectedTeamRole === 'counselors'
    ? counselors.map((person) => ({ ...person, teamRole: person.onLeave ? 'Counselor · on leave' : 'Counselor' }))
    : selectedTeamRole === 'trainers'
      ? trainers.map((person) => ({ ...person, teamRole: `Trainer · ${person.specialty}` }))
      : [...counselors.slice(0, 2).map((person) => ({ ...person, teamRole: person.onLeave ? 'Counselor · on leave' : 'Counselor' })), ...trainers.slice(0, 2).map((person) => ({ ...person, teamRole: `Trainer · ${person.specialty}` }))];
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={ClipboardList} label="Total leads" value={leads.length} change="Across all courses" tone="blue" />
        <StatCard icon={UsersRound} label="Active counselors" value={availableCounselorCount} change="Ready to take leads" tone="sage" />
        <StatCard icon={GraduationCap} label="Active trainers" value={trainers.length} change="Across your programs" tone="lavender" />
        <StatCard icon={Check} label="Leads assigned" value={`${assignedCount}/${leads.length}`} change="Currently with counselors" tone="sand" />
      </div>
      <div className="dashboard-grid">
        <section className="panel leads-panel">
          <div className="panel-heading"><div><h2>Joined students</h2><p>Students currently enrolled in your programs</p></div><button className="text-action" type="button" onClick={() => onNavigate('students')}>View all <ArrowRight size={15} /></button></div>
          <div className="joined-student-list">{joinedStudents.map((student, index) => <div className="joined-student-row" key={student.id}><span className={`avatar color-${index % 5}`}>{initials(student.name)}</span><span className="joined-student-details"><strong>{student.name}</strong><small>{student.course}</small></span><span className={`tier-badge tier-${student.tier.toLowerCase()}`}>{student.tier}</span><span className="joined-score">{student.evaluations.at(-1) == null ? '—' : `${student.evaluations.at(-1)}%`}</span></div>)}</div>
        </section>
        <section className="panel team-panel">
          <div className="panel-heading"><div><h2>Your team</h2><p>Counselors and trainers</p></div><button className="icon-action" type="button" aria-label="View trainers" onClick={() => onNavigate('trainers')}><ArrowRight size={17} /></button></div>
          <div className="team-summary">
            <button className={`team-count-block${selectedTeamRole === 'counselors' ? ' selected' : ''}`} type="button" aria-pressed={selectedTeamRole === 'counselors'} onClick={() => setSelectedTeamRole((role) => role === 'counselors' ? 'preview' : 'counselors')}><span>{counselors.length}</span><small>Counselors</small></button>
            <div className="team-divider" />
            <button className={`team-count-block${selectedTeamRole === 'trainers' ? ' selected' : ''}`} type="button" aria-pressed={selectedTeamRole === 'trainers'} onClick={() => setSelectedTeamRole((role) => role === 'trainers' ? 'preview' : 'trainers')}><span>{trainers.length}</span><small>Trainers</small></button>
          </div>
          <div className="team-people">{teamMembers.map((person, index) => <div className="team-person" key={`${person.teamRole}-${person.id}`}><span className={`avatar color-${index % 5}`}>{initials(person.name)}</span><span><strong>{person.name}</strong><small>{person.teamRole}</small></span><span className={`online-dot${person.onLeave ? ' leave-dot' : ''}`} /></div>)}</div>
          <button className="panel-footer-action" type="button" onClick={() => onNavigate('trainers')}><UsersRound size={15} /> Manage team</button>
        </section>
      </div>
      <section className="panel overview-prospects-panel"><div className="panel-heading"><div><h2>Leads in progress</h2><p>Prospective students still being contacted by counselors</p></div><button className="text-action" type="button" onClick={() => onNavigate('leads')}>New lead <ArrowRight size={15} /></button></div><LeadTable leads={leads.slice(0, 5)} counselors={counselors} compact /></section>
    </>
  );
}

function StatCard({ icon: Icon, label, value, change, tone }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-change">{change}</span></article>;
}

function LeadTable({ leads, counselors, compact = false, showCounselor = true, canChangeStatus = false, onStatusChange }) {
  if (leads.length === 0) return <div className="empty-state"><ClipboardList size={24} /><strong>No leads found</strong><span>Try changing your search or add a new lead.</span></div>;
  return (
    <div className={`table-scroll${compact ? ' compact' : ''}`}>
      <table className="lead-table"><thead><tr><th>STUDENT</th><th>COURSE</th><th>PHONE</th>{showCounselor && <th>COUNSELOR</th>}<th>STATUS</th>{!compact && <th>ADDED</th>}</tr></thead>
        <tbody>{leads.map((lead) => {
          const counselor = counselors.find((person) => person.id === lead.counselorId);
          return <tr key={lead.id}>
            <td><strong className="student-name">{lead.student}</strong><span className="cell-mobile">{lead.course}</span></td>
            <td className="course-cell">{lead.course}</td><td><span>{lead.phone}</span><small className="lead-followup-summary">Call: {lead.followUpCounts?.call ?? 0} · WhatsApp: {lead.followUpCounts?.whatsapp ?? 0}</small></td>
            {showCounselor && <td>{counselor ? <span className="assignee"><span className="mini-avatar">{initials(counselor.name)}</span>{counselor.name}</span> : <span className="unassigned">Unassigned</span>}</td>}
            <td>{canChangeStatus
              ? <select className={`status-select status-${lead.status.toLowerCase().replace(/\s+/g, '-')}`} value={lead.status} onChange={(event) => onStatusChange(lead.id, event.target.value)} aria-label={`Update ${lead.student} status`} disabled={lead.status === 'Enrolled'}><option>New</option><option>Follow-up</option><option>Enrolled</option><option>Dead</option></select>
              : <span className={`lead-status-pill lead-status-${lead.status.toLowerCase().replace(/\s+/g, '-')}`}>{lead.status}</span>}</td>
            {!compact && <td className="date-cell">{lead.created}</td>}
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function LeadForm({ counselors, onSubmit, onCancel, showCancel = true }) {
  return (
    <form className="entry-form lead-entry-form" onSubmit={onSubmit}>
      <div className="form-title-row"><div><span className="form-step">01</span><div><h2>New lead</h2><p>Add student details and assign an owner</p></div></div>{showCancel && <button type="button" className="icon-action" aria-label="Close form" onClick={onCancel}><X size={18} /></button>}</div>
      <div className="form-fields form-fields-four">
        <label>Student name<input name="student" placeholder="e.g. Priya Sharma" required /></label>
        <label>Course<input name="course" placeholder="Course interested in" required /></label>
        <label>Phone number<input name="phone" type="tel" placeholder="+91 98765 43210" required /></label>
        <label>Assign counselor<select name="counselorId" required defaultValue=""><option value="" disabled>Select counselor</option>{counselors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      </div>
      {counselors.length === 0 && <p className="form-warning">Add a counselor before assigning a new lead.</p>}
      <div className="form-actions">{showCancel && <button className="secondary-action" type="button" onClick={onCancel}>Cancel</button>}<button className="primary-action" type="submit" disabled={counselors.length === 0}><UserPlus size={16} /> Assign lead</button></div>
    </form>
  );
}

function LeadsView({ isAdmin, counselors, allCounselors, leads, onAdd, onStatusChange, onDelete, onFollowUp, onEditLead, onUpdateAdminLead }) {
  const [editingLead, setEditingLead] = useState(null);

  if (!isAdmin) {
    return <CounselorLeadsView leads={leads} onStatusChange={onStatusChange} onFollowUp={onFollowUp} onEditLead={onEditLead} />;
  }
  return <div className="view-stack">
    <LeadForm counselors={counselors} onSubmit={onAdd} showCancel={false} />
    <section className="panel data-panel">
      <div className="panel-heading"><div><h2>Lead register <span className="count-pill">{leads.length}</span></h2><p>Delete unwanted leads permanently</p></div></div>
      {leads.length ? <div className="student-table-scroll"><table className="student-table"><thead><tr><th>STUDENT</th><th>PHONE / FOLLOW-UPS</th><th>COURSE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}>
        <td>{lead.student}</td>
        <td><span>{lead.phone}</span><small className="lead-followup-summary">Call: {lead.followUpCounts?.call ?? 0} · WhatsApp: {lead.followUpCounts?.whatsapp ?? 0}</small></td>
        <td>{lead.course}</td>
        <td><span className={`lead-status-pill lead-status-${lead.status.toLowerCase().replace(/\s+/g, '-')}`}>{lead.status}</span></td>
        <td><div className="student-actions">
          <button className="icon-action" type="button" aria-label={`Edit lead for ${lead.student}`} title="Edit lead" onClick={() => setEditingLead(lead)}><Pencil size={17} /></button>
          <button className="icon-action remove-action" type="button" aria-label={`Delete lead for ${lead.student}`} title="Permanently delete lead" onClick={() => onDelete(lead)}><Trash2 size={17} /></button>
        </div></td>
      </tr>)}</tbody></table></div> : <div className="empty-state"><ClipboardList size={24} /><strong>No leads to display</strong></div>}
    </section>
    {editingLead && <LeadEditModal lead={editingLead} counselors={allCounselors} allowAssignment onSave={async (event) => {
      if (await onUpdateAdminLead(editingLead.id, event)) setEditingLead(null);
    }} onClose={() => setEditingLead(null)} />}
  </div>;
}

function CounselorLeadsView({ leads, onStatusChange, onFollowUp, onEditLead }) {
  const [search, setSearch] = useState('');
  const [schedule, setSchedule] = useState('All leads');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [openFollowUpLeadId, setOpenFollowUpLeadId] = useState(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const filteredLeads = leads.filter((lead) => {
    const searchValue = search.trim().toLowerCase();
    const matchesSearch = !searchValue || `${lead.student} ${lead.course} ${lead.phone}`.toLowerCase().includes(searchValue);
    const matchesSchedule = schedule === 'All leads' || lead.status === schedule;
    return matchesSearch && matchesSchedule && (!fromDate || lead.created === 'Today' || lead.created === 'Yesterday') && (!toDate || lead.created === 'Today' || lead.created === 'Yesterday');
  });
  const followUps = leads.filter((lead) => lead.status === 'Follow-up').length;
  const newLeads = leads.filter((lead) => lead.status === 'New').length;
  const enrolled = leads.filter((lead) => lead.status === 'Enrolled').length;
  const dead = leads.filter((lead) => lead.status === 'Dead').length;

  async function saveFollowUp(lead, channel) {
    setSavingFollowUp(true);
    const saved = await onFollowUp(lead.id, channel);
    setSavingFollowUp(false);
    if (saved) setOpenFollowUpLeadId(null);
  }

  return <div className="counselor-leads-page">
    <div className="counselor-lead-stats">
      <article className="counselor-lead-stat stat-blue"><strong>{leads.length}</strong><span>My Leads</span></article>
      <article className="counselor-lead-stat stat-orange"><strong>{newLeads}</strong><span>New Leads</span></article>
      <article className="counselor-lead-stat stat-green"><strong>{followUps}</strong><span>Follow-ups</span></article>
      <article className="counselor-lead-stat stat-pink"><strong>{enrolled}</strong><span>Enrolled</span></article>
    </div>
    <section className="panel counselor-leads-panel">
      <div className="counselor-lead-filters">
        <label className="counselor-lead-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, contact or course" /></label>
        <label><span>Status</span><select value={schedule} onChange={(event) => setSchedule(event.target.value)}><option>All leads</option><option>New</option><option>Follow-up</option><option>Enrolled</option><option>Dead</option></select></label>
        <label><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button type="button" className="primary-action" onClick={() => { setSearch(''); setSchedule('All leads'); setFromDate(''); setToDate(''); }}>Reset</button>
      </div>
      <div className="counselor-leads-count-label">{filteredLeads.length} assigned leads</div>
      <div className="counselor-leads-table-wrap"><table className="counselor-leads-table"><thead><tr><th>STUDENT DETAILS</th><th>STATUS</th><th>SCHEDULE</th><th>QUICK ACTIONS</th></tr></thead><tbody>{filteredLeads.map((lead) => <tr key={lead.id}>
        <td>
          <strong>{lead.student}</strong><small>{lead.phone} · {lead.course}</small>
          <small className="lead-followup-summary">Follow-ups: Call {lead.followUpCounts?.call ?? 0} · WhatsApp {lead.followUpCounts?.whatsapp ?? 0}</small>
          {lead.status !== 'Enrolled' && <div className="lead-followup-menu">
            <button className="lead-followup-trigger" type="button" aria-expanded={openFollowUpLeadId === lead.id} onClick={() => setOpenFollowUpLeadId((current) => current === lead.id ? null : lead.id)}>Follow up</button>
            {openFollowUpLeadId === lead.id && <div className="lead-followup-options"><button type="button" disabled={savingFollowUp} onClick={() => saveFollowUp(lead, 'call')}>Call</button><button type="button" disabled={savingFollowUp} onClick={() => saveFollowUp(lead, 'whatsapp')}>WhatsApp</button></div>}
          </div>}
        </td>
        <td><span className={`lead-status-pill lead-status-${lead.status.toLowerCase().replace(/\s+/g, '-')}`}>{lead.status}</span></td>
        <td><span className="lead-schedule">{lead.status === 'Dead' ? 'DEAD' : lead.status === 'Enrolled' ? 'ENROLLED' : lead.created}</span></td>
        <td><div className="lead-quick-actions">{lead.status !== 'Enrolled' ? <>
          <button className="lead-edit-action" type="button" title={`Edit ${lead.student}`} aria-label={`Edit lead for ${lead.student}`} onClick={() => setEditingLead(lead)}><Pencil size={15} /></button>
          <button className="lead-enroll-action" type="button" title={`Create admission for ${lead.student}`} aria-label={`Create student admission for ${lead.student}`} onClick={() => onStatusChange(lead.id, 'Enrolled')}><UserPlus size={15} /></button>
          {lead.status !== 'Dead' && <button className="lead-dead-action" type="button" title="Mark dead" aria-label={`Mark ${lead.student} dead`} onClick={() => onStatusChange(lead.id, 'Dead')}><X size={15} /></button>}
        </> : <span aria-label="No actions available">—</span>}</div></td>
      </tr>)}</tbody></table>{filteredLeads.length === 0 && <div className="empty-state"><ClipboardList size={24} /><strong>No leads found</strong><span>Try changing your search or filters.</span></div>}</div>
    </section>
    <small className="counselor-lead-dead-count">{dead} dead leads</small>
    {editingLead && <LeadEditModal lead={editingLead} onSave={async (event) => {
      if (await onEditLead(editingLead.id, event)) setEditingLead(null);
    }} onClose={() => setEditingLead(null)} />}
  </div>;
}

function LeadEditModal({ lead, counselors = [], allowAssignment = false, onSave, onClose }) {
  const assignableCounselors = counselors.filter((counselor) => (
    (counselor.active && !counselor.onLeave) || String(counselor.id) === String(lead.counselorId)
  ));

  return <div className="record-modal-backdrop"><form className="record-modal lead-edit-modal" onSubmit={onSave} role="dialog" aria-modal="true" aria-labelledby="edit-lead-title">
    <div className="record-modal-heading"><div><p className="section-kicker">LEAD DETAILS</p><h2 id="edit-lead-title">EDIT LEAD</h2><p>Update the student contact and course details.</p></div><button className="icon-action" type="button" aria-label="Close edit lead" onClick={onClose}><X size={18} /></button></div>
    <div className="student-edit-fields"><label>Student name<input name="studentName" defaultValue={lead.student} required /></label><label>Phone number<input name="phone" type="tel" defaultValue={lead.phone} minLength="6" required /></label><label>Course<input name="course" defaultValue={lead.course} required /></label>{allowAssignment && <label>Assign counsellor<select name="assignedCounsellor" defaultValue={lead.counselorId ?? ''}><option value="">Unassigned</option>{assignableCounselors.map((counselor) => <option key={counselor.id} value={counselor.id}>{counselor.name}{counselor.onLeave ? ' (on leave)' : ''}</option>)}</select></label>}</div>
    <div className="form-actions"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit"><Check size={16} /> Save changes</button></div>
  </form></div>;
}

function TeamForm({ type, onSubmit, onCancel }) {
  const counselor = type === 'counselor';
  return <form className="entry-form team-entry-form" onSubmit={onSubmit}>
    <div className="form-title-row"><div><span className="form-step">01</span><div><h2>Add {type}</h2><p>Enter the new team member's details</p></div></div><button type="button" className="icon-action" aria-label="Close form" onClick={onCancel}><X size={18} /></button></div>
    <div className="form-fields form-fields-three">
      <label>Full name<input name="name" placeholder="Enter full name" required /></label>
      <label>Phone number<input name="phone" type="tel" placeholder="+91 98765 43210" required /></label>
      {!counselor && <label>Specialty<input name="specialty" placeholder="e.g. Visual Design" required /></label>}
      <label>Email address<input name="email" type="email" placeholder="namewhc@gmail.com" required /></label>
      <label>Username<input name="username" autoComplete="off" placeholder="Choose a username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength="6" placeholder="At least 6 characters" required /></label>
    </div>
    <p className="form-hint">Set the login username and password for this team member.</p>
    <div className="form-actions"><button className="secondary-action" type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit"><Plus size={16} /> Add {type}</button></div>
  </form>;
}

function CounselorsView({ counselors, leads, credentials, showForm, handoffTargetId, onHandoffTargetChange, onToggleLeave, onTransfer, onAdd, onUpdateCounselor, onRemove, onCancelForm }) {
  const [editingCounselorId, setEditingCounselorId] = useState(null);

  return <div className="view-stack">
    {showForm && <TeamForm type="counselor" onSubmit={onAdd} onCancel={onCancelForm} />}
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Counselor team <span className="count-pill">{counselors.length}</span></h2><p>Assign leads and manage counselor access</p></div><span className="availability"><span className="online-dot" /> {counselors.filter((person) => !person.onLeave).length} available · {counselors.filter((person) => person.onLeave).length} on leave</span></div>
      {counselors.length ? <div className="team-table">{counselors.map((person, index) => {
        const assignedLeads = leads.filter((lead) => lead.counselorId === person.id);
        const openLeads = assignedLeads.filter((lead) => lead.status !== 'Enrolled');
        const availableCounselors = counselors.filter((candidate) => candidate.id !== person.id && !candidate.onLeave);
        const login = credentials[person.id];
        return <div className={`member-row counselor-member-row${person.onLeave ? ' counselor-on-leave' : ''}`} key={person.id}>
          {editingCounselorId === person.id ? <form className="employee-edit-form" onSubmit={async (event) => {
            if (await onUpdateCounselor(person.id, event)) setEditingCounselorId(null);
          }}>
            <label>Name<input name="name" defaultValue={person.name} required /></label>
            <label>Email<input name="email" type="email" defaultValue={person.email} required /></label>
            <label>Phone<input name="phone" type="tel" defaultValue={person.phone} minLength="6" required /></label>
            <label>Username<input name="username" defaultValue={person.username} autoComplete="off" required /></label>
            <label>New password<input name="password" type="password" autoComplete="new-password" minLength="6" placeholder="Leave blank to keep current" /></label>
            <div className="trainer-edit-actions"><button className="secondary-action" type="button" onClick={() => setEditingCounselorId(null)}>Cancel</button><button className="primary-action" type="submit"><Check size={15} /> Save</button></div>
          </form> : <>
            <span className={`avatar color-${index % 5}`}>{initials(person.name)}</span>
            <span className="member-details"><strong>{person.name}</strong><small>{person.email}{person.username ? ` · Username: ${person.username}` : ''}{login ? ` · Password (session only): ${login.password}` : ''}</small></span>
            <span className="member-phone">{person.phone}</span>
            <span className="member-load"><strong>{assignedLeads.length}</strong><small>assigned leads</small></span>
            <span className={`active-label${person.onLeave ? ' leave-label' : ''}`}><span className="online-dot" /> {person.onLeave ? 'On leave' : 'Active'}</span>
            <button className="leave-toggle" type="button" onClick={() => onToggleLeave(person.id)}>{person.onLeave ? 'Mark available' : 'Mark on leave'}</button>
            {person.onLeave && openLeads.length > 0 && <div className="handoff-row"><span>{openLeads.length} open {openLeads.length === 1 ? 'lead' : 'leads'} to reassign</span><select aria-label={`Choose new counselor for ${person.name}`} value={handoffTargetId} onChange={(event) => onHandoffTargetChange(event.target.value)}><option value="">Select available counselor</option>{availableCounselors.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><button className="primary-action" type="button" disabled={!handoffTargetId} onClick={() => onTransfer(person.id, handoffTargetId)}><UsersRound size={15} /> Transfer work</button></div>}
            <button className="icon-action" type="button" aria-label={`Edit ${person.name}`} title="Edit counselor" onClick={() => setEditingCounselorId(person.id)}><Pencil size={16} /></button>
            <button className="icon-action remove-action" type="button" aria-label={`Remove ${person.name}`} title="Remove counselor" onClick={() => onRemove(person.id)}><Trash2 size={16} /></button>
          </>}
        </div>;
      })}</div> : <div className="empty-state"><UsersRound size={24} /><strong>No counselors yet</strong><span>Add your first counselor to start assigning leads.</span></div>}
    </section>
  </div>;
}

function FeesView({ students, allStudents, filter, onFilter, onCollect }) {
  const filters = ['All', 'Overdue', 'Upcoming', 'Paid', 'Later'];
  const summary = {
    overdue: allStudents.filter((student) => feeStatus(student) === 'Overdue'),
    upcoming: allStudents.filter((student) => feeStatus(student) === 'Upcoming'),
    paid: allStudents.filter((student) => feeStatus(student) === 'Paid'),
  };
  const outstanding = allStudents.reduce((total, student) => total + Math.max(0, student.fullFees - student.totalPaid), 0);
  return <div className="view-stack">
    <div className="fee-summary-grid">
      <article className="fee-summary-card"><span>TOTAL FEES OUTSTANDING</span><strong>{formatCurrency(outstanding)}</strong><small>Across {allStudents.length} enrolled students</small></article>
      <article className="fee-summary-card fee-overdue"><span>OVERDUE</span><strong>{summary.overdue.length}</strong><small>{formatCurrency(summary.overdue.reduce((sum, student) => sum + student.nextDueAmount, 0))} pending</small></article>
      <article className="fee-summary-card fee-upcoming"><span>DUE IN 7 DAYS</span><strong>{summary.upcoming.length}</strong><small>{formatCurrency(summary.upcoming.reduce((sum, student) => sum + student.nextDueAmount, 0))} expected</small></article>
      <article className="fee-summary-card fee-paid"><span>FULLY PAID</span><strong>{summary.paid.length}</strong><small>Accounts settled</small></article>
    </div>
    <section className="panel data-panel fees-panel">
      <div className="panel-heading"><div><h2>Student fee register</h2><p>Due dates, paid totals, and next instalments</p></div><span className="fee-color-key"><i className="fee-key-overdue" />Overdue <i className="fee-key-upcoming" />Due soon <i className="fee-key-paid" />Paid</span></div>
      <div className="fee-filters" role="group" aria-label="Filter fees">{filters.map((item) => <button key={item} type="button" className={`tier-filter${filter === item ? ' selected' : ''}`} onClick={() => onFilter(item)}>{item}<span>{item === 'All' ? allStudents.length : summary[item.toLowerCase()]?.length ?? allStudents.filter((student) => feeStatus(student) === item).length}</span></button>)}</div>
      <div className="fee-table-wrap"><table className="fee-table"><thead><tr><th>STUDENT / FATHER</th><th>COURSE</th><th>FULL FEES</th><th>BALANCE</th><th>NEXT DUE</th><th>STATUS</th><th>COLLECT</th></tr></thead><tbody>
        {students.map((student) => <tr className={`fee-row fee-row-${feeStatus(student).toLowerCase()}`} key={student.id}><td><strong>{student.name}</strong><small>{student.fatherName}</small></td><td>{student.course}</td><td>{formatCurrency(student.fullFees)}</td><td>{formatCurrency(Math.max(0, student.fullFees - student.totalPaid))}</td><td><strong>{formatCurrency(student.nextDueAmount)}</strong><small>{student.nextDueDate}</small></td><td><span className={`fee-status-pill fee-pill-${feeStatus(student).toLowerCase()}`}>{feeStatus(student)}</span></td><td><button className="fee-collect-button" type="button" disabled={feeStatus(student) === 'Paid'} onClick={() => onCollect(student.id)}><DollarSign size={14} /> Collect</button></td></tr>)}
      </tbody></table>{students.length === 0 && <div className="empty-state"><CreditCard size={24} /><strong>No fee records in this category</strong><span>Choose another fee status filter.</span></div>}</div>
    </section>
  </div>;
}

function FeeCollectionPage({ students, studentId, onBack, onSubmit }) {
  const student = students.find((item) => item.id === studentId);
  if (!student) return null;
  const balance = Math.max(0, student.fullFees - student.totalPaid);
  return <div className="fee-collection-backdrop">
    <section className="fee-collection-page" role="dialog" aria-modal="true" aria-labelledby="fee-collection-title">
      <header className="fee-collection-header"><button className="secondary-action" type="button" onClick={onBack}><ArrowRight className="back-arrow" size={16} /> Back to fees</button><span>WHC · FEE COLLECTION</span></header>
      <div className="fee-collection-content">
        <div className="fee-collection-title"><p className="section-kicker">STUDENT PAYMENT</p><h2 id="fee-collection-title">Collect fees</h2><p>Verify the student details and record the payment.</p></div>
        <div className="fee-student-details">
          <div><span>STUDENT</span><strong>{student.name}</strong></div><div><span>FATHER / GUARDIAN</span><strong>{student.fatherName || 'Not provided'}</strong></div><div><span>COURSE</span><strong>{student.course}</strong></div><div><span>PHONE</span><strong>{student.phone || 'Not provided'}</strong></div><div><span>FULL COURSE FEES</span><strong>{formatCurrency(student.fullFees)}</strong></div><div><span>FEES ALREADY PAID</span><strong>{formatCurrency(student.totalPaid)}</strong></div><div><span>OUTSTANDING BALANCE</span><strong>{formatCurrency(balance)}</strong></div><div><span>NEXT DUE DATE</span><strong>{student.nextDueDate || 'Not set'}</strong></div>
        </div>
        <form className="fee-collection-form" onSubmit={(event) => onSubmit(student.id, event)}>
          <h3>Payment details</h3>
          <label>Amount received (INR)<input name="amount" type="number" min="1" max={balance} defaultValue={Math.min(balance, student.nextDueAmount || balance)} required /></label>
          <label>Payment mode<select name="mode" required defaultValue=""><option value="" disabled>Select payment mode</option><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Card</option><option>Cheque</option></select></label>
          <label>Next due date<input name="nextDueDate" type="date" defaultValue={student.nextDueDate || ''} /></label>
          <label>Next due amount (INR)<input name="nextDueAmount" type="number" min="0" max={balance} defaultValue={Math.min(balance, student.nextDueAmount || balance)} required /></label>
          <label>Note (optional)<input name="note" placeholder="Transaction reference or note" /></label>
          <div className="fee-collection-actions"><button className="primary-action" type="submit"><Check size={16} /> Proceed</button></div>
        </form>
      </div>
    </section>
  </div>;
}

function FeeReceiptModal({ receipt, onClose }) {
  const receiptNumber = `WHC-${String(receipt.payment.id).slice(-8)}`;
  return <div className="record-modal-backdrop fee-receipt-backdrop"><section className="fee-receipt" role="dialog" aria-modal="true" aria-labelledby="fee-receipt-title">
    <div className="fee-receipt-heading"><span>WHC</span><small>PAYMENT RECEIPT</small></div>
    <h2 id="fee-receipt-title">Payment received</h2>
    <p className="receipt-number">Receipt {receiptNumber}</p>
    <div className="fee-receipt-rows"><div><span>Student</span><strong>{receipt.student.name}</strong></div><div><span>Father / guardian</span><strong>{receipt.student.fatherName || 'Not provided'}</strong></div><div><span>Course</span><strong>{receipt.student.course}</strong></div><div><span>Amount paid</span><strong>{formatCurrency(receipt.payment.amount)}</strong></div><div><span>Payment mode</span><strong>{receipt.payment.mode}</strong></div><div><span>Payment date</span><strong>{receipt.payment.date}</strong></div><div><span>Balance remaining</span><strong>{formatCurrency(receipt.balanceAfter)}</strong></div><div><span>Note</span><strong>{receipt.payment.note}</strong></div></div>
    <div className="fee-receipt-actions"><button className="secondary-action" type="button" onClick={onClose}>Close</button><button className="primary-action" type="button" onClick={() => window.print()}><CreditCard size={16} /> Print receipt</button></div>
  </section></div>;
}

function CounselorOverview({ counselor, counselors, students, leads, onNavigate, onStatusChange }) {
  return <div className="counselor-home-grid">
    <div className="stats-grid counselor-stats"><StatCard icon={ClipboardList} label="MY OPEN LEADS" value={leads.filter((lead) => lead.status !== 'Enrolled').length} change="Assigned prospects" tone="blue" /><StatCard icon={ContactRound} label="MY STUDENTS" value={students.length} change="Registered learners" tone="sage" /><StatCard icon={CreditCard} label="FEES TO FOLLOW UP" value={students.filter((student) => feeStatus(student) !== 'Paid').length} change="Your assigned accounts" tone="sand" /><StatCard icon={CheckCircle2} label="FEES PAID" value={students.filter((student) => feeStatus(student) === 'Paid').length} change="Settled accounts" tone="lavender" /></div>
    <section className="panel counselor-home-panel"><div className="panel-heading"><div><h2>My leads</h2><p>Prospective students assigned to you</p></div><button className="text-action" type="button" onClick={() => onNavigate('leads')}>Add lead <ArrowRight size={15} /></button></div><LeadTable leads={leads.slice(0, 5)} counselors={counselors} compact showCounselor={false} canChangeStatus onStatusChange={onStatusChange} /></section>
    <section className="panel counselor-home-panel"><div className="panel-heading"><div><h2>My registered students</h2><p>Students currently learning with us</p></div><button className="text-action" type="button" onClick={() => onNavigate('my-students')}>View roster <ArrowRight size={15} /></button></div><div className="joined-student-list">{students.slice(0, 5).map((student, index) => <div className="joined-student-row" key={student.id}><span className={`avatar color-${index % 5}`}>{initials(student.name)}</span><span className="joined-student-details"><strong>{student.name}</strong><small>{student.course}</small></span><span className={`fee-status-pill fee-pill-${feeStatus(student).toLowerCase()}`}>{feeStatus(student)}</span></div>)}</div></section>
  </div>;
}

function CounselorStudentsView({ counselor, students, notice, credentials, onRegister }) {
  return <div className="view-stack">
    <form className="entry-form registration-form" onSubmit={onRegister}>
      <div className="form-title-row"><div><span className="form-step">01</span><div><h2>Register a student</h2><p>Registration is shared with the admin workspace automatically.</p></div></div></div>
      <div className="form-fields registration-fields">
        <label>Student name<input name="studentName" required placeholder="Student full name" /></label><label>Father name<input name="fatherName" required placeholder="Parent or guardian" /></label><label>Student phone (optional)<input name="phone" type="tel" placeholder="+91 90000 00000" /></label><label>Alternative phone<input name="alternativePhone" type="tel" placeholder="Optional alternate number" /></label>
        <label>Course<input name="course" required placeholder="Course enrolled" /></label><label>Course type<select name="tier">{courseTypeOptions.map((item) => <option key={item} value={item}>{courseTypeLabel(item)}</option>)}</select></label>
        <label>Course start date<input name="courseStartDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Course end date<input name="courseEndDate" type="date" /></label>
        <label>Full fees (INR)<input name="fullFees" type="number" min="0" required placeholder="96000" /></label><label>Registration amount<input name="registrationAmount" type="number" min="0" required placeholder="10000" /></label><label>Next due amount<input name="nextDueAmount" type="number" min="0" required placeholder="14000" /></label><label>Next due date<input name="nextDueDate" type="date" required /></label>
      </div>
      {notice && <p className="registration-success"><CheckCircle2 size={16} />{notice}</p>}
      {credentials && <div className="admission-credentials" role="status"><strong>Student login credentials — share securely</strong><span>Username: <code>{credentials.username}</code></span><span>{credentials.passwordSource === 'phone' ? 'Initial password (phone number)' : 'Temporary password'}: <code>{credentials.password}</code></span><small>The student should change this password after signing in.</small></div>}
      <div className="form-actions"><button className="primary-action" type="submit"><UserPlus size={16} /> Submit registration</button></div>
    </form>
    <section className="panel data-panel"><div className="panel-heading"><div><h2>My registered students <span className="count-pill">{students.length}</span></h2><p>Only your assigned student records are shown</p></div></div><StudentRosterTable students={students} /></section>
  </div>;
}

function StudentRosterTable({ students }) {
  return <div className="student-roster-grid"><div className="student-roster-head"><span>STUDENT / FATHER</span><span>CONTACT</span><span>COURSE</span><span>COURSE TYPE</span><span>FULL FEES</span><span>REGISTRATION DATE</span><span>REGISTRATION AMOUNT</span><span>NEXT PAYMENT</span></div>{students.map((student) => <div className="student-roster-row" key={student.id}><span><strong>{student.name}</strong><small>{student.fatherName}</small><small>Username: {student.username || '—'}</small></span><span><strong>{student.phone}</strong><small>{student.alternativePhone}</small></span><span><strong>{student.course}</strong></span><span><strong>{courseTypeLabel(student.tier)}</strong></span><span>{formatCurrency(student.fullFees)}</span><span>{student.registrationDate || student.enrolledDate || '—'}</span><span>{formatCurrency(student.registrationAmount)}</span><span><strong>{formatCurrency(student.nextDueAmount)}</strong><small>{student.nextDueDate}</small></span></div>)}</div>;
}

function CoursesView({ courses }) {
  const topCourse = courses.find((course) => course.count > 0);
  const chartCourses = courses.filter((course) => course.count > 0).slice(0, 7);
  const maxCount = Math.max(...chartCourses.map((course) => course.count), 1);
  const chartPalette = ['#1d6da8', '#5a93c8', '#8db8d9', '#dfe7ee'];
  const chartCoursesWithMetrics = chartCourses.map((course, index) => ({
    ...course,
    percentage: Math.max(12, Math.round((course.count / maxCount) * 100)),
    accent: chartPalette[index % chartPalette.length],
  }));
  const marqueeCourses = [...chartCoursesWithMetrics, ...chartCoursesWithMetrics];

  const totalDemand = chartCoursesWithMetrics.reduce((sum, course) => sum + course.count, 0);
  const donutSegments = chartCoursesWithMetrics.reduce((segments, course) => {
    const start = segments.length === 0 ? 0 : Number(segments[segments.length - 1].end);
    const end = start + (course.count / totalDemand) * 100;
    segments.push({ ...course, start, end });
    return segments;
  }, []);
  const donutGradient = donutSegments.map((segment) => `${segment.accent} ${segment.start}% ${segment.end}%`).join(', ');

  const pieData = chartCoursesWithMetrics.map((course, index) => {
    const colors = ['#6c8bb2', '#c25e5e', '#73a4bb', '#d3c0d8', '#a3c99d', '#8cb3d9', '#c6b5d8'];
    const total = chartCourses.reduce((sum, item) => sum + item.count, 0) || 1;
    return {
      label: course.name,
      value: Math.round((course.count / total) * 100),
      color: colors[index % colors.length],
    };
  });
  const pieGradient = pieData.reduce((segments, item) => {
    const start = segments.length === 0 ? 0 : Number(segments[segments.length - 1].end);
    const end = start + item.value;
    segments.push({ ...item, start, end });
    return segments;
  }, []).map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(', ');

  return (
    <div className="view-stack courses-view">
      <section className="panel courses-hero">
        <div className="courses-hero-head">
          <div>
            <p className="section-kicker">PROGRAMS</p>
            <h2>Course demand overview</h2>
          </div>
          <div className="top-course-badge">
            <span>Top choice</span>
            <strong>{topCourse?.name ?? 'No course data'}</strong>
            <small>{topCourse?.count ?? 0} students selected</small>
          </div>
        </div>

        {totalDemand > 0 && <div className="course-marquee" aria-label="Popular courses">
          <div className="course-marquee-track">
            {marqueeCourses.map((course, index) => (
              <article key={`${course.id}-${index}`} className="mini-course-card" style={{ '--course-accent': course.accent }}>
                <span className="mini-course-rank">0{(index % chartCoursesWithMetrics.length) + 1}</span>
                <strong>{course.name}</strong>
                <small>{course.count} students</small>
              </article>
            ))}
          </div>
        </div>}

        {totalDemand > 0 ? <div className="chart-strip" aria-label="Course analytics strip">
          <article className="analytics-card analytics-card-bars">
            <div className="analytics-header">
              <span>Performance</span>
              <strong>{topCourse?.name}</strong>
            </div>
            <div className="bars-surface">
              {chartCoursesWithMetrics.map((course) => (
                <div key={course.id} className="mini-bar-group">
                  <div className="mini-bar-value">{course.percentage}%</div>
                  <div className="mini-bar-stack">
                    <span className="mini-bar" style={{ height: `${course.percentage}%`, background: `linear-gradient(180deg, ${course.accent} 0%, rgba(28, 87, 128, 0.9) 100%)` }} />
                  </div>
                  <small>{course.short}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="analytics-card analytics-card-donut">
            <div className="analytics-header">
              <span>Demand mix</span>
              <strong>Share</strong>
            </div>
            <div className="pie-layout">
              <div className="pie-chart" style={{ background: `conic-gradient(${pieGradient})` }}>
                <div className="pie-center">
                  <strong>{pieData[0]?.value ?? 0}%</strong>
                </div>
              </div>
              <div className="course-legend" aria-label="Course share chart legend">
                {pieData.map((item) => (
                  <div key={item.label} className="course-legend-item">
                    <span className="legend-swatch" style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <strong>{item.value}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

        </div> : <div className="empty-state"><BookOpen size={24} /><strong>No course analytics yet</strong><span>Course counts will appear here after leads or students are added.</span></div>}
      </section>
    </div>
  );
}

const lbColors = [['#2f86a8', '#8fd3ea'], ['#4458c9', '#9db0ff'], ['#6a54c9', '#c0b0ff'], ['#d4566f', '#ffa8bb'], ['#2f9d74', '#8ae6bf']];
const lbPhases = ['spin', 'glow', 'fly', 'congrats', 'park', 'open', 'praise', 'done'];

function playLudoWinSound() {
  const context = unlockAudioContext();
  if (!context) return;
  const notes = [
    { frequency: 784, duration: 0.13, delay: 0 },
    { frequency: 988, duration: 0.13, delay: 0.12 },
    { frequency: 1175, duration: 0.15, delay: 0.24 },
    { frequency: 1568, duration: 0.4, delay: 0.39 },
    { frequency: 1175, duration: 0.12, delay: 0.82 },
    { frequency: 1568, duration: 0.55, delay: 0.94 },
  ];
  notes.forEach(({ frequency, duration, delay }, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = index < 3 ? 'square' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(index < 3 ? 0.09 : 0.15, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}

let leaderboardApplause;

function playApplause() {
  leaderboardApplause ??= new Audio(applauseSound);
  leaderboardApplause.pause();
  leaderboardApplause.currentTime = 0;
  leaderboardApplause.volume = 0.45;
  leaderboardApplause.play().catch((error) => {
    console.error('Could not play leaderboard applause:', error);
  });
}

function LeaderboardView({ entries, loadError, onCelebrate }) {
  const rankings = entries.map((entry) => ({
    ...entry,
    studentCount: entry.convertedLeads,
  }));

  const orbit = rankings.slice(0, 5);
  const winner = orbit[0];
  const count = orbit.length;
  const [phase, setPhase] = useState('spin');
  const [runKey, setRunKey] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const orbRefs = useRef([]);
  const canvasRef = useRef(null);
  const rotation = useRef(0);
  const phaseRef = useRef('spin');
  const sizeRef = useRef(560);
  const runToken = useRef(0);
  const particles = useRef([]);
  const confettiRunning = useRef(false);
  const timers = useRef([]);
  const phaseIndex = lbPhases.indexOf(phase);

  const layout = useCallback(() => {
    const size = sizeRef.current;
    const radius = size * 0.36;
    orbRefs.current.forEach((element, index) => {
      if (!element || (index === 0 && lbPhases.indexOf(phaseRef.current) >= 2)) return;
      const angle = ((index * 360) / count + rotation.current - 90) * Math.PI / 180;
      element.style.transform = `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`;
    });
    if (trackRef.current) trackRef.current.style.transform = `translate(-50%, -50%) rotate(${rotation.current}deg)`;
  }, [count]);

  const burst = useCallback((x, y, amount) => {
    const colors = ['#f0b23a', '#4ca7c7', '#5d7ce8', '#7a65d8', '#ea6c86', '#53b98d', '#edf6ff'];
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      particles.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 6, rotation: Math.random() * 6, spin: Math.random() * 0.4 - 0.2, size: 6 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)] });
    }
    if (confettiRunning.current) return;
    confettiRunning.current = true;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { confettiRunning.current = false; return; }
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const context = canvas.getContext('2d');
      particles.current = particles.current.filter((p) => p.y < canvas.height + 30);
      particles.current.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rotation += p.spin;
        context.save(); context.translate(p.x, p.y); context.rotate(p.rotation); context.fillStyle = p.color; context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); context.restore();
      });
      if (particles.current.length) window.requestAnimationFrame(draw);
      else confettiRunning.current = false;
    };
    window.requestAnimationFrame(draw);
  }, []);

  useLayoutEffect(() => {
    function fit() {
      const available = wrapRef.current ? wrapRef.current.clientWidth - 36 : 560;
      const size = Math.max(280, Math.min(available, window.innerHeight - 250, 680));
      sizeRef.current = size;
      if (stageRef.current) stageRef.current.style.setProperty('--S', `${size}px`);
      layout();
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [layout]);

  useEffect(() => {
    if (!winner) return undefined;
    let dead = false;
    let frame = 0;
    runToken.current += 1;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    const sleep = (ms) => new Promise((resolve) => { timers.current.push(window.setTimeout(resolve, ms)); });
    const go = (next) => { phaseRef.current = next; setPhase(next); };
    rotation.current = 0;
    setCardOpen(false);
    setLineCount(0);
    go('spin');
    layout();

    (async () => {
      await sleep(1000);
      if (dead) return;
      await new Promise((resolve) => {
        const startTime = performance.now();
        const duration = 5200;
        const step = (now) => {
          if (dead) return;
          const k = Math.min(1, (now - startTime) / duration);
          rotation.current = 360 * (-(Math.cos(Math.PI * k) - 1) / 2);
          layout();
          if (k < 1) frame = window.requestAnimationFrame(step); else resolve();
        };
        frame = window.requestAnimationFrame(step);
      });
      if (dead) return;
      go('glow');
      await sleep(1900);
      if (dead) return;
      go('fly');
      await sleep(1500);
      if (dead) return;
      go('congrats');
      playLudoWinSound();
      burst(window.innerWidth / 2, window.innerHeight / 2, 160);
      await sleep(4200);
      if (dead) return;
      go('park');
    })();

    return () => {
      dead = true;
      window.cancelAnimationFrame(frame);
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, [runKey, winner?.id, count, layout, burst]);

  function openGift() {
    if (phaseRef.current !== 'park') return;
    const token = runToken.current;
    const later = (ms, fn) => timers.current.push(window.setTimeout(() => { if (token === runToken.current) fn(); }, ms));
    phaseRef.current = 'open';
    setPhase('open');
    playApplause();
    later(900, () => {
      phaseRef.current = 'praise';
      setPhase('praise');
      setCardOpen(true);
      burst(window.innerWidth / 2, window.innerHeight * 0.4, 200);
      [0, 1, 2, 3, 4, 5].forEach((i) => later(600 + i * 700, () => { burst(0, window.innerHeight * 0.6, 50); burst(window.innerWidth, window.innerHeight * 0.6, 50); }));
      [1, 2, 3, 4].forEach((n) => later(900 + (n - 1) * 1200, () => setLineCount(n)));
    });
  }

  function closeCard() {
    setCardOpen(false);
    phaseRef.current = 'done';
    setPhase('done');
  }

  if (!winner) return <section className="panel"><div className="empty-state"><Trophy size={24} /><strong>{loadError ? 'Leaderboard could not be loaded' : 'No counselors yet'}</strong><span>{loadError || 'Add counselors to start the leaderboard.'}</span></div></section>;

  const topDistribution = rankings.slice(0, 5).map((person, index) => ({
    label: person.name.split(' ')[0],
    value: Math.max(10, Math.round((person.studentCount / Math.max(rankings.reduce((sum, item) => sum + item.studentCount, 0), 1)) * 100)),
    color: ['#4d7eb4', '#7be0d0', '#6ea7c8', '#a9dccc', '#c8d9e8'][index % 5],
  }));
  const totalDistributed = topDistribution.reduce((sum, item) => sum + item.value, 0) || 1;
  const distributionGradient = topDistribution.reduce((segments, item) => {
    const start = segments.length === 0 ? 0 : Number(segments[segments.length - 1].end);
    const end = start + (item.value / totalDistributed) * 100;
    segments.push({ ...item, start, end });
    return segments;
  }, []).map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(', ');

  const rankingPanel = (
    <div className="panel leaderboard-panel">
      <div className="panel-heading">
        <div>
          <h2>Counselor leaderboard</h2>
          <p>Ranked by student admissions created from converted leads</p>
        </div>
        <Trophy size={23} />
      </div>
      <div className="leaderboard-layout">
        <div className="leaderboard-list-panel">
          <div className="leaderboard-list">
            {rankings.map((person, index) => (
              <article className={`leaderboard-row rank-${index + 1}`} key={person.id}>
                <span className="leader-rank">{index + 1}</span>
                <span className={`avatar color-${index % 5}`}>{initials(person.name)}</span>
                <span className="leader-person"><strong>{person.name}</strong><small>{person.studentCount} admissions</small></span>
                <span className="leader-score">{person.studentCount}<small>ADMISSIONS</small></span>
                {index === 0 && <button className="congrats-button" type="button" onClick={onCelebrate}>Celebrate <Smile size={17} /></button>}
              </article>
            ))}
          </div>
        </div>
        <aside className="leaderboard-summary-card" aria-label="Lead contribution summary">
          <div className="summary-header">
            <span>Lead share</span>
            <strong>Distribution</strong>
          </div>
          <div className="summary-donut-wrap">
            <div className="summary-donut" style={{ background: `conic-gradient(${distributionGradient})` }}>
              <div className="summary-donut-core">
                <strong>{Math.max(...topDistribution.map((item) => item.value))}%</strong>
                <small>Top share</small>
              </div>
            </div>
          </div>
          <div className="summary-legend">
            {topDistribution.map((item) => (
              <div key={item.label} className="summary-legend-item">
                <span className="summary-dot" style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );

  const first = winner.name.split(' ')[0];
  const praiseLines = [
    `${first} led the whole team this round with ${winner.studentCount} student ${winner.studentCount === 1 ? 'registration' : 'registrations'}.`,
    `Every student ${first} guides receives clear advice, patience, and real support.`,
    `Every converted lead represents another student ${first} helped bring into the program.`,
    `Thank you for lifting the whole team. Congratulations, ${first}!`,
  ];
  const centered = phase === 'fly' || phase === 'congrats' || phase === 'done';
  const parked = phase === 'park' || phase === 'open' || phase === 'praise';

  return (
    <section className="leaderboard-outer-panel">
    <div className="lb-wrap" ref={wrapRef}>
      <div className="lb-stage" ref={stageRef}>
        <div className={`lb-track${phaseIndex >= 2 ? ' off' : ''}`} ref={trackRef} />
        <div className={`lb-title${phaseIndex >= 2 ? ' gone' : ''}${phase === 'spin' ? ' pulse' : ''}`}><b>Leader</b><b>board</b></div>
        {orbit.map((person, index) => (
          <div
            key={person.id}
            ref={(element) => { orbRefs.current[index] = element; }}
            className={`lb-orb${index === 0 && phase === 'glow' ? ' is-win' : ''}${index === 0 && phaseIndex >= 2 ? ' is-champ moving' : ''}${index === 0 && centered ? ' is-center' : ''}${index === 0 && parked ? ' is-top' : ''}${index > 0 && phaseIndex >= 2 ? ' dim' : ''}`}
            style={{ '--c1': lbColors[index % 5][0], '--c2': lbColors[index % 5][1] }}
          ><span>{person.name}</span></div>
        ))}
        <button
          type="button"
          className={`lb-gift${parked ? ' show' : ''}${phase === 'open' || phase === 'praise' ? ' open' : ''}`}
          onClick={openGift}
          aria-label="Open the gift"
        >
          <span className="lb-gift-body"><span className="lb-rays" /><span className="lb-box" /><span className="lb-lid"><i className="lb-bow" /></span></span>
        </button>
        <p className={`lb-hint${phase === 'park' ? ' on' : ''}`}>Tap the gift to open it</p>
      </div>
      {phase === 'done' && <button className="primary-action" type="button" onClick={() => setRunKey((value) => value + 1)}>Replay</button>}
      {createPortal(
        <>
          <canvas className="lb-confetti" ref={canvasRef} aria-hidden="true" />
          <div className={`lb-overlay${phase === 'congrats' ? ' on' : ''}`}>
            <div className="lb-card" role="status">
              <Trophy className="lb-trophy" size={54} />
              <h2>Congratulations!</h2>
              <div className="lb-name">{winner.name}</div>
            </div>
          </div>
          <div className={`lb-overlay${cardOpen ? ' on' : ''}`}>
            <div className="lb-card lb-card-wide" role="dialog" aria-modal="true" aria-label="Appreciation for the top counselor">
              <PartyPopper className="lb-trophy" size={48} />
              <div className="lb-name">{winner.name}</div>
              <p>A big round of applause!</p>
              <div className="lb-praise">{praiseLines.map((line, index) => <p key={index} className={index < lineCount ? 'in' : ''}>{line}</p>)}</div>
              <button className="primary-action" type="button" onClick={closeCard}>Close</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
    {rankingPanel}
    </section>
  );
}

function TrainersView({ trainers, credentials, showForm, onAdd, onUpdateTrainer, onRemove, onCancelForm }) {
  const [editingTrainerId, setEditingTrainerId] = useState(null);

  return <div className="view-stack">
    {showForm && <TeamForm type="trainer" onSubmit={onAdd} onCancel={onCancelForm} />}
    <section className="panel data-panel"><div className="panel-heading"><div><h2>Trainer team <span className="count-pill">{trainers.length}</span></h2><p>Manage trainer profiles and course assignments</p></div><span className="availability"><span className="online-dot" /> All members active</span></div>
      {trainers.length ? <div className="team-table">{trainers.map((person, index) => <div className="member-row trainer-row" key={person.id}>
        {editingTrainerId === person.id ? <form className="employee-edit-form" onSubmit={async (event) => {
          if (await onUpdateTrainer(person.id, event)) setEditingTrainerId(null);
        }}>
          <label>Name<input name="name" defaultValue={person.name} required /></label>
          <label>Email<input name="email" type="email" defaultValue={person.email} required /></label>
          <label>Phone<input name="phone" type="tel" defaultValue={person.phone} minLength="6" required /></label>
          <label>Specialty<input name="specialty" defaultValue={person.specialty} placeholder="Optional" /></label>
          <label>Username<input name="username" defaultValue={person.username} autoComplete="off" required /></label>
          <label>New password<input name="password" type="password" autoComplete="new-password" minLength="6" placeholder="Leave blank to keep current" /></label>
          <div className="trainer-edit-actions"><button className="secondary-action" type="button" onClick={() => setEditingTrainerId(null)}>Cancel</button><button className="primary-action" type="submit"><Check size={15} /> Save</button></div>
        </form> : <>
          <span className={`avatar color-${(index + 2) % 5}`}>{initials(person.name)}</span><span className="member-details"><strong>{person.name}</strong><small>{person.email}{person.username ? ` · Username: ${person.username}` : ''}{credentials[person.id] ? ` · Password (session only): ${credentials[person.id].password}` : ''}</small></span><span className="specialty-label"><BookOpen size={15} />{person.specialty || 'Trainer'}</span><span className="active-label"><span className="online-dot" /> Active</span><button className="icon-action" type="button" aria-label={`Edit ${person.name}`} title="Edit trainer" onClick={() => setEditingTrainerId(person.id)}><Pencil size={16} /></button><button className="icon-action remove-action" type="button" aria-label={`Remove ${person.name}`} title="Remove trainer" onClick={() => onRemove(person.id)}><Trash2 size={16} /></button>
        </>}
      </div>)}</div> : <div className="empty-state"><GraduationCap size={24} /><strong>No trainers yet</strong><span>Add a trainer to your teaching team.</span></div>}
    </section>
  </div>;
}

export default App;