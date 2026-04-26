import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Briefcase, Building2, Calendar, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Download, Edit2, FileText, Landmark, Link2, LogIn, LogOut, Plus, RefreshCw,
  ShieldCheck, Sparkles, Users, Wallet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppStore } from '../store/appStore';
import db, { formatCurrency, formatDate, generateId } from '../utils/database';
import accountingDb from '../utils/accountingDatabase';
import { getErpName } from '../utils/branding';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().getMonth() + 1;
const currentYear = () => new Date().getFullYear();

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'consultant', label: 'Consultant' }
];

const DEPARTMENTS = ['Operations', 'Sales', 'Engineering', 'Procurement', 'Inventory', 'Accounts', 'HR', 'Administration'];
const ATTENDANCE_STATUSES = ['present', 'late', 'half_day', 'absent'];
const WORK_MODES = ['onsite', 'remote', 'hybrid', 'site_visit'];
const LEAVE_TYPES = ['casual', 'sick', 'earned', 'comp_off', 'unpaid'];
const HR_DOCUMENT_TYPES = ['Joining Letter', 'Confirmation Letter', 'Resignation Letter', 'Appraisal Letter', 'Policy Acknowledgement', 'ID Proof', 'Address Proof', 'Salary Revision', 'Warning Letter', 'Other'];

const EMPLOYEE_DEFAULTS = {
  employee_code: '',
  user_id: '',
  full_name: '',
  work_email: '',
  personal_email: '',
  phone: '',
  department: 'Operations',
  designation: '',
  employment_type: 'full_time',
  joining_date: today(),
  reporting_manager_id: '',
  work_location: '',
  shift_name: 'General Shift',
  status: 'active',
  basic_salary: 0,
  hra_amount: 0,
  allowance_amount: 0,
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  pf_number: '',
  esi_number: '',
  pan_number: '',
  aadhaar_number: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  leave_balance: 12,
  notes: ''
};

const ATTENDANCE_DEFAULTS = {
  employee_id: '',
  attendance_date: today(),
  check_in: '09:30',
  check_out: '18:30',
  status: 'present',
  work_mode: 'onsite',
  overtime_hours: 0,
  notes: ''
};

const LEAVE_DEFAULTS = {
  employee_id: '',
  leave_type: 'casual',
  start_date: today(),
  end_date: today(),
  reason: '',
  comments: ''
};

const REGULARIZATION_DEFAULTS = {
  employee_id: '',
  attendance_date: today(),
  requested_check_in: '09:30',
  requested_check_out: '18:30',
  requested_status: 'present',
  reason: '',
  comments: ''
};

const PAYROLL_DEFAULTS = {
  employee_id: '',
  payroll_month: currentMonth(),
  payroll_year: currentYear(),
  bonus_amount: 0,
  deduction_amount: 0,
  payment_status: 'draft',
  notes: ''
};

const DOCUMENT_DEFAULTS = {
  employee_id: '',
  document_type: 'Joining Letter',
  document_title: '',
  document_url: '',
  issued_on: today(),
  notes: ''
};

const badgeClass = (value) => {
  const tone = `${value || ''}`.toLowerCase();
  if (['active', 'approved', 'present', 'paid', 'posted', 'processed'].includes(tone)) return 'badge badge-success';
  if (['late', 'half_day', 'pending', 'draft'].includes(tone)) return 'badge badge-warning';
  if (['absent', 'inactive', 'rejected', 'failed', 'notice'].includes(tone)) return 'badge badge-danger';
  return 'badge badge-secondary';
};

const compactCurrency = (amount) => formatCurrency(amount, '\u20B9');
const currentTime = () => new Date().toTimeString().slice(0, 5);

const parseDateKey = (dateKey) => {
  const [year, month, day] = `${dateKey || ''}`.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const monthStart = (dateKey = today()) => {
  const date = parseDateKey(dateKey);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const shiftMonth = (date, direction) => new Date(date.getFullYear(), date.getMonth() + direction, 1);

const formatMonthHeading = (date) =>
  date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const buildCalendarDays = (date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      day,
      key,
      isToday: key === today()
    });
  }

  return cells;
};

const dayNameShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatHoursLabel = (value) => `${Number(value || 0).toFixed(2)} hrs`;
const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const getPayrollGross = (row) =>
  Number(row?.basic_amount || 0)
  + Number(row?.hra_amount || 0)
  + Number(row?.allowance_amount || 0)
  + Number(row?.bonus_amount || 0);
const maskAccountNumber = (value) => {
  const raw = `${value || ''}`.replace(/\s+/g, '');
  if (!raw) return '-';
  if (raw.length <= 4) return raw;
  return `${'*'.repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
};

const getRequiredWorkHours = (settings = {}) => {
  const parsed = Number(settings.work_hours_per_day || 9);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 9;
};

const calculateHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = `${checkIn}`.split(':').map(Number);
  const [outHour, outMinute] = `${checkOut}`.split(':').map(Number);
  const start = (inHour * 60) + inMinute;
  const end = (outHour * 60) + outMinute;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Number(((end - start) / 60).toFixed(2));
};

const getAttendanceWorkedHours = (attendanceRow, dateKey) => {
  if (!attendanceRow) return 0;
  if (attendanceRow.check_out) {
    return Number(attendanceRow.hours_worked || calculateHours(attendanceRow.check_in, attendanceRow.check_out) || 0);
  }
  if (attendanceRow.check_in && dateKey === today()) {
    return calculateHours(attendanceRow.check_in, currentTime());
  }
  return Number(attendanceRow.hours_worked || 0);
};

const isApprovedLeave = (leaveRow) => `${leaveRow?.status || ''}`.toLowerCase() === 'approved';
const isPendingLeave = (leaveRow) => Boolean(leaveRow) && !isApprovedLeave(leaveRow);

const getAttendanceSignal = ({ attendanceRow, leaveRow, requiredHours, dateKey }) => {
  const workedHours = getAttendanceWorkedHours(attendanceRow, dateKey);
  const shortfallHours = Math.max(requiredHours - workedHours, 0);
  const approvedLeave = isApprovedLeave(leaveRow);
  const pendingLeave = isPendingLeave(leaveRow);
  const isPastDate = Boolean(dateKey) && dateKey < today();
  const isTodayDate = dateKey === today();
  const isWeekOff = Boolean(dateKey) && isSunday(dateKey);

  if (isWeekOff) {
    return {
      status: 'week_off',
      label: 'week off',
      dotColor: 'var(--border)',
      needsRegularization: false,
      workedHours: 0,
      shortfallHours: 0
    };
  }

  if (approvedLeave) {
    return {
      status: 'leave_approved',
      label: 'approved leave',
      dotColor: 'var(--warning)',
      needsRegularization: false,
      workedHours: 0,
      shortfallHours: 0
    };
  }

  if (!attendanceRow?.check_in) {
    if (pendingLeave) {
      return {
        status: 'leave_pending',
        label: 'pending leave',
        dotColor: 'var(--accent)',
        needsRegularization: true,
        workedHours: 0,
        shortfallHours: requiredHours
      };
    }

    if (attendanceRow?.status === 'absent' || isPastDate) {
      return {
        status: 'absent',
        label: 'absent',
        dotColor: 'var(--danger)',
        needsRegularization: true,
        workedHours: 0,
        shortfallHours: requiredHours
      };
    }

    return {
      status: attendanceRow?.status || 'idle',
      label: (attendanceRow?.status || 'idle').replace('_', ' '),
      dotColor: attendanceRow?.status === 'absent' ? 'var(--danger)' : 'var(--border)',
      needsRegularization: false,
      workedHours: 0,
      shortfallHours: requiredHours
    };
  }

  if (attendanceRow.check_in && !attendanceRow.check_out) {
    return {
      status: isTodayDate ? 'in_progress' : 'incomplete_punch',
      label: isTodayDate ? 'punch open' : 'incomplete punch',
      dotColor: isTodayDate ? 'var(--accent)' : 'var(--danger)',
      needsRegularization: !isTodayDate,
      workedHours,
      shortfallHours
    };
  }

  if (attendanceRow.status === 'absent') {
    return {
      status: 'absent',
      label: 'absent',
      dotColor: 'var(--danger)',
      needsRegularization: true,
      workedHours: 0,
      shortfallHours: requiredHours
    };
  }

  if (workedHours >= requiredHours) {
    return {
      status: 'present',
      label: 'present',
      dotColor: 'var(--success)',
      needsRegularization: false,
      workedHours,
      shortfallHours: 0
    };
  }

  if (attendanceRow.status === 'half_day') {
    return {
      status: 'half_day',
      label: 'half day',
      dotColor: 'var(--warning)',
      needsRegularization: false,
      workedHours,
      shortfallHours
    };
  }

  if (pendingLeave) {
    return {
      status: 'leave_pending',
      label: 'pending leave',
      dotColor: 'var(--accent)',
      needsRegularization: true,
      workedHours,
      shortfallHours
    };
  }

  return {
    status: 'regularize_required',
    label: 'regularize required',
    dotColor: 'var(--danger)',
    needsRegularization: true,
    workedHours,
    shortfallHours
  };
};

const diffDaysInclusive = (startDate, endDate) => {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(diff + 1, 1);
};

const monthLabel = (month, year) =>
  new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const getMonthDays = (month, year) => new Date(Number(year), Number(month), 0).getDate();
const makeDateKey = (year, month, day) => `${Number(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const isSunday = (dateKey) => parseDateKey(dateKey).getDay() === 0;
const downloadFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const initials = (name) => {
  const parts = `${name || ''}`.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'HR';
};

const normalizeLookup = (value) => `${value || ''}`.trim().toLowerCase();

async function getNextSeries(table, field, prefix) {
  const row = await db.get(`SELECT ${field} AS code FROM ${table} ORDER BY created_at DESC LIMIT 1`);
  const last = row?.code ? parseInt(`${row.code}`.split('-').pop(), 10) || 0 : 0;
  return `${prefix}-${String(last + 1).padStart(4, '0')}`;
}

function EmployeeModal({ employee, employees, users, currentUser, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPLOYEE_DEFAULTS, ...(employee || {}) });
  const [departmentOptions, setDepartmentOptions] = useState(() => Array.from(
    new Set(
      [...DEPARTMENTS, ...employees.map((entry) => `${entry.department || ''}`.trim()), `${employee?.department || ''}`.trim()]
        .filter(Boolean)
    )
  ));
  const [showDepartmentCreator, setShowDepartmentCreator] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const grossMonthly = Number(form.basic_salary || 0) + Number(form.hra_amount || 0) + Number(form.allowance_amount || 0);
  const settlementReady = Boolean(`${form.bank_name || ''}`.trim() && `${form.account_number || ''}`.trim() && `${form.ifsc_code || ''}`.trim());
  const managerOptions = useMemo(() => {
    const currentManager = employees.find((entry) => entry.id === form.reporting_manager_id);
    const options = [...employees];

    if (currentManager && !options.some((entry) => entry.id === currentManager.id)) {
      options.push(currentManager);
    }

    return options
      .filter((entry) => entry.id !== employee?.id)
      .map((entry) => ({
        id: entry.id,
        label: entry.full_name || entry.linked_user_name || entry.linked_username || entry.employee_code || 'Unnamed employee',
        detail: [entry.designation, entry.department].filter(Boolean).join(' · ')
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employee?.id, employees, form.reporting_manager_id]);
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreateDepartment = () => {
    const normalizedName = `${newDepartmentName || ''}`.trim();
    if (!normalizedName) return;

    const existingDepartment = departmentOptions.find(
      (item) => item.toLowerCase() === normalizedName.toLowerCase()
    );
    const nextDepartment = existingDepartment || normalizedName;

    if (!existingDepartment) {
      setDepartmentOptions((prev) => [...prev, normalizedName].sort((a, b) => a.localeCompare(b)));
    }
    setField('department', nextDepartment);
    setNewDepartmentName('');
    setShowDepartmentCreator(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const employeeCode = form.employee_code || await getNextSeries('hr_employees', 'employee_code', 'EMP');
    const payload = [
      employeeCode, form.user_id || null, form.full_name, form.work_email, form.personal_email, form.phone,
      form.department, form.designation, form.employment_type, form.joining_date, form.reporting_manager_id || null,
      form.work_location, form.shift_name, form.status, Number(form.basic_salary || 0), Number(form.hra_amount || 0),
      Number(form.allowance_amount || 0), form.bank_name, form.account_number, form.ifsc_code, form.pf_number,
      form.esi_number, form.pan_number, form.aadhaar_number, form.emergency_contact_name, form.emergency_contact_phone,
      Number(form.leave_balance || 0), form.notes
    ];

    if (employee?.id) {
      await db.run(
        `UPDATE hr_employees
         SET employee_code=?, user_id=?, full_name=?, work_email=?, personal_email=?, phone=?, department=?, designation=?,
             employment_type=?, joining_date=?, reporting_manager_id=?, work_location=?, shift_name=?, status=?, basic_salary=?,
             hra_amount=?, allowance_amount=?, bank_name=?, account_number=?, ifsc_code=?, pf_number=?, esi_number=?, pan_number=?,
             aadhaar_number=?, emergency_contact_name=?, emergency_contact_phone=?, leave_balance=?, notes=?, updated_at=datetime('now')
         WHERE id=?`,
        [...payload, employee.id]
      );
    } else {
      await db.run(
        `INSERT INTO hr_employees (
          id, employee_code, user_id, full_name, work_email, personal_email, phone, department, designation,
          employment_type, joining_date, reporting_manager_id, work_location, shift_name, status, basic_salary,
          hra_amount, allowance_amount, bank_name, account_number, ifsc_code, pf_number, esi_number, pan_number,
          aadhaar_number, emergency_contact_name, emergency_contact_phone, leave_balance, notes, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [generateId(), ...payload, currentUser?.id || 'system']
      );
    }

    onSaved(employee ? 'Employee profile updated.' : 'Employee profile created.');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div className="catalogue-modal-title">
            <div className="catalogue-modal-title-icon" style={{ background: 'rgba(61,127,255,0.15)', color: 'var(--accent)' }}>
              <Users size={18} />
            </div>
            <div>
              <h3>{employee ? 'Edit Workforce Profile' : 'Add Workforce Profile'}</h3>
              <p>Employee master records connected to users, approvals, payroll, and accounting.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ padding: 18, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(61,127,255,0.18), rgba(34,197,94,0.08))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div className="catalogue-hero-kicker"><Sparkles size={14} /> Workforce Identity</div>
                  <h3 style={{ marginTop: 12, marginBottom: 4 }}>{form.full_name || 'New team member'}</h3>
                  <div className="text-secondary text-sm">{form.designation || 'Designation pending'} · {form.department || 'Department pending'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="catalogue-hero-side-label">Employee Code</div>
                  <strong style={{ fontSize: 24 }}>{form.employee_code || 'Auto on save'}</strong>
                  <div className="text-secondary text-sm" style={{ marginTop: 4 }}>
                    {employee ? 'Editing live workforce record' : 'A unique HR identity will be generated'}
                  </div>
                </div>
              </div>
              <div className="catalogue-modal-insights">
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Gross Monthly</span>
                  <strong>{compactCurrency(grossMonthly)}</strong>
                  <span className="text-secondary text-sm">Feeds payroll generation directly.</span>
                </div>
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Leave Balance</span>
                  <strong>{Number(form.leave_balance || 0).toFixed(1)} day(s)</strong>
                  <span className="text-secondary text-sm">Adjusted by approved leave flow.</span>
                </div>
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">User Linkage</span>
                  <strong>{form.user_id ? 'Linked' : 'Standalone'}</strong>
                  <span className="text-secondary text-sm">Connects employee to app access and approvals.</span>
                </div>
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Payroll Rail</span>
                  <strong>{settlementReady ? 'Ready' : 'Pending'}</strong>
                  <span className="text-secondary text-sm">Bank details required for reliable payroll ops.</span>
                </div>
              </div>
            </div>
            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Identity and Assignment</h4>
                <span>Core employment identity, organizational ownership, and system-user mapping.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation *</label>
                  <input className="form-control" value={form.designation} onChange={(e) => setField('designation', e.target.value)} required />
                </div>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
                      <select className="form-control" value={form.department} onChange={(e) => setField('department', e.target.value)}>
                        {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowDepartmentCreator((prev) => !prev)}>
                        <Plus size={16} />
                        {showDepartmentCreator ? 'Close' : 'Create New'}
                      </button>
                    </div>
                    {showDepartmentCreator && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                        <input
                          className="form-control"
                          value={newDepartmentName}
                          onChange={(e) => setNewDepartmentName(e.target.value)}
                          placeholder="Enter new department name, e.g. Management"
                        />
                        <button type="button" className="btn btn-primary" onClick={handleCreateDepartment}>
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select className="form-control" value={form.employment_type} onChange={(e) => setField('employment_type', e.target.value)}>
                    {EMPLOYMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="notice">Notice Period</option>
                  </select>
                </div>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Linked User</label>
                  <select className="form-control" value={form.user_id} onChange={(e) => setField('user_id', e.target.value)}>
                    <option value="">Not linked</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reporting Manager</label>
                  <select className="form-control" value={form.reporting_manager_id} onChange={(e) => setField('reporting_manager_id', e.target.value)}>
                    <option value="">No manager selected</option>
                    {managerOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.detail ? `${entry.label} (${entry.detail})` : entry.label}</option>)}
                  </select>
                  {managerOptions.length === 0 && (
                    <div className="text-secondary text-sm" style={{ marginTop: 6 }}>
                      No employee profile is available to assign as manager yet. Create the manager&apos;s workforce profile first.
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input type="date" className="form-control" value={form.joining_date || ''} onChange={(e) => setField('joining_date', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Contact and Work Arrangement</h4>
                <span>Operational contact channels and work structure used by HR operations.</span>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Work Email</label>
                  <input type="email" className="form-control" value={form.work_email} onChange={(e) => setField('work_email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Personal Email</label>
                  <input type="email" className="form-control" value={form.personal_email} onChange={(e) => setField('personal_email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Work Location</label>
                  <input className="form-control" value={form.work_location} onChange={(e) => setField('work_location', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Shift Name</label>
                  <input className="form-control" value={form.shift_name} onChange={(e) => setField('shift_name', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Payroll and Compliance</h4>
                <span>Salary stack and statutory identity that flow into monthly payroll runs.</span>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Basic Salary</label>
                  <input type="number" min="0" className="form-control" value={form.basic_salary} onChange={(e) => setField('basic_salary', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">HRA</label>
                  <input type="number" min="0" className="form-control" value={form.hra_amount} onChange={(e) => setField('hra_amount', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Allowances</label>
                  <input type="number" min="0" className="form-control" value={form.allowance_amount} onChange={(e) => setField('allowance_amount', e.target.value)} />
                </div>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">PAN Number</label>
                  <input className="form-control" value={form.pan_number} onChange={(e) => setField('pan_number', e.target.value.toUpperCase())} />
                </div>
                <div className="form-group">
                  <label className="form-label">PF Number</label>
                  <input className="form-control" value={form.pf_number} onChange={(e) => setField('pf_number', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">ESI Number</label>
                  <input className="form-control" value={form.esi_number} onChange={(e) => setField('esi_number', e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Aadhaar Number</label>
                  <input className="form-control" value={form.aadhaar_number} onChange={(e) => setField('aadhaar_number', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Balance</label>
                  <input type="number" min="0" step="0.5" className="form-control" value={form.leave_balance} onChange={(e) => setField('leave_balance', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Banking and Emergency Contact</h4>
                <span>Settlement details for payroll and escalation contact for employee safety.</span>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-control" value={form.bank_name} onChange={(e) => setField('bank_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input className="form-control" value={form.account_number} onChange={(e) => setField('account_number', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input className="form-control" value={form.ifsc_code} onChange={(e) => setField('ifsc_code', e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Emergency Contact Name</label>
                  <input className="form-control" value={form.emergency_contact_name} onChange={(e) => setField('emergency_contact_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Emergency Contact Phone</label>
                  <input className="form-control" value={form.emergency_contact_phone} onChange={(e) => setField('emergency_contact_phone', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{employee ? 'Update Employee' : 'Create Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HR() {
  const { currentUser, addNotification, settings } = useAppStore();
  const isAdmin = currentUser?.role === 'admin';
  const isDeveloper = normalizeLookup(currentUser?.role) === 'developer';
  const canViewAttendanceReports = isAdmin || isDeveloper;
  const [activeTab, setActiveTab] = useState(isAdmin ? 'overview' : 'payroll');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [regularizationRequests, setRegularizationRequests] = useState([]);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [overview, setOverview] = useState({
    activeEmployees: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingLeaves: 0,
    currentMonthPayroll: 0,
    linkedUsers: 0,
    openOrders: 0,
    payrollPosted: 0
  });
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState(ATTENDANCE_DEFAULTS);
  const [leaveForm, setLeaveForm] = useState(LEAVE_DEFAULTS);
  const [regularizationForm, setRegularizationForm] = useState(REGULARIZATION_DEFAULTS);
  const [payrollForm, setPayrollForm] = useState(PAYROLL_DEFAULTS);
  const [documentForm, setDocumentForm] = useState(DOCUMENT_DEFAULTS);
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportYear, setReportYear] = useState(currentYear());
  const [reportDepartment, setReportDepartment] = useState('all');
  const [reportEmployeeId, setReportEmployeeId] = useState('all');
  const [selectedDate, setSelectedDate] = useState(today());
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(today()));
  const [hrConnectStatus, setHrConnectStatus] = useState({
    running: false,
    localUrls: [],
    port: 4860,
    error: ''
  });

  const currencySymbol = settings.currency_symbol || '\u20B9';
  const companyName = settings.company_name || 'My Company';
  const erpName = getErpName(settings);
  const requiredWorkHours = getRequiredWorkHours(settings);
  const hrConnectMobileUrl = useMemo(
    () => (hrConnectStatus.localUrls || []).find((url) => !url.includes('127.0.0.1')) || null,
    [hrConnectStatus.localUrls]
  );
  const hrConnectDesktopUrl = useMemo(
    () => (hrConnectStatus.localUrls || []).find((url) => url.includes('127.0.0.1')) || `http://127.0.0.1:${hrConnectStatus.port || 4860}/hr-connect/`,
    [hrConnectStatus.localUrls, hrConnectStatus.port]
  );

  const flash = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3200);
  };

  // HR workspace hydration intentionally runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);

  const selfEmployee = useMemo(() => {
    if (!currentUser?.id) return null;
    return employees.find((entry) => entry.user_id === currentUser.id) || null;
  }, [employees, currentUser]);

  const selectedLeaveEmployee = useMemo(
    () => (leaveForm.employee_id
      ? employees.find((entry) => entry.id === leaveForm.employee_id) || null
      : null),
    [employees, leaveForm.employee_id]
  );

  const workforceLeaveBalance = useMemo(
    () => employees.reduce((sum, entry) => sum + Number(entry.leave_balance || 0), 0),
    [employees]
  );

  const managedEmployees = useMemo(
    () => (selfEmployee?.id ? employees.filter((entry) => entry.reporting_manager_id === selfEmployee.id) : []),
    [employees, selfEmployee]
  );

  const selfManager = useMemo(
    () => (selfEmployee?.reporting_manager_id
      ? employees.find((entry) => entry.id === selfEmployee.reporting_manager_id) || null
      : null),
    [employees, selfEmployee]
  );

  const selfNotificationRecipient = selfManager?.user_id || selfEmployee?.user_id || currentUser?.id || null;

  const managedEmployeeIds = useMemo(
    () => new Set(managedEmployees.map((entry) => entry.id)),
    [managedEmployees]
  );

  const isManager = managedEmployees.length > 0;
  const canApproveTeamRequests = isAdmin || isManager;

  const selfDocuments = useMemo(
    () => documents.filter((entry) => entry.employee_id === selfEmployee?.id),
    [documents, selfEmployee]
  );

  const selfAttendanceToday = useMemo(
    () => attendance.find((entry) => entry.employee_id === selfEmployee?.id && entry.attendance_date === today()) || null,
    [attendance, selfEmployee]
  );
  const selfAttendanceSignal = useMemo(
    () => getAttendanceSignal({ attendanceRow: selfAttendanceToday, leaveRow: null, requiredHours: requiredWorkHours, dateKey: today() }),
    [requiredWorkHours, selfAttendanceToday]
  );

  const visibleLeaveRequests = useMemo(
    () => (isAdmin
      ? leaveRequests
      : canApproveTeamRequests
        ? leaveRequests.filter((entry) => entry.employee_id === selfEmployee?.id || managedEmployeeIds.has(entry.employee_id))
        : leaveRequests.filter((entry) => entry.employee_id === selfEmployee?.id)),
    [canApproveTeamRequests, isAdmin, leaveRequests, managedEmployeeIds, selfEmployee]
  );

  const visibleAttendance = useMemo(
    () => (isAdmin
      ? attendance
      : canApproveTeamRequests
        ? attendance.filter((entry) => entry.employee_id === selfEmployee?.id || managedEmployeeIds.has(entry.employee_id))
        : attendance.filter((entry) => entry.employee_id === selfEmployee?.id)),
    [attendance, canApproveTeamRequests, isAdmin, managedEmployeeIds, selfEmployee]
  );

  const visibleRegularizationRequests = useMemo(
    () => (isAdmin
      ? regularizationRequests
      : canApproveTeamRequests
        ? regularizationRequests.filter((entry) => entry.employee_id === selfEmployee?.id || managedEmployeeIds.has(entry.employee_id))
        : regularizationRequests.filter((entry) => entry.employee_id === selfEmployee?.id)),
    [canApproveTeamRequests, isAdmin, managedEmployeeIds, regularizationRequests, selfEmployee]
  );

  const selfPayrollRuns = useMemo(
    () => payrollRuns.filter((entry) => entry.employee_id === selfEmployee?.id),
    [payrollRuns, selfEmployee]
  );

  const latestSelfPayroll = selfPayrollRuns[0] || null;

  const selfPayrollOverview = useMemo(() => {
    return selfPayrollRuns.reduce((summary, row) => {
      const gross = getPayrollGross(row);
      summary.gross += gross;
      summary.net += Number(row.net_amount || 0);
      summary.deductions += Number(row.deduction_amount || 0);
      if (`${row.payment_status || ''}`.toLowerCase() === 'paid') {
        summary.paid += Number(row.net_amount || 0);
      }
      return summary;
    }, {
      gross: 0,
      net: 0,
      paid: 0,
      deductions: 0
    });
  }, [selfPayrollRuns]);

  const selfPayrollStatuses = useMemo(() => {
    return selfPayrollRuns.reduce((counts, row) => {
      const key = `${row.payment_status || 'draft'}`.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [selfPayrollRuns]);

  const availableTabs = useMemo(
    () => (isAdmin
      ? [
          ['overview', 'Overview'],
          ['people', 'People'],
          ['attendance', 'Attendance'],
          ['leave', 'Leave'],
          ['documents', 'Documents'],
          ['payroll', 'Payroll'],
          ['reports', 'Reports']
        ]
      : canViewAttendanceReports
        ? [
            ['payroll', 'Payroll'],
            ['reports', 'Reports'],
            ['attendance', 'Attendance'],
            ['leave', 'Leave'],
            ['documents', 'Documents']
        ]
      : [
          ['payroll', 'Payroll'],
          ['attendance', 'Attendance'],
          ['leave', 'Leave'],
          ['documents', 'Documents']
        ]),
    [canViewAttendanceReports, isAdmin]
  );

  useEffect(() => {
    if (!availableTabs.some(([id]) => id === activeTab)) {
      setActiveTab(availableTabs[0]?.[0] || 'attendance');
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    if (selfEmployee?.id) {
      setAttendanceForm((prev) => ({ ...prev, employee_id: prev.employee_id || selfEmployee.id }));
      setLeaveForm((prev) => ({ ...prev, employee_id: prev.employee_id || selfEmployee.id }));
      setRegularizationForm((prev) => ({ ...prev, employee_id: prev.employee_id || selfEmployee.id }));
      setDocumentForm((prev) => ({ ...prev, employee_id: prev.employee_id || selfEmployee.id }));
    }
  }, [selfEmployee]);

  useEffect(() => {
    let active = true;
    if (!window.electronAPI?.getHrConnectStatus) return undefined;

    window.electronAPI.getHrConnectStatus()
      .then((result) => {
        if (active && result) setHrConnectStatus(result);
      })
      .catch((error) => {
        if (active) setHrConnectStatus((prev) => ({ ...prev, running: false, error: error.message || 'Unable to load HR Connect status.' }));
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    setRegularizationForm((prev) => ({ ...prev, attendance_date: selectedDate }));
  }, [selectedDate]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const month = currentMonth();
      const year = currentYear();
      const [employeeRows, attendanceRows, leaveRows, regularizationRows, payrollRows, documentRows, userRows, departmentRows, trendRows, activeEmployeesRow, presentTodayRow, onLeaveTodayRow, pendingLeavesRow, payrollRow, linkedUsersRow, openOrdersRow, payrollPostedRow] = await Promise.all([
        db.all(`SELECT e.*, u.full_name as linked_user_name, u.username as linked_username, mgr.full_name as manager_name
                FROM hr_employees e
                LEFT JOIN users u ON u.id = e.user_id
                LEFT JOIN hr_employees mgr ON mgr.id = e.reporting_manager_id
                ORDER BY CASE WHEN e.status = 'active' THEN 0 ELSE 1 END, e.full_name`),
        db.all(`SELECT a.*, e.full_name as employee_name, e.employee_code, e.department, e.designation
                FROM hr_attendance a
                JOIN hr_employees e ON e.id = a.employee_id
                ORDER BY a.attendance_date DESC, COALESCE(a.check_in, '23:59') DESC`),
        db.all(`SELECT l.*, e.full_name as employee_name, e.employee_code, e.department, u.full_name as approver_name
                FROM hr_leave_requests l
                JOIN hr_employees e ON e.id = l.employee_id
                LEFT JOIN users u ON u.id = l.approved_by
                ORDER BY CASE WHEN l.status = 'pending' THEN 0 ELSE 1 END, l.start_date DESC`),
        db.all(`SELECT r.*, e.full_name as employee_name, e.employee_code, e.department, e.designation, u.full_name as approver_name
                FROM hr_attendance_regularizations r
                JOIN hr_employees e ON e.id = r.employee_id
                LEFT JOIN users u ON u.id = r.approved_by
                ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.attendance_date DESC, r.created_at DESC`),
        db.all(`SELECT p.*, e.full_name as employee_name, e.employee_code, e.department, e.designation,
                       e.bank_name, e.account_number, e.ifsc_code
                FROM hr_payroll_runs p
                JOIN hr_employees e ON e.id = p.employee_id
                ORDER BY p.payroll_year DESC, p.payroll_month DESC, p.created_at DESC
                LIMIT 100`),
        db.all(`SELECT d.*, e.full_name as employee_name, e.employee_code, u.full_name as uploader_name
                FROM hr_employee_documents d
                JOIN hr_employees e ON e.id = d.employee_id
                LEFT JOIN users u ON u.id = d.created_by
                ORDER BY COALESCE(d.issued_on, d.created_at) DESC, d.created_at DESC
                LIMIT 200`),
        db.all(`
          SELECT id, username, full_name, email, role
          FROM users
          WHERE is_active = 1
            AND COALESCE(is_hidden, 0) = 0
            AND COALESCE(is_protected, 0) = 0
            AND LOWER(COALESCE(role, '')) <> 'developer'
            AND LOWER(COALESCE(username, '')) <> 'developer'
          ORDER BY COALESCE(full_name, username)
        `),
        db.all(`SELECT COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') as department, COUNT(*) as headcount
                FROM hr_employees
                WHERE status = 'active'
                GROUP BY COALESCE(NULLIF(TRIM(department), ''), 'Unassigned')
                ORDER BY headcount DESC`),
        db.all(`SELECT attendance_date,
                       SUM(CASE WHEN status IN ('present', 'late', 'half_day') THEN 1 ELSE 0 END) as present_count,
                       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
                FROM hr_attendance
                WHERE attendance_date >= date('now', '-6 day')
                GROUP BY attendance_date
                ORDER BY attendance_date`),
        db.get("SELECT COUNT(*) as count FROM hr_employees WHERE status = 'active'"),
        db.get("SELECT COUNT(DISTINCT employee_id) as count FROM hr_attendance WHERE attendance_date = date('now') AND status IN ('present', 'late', 'half_day')"),
        db.get("SELECT COUNT(*) as count FROM hr_leave_requests WHERE status = 'approved' AND date('now') BETWEEN start_date AND end_date"),
        db.get("SELECT COUNT(*) as count FROM hr_leave_requests WHERE status = 'pending'"),
        db.get('SELECT COALESCE(SUM(net_amount), 0) as amount FROM hr_payroll_runs WHERE payroll_month = ? AND payroll_year = ?', [month, year]),
        db.get("SELECT COUNT(*) as count FROM hr_employees WHERE status = 'active' AND user_id IS NOT NULL"),
        db.get("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'in_production')"),
        db.get('SELECT COUNT(*) as count FROM hr_payroll_runs WHERE payroll_month = ? AND payroll_year = ? AND posted_to_accounting = 1', [month, year])
      ]);

      setEmployees(employeeRows);
      setAttendance(attendanceRows);
      setLeaveRequests(leaveRows);
      setRegularizationRequests(regularizationRows);
      setPayrollRuns(payrollRows);
      setDocuments(documentRows);
      setUsers(userRows);
      setDepartmentStats(departmentRows);
      setAttendanceTrend(trendRows);
      setOverview({
        activeEmployees: activeEmployeesRow?.count || 0,
        presentToday: presentTodayRow?.count || 0,
        onLeaveToday: onLeaveTodayRow?.count || 0,
        pendingLeaves: pendingLeavesRow?.count || 0,
        currentMonthPayroll: Number(payrollRow?.amount || 0),
        linkedUsers: linkedUsersRow?.count || 0,
        openOrders: openOrdersRow?.count || 0,
        payrollPosted: payrollPostedRow?.count || 0
      });
    } catch (error) {
      console.error('Failed to load HR workspace', error);
      flash('error', 'Unable to load HR workspace.');
    } finally {
      setLoading(false);
    }
  };

  const attendanceHighlights = useMemo(() => {
    const total = Math.max(overview.activeEmployees, 1);
    const coverage = Math.min((overview.presentToday / total) * 100, 100);
    return {
      coverage,
      absentCount: Math.max(overview.activeEmployees - overview.presentToday - overview.onLeaveToday, 0)
    };
  }, [overview]);

  const recentJoiners = useMemo(
    () => [...employees]
      .sort((a, b) => new Date(b.joining_date || 0) - new Date(a.joining_date || 0))
      .slice(0, 4),
    [employees]
  );

  const payrollTotalPreview = useMemo(() => {
    const employee = employees.find((entry) => entry.id === payrollForm.employee_id);
    const gross = Number(employee?.basic_salary || 0) + Number(employee?.hra_amount || 0) + Number(employee?.allowance_amount || 0) + Number(payrollForm.bonus_amount || 0);
    const deduction = Number(payrollForm.deduction_amount || 0);
    return { employee, gross, deduction, net: Math.max(gross - deduction, 0) };
  }, [employees, payrollForm]);

  const calendarEmployeeId = isAdmin
    ? (attendanceForm.employee_id || '')
    : (selfEmployee?.id || '');

  const calendarEmployee = useMemo(
    () => employees.find((entry) => entry.id === calendarEmployeeId) || null,
    [calendarEmployeeId, employees]
  );

  const calendarAttendance = useMemo(
    () => attendance.filter((entry) => entry.employee_id === calendarEmployeeId),
    [attendance, calendarEmployeeId]
  );

  const calendarLeaves = useMemo(
    () => leaveRequests.filter((entry) => entry.employee_id === calendarEmployeeId),
    [calendarEmployeeId, leaveRequests]
  );

  const attendanceByDate = useMemo(
    () => new Map(calendarAttendance.map((entry) => [entry.attendance_date, entry])),
    [calendarAttendance]
  );

  const leaveByDate = useMemo(() => {
    const map = new Map();
    calendarLeaves.forEach((entry) => {
      let cursor = entry.start_date;
      while (cursor && cursor <= entry.end_date) {
        map.set(cursor, entry);
        const next = parseDateKey(cursor);
        next.setDate(next.getDate() + 1);
        cursor = toDateKey(next);
      }
    });
    return map;
  }, [calendarLeaves]);

  const selectedAttendance = attendanceByDate.get(selectedDate) || null;
  const selectedLeave = leaveByDate.get(selectedDate) || null;
  const selectedApprovedLeave = isApprovedLeave(selectedLeave) ? selectedLeave : null;
  const adminSelectionPending = isAdmin && !calendarEmployeeId;
  const selectedAttendanceSignal = useMemo(
    () => getAttendanceSignal({ attendanceRow: selectedAttendance, leaveRow: selectedLeave, requiredHours: requiredWorkHours, dateKey: selectedDate }),
    [requiredWorkHours, selectedAttendance, selectedDate, selectedLeave]
  );

  const calendarCells = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const attendanceCalendarSummary = useMemo(() => {
    const monthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = calendarAttendance.filter((entry) => entry.attendance_date.startsWith(monthKey));
    const monthSignals = monthEntries.map((entry) => getAttendanceSignal({
      attendanceRow: entry,
      leaveRow: leaveByDate.get(entry.attendance_date),
      requiredHours: requiredWorkHours,
      dateKey: entry.attendance_date
    }));
    return {
      workingDays: monthSignals.filter((entry) => entry.status === 'present').length,
      absentDays: monthSignals.filter((entry) => entry.status === 'regularize_required' || entry.status === 'absent').length,
      hoursWorked: monthEntries.reduce((sum, entry) => sum + Number(entry.hours_worked || 0), 0)
    };
  }, [calendarAttendance, calendarMonth, leaveByDate, requiredWorkHours]);

  const reportMonthName = useMemo(() => monthLabel(reportMonth, reportYear), [reportMonth, reportYear]);
  const reportDays = useMemo(
    () => Array.from({ length: getMonthDays(reportMonth, reportYear) }, (_, index) => index + 1),
    [reportMonth, reportYear]
  );

  const reportDepartmentOptions = useMemo(
    () => Array.from(new Set(
      employees
        .filter((entry) => entry.status === 'active')
        .map((entry) => `${entry.department || ''}`.trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b)),
    [employees]
  );

  const reportAttendanceMap = useMemo(
    () => new Map(
      attendance.map((entry) => [`${entry.employee_id}|${entry.attendance_date}`, entry])
    ),
    [attendance]
  );

  const reportLeaveMap = useMemo(() => {
    const map = new Map();
    const monthPrefix = `${reportYear}-${String(reportMonth).padStart(2, '0')}`;
    leaveRequests
      .filter((entry) => entry.status === 'approved')
      .forEach((entry) => {
        let cursor = entry.start_date;
        while (cursor && cursor <= entry.end_date) {
          if (cursor.startsWith(monthPrefix)) {
            map.set(`${entry.employee_id}|${cursor}`, entry);
          }
          const next = parseDateKey(cursor);
          next.setDate(next.getDate() + 1);
          cursor = toDateKey(next);
        }
      });
    return map;
  }, [leaveRequests, reportMonth, reportYear]);

  const reportEmployees = useMemo(
    () => employees
      .filter((entry) => entry.status === 'active')
      .filter((entry) => reportDepartment === 'all' || `${entry.department || ''}` === reportDepartment)
      .filter((entry) => reportEmployeeId === 'all' || entry.id === reportEmployeeId)
      .sort((a, b) => `${a.full_name || ''}`.localeCompare(`${b.full_name || ''}`)),
    [employees, reportDepartment, reportEmployeeId]
  );

  const attendanceReportRows = useMemo(() => reportEmployees.map((employee) => {
    const cells = [];
    const joinDateKey = employee.joining_date || null;
    let presentDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let weekOffDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let incompletePunches = 0;
    let scheduledDays = 0;
    let workedHours = 0;
    let presentCredits = 0;

    reportDays.forEach((day) => {
      const dateKey = makeDateKey(reportYear, reportMonth, day);
      const attendanceRow = reportAttendanceMap.get(`${employee.id}|${dateKey}`) || null;
      const leaveRow = reportLeaveMap.get(`${employee.id}|${dateKey}`) || null;
      const futureDate = dateKey > today();
      const beforeJoining = joinDateKey ? dateKey < joinDateKey : false;
      const daySignal = getAttendanceSignal({
        attendanceRow,
        leaveRow,
        requiredHours: requiredWorkHours,
        dateKey
      });

      let code = '';

      if (beforeJoining || futureDate) {
        code = '';
      } else if (isSunday(dateKey)) {
        code = 'W';
        weekOffDays += 1;
      } else {
        scheduledDays += 1;
        workedHours += daySignal.workedHours;

        if (daySignal.status === 'leave_approved') {
          code = 'L';
          leaveDays += 1;
        } else if (daySignal.status === 'present') {
          code = 'P';
          presentDays += 1;
          presentCredits += 1;
          if (attendanceRow?.status === 'late') lateDays += 1;
        } else if (daySignal.status === 'half_day') {
          code = 'HD';
          halfDays += 1;
          presentCredits += 0.5;
        } else if (daySignal.status === 'in_progress') {
          code = 'IN';
        } else if (daySignal.status === 'incomplete_punch') {
          code = 'IP';
          incompletePunches += 1;
        } else {
          code = 'A';
          absentDays += 1;
        }
      }

      cells.push({
        day,
        dateKey,
        code,
        title: leaveRow
          ? `${leaveRow.leave_type} leave`
          : attendanceRow
            ? `${attendanceRow.status}${attendanceRow.check_in ? ` · In ${attendanceRow.check_in}` : ''}${attendanceRow.check_out ? ` · Out ${attendanceRow.check_out}` : ''}`
            : (code === 'W' ? 'Week off' : code === 'A' ? 'Absent' : 'No record')
      });
    });

    const attendanceRate = scheduledDays ? (presentCredits / scheduledDays) * 100 : 0;

    return {
      employee,
      cells,
      presentDays,
      leaveDays,
      absentDays,
      weekOffDays,
      halfDays,
      lateDays,
      incompletePunches,
      scheduledDays,
      workedHours,
      presentCredits,
      attendanceRate
    };
  }), [reportAttendanceMap, reportDays, reportEmployees, reportLeaveMap, reportMonth, reportYear, requiredWorkHours]);

  const attendanceReportSummary = useMemo(() => {
    const totals = attendanceReportRows.reduce((acc, row) => {
      acc.employees += 1;
      acc.presentDays += row.presentDays;
      acc.leaveDays += row.leaveDays;
      acc.absentDays += row.absentDays;
      acc.weekOffDays += row.weekOffDays;
      acc.halfDays += row.halfDays;
      acc.lateDays += row.lateDays;
      acc.incompletePunches += row.incompletePunches;
      acc.scheduledDays += row.scheduledDays;
      acc.workedHours += row.workedHours;
      acc.presentCredits += row.presentCredits;
      return acc;
    }, {
      employees: 0,
      presentDays: 0,
      leaveDays: 0,
      absentDays: 0,
      weekOffDays: 0,
      halfDays: 0,
      lateDays: 0,
      incompletePunches: 0,
      scheduledDays: 0,
      workedHours: 0,
      presentCredits: 0
    });

    const attendanceRate = totals.scheduledDays ? (totals.presentCredits / totals.scheduledDays) * 100 : 0;
    const avgWorkedHours = totals.presentCredits ? totals.workedHours / totals.presentCredits : 0;

    return {
      ...totals,
      attendanceRate,
      avgWorkedHours
    };
  }, [attendanceReportRows]);

  const attendanceReportExceptions = useMemo(
    () => attendanceReportRows
      .filter((row) => row.absentDays > 0 || row.incompletePunches > 0 || row.lateDays > 0 || row.halfDays > 0)
      .sort((a, b) => (b.absentDays + b.incompletePunches + b.lateDays) - (a.absentDays + a.incompletePunches + a.lateDays))
      .slice(0, 6),
    [attendanceReportRows]
  );

  const exportAttendanceReportCsv = () => {
    if (attendanceReportRows.length === 0) return flash('error', 'No attendance rows available for export.');
    const headers = ['Employee', 'Emp Code', ...reportDays.map(String), 'Present', 'Leave', 'Absent', 'Week Off', 'Half Day', 'Late', 'Incomplete', 'Worked Hours', 'Attendance %'];
    const rows = attendanceReportRows.map((row) => [
      row.employee.full_name || '',
      row.employee.employee_code || '',
      ...row.cells.map((cell) => cell.code || ''),
      row.presentDays,
      row.leaveDays,
      row.absentDays,
      row.weekOffDays,
      row.halfDays,
      row.lateDays,
      row.incompletePunches,
      row.workedHours.toFixed(2),
      row.attendanceRate.toFixed(1)
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${`${value ?? ''}`.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadFile(`attendance-report-${reportYear}-${String(reportMonth).padStart(2, '0')}.csv`, csv, 'text/csv;charset=utf-8;');
    flash('success', 'Attendance report CSV downloaded.');
  };

  const exportAttendanceReportPdf = () => {
    if (attendanceReportRows.length === 0) return flash('error', 'No attendance rows available for export.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
    doc.setFontSize(18);
    doc.text(`${companyName} Attendance Report`, 40, 42);
    doc.setFontSize(10);
    doc.setTextColor(90, 98, 118);
    doc.text(`${reportMonthName} · Generated from employee punch data in ${erpName}`, 40, 60);
    doc.text(`Employees: ${attendanceReportSummary.employees} · Presence rate: ${attendanceReportSummary.attendanceRate.toFixed(1)}% · Worked hours: ${attendanceReportSummary.workedHours.toFixed(2)}`, 40, 76);

    autoTable(doc, {
      startY: 92,
      head: [[
        'Employee', 'Code', ...reportDays.map(String), 'P', 'L', 'A', 'W', 'HD', 'Late', 'Inc', 'Hours', '%'
      ]],
      body: attendanceReportRows.map((row) => [
        row.employee.full_name || '',
        row.employee.employee_code || '',
        ...row.cells.map((cell) => cell.code || ''),
        row.presentDays,
        row.leaveDays,
        row.absentDays,
        row.weekOffDays,
        row.halfDays,
        row.lateDays,
        row.incompletePunches,
        row.workedHours.toFixed(2),
        row.attendanceRate.toFixed(1)
      ]),
      styles: {
        fontSize: 6,
        cellPadding: 2,
        lineColor: [222, 228, 242],
        lineWidth: 0.3,
        overflow: 'hidden'
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        halign: 'center'
      },
      bodyStyles: {
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [247, 250, 255]
      },
      margin: { left: 24, right: 24, bottom: 24 },
      didParseCell: (hook) => {
        if (hook.section !== 'body') return;
        const dayStart = 2;
        const dayEnd = dayStart + reportDays.length - 1;
        if (hook.column.index < dayStart || hook.column.index > dayEnd) return;
        const value = `${hook.cell.raw || ''}`;
        if (value === 'P') {
          hook.cell.styles.fillColor = [220, 252, 231];
          hook.cell.styles.textColor = [22, 101, 52];
        } else if (value === 'A') {
          hook.cell.styles.fillColor = [254, 226, 226];
          hook.cell.styles.textColor = [153, 27, 27];
        } else if (value === 'L') {
          hook.cell.styles.fillColor = [254, 243, 199];
          hook.cell.styles.textColor = [146, 64, 14];
        } else if (value === 'W') {
          hook.cell.styles.fillColor = [226, 232, 240];
          hook.cell.styles.textColor = [51, 65, 85];
        } else if (value === 'HD') {
          hook.cell.styles.fillColor = [224, 231, 255];
          hook.cell.styles.textColor = [67, 56, 202];
        } else if (value === 'IP' || value === 'IN') {
          hook.cell.styles.fillColor = [219, 234, 254];
          hook.cell.styles.textColor = [30, 64, 175];
        }
      }
    });

    doc.save(`attendance-report-${reportYear}-${String(reportMonth).padStart(2, '0')}.pdf`);
    flash('success', 'Attendance report PDF downloaded.');
  };

  const pendingLeaveApprovals = useMemo(
    () => leaveRequests.filter((entry) => entry.status === 'pending' && (isAdmin || managedEmployeeIds.has(entry.employee_id))),
    [isAdmin, leaveRequests, managedEmployeeIds]
  );

  const pendingRegularizationApprovals = useMemo(
    () => regularizationRequests.filter((entry) => entry.status === 'pending' && (isAdmin || managedEmployeeIds.has(entry.employee_id))),
    [isAdmin, managedEmployeeIds, regularizationRequests]
  );

  const canApproveEmployee = (employeeId) => isAdmin || managedEmployeeIds.has(employeeId);

  useEffect(() => {
    if (!selfEmployee?.id) return;
    setRegularizationForm((prev) => ({
      ...prev,
      employee_id: selfEmployee.id,
      attendance_date: selectedDate,
      requested_check_in: selectedAttendance?.check_in || prev.requested_check_in || REGULARIZATION_DEFAULTS.requested_check_in,
      requested_check_out: selectedAttendance?.check_out || prev.requested_check_out || REGULARIZATION_DEFAULTS.requested_check_out,
      requested_status: selectedAttendanceSignal.needsRegularization ? 'present' : (selectedAttendance?.status || prev.requested_status || 'present')
    }));
  }, [selfEmployee, selectedAttendance, selectedAttendanceSignal.needsRegularization, selectedDate]);

  const handleEmployeeSaved = async (message) => {
    setEmployeeModalOpen(false);
    setEditingEmployee(null);
    await loadAll();
    flash('success', message);
  };

  const submitAttendance = async (e) => {
    e.preventDefault();
    const employeeId = isAdmin ? attendanceForm.employee_id : selfEmployee?.id;
    if (!employeeId) return flash('error', 'Select an employee for attendance.');

    const hoursWorked = attendanceForm.status === 'absent'
      ? 0
      : calculateHours(attendanceForm.check_in, attendanceForm.check_out);

    const existing = await db.get('SELECT id FROM hr_attendance WHERE employee_id = ? AND attendance_date = ?', [employeeId, attendanceForm.attendance_date]);
    const payload = [
      attendanceForm.check_in || null,
      attendanceForm.check_out || null,
      attendanceForm.status,
      attendanceForm.work_mode,
      hoursWorked,
      Number(attendanceForm.overtime_hours || 0),
      attendanceForm.notes,
      currentUser?.id || 'system'
    ];

    if (existing?.id) {
      await db.run(
        `UPDATE hr_attendance
         SET check_in=?, check_out=?, status=?, work_mode=?, hours_worked=?, overtime_hours=?, notes=?, created_by=?
         WHERE id=?`,
        [...payload, existing.id]
      );
    } else {
      await db.run(
        `INSERT INTO hr_attendance (
          id, employee_id, attendance_date, check_in, check_out, status, work_mode, hours_worked, overtime_hours, notes, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [generateId(), employeeId, attendanceForm.attendance_date, ...payload]
      );
    }

    const employee = employees.find((entry) => entry.id === employeeId);
    await addNotification('info', 'Attendance Updated', `${employee?.full_name || 'Employee'} marked ${attendanceForm.status} for ${attendanceForm.attendance_date}`, employeeId, 'hr_employee');
    setAttendanceForm({ ...ATTENDANCE_DEFAULTS, employee_id: isAdmin ? '' : (selfEmployee?.id || '') });
    await loadAll();
    flash('success', 'Attendance updated successfully.');
  };

  const submitLeave = async (e) => {
    e.preventDefault();
    const employeeId = isAdmin ? leaveForm.employee_id : selfEmployee?.id;
    if (!employeeId) return flash('error', 'Select an employee for leave request.');

    const leaveNumber = await getNextSeries('hr_leave_requests', 'leave_number', 'LV');
    const totalDays = diffDaysInclusive(leaveForm.start_date, leaveForm.end_date);

    await db.run(
      `INSERT INTO hr_leave_requests (
        id, leave_number, employee_id, leave_type, start_date, end_date, total_days, reason, comments, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [generateId(), leaveNumber, employeeId, leaveForm.leave_type, leaveForm.start_date, leaveForm.end_date, totalDays, leaveForm.reason, leaveForm.comments, currentUser?.id || 'system']
    );

    const employee = employees.find((entry) => entry.id === employeeId);
    const employeeRecord = employees.find((entry) => entry.id === employeeId) || null;
    const managerRecipient = employeeRecord?.reporting_manager_id
      ? employees.find((entry) => entry.id === employeeRecord.reporting_manager_id)?.user_id || null
      : employeeRecord?.user_id || currentUser?.id || null;
    await addNotification('warning', 'Leave Request Raised', `${employee?.full_name || 'Employee'} submitted ${leaveForm.leave_type} leave (${totalDays} day(s))`, employeeId, 'hr_leave', managerRecipient);
    setLeaveForm({ ...LEAVE_DEFAULTS, employee_id: isAdmin ? '' : (selfEmployee?.id || '') });
    await loadAll();
    flash('success', 'Leave request submitted.');
  };

  const updateLeaveStatus = async (row, newStatus) => {
    if (row.status !== 'pending') return;
    if (!canApproveEmployee(row.employee_id)) {
      return flash('error', 'You can only approve leave for your direct reports.');
    }
    await db.run(
      `UPDATE hr_leave_requests
       SET status=?, approved_by=?, approved_at=datetime('now'), comments=?, updated_at=datetime('now')
       WHERE id=?`,
      [newStatus, currentUser?.id || null, row.comments || null, row.id]
    );
    if (newStatus === 'approved') {
      await db.run('UPDATE hr_employees SET leave_balance = leave_balance - ? WHERE id = ?', [Number(row.total_days || 0), row.employee_id]);
    }
    const leaveEmployee = employees.find((entry) => entry.id === row.employee_id) || null;
    await addNotification(newStatus === 'approved' ? 'success' : 'error', `Leave ${newStatus}`, `${row.employee_name} leave request ${row.leave_number} was ${newStatus}.`, row.id, 'hr_leave', leaveEmployee?.user_id || null);
    await loadAll();
    flash('success', `Leave request ${newStatus}.`);
  };

  const submitRegularization = async (e) => {
    e.preventDefault();
    const employeeId = selfEmployee?.id;
    if (!employeeId) return flash('error', 'Link this login to an employee record before requesting regularization.');
    if (!regularizationForm.attendance_date) return flash('error', 'Choose the attendance date to regularize.');
    if (!`${regularizationForm.reason || ''}`.trim()) return flash('error', 'Enter a reason for regularization.');

    const requestNumber = await getNextSeries('hr_attendance_regularizations', 'request_number', 'RG');
    await db.run(
      `INSERT INTO hr_attendance_regularizations (
        id, request_number, employee_id, attendance_date, requested_check_in, requested_check_out, requested_status, reason, comments, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        requestNumber,
        employeeId,
        regularizationForm.attendance_date,
        regularizationForm.requested_check_in || null,
        regularizationForm.requested_check_out || null,
        regularizationForm.requested_status,
        regularizationForm.reason,
        regularizationForm.comments,
        currentUser?.id || 'system'
      ]
    );

    await addNotification(
      'warning',
      'Attendance Regularization Raised',
      `${selfEmployee?.full_name || 'Employee'} requested attendance regularization for ${regularizationForm.attendance_date}.`,
      employeeId,
      'hr_attendance_regularization',
      selfNotificationRecipient
    );
    setRegularizationForm({
      ...REGULARIZATION_DEFAULTS,
      employee_id: selfEmployee?.id || '',
      attendance_date: selectedDate,
      requested_check_in: selectedAttendance?.check_in || REGULARIZATION_DEFAULTS.requested_check_in,
      requested_check_out: selectedAttendance?.check_out || REGULARIZATION_DEFAULTS.requested_check_out,
      requested_status: selectedAttendanceSignal.needsRegularization ? 'present' : (selectedAttendance?.status || 'present')
    });
    await loadAll();
    flash('success', 'Regularization request submitted.');
  };

  const updateRegularizationStatus = async (row, newStatus) => {
    if (row.status !== 'pending') return;
    if (!canApproveEmployee(row.employee_id)) {
      return flash('error', 'You can only approve regularization requests for your direct reports.');
    }

    await db.run(
      `UPDATE hr_attendance_regularizations
       SET status=?, approved_by=?, approved_at=datetime('now'), updated_at=datetime('now')
       WHERE id=?`,
      [newStatus, currentUser?.id || null, row.id]
    );

    if (newStatus === 'approved') {
      const hoursWorked = row.requested_status === 'absent'
        ? 0
        : calculateHours(row.requested_check_in, row.requested_check_out);
      const existing = await db.get(
        'SELECT id, notes FROM hr_attendance WHERE employee_id = ? AND attendance_date = ?',
        [row.employee_id, row.attendance_date]
      );
      const approvalNote = `Approved regularization ${row.request_number}`;

      if (existing?.id) {
        await db.run(
          `UPDATE hr_attendance
           SET check_in=?, check_out=?, status=?, hours_worked=?, notes=?, created_by=?
           WHERE id=?`,
          [
            row.requested_check_in || null,
            row.requested_check_out || null,
            row.requested_status,
            hoursWorked,
            `${existing.notes ? `${existing.notes} | ` : ''}${approvalNote}`,
            currentUser?.id || 'system',
            existing.id
          ]
        );
      } else {
        await db.run(
          `INSERT INTO hr_attendance (
            id, employee_id, attendance_date, check_in, check_out, status, work_mode, hours_worked, overtime_hours, notes, created_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            generateId(),
            row.employee_id,
            row.attendance_date,
            row.requested_check_in || null,
            row.requested_check_out || null,
            row.requested_status,
            'onsite',
            hoursWorked,
            0,
            approvalNote,
            currentUser?.id || 'system'
          ]
        );
      }
    }

    await addNotification(
      newStatus === 'approved' ? 'success' : 'error',
      `Regularization ${newStatus}`,
      `${row.employee_name} regularization ${row.request_number} was ${newStatus}.`,
      row.id,
      'hr_attendance_regularization',
      employees.find((entry) => entry.id === row.employee_id)?.user_id || null
    );
    await loadAll();
    flash('success', `Regularization request ${newStatus}.`);
  };

  const punchAttendance = async (mode) => {
    try {
      if (!selfEmployee?.id) {
        return flash('error', 'This login is not linked to an employee record. Open HR > People and map this user to an employee first.');
      }

      const stamp = currentTime();
      const existing = await db.get('SELECT * FROM hr_attendance WHERE employee_id = ? AND attendance_date = ?', [selfEmployee.id, today()]);

      if (mode === 'in') {
        if (existing?.check_in) {
          return flash('info', `You already punched in at ${existing.check_in}.`);
        }

        if (existing?.id) {
          await db.run(
            `UPDATE hr_attendance
             SET check_in = ?, check_out = NULL, status = 'in_progress', work_mode = COALESCE(work_mode, 'onsite'),
                 hours_worked = 0, notes = ?, created_by = ?, created_at = datetime('now')
             WHERE id = ?`,
            [`${stamp}`, `Punch in via ${erpName} self service`, currentUser?.id || 'system', existing.id]
          );
        } else {
          await db.run(
            `INSERT INTO hr_attendance (
              id, employee_id, attendance_date, check_in, check_out, status, work_mode, hours_worked, overtime_hours, notes, created_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [generateId(), selfEmployee.id, today(), `${stamp}`, null, 'in_progress', 'onsite', 0, 0, `Punch in via ${erpName} self service`, currentUser?.id || 'system']
          );
        }

        await addNotification('info', 'Punch In Recorded', `${selfEmployee.full_name} punched in at ${stamp}.`, selfEmployee.id, 'hr_attendance', selfNotificationRecipient);
        await loadAll();
        return flash('success', `Punch in recorded at ${stamp}.`);
      }

      if (!existing?.check_in) {
        return flash('error', 'Punch in first before punching out.');
      }

      if (existing?.check_out) {
        return flash('info', `You already punched out at ${existing.check_out}.`);
      }

      const workedHours = calculateHours(existing.check_in, `${stamp}`);
      const computedStatus = workedHours >= requiredWorkHours ? 'present' : 'regularize_required';

      await db.run(
        `UPDATE hr_attendance
         SET check_out = ?, status = ?,
             hours_worked = ?, notes = ?, created_by = ?
         WHERE id = ?`,
        [
          `${stamp}`,
          computedStatus,
          workedHours,
          `${existing.notes ? `${existing.notes} | ` : ''}Punch out via ${erpName} self service`,
          currentUser?.id || 'system',
          existing.id
        ]
      );
      await addNotification('success', 'Punch Out Recorded', `${selfEmployee.full_name} punched out at ${stamp}.`, selfEmployee.id, 'hr_attendance', selfNotificationRecipient);
      await loadAll();
      return flash('success', `Punch out recorded at ${stamp}.`);
    } catch (error) {
      console.error('Punch attendance failed', error);
      return flash('error', `Punch action failed: ${error.message || 'unknown error'}`);
    }
  };

  const submitDocument = async (e) => {
    e.preventDefault();
    if (!documentForm.employee_id) return flash('error', 'Select an employee for the document record.');
    if (!`${documentForm.document_title || ''}`.trim() || !`${documentForm.document_url || ''}`.trim()) {
      return flash('error', 'Document title and document link are required.');
    }

    await db.run(
      `INSERT INTO hr_employee_documents (
        id, employee_id, document_type, document_title, document_url, issued_on, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        documentForm.employee_id,
        documentForm.document_type,
        documentForm.document_title.trim(),
        documentForm.document_url.trim(),
        documentForm.issued_on || today(),
        documentForm.notes || '',
        currentUser?.id || 'system'
      ]
    );

    const employee = employees.find((entry) => entry.id === documentForm.employee_id);
    await addNotification('info', 'Employee Document Added', `${documentForm.document_title} linked for ${employee?.full_name || 'employee'}.`, documentForm.employee_id, 'hr_document');
    setDocumentForm({ ...DOCUMENT_DEFAULTS, employee_id: isAdmin ? '' : (selfEmployee?.id || '') });
    await loadAll();
    flash('success', 'Document link saved successfully.');
  };

  const submitPayroll = async (e) => {
    e.preventDefault();
    if (!payrollForm.employee_id) return flash('error', 'Select an employee for payroll.');

    const existing = await db.get(
      'SELECT id FROM hr_payroll_runs WHERE employee_id = ? AND payroll_month = ? AND payroll_year = ?',
      [payrollForm.employee_id, payrollForm.payroll_month, payrollForm.payroll_year]
    );
    if (existing?.id) return flash('error', 'Payroll already exists for this employee and month.');

    const payrollNumber = await getNextSeries('hr_payroll_runs', 'payroll_number', `PR-${payrollForm.payroll_year}${String(payrollForm.payroll_month).padStart(2, '0')}`);

    await db.run(
      `INSERT INTO hr_payroll_runs (
        id, payroll_number, employee_id, payroll_month, payroll_year, basic_amount, hra_amount, allowance_amount,
        bonus_amount, deduction_amount, net_amount, payment_status, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        payrollNumber,
        payrollForm.employee_id,
        Number(payrollForm.payroll_month),
        Number(payrollForm.payroll_year),
        Number(payrollTotalPreview.employee?.basic_salary || 0),
        Number(payrollTotalPreview.employee?.hra_amount || 0),
        Number(payrollTotalPreview.employee?.allowance_amount || 0),
        Number(payrollForm.bonus_amount || 0),
        Number(payrollForm.deduction_amount || 0),
        payrollTotalPreview.net,
        payrollForm.payment_status,
        payrollForm.notes,
        currentUser?.id || 'system'
      ]
    );

    await addNotification('info', 'Payroll Run Created', `${payrollTotalPreview.employee?.full_name || 'Employee'} payroll generated for ${monthLabel(payrollForm.payroll_month, payrollForm.payroll_year)}.`, payrollForm.employee_id, 'hr_payroll');
    setPayrollForm(PAYROLL_DEFAULTS);
    await loadAll();
    flash('success', 'Payroll run created.');
  };

  const postPayrollToAccounting = async (row) => {
    if (row.posted_to_accounting) return flash('info', 'This payroll run is already posted to accounting.');

    try {
      const [salaryExpense, payrollPayable, deductionPayable, settingsRow] = await Promise.all([
        accountingDb.get("SELECT * FROM coa_accounts WHERE code = '5200' LIMIT 1"),
        accountingDb.get("SELECT * FROM coa_accounts WHERE code = '2310' LIMIT 1"),
        accountingDb.get("SELECT * FROM coa_accounts WHERE code = '2320' LIMIT 1"),
        accountingDb.get("SELECT value FROM accounting_settings WHERE key = 'journal_prefix'")
      ]);

      const journalId = generateId();
      const voucherNumber = `${settingsRow?.value || 'JV'}-${Date.now()}`;
      const gross = Number(row.basic_amount || 0) + Number(row.hra_amount || 0) + Number(row.allowance_amount || 0) + Number(row.bonus_amount || 0);
      const deduction = Number(row.deduction_amount || 0);
      const net = Number(row.net_amount || 0);
      const lines = [
        {
          account_id: salaryExpense?.id || null,
          account_code: salaryExpense?.code || '5200',
          account_name: salaryExpense?.name || 'Payroll Expense',
          debit_amount: gross,
          credit_amount: 0
        },
        {
          account_id: payrollPayable?.id || null,
          account_code: payrollPayable?.code || '2310',
          account_name: payrollPayable?.name || 'Payroll Payable',
          debit_amount: 0,
          credit_amount: net
        }
      ];

      if (deduction > 0) {
        lines.push({
          account_id: deductionPayable?.id || null,
          account_code: deductionPayable?.code || '2320',
          account_name: deductionPayable?.name || 'Payroll Deductions Payable',
          debit_amount: 0,
          credit_amount: deduction
        });
      }

      await accountingDb.run(
        `INSERT INTO journal_entries (
          id, voucher_number, voucher_type, voucher_date, posting_status, reference_type, reference_id,
          narration, source_module, auto_posted, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          journalId,
          voucherNumber,
          'payroll-accrual',
          today(),
          'posted',
          'hr_payroll',
          row.id,
          `${row.employee_name} payroll accrual for ${monthLabel(row.payroll_month, row.payroll_year)}`,
          'hr',
          1,
          currentUser?.id || 'system'
        ]
      );

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        await accountingDb.run(
          `INSERT INTO journal_lines (
            id, journal_id, line_number, account_id, account_code, account_name, description, debit_amount, credit_amount
          ) VALUES (?,?,?,?,?,?,?,?,?)`,
          [generateId(), journalId, index + 1, line.account_id, line.account_code, line.account_name, 'Auto-posted from HR payroll', Number(line.debit_amount || 0), Number(line.credit_amount || 0)]
        );
      }

      await db.run(
        "UPDATE hr_payroll_runs SET posted_to_accounting = 1, accounting_journal_id = ?, payment_status = CASE WHEN payment_status = 'draft' THEN 'processed' ELSE payment_status END, updated_at = datetime('now') WHERE id = ?",
        [journalId, row.id]
      );

      await addNotification('success', 'Payroll Posted', `${row.payroll_number} posted to accounting journal ${voucherNumber}.`, row.id, 'hr_payroll');
      await loadAll();
      flash('success', 'Payroll posted to Accounting.');
    } catch (error) {
      console.error('Failed to post payroll to accounting', error);
      flash('error', 'Unable to post payroll to Accounting.');
    }
  };

  const downloadPayslipLegacy = (row) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const gross = getPayrollGross(row);
    autoTable(doc, {
      startY: 220,
      head: [['Earnings / Deductions', 'Amount']],
      body: [
        ['Basic Salary', compactCurrency(row.basic_amount)],
        ['HRA', compactCurrency(row.hra_amount)],
        ['Allowances', compactCurrency(row.allowance_amount)],
        ['Bonus', compactCurrency(row.bonus_amount)],
        ['Deductions', compactCurrency(row.deduction_amount)],
        ['Net Pay', compactCurrency(row.net_amount)]
      ],
      styles: { fontSize: 11, cellPadding: 8 },
      headStyles: { fillColor: [36, 74, 178] }
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(companyName, 40, 52);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${erpName} · Payroll Payslip`, 40, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`Payslip · ${monthLabel(row.payroll_month, row.payroll_year)}`, 40, 110);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Employee: ${row.employee_name}`, 40, 136);
    doc.text(`Employee Code: ${row.employee_code}`, 40, 154);
    doc.text(`Department: ${row.department || '-'}`, 40, 172);
    doc.text(`Designation: ${row.designation || '-'}`, 40, 190);
    doc.text(`Payroll No.: ${row.payroll_number}`, 340, 136);
    doc.text(`Payment Status: ${row.payment_status}`, 340, 154);
    doc.text(`Accounting Posted: ${row.posted_to_accounting ? 'Yes' : 'No'}`, 340, 172);
    doc.text(`Bank: ${row.bank_name || '-'}`, 340, 190);
    doc.setFont('helvetica', 'bold');
    doc.text(`Gross Pay: ${compactCurrency(gross)}`, 40, doc.lastAutoTable.finalY + 28);
    doc.text(`Net Pay: ${compactCurrency(row.net_amount)}`, 40, doc.lastAutoTable.finalY + 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('This is a system-generated payslip prepared from the ERP HR and payroll workspace.', 40, doc.lastAutoTable.finalY + 80);
    doc.save(`${row.payroll_number}.pdf`);
  };

  void downloadPayslipLegacy;

  const downloadPayslip = (row) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const gross = getPayrollGross(row);
    const deduction = Number(row.deduction_amount || 0);
    const payPeriod = monthLabel(row.payroll_month, row.payroll_year);
    const generatedOn = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const bankAccount = maskAccountNumber(row.bank_account_number || row.account_number || row.bank_account);
    const ifscCode = row.ifsc_code || row.bank_ifsc || row.ifsc || '-';
    const paymentMethod = row.payment_method || 'Bank Transfer';
    const startX = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - startX * 2;
    const panelGap = 16;
    const panelWidth = (contentWidth - panelGap) / 2;
    const summaryWidth = 156;
    const cardTop = 210;
    const cardHeight = 112;

    const drawInfoBlock = (title, x, lines) => {
      doc.setTextColor(19, 66, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title, x + 18, cardTop + 24);
      doc.setTextColor(82, 94, 117);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      lines.forEach(([label, value], index) => {
        const y = cardTop + 48 + index * 18;
        doc.text(label, x + 18, y);
        doc.setTextColor(35, 43, 59);
        doc.text(`${value}`, x + 112, y);
        doc.setTextColor(82, 94, 117);
      });
    };

    doc.setFillColor(246, 248, 252);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(19, 66, 139);
    doc.rect(0, 0, pageWidth, 112, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(companyName, startX, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${erpName} Payroll Management`, startX, 62);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Salary Slip', pageWidth - startX, 44, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Pay period: ${payPeriod}`, pageWidth - startX, 64, { align: 'right' });
    doc.text(`Generated on: ${generatedOn}`, pageWidth - startX, 82, { align: 'right' });

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(startX, 92, contentWidth, 98, 18, 18, 'F');
    doc.setDrawColor(220, 227, 238);
    doc.roundedRect(startX, 92, contentWidth, 98, 18, 18, 'S');

    doc.setTextColor(35, 43, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(row.employee_name || 'Employee', startX + 22, 122);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(106, 118, 140);
    doc.text(`Employee ID: ${row.employee_code || '-'}`, startX + 22, 142);
    doc.text(`Designation: ${row.designation || '-'}`, startX + 22, 158);
    doc.text(`Department: ${row.department || '-'}`, startX + 22, 174);

    const summaryX = startX + contentWidth - summaryWidth - 22;
    doc.setFillColor(241, 247, 255);
    doc.roundedRect(summaryX, 108, summaryWidth, 66, 12, 12, 'F');
    doc.setTextColor(19, 66, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Net Pay', summaryX + 16, 128);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(compactCurrency(row.net_amount), summaryX + 16, 152);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Payroll No: ${row.payroll_number || '-'}`, summaryX + 16, 170);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(startX, cardTop, panelWidth, cardHeight, 14, 14, 'F');
    doc.roundedRect(startX + panelWidth + panelGap, cardTop, panelWidth, cardHeight, 14, 14, 'F');
    doc.setDrawColor(220, 227, 238);
    doc.roundedRect(startX, cardTop, panelWidth, cardHeight, 14, 14, 'S');
    doc.roundedRect(startX + panelWidth + panelGap, cardTop, panelWidth, cardHeight, 14, 14, 'S');

    drawInfoBlock('Employee Details', startX, [
      ['Pay period', payPeriod],
      ['Status', row.payment_status || 'processed'],
      ['Posted', row.posted_to_accounting ? 'Yes' : 'No']
    ]);

    drawInfoBlock('Payment Details', startX + panelWidth + panelGap, [
      ['Method', paymentMethod],
      ['Bank', row.bank_name || '-'],
      ['Account', bankAccount || '-'],
      ['IFSC', ifscCode]
    ]);

    autoTable(doc, {
      startY: 346,
      theme: 'grid',
      head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
      body: [
        ['Basic Salary', compactCurrency(row.basic_amount), 'Statutory / Other', compactCurrency(deduction)],
        ['House Rent Allowance', compactCurrency(row.hra_amount), '', ''],
        ['Other Allowances', compactCurrency(row.allowance_amount), '', ''],
        ['Bonus', compactCurrency(row.bonus_amount), '', ''],
        ['Gross Earnings', compactCurrency(gross), 'Total Deductions', compactCurrency(deduction)],
        ['Net Salary', compactCurrency(row.net_amount), '', '']
      ],
      styles: {
        fontSize: 10,
        cellPadding: 9,
        textColor: [45, 55, 72],
        lineColor: [228, 233, 242],
        lineWidth: 1
      },
      headStyles: {
        fillColor: [19, 66, 139],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [247, 250, 255]
      },
      columnStyles: {
        0: { cellWidth: 175 },
        1: { halign: 'right', cellWidth: 95 },
        2: { cellWidth: 165 },
        3: { halign: 'right', cellWidth: 95 }
      },
      didParseCell: ({ row: tableRow, cell }) => {
        if (tableRow.section === 'body' && (tableRow.index === 4 || tableRow.index === 5)) {
          cell.styles.fontStyle = 'bold';
          cell.styles.fillColor = [239, 245, 255];
        }
      }
    });

    const tableBottom = doc.lastAutoTable.finalY;
    doc.setFillColor(19, 66, 139);
    doc.roundedRect(startX, tableBottom + 18, contentWidth, 46, 12, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Gross Salary', startX + 18, tableBottom + 45);
    doc.text('Total Deductions', startX + 220, tableBottom + 45);
    doc.text('Net Salary', startX + 422, tableBottom + 45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(compactCurrency(gross), startX + 18, tableBottom + 62);
    doc.text(compactCurrency(deduction), startX + 220, tableBottom + 62);
    doc.text(compactCurrency(row.net_amount), startX + 422, tableBottom + 62);

    doc.setTextColor(102, 113, 132);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('This is a system-generated salary slip and does not require a physical signature.', startX, tableBottom + 96);
    doc.text('Authorised Signatory', pageWidth - startX, tableBottom + 96, { align: 'right' });
    doc.setDrawColor(180, 190, 210);
    doc.line(pageWidth - 170, tableBottom + 84, pageWidth - startX, tableBottom + 84);
    doc.save(`${row.payroll_number}.pdf`);
  };

  const activityFeed = useMemo(() => {
    const attendanceEvents = attendance.slice(0, 4).map((row) => ({
      id: row.id,
      type: 'Attendance',
      title: `${row.employee_name} marked ${row.status}`,
      subtitle: `${row.attendance_date} · ${row.work_mode}`,
      tone: row.status === 'absent' ? 'var(--danger)' : 'var(--accent)'
    }));
    const leaveEvents = leaveRequests.slice(0, 4).map((row) => ({
      id: row.id,
      type: 'Leave',
      title: `${row.employee_name} · ${row.leave_type}`,
      subtitle: `${row.status} · ${row.start_date} to ${row.end_date}`,
      tone: row.status === 'approved' ? 'var(--success)' : row.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'
    }));
    const payrollEvents = payrollRuns.slice(0, 4).map((row) => ({
      id: row.id,
      type: 'Payroll',
      title: `${row.employee_name} · ${row.payroll_number}`,
      subtitle: `${monthLabel(row.payroll_month, row.payroll_year)} · ${compactCurrency(row.net_amount)}`,
      tone: row.posted_to_accounting ? 'var(--success)' : 'var(--accent)'
    }));
    return [...attendanceEvents, ...leaveEvents, ...payrollEvents]
      .sort((a, b) => `${b.subtitle}`.localeCompare(`${a.subtitle}`))
      .slice(0, 8);
  }, [attendance, leaveRequests, payrollRuns]);

  const tabStyle = { padding: '0 24px 24px', display: 'grid', gap: 16 };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>HR</h2>
          <div className="page-subtitle">People operations, time governance, leave control, and payroll posting connected to your ERP core.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={loadAll}><RefreshCw size={14} /> Refresh</button>
          {isAdmin && <button className="btn btn-primary" onClick={() => { setEditingEmployee(null); setEmployeeModalOpen(true); }}><Plus size={14} /> Add Employee</button>}
        </div>
      </div>

      <div className="page-content">
        {status && (
          <div style={{
            margin: '0 24px 16px',
            padding: '12px 14px',
            borderRadius: 14,
            border: `1px solid ${status.type === 'success' ? 'rgba(34,197,94,0.22)' : status.type === 'error' ? 'rgba(239,68,68,0.22)' : 'rgba(61,127,255,0.22)'}`,
            background: status.type === 'success' ? 'rgba(34,197,94,0.08)' : status.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(61,127,255,0.08)'
          }}>
            {status.message}
          </div>
        )}

        <div className="catalogue-hero">
          <div className="catalogue-hero-main">
            <div className="catalogue-hero-kicker"><Sparkles size={14} /> Human Capital Command Center</div>
            <h3>{isAdmin ? 'Run employee operations with the same discipline as leading ERP suites.' : `Welcome back, ${selfEmployee?.full_name || currentUser?.full_name || 'team member'}.`}</h3>
            <p>{isAdmin
              ? 'Employee master records, attendance capture, leave approvals, payroll control, and employee document custody now live in one connected workspace, with user-account linkage and accounting journal posting built in.'
              : 'Use this personal HR desk to punch in or out, review your attendance trail, request leave, and open your own HR documents without seeing wider workforce administration.'}</p>
            <div className="catalogue-chip-row">
              {isAdmin && <div className="catalogue-chip">Employee Central</div>}
              <div className="catalogue-chip">Time & Attendance</div>
              <div className="catalogue-chip">Leave Governance</div>
              <div className="catalogue-chip">Document Desk</div>
              {!isAdmin && <div className="catalogue-chip">Personal Payslips</div>}
              {isAdmin && <div className="catalogue-chip">Payroll to Ledger</div>}
            </div>
          </div>
          <div className="catalogue-hero-side">
            <span className="catalogue-hero-side-label">{isAdmin ? 'Current Payroll Cycle' : 'My Payroll Access'}</span>
            <strong>{isAdmin ? monthLabel(currentMonth(), currentYear()) : (latestSelfPayroll ? monthLabel(latestSelfPayroll.payroll_month, latestSelfPayroll.payroll_year) : (selfEmployee?.employee_code || 'Pending Link'))}</strong>
            <span>{isAdmin ? `${overview.activeEmployees} active employees across ${departmentStats.length || 0} departments.` : (selfEmployee ? `${selfEmployee.designation || 'Employee'} · ${selfEmployee.department || 'Unassigned department'}` : 'Ask HR admin to link your user with an employee master.')}</span>
            <span>{isAdmin ? `${overview.payrollPosted} payroll run(s) posted to Accounting this month.` : (latestSelfPayroll ? `${selfPayrollRuns.length} payslip(s) are available in your login automatically after HR generates payroll.` : 'Your payslips will appear here automatically once HR generates payroll for your employee record.')}</span>
          </div>
        </div>

        {isAdmin && (
          <div style={{ margin: '0 24px 16px' }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>HR Connect Mobile Page</h3>
                  <div className="page-subtitle">Employees on the same local Wi-Fi can open this page on mobile, sign in with their own credentials, and use punch in or punch out.</div>
                </div>
                <span className={badgeClass(hrConnectStatus.running ? 'active' : 'inactive')}>
                  {hrConnectStatus.running ? 'running' : 'offline'}
                </span>
              </div>
              <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                <div className="grid-2">
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--bg-secondary)' }}>
                    <div className="catalogue-summary-title">Mobile Portal Address</div>
                    <strong style={{ display: 'block', marginTop: 6, fontSize: 18 }}>
                      {hrConnectMobileUrl || 'Connect this PC and your phone to the same Wi-Fi to generate a mobile URL.'}
                    </strong>
                    <div className="text-secondary text-sm" style={{ marginTop: 6 }}>
                      Use the Wi-Fi IP on mobile. Do not use `127.0.0.1` on a phone because that points back to the phone itself.
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--bg-secondary)' }}>
                    <div className="catalogue-summary-title">How It Works</div>
                    <div className="text-secondary text-sm" style={{ marginTop: 6, lineHeight: 1.7 }}>
                      Keep the OWNERP desktop app open on the main PC, connect phones to the same local Wi-Fi, open the Wi-Fi IP shown here, and sign in using the employee&apos;s normal login.
                    </div>
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--bg-secondary)' }}>
                  <div className="catalogue-summary-title">Available Local URLs</div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {hrConnectMobileUrl && (
                      <div className="font-mono" style={{ fontSize: 13, wordBreak: 'break-all' }}>
                        Mobile / same Wi-Fi: {hrConnectMobileUrl}
                      </div>
                    )}
                    <div className="font-mono" style={{ fontSize: 13, wordBreak: 'break-all', opacity: 0.72 }}>
                      This PC only: {hrConnectDesktopUrl}
                    </div>
                    {(!hrConnectStatus.localUrls || hrConnectStatus.localUrls.length === 0) && (
                      <div className="text-secondary text-sm">{hrConnectStatus.error || 'Local URLs will appear once the built-in HR Connect server starts.'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAdmin && <div className="catalogue-stats-grid">
          {[
            { label: 'Active Employees', value: overview.activeEmployees, detail: `${overview.linkedUsers} linked to users`, icon: Users, tone: 'var(--accent)' },
            { label: 'Present Today', value: overview.presentToday, detail: `${attendanceHighlights.coverage.toFixed(0)}% attendance coverage`, icon: Clock, tone: 'var(--success)' },
            { label: 'Pending Leave Approvals', value: overview.pendingLeaves, detail: `${overview.onLeaveToday} employee(s) on leave today`, icon: Calendar, tone: 'var(--warning)' },
            { label: 'Monthly Payroll', value: formatCurrency(overview.currentMonthPayroll, currencySymbol), detail: `${overview.openOrders} open order(s) influencing manpower load`, icon: Wallet, tone: 'var(--info)' }
          ].map((card) => (
            <div key={card.label} className="catalogue-summary-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <span className="catalogue-summary-title">{card.label}</span>
                  <strong>{card.value}</strong>
                  <span className="text-secondary text-sm">{card.detail}</span>
                </div>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: `${card.tone}1a`, color: card.tone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <card.icon size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>}

        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div className="tabs" style={{ width: 'fit-content' }}>
              {availableTabs.map(([id, label]) => (
              <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
              ))}
            </div>
            <div className="catalogue-summary-card" style={{ flex: '1 1 420px', maxWidth: 560, minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="catalogue-summary-title">Self Attendance Desk</span>
                  <strong>{selfAttendanceToday?.check_in ? `In ${selfAttendanceToday.check_in}` : 'Not Punched In'}</strong>
                  <span className="text-secondary text-sm">
                    {selfEmployee
                      ? `${selfEmployee.full_name} · ${selfAttendanceToday?.check_out ? `Out ${selfAttendanceToday.check_out}` : 'Waiting for punch out'}`
                      : 'This login is not yet connected to an employee master.'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => punchAttendance('in')} disabled={!selfEmployee || Boolean(selfAttendanceToday?.check_in)}>
                    <LogIn size={12} /> Punch In
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => punchAttendance('out')} disabled={!selfEmployee || !selfAttendanceToday?.check_in || Boolean(selfAttendanceToday?.check_out)}>
                    <LogOut size={12} /> Punch Out
                  </button>
                </div>
              </div>
              {!selfEmployee && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', color: 'var(--warning)', fontSize: 12 }}>
                  Punch actions need an employee mapping for this login. Open the employee master and set the Linked User field for your account.
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ margin: '0 24px 24px' }}>
            <div className="card-body">Loading HR workspace...</div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div style={tabStyle}>
                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Workforce Architecture</h3>
                        <div className="page-subtitle">Headcount and department distribution for org planning.</div>
                      </div>
                      <Building2 size={18} color="var(--accent)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      {departmentStats.length === 0 && <div className="text-secondary">No departments configured yet.</div>}
                      {departmentStats.map((row, index) => {
                        const max = Math.max(...departmentStats.map((item) => Number(item.headcount || 0)), 1);
                        const width = (Number(row.headcount || 0) / max) * 100;
                        return (
                          <div key={`${row.department}-${index}`} className="catalogue-stock-card tone-watch">
                            <div className="catalogue-stock-head">
                              <strong>{row.department}</strong>
                              <span>{row.headcount} team member(s)</span>
                            </div>
                            <div className="catalogue-stock-bar"><span style={{ width: `${width}%` }} /></div>
                            <div className="catalogue-stock-foot">
                              <span>Headcount share</span>
                              <span>{width.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Attendance Pulse</h3>
                        <div className="page-subtitle">Last 7 days presence against absence indicators.</div>
                      </div>
                      <Clock size={18} color="var(--success)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                      <div className="catalogue-stock-card tone-healthy">
                        <div className="catalogue-stock-head">
                          <strong>Today Coverage</strong>
                          <span>{attendanceHighlights.coverage.toFixed(0)}%</span>
                        </div>
                        <div className="catalogue-stock-bar"><span style={{ width: `${attendanceHighlights.coverage}%` }} /></div>
                        <div className="catalogue-stock-foot">
                          <span>{overview.presentToday} present</span>
                          <span>{attendanceHighlights.absentCount} absent</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {attendanceTrend.length === 0 && <div className="text-secondary">Attendance trend will appear after daily marking starts.</div>}
                        {attendanceTrend.map((row) => {
                          const total = Number(row.present_count || 0) + Number(row.absent_count || 0) || 1;
                          const presentWidth = (Number(row.present_count || 0) / total) * 100;
                          return (
                            <div key={row.attendance_date}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                                <span>{formatDate(row.attendance_date)}</span>
                                <span className="text-secondary">{row.present_count} present / {row.absent_count} absent</span>
                              </div>
                              <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex' }}>
                                <div style={{ width: `${presentWidth}%`, background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
                                <div style={{ width: `${100 - presentWidth}%`, background: 'linear-gradient(90deg, #f97316, #ef4444)' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Integration Layer</h3>
                        <div className="page-subtitle">How HR is connected to the rest of the ERP.</div>
                      </div>
                      <Landmark size={18} color="var(--info)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      {[
                        { title: 'Users', text: `${overview.linkedUsers} employee profile(s) linked to system users for role-based access and approvals.`, icon: ShieldCheck, tone: 'var(--accent)' },
                        { title: 'Accounting', text: `${overview.payrollPosted} payroll run(s) already posted into journal entries this month.`, icon: Landmark, tone: 'var(--success)' },
                        { title: 'Orders', text: `${overview.openOrders} open order(s) visible as workforce demand signals for planning teams.`, icon: Briefcase, tone: 'var(--warning)' }
                      ].map((item) => (
                        <div key={item.title} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${item.tone}18`, color: item.tone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <item.icon size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.title}</div>
                            <div className="text-secondary text-sm">{item.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Recent Workforce Signals</h3>
                        <div className="page-subtitle">Fast read of the latest people operations events.</div>
                      </div>
                      <AlertTriangle size={18} color="var(--warning)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      {activityFeed.length === 0 && <div className="text-secondary">HR activity will start showing here as records are created.</div>}
                      {activityFeed.map((item) => (
                        <div key={`${item.type}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.title}</div>
                            <div className="text-secondary text-sm">{item.subtitle}</div>
                          </div>
                          <span className="badge badge-secondary" style={{ alignSelf: 'center', color: item.tone }}>{item.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Newest Team Members</h3>
                      <div className="page-subtitle">Fresh employee records entering the org graph.</div>
                    </div>
                    <Users size={18} color="var(--accent)" />
                  </div>
                  <div className="card-body">
                    <div className="grid-4">
                      {recentJoiners.length === 0 && <div className="text-secondary">Add your first employee to start building the HR base.</div>}
                      {recentJoiners.map((entry) => (
                        <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 18, background: 'linear-gradient(180deg, rgba(61,127,255,0.08), rgba(255,255,255,0.01))' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 16, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                              {initials(entry.full_name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{entry.full_name}</div>
                              <div className="text-secondary text-sm">{entry.designation || 'Designation pending'}</div>
                            </div>
                          </div>
                          <div className="text-secondary text-sm" style={{ marginBottom: 6 }}>{entry.department || 'Unassigned department'}</div>
                          <div className="text-secondary text-sm">Joined {formatDate(entry.joining_date)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'leave' && (
              <div style={tabStyle}>
                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>{isAdmin ? 'Raise Leave Request' : 'Raise My Leave Request'}</h3>
                        <div className="page-subtitle">{isAdmin ? 'Track planned absence with approval-ready dates and balance impact.' : 'Submit your own leave request with approval-ready dates and reason details.'}</div>
                      </div>
                      <Calendar size={18} color="var(--warning)" />
                    </div>
                    <form onSubmit={submitLeave} className="card-body" style={{ display: 'grid', gap: 14 }}>
                      <div className="grid-2">
                        {isAdmin ? (
                          <div className="form-group">
                            <label className="form-label">Employee</label>
                            <select className="form-control" value={leaveForm.employee_id} onChange={(e) => setLeaveForm((prev) => ({ ...prev, employee_id: e.target.value }))}>
                              <option value="">Select employee</option>
                              {employees.filter((entry) => entry.status === 'active').map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="catalogue-modal-insight">
                            <span className="catalogue-summary-title">Employee</span>
                            <strong>{selfEmployee?.full_name || 'Employee link pending'}</strong>
                            <span className="text-secondary text-sm">{selfEmployee?.employee_code || 'Ask HR admin to map your login.'}</span>
                          </div>
                        )}
                        <div className="form-group">
                          <label className="form-label">Leave Type</label>
                          <select className="form-control" value={leaveForm.leave_type} onChange={(e) => setLeaveForm((prev) => ({ ...prev, leave_type: e.target.value }))}>
                            {LEAVE_TYPES.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Start Date</label>
                          <input type="date" className="form-control" value={leaveForm.start_date} onChange={(e) => setLeaveForm((prev) => ({ ...prev, start_date: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">End Date</label>
                          <input type="date" className="form-control" value={leaveForm.end_date} onChange={(e) => setLeaveForm((prev) => ({ ...prev, end_date: e.target.value }))} />
                        </div>
                      </div>
                      <div className="catalogue-modal-insight">
                        <span className="catalogue-summary-title">Duration</span>
                        <strong>{diffDaysInclusive(leaveForm.start_date, leaveForm.end_date)} day(s)</strong>
                        <span className="text-secondary text-sm">Inclusive date calculation for approval processing.</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Reason</label>
                        <textarea className="form-control" rows={3} value={leaveForm.reason} onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Comments</label>
                        <textarea className="form-control" rows={2} value={leaveForm.comments} onChange={(e) => setLeaveForm((prev) => ({ ...prev, comments: e.target.value }))} />
                      </div>
                      <button className="btn btn-primary" type="submit">Submit Leave Request</button>
                    </form>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>{canApproveTeamRequests ? 'Approvals Queue' : 'My Leave History'}</h3>
                        <div className="page-subtitle">{canApproveTeamRequests ? 'Pending requests waiting for manager or HR action.' : 'Only your own leave requests and approval updates are shown here.'}</div>
                      </div>
                      <ShieldCheck size={18} color="var(--accent)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      <div className="grid-3">
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">Pending</span>
                          <strong>{canApproveTeamRequests ? pendingLeaveApprovals.length : visibleLeaveRequests.filter((row) => row.status === 'pending').length}</strong>
                          <span className="text-secondary text-sm">{canApproveTeamRequests ? 'Needs review.' : 'Waiting for approval.'}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">{canApproveTeamRequests ? 'On Leave Today' : 'Approved Requests'}</span>
                          <strong>{canApproveTeamRequests ? overview.onLeaveToday : visibleLeaveRequests.filter((row) => row.status === 'approved').length}</strong>
                          <span className="text-secondary text-sm">{canApproveTeamRequests ? 'Already approved and active.' : 'Already approved for you.'}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">{isAdmin ? 'Policy Signal' : 'My Balance'}</span>
                          <strong>
                            {isAdmin
                              ? `${Number(selectedLeaveEmployee?.leave_balance ?? workforceLeaveBalance).toFixed(1)} days`
                              : `${Number(selfEmployee?.leave_balance || 0).toFixed(1)} days`}
                          </strong>
                          <span className="text-secondary text-sm">
                            {isAdmin
                              ? (selectedLeaveEmployee
                                ? `Available leave balance for ${selectedLeaveEmployee.full_name || 'selected employee'}.`
                                : 'Total available leave balance across workforce.')
                              : 'Current available balance on your employee master.'}
                          </span>
                        </div>
                      </div>
                      <div className="table-container" style={{ maxHeight: 360 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Request</th>
                              <th>Duration</th>
                              <th>Reason</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleLeaveRequests.length === 0 && (<tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No leave requests yet.</td></tr>)}
                            {visibleLeaveRequests.map((row) => (
                              <tr key={row.id}>
                                <td><div style={{ fontWeight: 600 }}>{row.employee_name}</div><div className="text-secondary text-sm">{row.leave_number} - {row.leave_type}</div></td>
                                <td>{formatDate(row.start_date)} - {formatDate(row.end_date)}<div className="text-secondary text-sm">{Number(row.total_days || 0).toFixed(1)} day(s)</div></td>
                                <td style={{ maxWidth: 260 }}>{row.reason || '-'}</td>
                                <td><span className={badgeClass(row.status)}>{row.status}</span>{row.approver_name && <div className="text-secondary text-sm" style={{ marginTop: 4 }}>By {row.approver_name}</div>}</td>
                                <td>
                                  {canApproveTeamRequests && row.status === 'pending' && canApproveEmployee(row.employee_id) ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button className="btn btn-success btn-sm" onClick={() => updateLeaveStatus(row, 'approved')}>Approve</button>
                                      <button className="btn btn-danger btn-sm" onClick={() => updateLeaveStatus(row, 'rejected')}>Reject</button>
                                    </div>
                                  ) : <span className="text-secondary text-sm">{row.status === 'pending' ? 'Awaiting HR action' : 'Closed'}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'documents' && (
              <div style={tabStyle}>
                <div className="grid-2">
                  {isAdmin && (
                    <div className="card">
                      <div className="card-header">
                        <div>
                          <h3>Link Employee Document</h3>
                          <div className="page-subtitle">Store secure reference links for onboarding, confirmation, compliance, and exit paperwork.</div>
                        </div>
                        <FileText size={18} color="var(--accent)" />
                      </div>
                      <form onSubmit={submitDocument} className="card-body" style={{ display: 'grid', gap: 14 }}>
                        <div className="grid-2">
                          <div className="form-group">
                            <label className="form-label">Employee</label>
                            <select className="form-control" value={documentForm.employee_id} onChange={(e) => setDocumentForm((prev) => ({ ...prev, employee_id: e.target.value }))}>
                              <option value="">Select employee</option>
                              {employees.filter((entry) => entry.status === 'active').map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Document Type</label>
                            <select className="form-control" value={documentForm.document_type} onChange={(e) => setDocumentForm((prev) => ({ ...prev, document_type: e.target.value }))}>
                              {HR_DOCUMENT_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid-2">
                          <div className="form-group">
                            <label className="form-label">Document Title</label>
                            <input className="form-control" value={documentForm.document_title} onChange={(e) => setDocumentForm((prev) => ({ ...prev, document_title: e.target.value }))} placeholder="Joining letter - April 2026" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Issued On</label>
                            <input type="date" className="form-control" value={documentForm.issued_on} onChange={(e) => setDocumentForm((prev) => ({ ...prev, issued_on: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Document Link</label>
                          <input className="form-control" value={documentForm.document_url} onChange={(e) => setDocumentForm((prev) => ({ ...prev, document_url: e.target.value }))} placeholder="https://drive.google.com/... or internal DMS link" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Notes</label>
                          <textarea className="form-control" rows={3} value={documentForm.notes} onChange={(e) => setDocumentForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional note for HR context, validity, or owner." />
                        </div>
                        <div className="catalogue-modal-insights">
                          <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Coverage</span><strong>{documents.length}</strong><span className="text-secondary text-sm">Employee document links tracked in HR.</span></div>
                          <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Mandatory Stack</span><strong>Onboarding + Lifecycle</strong><span className="text-secondary text-sm">Joining, confirmation, salary revision, resignation, and compliance letters.</span></div>
                        </div>
                        <button className="btn btn-primary" type="submit">Save Document Link</button>
                      </form>
                    </div>
                  )}

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>{isAdmin ? 'Employee Document Register' : 'My Documents'}</h3>
                        <div className="page-subtitle">{isAdmin ? 'Central register of employee document links mapped to the workforce master.' : 'Only your own HR documents are visible here.'}</div>
                      </div>
                      <Link2 size={18} color="var(--info)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      <div className={isAdmin ? 'grid-3' : 'grid-2'}>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">{isAdmin ? 'Tracked Documents' : 'My Documents'}</span>
                          <strong>{isAdmin ? documents.length : selfDocuments.length}</strong>
                          <span className="text-secondary text-sm">{isAdmin ? 'Across the full employee base.' : 'Visible against your employee profile.'}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">Latest Type</span>
                          <strong>{(isAdmin ? documents[0]?.document_type : selfDocuments[0]?.document_type) || 'None yet'}</strong>
                          <span className="text-secondary text-sm">Most recent linked document category.</span>
                        </div>
                        {isAdmin && <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">Employees Covered</span>
                          <strong>{new Set(documents.map((entry) => entry.employee_id)).size}</strong>
                          <span className="text-secondary text-sm">Employees with at least one linked document.</span>
                        </div>}
                      </div>
                      <div className="table-container" style={{ maxHeight: 440 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              {isAdmin && <th>Employee</th>}
                              <th>Document</th>
                              <th>Issued On</th>
                              <th>Linked By</th>
                              <th>Access</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(isAdmin ? documents : selfDocuments).length === 0 && (
                              <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No document links available yet.</td></tr>
                            )}
                            {(isAdmin ? documents : selfDocuments).map((row) => (
                              <tr key={row.id}>
                                {isAdmin && <td><div style={{ fontWeight: 600 }}>{row.employee_name}</div><div className="text-secondary text-sm">{row.employee_code}</div></td>}
                                <td>
                                  <div style={{ fontWeight: 600 }}>{row.document_title}</div>
                                  <div className="text-secondary text-sm">{row.document_type}</div>
                                </td>
                                <td>{row.issued_on ? formatDate(row.issued_on) : '-'}</td>
                                <td>{row.uploader_name || 'System'}</td>
                                <td>
                                  <a className="btn btn-secondary btn-sm" href={row.document_url} target="_blank" rel="noreferrer">
                                    <Link2 size={12} /> Open Link
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'payroll' && (
              <div style={tabStyle}>
                {isAdmin ? (
                  <>
                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Create Payroll Run</h3>
                        <div className="page-subtitle">Generate monthly payroll from employee master salary components.</div>
                      </div>
                      <Wallet size={18} color="var(--success)" />
                    </div>
                    <form onSubmit={submitPayroll} className="card-body" style={{ display: 'grid', gap: 14 }}>
                      <div className="grid-3">
                        <div className="form-group">
                          <label className="form-label">Employee</label>
                          <select className="form-control" value={payrollForm.employee_id} onChange={(e) => setPayrollForm((prev) => ({ ...prev, employee_id: e.target.value }))}>
                            <option value="">Select employee</option>
                            {employees.filter((entry) => entry.status === 'active').map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Month</label>
                          <select className="form-control" value={payrollForm.payroll_month} onChange={(e) => setPayrollForm((prev) => ({ ...prev, payroll_month: Number(e.target.value) }))}>
                            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{monthLabel(month, payrollForm.payroll_year)}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Year</label>
                          <input type="number" className="form-control" value={payrollForm.payroll_year} onChange={(e) => setPayrollForm((prev) => ({ ...prev, payroll_year: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="grid-3">
                        <div className="form-group">
                          <label className="form-label">Bonus</label>
                          <input type="number" min="0" className="form-control" value={payrollForm.bonus_amount} onChange={(e) => setPayrollForm((prev) => ({ ...prev, bonus_amount: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Deductions</label>
                          <input type="number" min="0" className="form-control" value={payrollForm.deduction_amount} onChange={(e) => setPayrollForm((prev) => ({ ...prev, deduction_amount: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Status</label>
                          <select className="form-control" value={payrollForm.payment_status} onChange={(e) => setPayrollForm((prev) => ({ ...prev, payment_status: e.target.value }))}>
                            <option value="draft">Draft</option>
                            <option value="processed">Processed</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-control" rows={3} value={payrollForm.notes} onChange={(e) => setPayrollForm((prev) => ({ ...prev, notes: e.target.value }))} />
                      </div>
                      <div className="catalogue-modal-insights">
                        <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Gross</span><strong>{compactCurrency(payrollTotalPreview.gross)}</strong><span className="text-secondary text-sm">Basic + HRA + allowances + bonus.</span></div>
                        <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Deductions</span><strong>{compactCurrency(payrollTotalPreview.deduction)}</strong><span className="text-secondary text-sm">Manual deduction bucket.</span></div>
                        <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Net Pay</span><strong>{compactCurrency(payrollTotalPreview.net)}</strong><span className="text-secondary text-sm">Ready for payslip and accounting accrual.</span></div>
                        <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Accounting Link</span><strong>{payrollTotalPreview.employee ? 'Ready' : 'Select employee'}</strong><span className="text-secondary text-sm">Payroll can be posted to journal entries.</span></div>
                      </div>
                      <button className="btn btn-primary" type="submit">Create Payroll Run</button>
                    </form>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Payroll Control Tower</h3>
                        <div className="page-subtitle">Commercial view of payroll scale and finance readiness.</div>
                      </div>
                      <Landmark size={18} color="var(--accent)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      <div className="grid-2">
                        <div className="catalogue-stock-card tone-healthy">
                          <div className="catalogue-stock-head"><strong>Current Month Payroll</strong><span>{monthLabel(currentMonth(), currentYear())}</span></div>
                          <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>{formatCurrency(overview.currentMonthPayroll, currencySymbol)}</div>
                          <div className="text-secondary text-sm">Generated from live payroll runs in this workspace.</div>
                        </div>
                        <div className="catalogue-stock-card tone-watch">
                          <div className="catalogue-stock-head"><strong>Accounting Sync</strong><span>{overview.payrollPosted} posted</span></div>
                          <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>{payrollRuns.filter((row) => !row.posted_to_accounting).length}</div>
                          <div className="text-secondary text-sm">Payroll runs still waiting for journal posting.</div>
                        </div>
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--bg-secondary)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Posting Logic</div>
                        <div className="text-secondary text-sm">Payroll accrual posts salary expense against payroll payable and deductions payable, so HR and Accounting stay synchronized without manual journal entry.</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Payroll Register</h3>
                      <div className="page-subtitle">Monthly payroll history with PDF export and accounting posting actions.</div>
                    </div>
                    <Wallet size={18} color="var(--success)" />
                  </div>
                  <div className="table-container" style={{ maxHeight: 460 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Payroll</th>
                          <th>Employee</th>
                          <th>Period</th>
                          <th>Gross</th>
                          <th>Net</th>
                          <th>Status</th>
                          <th>Accounting</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollRuns.length === 0 && (<tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No payroll runs yet.</td></tr>)}
                        {payrollRuns.map((row) => {
                          const gross = Number(row.basic_amount || 0) + Number(row.hra_amount || 0) + Number(row.allowance_amount || 0) + Number(row.bonus_amount || 0);
                          return (
                            <tr key={row.id}>
                              <td><div style={{ fontWeight: 600 }}>{row.payroll_number}</div><div className="text-secondary text-sm">{formatDate(row.created_at)}</div></td>
                              <td><div style={{ fontWeight: 600 }}>{row.employee_name}</div><div className="text-secondary text-sm">{row.employee_code} - {row.department || '-'}</div></td>
                              <td>{monthLabel(row.payroll_month, row.payroll_year)}</td>
                              <td>{compactCurrency(gross)}</td>
                              <td>{compactCurrency(row.net_amount)}</td>
                              <td><span className={badgeClass(row.payment_status)}>{row.payment_status}</span></td>
                              <td>{row.posted_to_accounting ? <span className="badge badge-success">Posted</span> : <span className="badge badge-warning">Pending</span>}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => downloadPayslip(row)}><Download size={12} /> Payslip</button>
                                  <button className="btn btn-primary btn-sm" onClick={() => postPayrollToAccounting(row)} disabled={Boolean(row.posted_to_accounting)}>
                                    <Landmark size={12} /> {row.posted_to_accounting ? 'Posted' : 'Post'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </>
                ) : (
                  <div className="payroll-portal">
                    <div className="payroll-portal__hero">
                      <div className="payroll-portal__hero-main">
                        <div className="catalogue-hero-kicker"><Wallet size={14} /> Personal Payroll Desk</div>
                        <h3>{latestSelfPayroll ? `Your ${monthLabel(latestSelfPayroll.payroll_month, latestSelfPayroll.payroll_year)} payslip is ready.` : 'Your payslips will appear here automatically.'}</h3>
                        <p>
                          {selfEmployee
                            ? 'Whenever HR or admin generates payroll for your employee record, the payslip is published here automatically. Review your paid amount, deductions, salary breakup, and download the PDF anytime from your login.'
                            : 'This login needs to be linked to an employee profile before payroll can be shown here automatically.'}
                        </p>
                        <div className="catalogue-chip-row">
                          <div className="catalogue-chip">Auto-sync from HR payroll</div>
                          <div className="catalogue-chip">My earnings and deductions</div>
                          <div className="catalogue-chip">Download-ready PDF payslips</div>
                        </div>
                      </div>

                      <div className="payroll-portal__hero-side">
                        <div className="payroll-portal__metric">
                          <span className="catalogue-summary-title">Payslips Available</span>
                          <strong>{selfPayrollRuns.length}</strong>
                          <span className="text-secondary text-sm">Visible only for your linked employee record.</span>
                        </div>
                        <div className="payroll-portal__metric">
                          <span className="catalogue-summary-title">Latest Status</span>
                          <strong>{latestSelfPayroll ? latestSelfPayroll.payment_status : 'waiting'}</strong>
                          <span className="text-secondary text-sm">{latestSelfPayroll ? `Payroll no. ${latestSelfPayroll.payroll_number}` : 'HR has not generated your first payslip yet.'}</span>
                        </div>
                      </div>
                    </div>

                    {selfEmployee && selfPayrollRuns.length > 0 ? (
                      <>
                        <div className="payroll-portal__stats">
                          <div className="payroll-portal__stat-card tone-primary">
                            <span className="catalogue-summary-title">Latest Net Pay</span>
                            <strong>{compactCurrency(latestSelfPayroll.net_amount)}</strong>
                            <span className="text-secondary text-sm">{monthLabel(latestSelfPayroll.payroll_month, latestSelfPayroll.payroll_year)}</span>
                          </div>
                          <div className="payroll-portal__stat-card tone-success">
                            <span className="catalogue-summary-title">Total Paid</span>
                            <strong>{compactCurrency(selfPayrollOverview.paid || selfPayrollOverview.net)}</strong>
                            <span className="text-secondary text-sm">{selfPayrollStatuses.paid || 0} run(s) marked as paid.</span>
                          </div>
                          <div className="payroll-portal__stat-card tone-warning">
                            <span className="catalogue-summary-title">Total Deductions</span>
                            <strong>{compactCurrency(selfPayrollOverview.deductions)}</strong>
                            <span className="text-secondary text-sm">Manual payroll deductions applied across your runs.</span>
                          </div>
                          <div className="payroll-portal__stat-card tone-neutral">
                            <span className="catalogue-summary-title">Gross Earnings</span>
                            <strong>{compactCurrency(selfPayrollOverview.gross)}</strong>
                            <span className="text-secondary text-sm">Before deductions, based on payroll generated so far.</span>
                          </div>
                        </div>

                        <div className="payroll-portal__grid">
                          <div className="payroll-portal__spotlight">
                            <div className="payroll-portal__spotlight-head">
                              <div>
                                <div className="catalogue-summary-title">Featured Payslip</div>
                                <h3>{monthLabel(latestSelfPayroll.payroll_month, latestSelfPayroll.payroll_year)}</h3>
                                <div className="text-secondary text-sm">{latestSelfPayroll.payroll_number} - generated on {formatDate(latestSelfPayroll.created_at)}</div>
                              </div>
                              <button className="btn btn-primary" onClick={() => downloadPayslip(latestSelfPayroll)}>
                                <Download size={14} /> Download Payslip
                              </button>
                            </div>

                            <div className="payroll-portal__pay-band">
                              <div>
                                <span className="catalogue-summary-title">Net Salary</span>
                                <strong>{compactCurrency(latestSelfPayroll.net_amount)}</strong>
                              </div>
                              <div>
                                <span className="catalogue-summary-title">Payment Status</span>
                                <span className={badgeClass(latestSelfPayroll.payment_status)}>{latestSelfPayroll.payment_status}</span>
                              </div>
                              <div>
                                <span className="catalogue-summary-title">Accounting</span>
                                <span className={latestSelfPayroll.posted_to_accounting ? 'badge badge-success' : 'badge badge-warning'}>
                                  {latestSelfPayroll.posted_to_accounting ? 'Posted' : 'Pending'}
                                </span>
                              </div>
                            </div>

                            <div className="payroll-portal__breakdown">
                              <div className="payroll-portal__breakdown-card">
                                <div className="payroll-portal__breakdown-title">Earnings</div>
                                <div className="payroll-portal__line-item"><span>Basic salary</span><strong>{compactCurrency(latestSelfPayroll.basic_amount)}</strong></div>
                                <div className="payroll-portal__line-item"><span>House rent allowance</span><strong>{compactCurrency(latestSelfPayroll.hra_amount)}</strong></div>
                                <div className="payroll-portal__line-item"><span>Allowances</span><strong>{compactCurrency(latestSelfPayroll.allowance_amount)}</strong></div>
                                <div className="payroll-portal__line-item"><span>Bonus</span><strong>{compactCurrency(latestSelfPayroll.bonus_amount)}</strong></div>
                                <div className="payroll-portal__line-item total"><span>Gross salary</span><strong>{compactCurrency(getPayrollGross(latestSelfPayroll))}</strong></div>
                              </div>

                              <div className="payroll-portal__breakdown-card">
                                <div className="payroll-portal__breakdown-title">Deductions & Settlement</div>
                                <div className="payroll-portal__line-item"><span>Total deductions</span><strong>{compactCurrency(latestSelfPayroll.deduction_amount)}</strong></div>
                                <div className="payroll-portal__line-item"><span>Credited to</span><strong>{latestSelfPayroll.bank_name || 'Bank details pending'}</strong></div>
                                <div className="payroll-portal__line-item"><span>Account no.</span><strong>{latestSelfPayroll.account_number || '-'}</strong></div>
                                <div className="payroll-portal__line-item"><span>IFSC</span><strong>{latestSelfPayroll.ifsc_code || '-'}</strong></div>
                                <div className="payroll-portal__line-item total"><span>Take-home pay</span><strong>{compactCurrency(latestSelfPayroll.net_amount)}</strong></div>
                              </div>
                            </div>
                          </div>

                          <div className="payroll-portal__rail">
                            <div className="payroll-portal__rail-card">
                              <div className="catalogue-summary-title">Recent Payslips</div>
                              <div className="payroll-portal__timeline">
                                {selfPayrollRuns.slice(0, 6).map((row) => (
                                  <button key={row.id} className="payroll-portal__timeline-item" onClick={() => downloadPayslip(row)}>
                                    <div>
                                      <strong>{monthLabel(row.payroll_month, row.payroll_year)}</strong>
                                      <span>{row.payroll_number}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <strong>{compactCurrency(row.net_amount)}</strong>
                                      <span>{row.payment_status}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="payroll-portal__rail-card">
                              <div className="catalogue-summary-title">How It Works</div>
                              <div className="text-secondary text-sm" style={{ lineHeight: 1.7 }}>
                                HR generates payroll in the admin workspace. The moment your payroll run is created, the payslip becomes visible here against your linked employee profile with the same employee login.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="card">
                          <div className="card-header">
                            <div>
                              <h3>My Payroll History</h3>
                              <div className="page-subtitle">Every generated payslip for your login, with gross pay, deductions, and download access.</div>
                            </div>
                            <FileText size={18} color="var(--accent)" />
                          </div>
                          <div className="table-container" style={{ maxHeight: 460 }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Period</th>
                                  <th>Payroll No.</th>
                                  <th>Gross</th>
                                  <th>Deductions</th>
                                  <th>Net</th>
                                  <th>Status</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selfPayrollRuns.map((row) => (
                                  <tr key={row.id}>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{monthLabel(row.payroll_month, row.payroll_year)}</div>
                                      <div className="text-secondary text-sm">{formatDate(row.created_at)}</div>
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{row.payroll_number}</div>
                                      <div className="text-secondary text-sm">{row.posted_to_accounting ? 'Accounting posted' : 'Accounting pending'}</div>
                                    </td>
                                    <td>{compactCurrency(getPayrollGross(row))}</td>
                                    <td>{compactCurrency(row.deduction_amount)}</td>
                                    <td>{compactCurrency(row.net_amount)}</td>
                                    <td><span className={badgeClass(row.payment_status)}>{row.payment_status}</span></td>
                                    <td>
                                      <button className="btn btn-secondary btn-sm" onClick={() => downloadPayslip(row)}>
                                        <Download size={12} /> Download
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="card">
                        <div className="card-body">
                          <div className="empty-state" style={{ padding: '72px 24px' }}>
                            <Wallet size={42} />
                            <h3 style={{ margin: 0 }}>{selfEmployee ? 'No payslips generated yet' : 'Employee mapping required'}</h3>
                            <p style={{ maxWidth: 560 }}>
                              {selfEmployee
                                ? 'Once admin generates your payroll run in HR, it will appear here automatically with your paid amount, deductions, and a downloadable payslip PDF.'
                                : 'Ask your HR admin to link this user login to your employee profile. After that, every generated payslip will show here automatically.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'reports' && canViewAttendanceReports && (
              <div style={tabStyle}>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: 24,
                      borderBottom: '1px solid var(--border)',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(37, 99, 235, 0.10), rgba(245, 158, 11, 0.08))'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ maxWidth: 760 }}>
                        <div className="catalogue-hero-kicker"><Sparkles size={14} /> Attendance Intelligence</div>
                        <h3 style={{ margin: '12px 0 8px' }}>
                          {isAdmin ? 'Monthly Workforce Attendance Report' : 'Developer Attendance Audit Report'}
                        </h3>
                        <div className="page-subtitle">
                          Day-wise employee attendance built from live punch in, punch out, approved leave, Sundays, and month filters.
                          Designed to feel like a management report instead of a raw data table.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={exportAttendanceReportCsv}>
                          <Download size={12} /> Export CSV
                        </button>
                        <button className="btn btn-primary btn-sm" type="button" onClick={exportAttendanceReportPdf}>
                          <Download size={12} /> Export PDF
                        </button>
                      </div>
                    </div>
                    <div className="catalogue-modal-insights" style={{ marginTop: 18 }}>
                      <div className="catalogue-modal-insight">
                        <span className="catalogue-summary-title">Report Month</span>
                        <strong>{reportMonthName}</strong>
                        <span className="text-secondary text-sm">Month-wise algorithm based on employee punch data.</span>
                      </div>
                      <div className="catalogue-modal-insight">
                        <span className="catalogue-summary-title">Employees</span>
                        <strong>{attendanceReportSummary.employees}</strong>
                        <span className="text-secondary text-sm">Filtered workforce rows included in this report.</span>
                      </div>
                      <div className="catalogue-modal-insight">
                        <span className="catalogue-summary-title">Presence Rate</span>
                        <strong>{attendanceReportSummary.attendanceRate.toFixed(1)}%</strong>
                        <span className="text-secondary text-sm">Present credits divided by scheduled workdays.</span>
                      </div>
                      <div className="catalogue-modal-insight">
                        <span className="catalogue-summary-title">Avg Worked Hours</span>
                        <strong>{attendanceReportSummary.avgWorkedHours.toFixed(2)} hrs</strong>
                        <span className="text-secondary text-sm">Average punch-derived hours across present credits.</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-body" style={{ display: 'grid', gap: 18 }}>
                    <div className="grid-4">
                      <div className="form-group">
                        <label className="form-label">Month</label>
                        <select className="form-control" value={reportMonth} onChange={(e) => setReportMonth(Number(e.target.value))}>
                          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{monthLabel(month, reportYear)}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Year</label>
                        <input type="number" className="form-control" value={reportYear} onChange={(e) => setReportYear(Number(e.target.value) || currentYear())} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Department</label>
                        <select className="form-control" value={reportDepartment} onChange={(e) => setReportDepartment(e.target.value)}>
                          <option value="all">All departments</option>
                          {reportDepartmentOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Employee</label>
                        <select className="form-control" value={reportEmployeeId} onChange={(e) => setReportEmployeeId(e.target.value)}>
                          <option value="all">All employees</option>
                          {employees
                            .filter((entry) => entry.status === 'active')
                            .filter((entry) => reportDepartment === 'all' || `${entry.department || ''}` === reportDepartment)
                            .sort((a, b) => `${a.full_name || ''}`.localeCompare(`${b.full_name || ''}`))
                            .map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid-4">
                      <div className="catalogue-stock-card tone-healthy">
                        <div className="catalogue-stock-head"><strong>Present Days</strong><span>{reportMonthName}</span></div>
                        <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>{attendanceReportSummary.presentDays}</div>
                        <div className="text-secondary text-sm">Days credited present after meeting required hours or approved regularization.</div>
                      </div>
                      <div className="catalogue-stock-card tone-watch">
                        <div className="catalogue-stock-head"><strong>Leave Days</strong><span>approved</span></div>
                        <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>{attendanceReportSummary.leaveDays}</div>
                        <div className="text-secondary text-sm">Approved leave dates merged into the monthly matrix.</div>
                      </div>
                      <div className="catalogue-stock-card tone-critical">
                        <div className="catalogue-stock-head"><strong>Absent Days</strong><span>workdays only</span></div>
                        <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>{attendanceReportSummary.absentDays}</div>
                        <div className="text-secondary text-sm">Eligible workdays stay absent unless required hours, approved leave, or approved regularization is available.</div>
                      </div>
                      <div className="catalogue-stock-card tone-calm">
                        <div className="catalogue-stock-head"><strong>Incomplete Punches</strong><span>needs review</span></div>
                        <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>{attendanceReportSummary.incompletePunches}</div>
                        <div className="text-secondary text-sm">Days where punch in exists but punch out is still missing.</div>
                      </div>
                    </div>

                    <div className="grid-2" style={{ alignItems: 'start' }}>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 18, background: 'var(--bg-secondary)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Report Logic</div>
                        <div className="text-secondary text-sm" style={{ lineHeight: 1.8 }}>
                          `P` = required daily hours completed or approved regularization posted, `A` = workday without enough approved attendance cover,
                          `L` = approved leave, `W` = Sunday week off, `HD` = half day, `IP` = incomplete past punch, `IN` = today&apos;s live punch still open.
                          Dates before joining and future dates stay blank so the report does not overstate absences.
                        </div>
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 18, background: 'var(--bg-secondary)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Attention Queue</div>
                        {attendanceReportExceptions.length === 0 && (
                          <div className="text-secondary text-sm">No exception-heavy employees in the selected month.</div>
                        )}
                        <div style={{ display: 'grid', gap: 10 }}>
                          {attendanceReportExceptions.map((row) => (
                            <div key={row.employee.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.45)', border: '1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontWeight: 700 }}>{row.employee.full_name}</div>
                                <div className="text-secondary text-sm">{row.employee.employee_code} · {row.employee.department || 'Unassigned'}</div>
                              </div>
                              <div style={{ textAlign: 'right' }} className="text-secondary text-sm">
                                <div>{row.absentDays} absent</div>
                                <div>{row.incompletePunches} incomplete</div>
                                <div>{row.lateDays} late</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="table-container" style={{ maxHeight: 520 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: 220 }}>Employee</th>
                            {reportDays.map((day) => <th key={day}>{day}</th>)}
                            <th>P</th>
                            <th>L</th>
                            <th>A</th>
                            <th>W</th>
                            <th>HD</th>
                            <th>Late</th>
                            <th>Inc</th>
                            <th>Hours</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceReportRows.length === 0 && (
                            <tr><td colSpan={reportDays.length + 10} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No employees match the selected filters.</td></tr>
                          )}
                          {attendanceReportRows.map((row) => (
                            <tr key={row.employee.id}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{row.employee.full_name}</div>
                                <div className="text-secondary text-sm">{row.employee.employee_code} · {row.employee.department || '-'}</div>
                              </td>
                              {row.cells.map((cell) => {
                                const tone = cell.code === 'P'
                                  ? { background: 'rgba(34,197,94,0.14)', color: '#166534' }
                                  : cell.code === 'A'
                                    ? { background: 'rgba(239,68,68,0.14)', color: '#991b1b' }
                                    : cell.code === 'L'
                                      ? { background: 'rgba(245,158,11,0.16)', color: '#92400e' }
                                      : cell.code === 'W'
                                        ? { background: 'rgba(148,163,184,0.18)', color: '#334155' }
                                        : cell.code === 'HD'
                                          ? { background: 'rgba(99,102,241,0.16)', color: '#4338ca' }
                                          : cell.code === 'IP' || cell.code === 'IN'
                                            ? { background: 'rgba(59,130,246,0.14)', color: '#1d4ed8' }
                                            : { background: 'transparent', color: 'var(--text-secondary)' };
                                return (
                                  <td key={cell.dateKey} title={cell.title}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        minWidth: 30,
                                        justifyContent: 'center',
                                        padding: '4px 6px',
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        ...tone
                                      }}
                                    >
                                      {cell.code || '-'}
                                    </span>
                                  </td>
                                );
                              })}
                              <td>{row.presentDays}</td>
                              <td>{row.leaveDays}</td>
                              <td>{row.absentDays}</td>
                              <td>{row.weekOffDays}</td>
                              <td>{row.halfDays}</td>
                              <td>{row.lateDays}</td>
                              <td>{row.incompletePunches}</td>
                              <td>{row.workedHours.toFixed(2)}</td>
                              <td>{row.attendanceRate.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'people' && (
              <div style={tabStyle}>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Employee Directory</h3>
                      <div className="page-subtitle">Core employee master with organizational, payroll, and system linkage.</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingEmployee(null); setEmployeeModalOpen(true); }}>
                      <Plus size={14} /> Add Employee
                    </button>
                  </div>
                  <div className="table-container" style={{ maxHeight: 540 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Linked User</th>
                          <th>Manager</th>
                          <th>Gross Pay</th>
                          <th>Leave</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.length === 0 && (
                          <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No employee records yet.</td></tr>
                        )}
                        {employees.map((entry) => {
                          const gross = Number(entry.basic_salary || 0) + Number(entry.hra_amount || 0) + Number(entry.allowance_amount || 0);
                          return (
                            <tr key={entry.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 38, height: 38, borderRadius: 14, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                    {initials(entry.full_name)}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{entry.full_name}</div>
                                    <div className="text-secondary text-sm">{entry.employee_code} · {entry.designation || '-'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{entry.department || '-'}</td>
                              <td>{entry.linked_user_name || entry.linked_username || 'Not linked'}</td>
                              <td>{entry.manager_name || '-'}</td>
                              <td>{compactCurrency(gross)}</td>
                              <td>{Number(entry.leave_balance || 0).toFixed(1)} day(s)</td>
                              <td><span className={badgeClass(entry.status)}>{entry.status}</span></td>
                              <td>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingEmployee(entry); setEmployeeModalOpen(true); }}>
                                  <Edit2 size={12} /> Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'attendance' && (
              <div style={tabStyle}>
                <div className="grid-2" style={{ alignItems: 'start' }}>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>{isAdmin ? 'Attendance Calendar' : 'My Attendance Calendar'}</h3>
                        <div className="page-subtitle">{isAdmin ? 'Review daily login hours, attendance status, and shift completion for the selected employee.' : 'See each day&apos;s login hour, attendance status, and leave signal in a monthly calendar.'}</div>
                      </div>
                      <Calendar size={18} color="var(--accent)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 18 }}>
                      {isAdmin && (
                        <div className="form-group">
                          <label className="form-label">Employee</label>
                          <select className="form-control" value={attendanceForm.employee_id} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, employee_id: e.target.value }))}>
                            <option value="">Select employee</option>
                            {employees.filter((entry) => entry.status === 'active').map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}>
                          <ChevronLeft size={14} /> Prev
                        </button>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMonthHeading(calendarMonth)}</div>
                          <div className="text-secondary text-sm">{calendarEmployee?.full_name || 'Select an employee to load attendance'}</div>
                        </div>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}>
                          Next <ChevronRight size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
                        {dayNameShort.map((label) => (
                          <div key={label} className="text-secondary text-sm" style={{ textAlign: 'center', fontWeight: 600 }}>{label}</div>
                        ))}
                        {calendarCells.map((cell, index) => {
                          if (!cell) {
                            return <div key={`empty-${index}`} style={{ minHeight: 86, borderRadius: 16, border: '1px dashed var(--border)', opacity: 0.35 }} />;
                          }

                          const dayAttendance = attendanceByDate.get(cell.key);
                          const dayLeave = leaveByDate.get(cell.key);
                          const isSelected = cell.key === selectedDate;
                          const daySignal = getAttendanceSignal({
                            attendanceRow: dayAttendance,
                            leaveRow: dayLeave,
                            requiredHours: requiredWorkHours,
                            dateKey: cell.key
                          });

                          return (
                            <button
                              key={cell.key}
                              type="button"
                              onClick={() => {
                                setSelectedDate(cell.key);
                                setAttendanceForm((prev) => ({ ...prev, attendance_date: cell.key }));
                              }}
                              style={{
                                minHeight: 86,
                                borderRadius: 18,
                                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                padding: 10,
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'grid',
                                gap: 6
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <strong style={{ fontSize: 15 }}>{cell.day}</strong>
                                <span style={{ width: 10, height: 10, borderRadius: 999, background: adminSelectionPending ? 'var(--border)' : daySignal.dotColor, display: 'inline-block' }} />
                              </div>
                              <div className="text-secondary text-sm" style={{ fontSize: 11 }}>
                                {adminSelectionPending ? 'Select employee' : (dayAttendance?.check_in ? `In ${dayAttendance.check_in}` : dayLeave ? `${dayLeave.leave_type} leave` : 'No login')}
                              </div>
                              <div style={{ fontSize: 11, color: isSelected ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {adminSelectionPending ? 'No data loaded' : daySignal.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{formatDate(selectedDate)}</div>
                            <div className="text-secondary text-sm">{adminSelectionPending ? 'Select an employee to view attendance details.' : `${calendarEmployee?.designation || 'Attendance detail'} ${calendarEmployee?.department ? `· ${calendarEmployee.department}` : ''}`}</div>
                          </div>
                          <span className={badgeClass(selectedAttendanceSignal.status === 'regularize_required' ? 'rejected' : (selectedLeave ? selectedLeave.status : selectedAttendanceSignal.status))}>
                            {adminSelectionPending ? 'select employee' : selectedAttendanceSignal.label}
                          </span>
                        </div>
                        <div className="grid-3">
                          <div className="catalogue-modal-insight">
                            <span className="catalogue-summary-title">Login Hour</span>
                            <strong>{adminSelectionPending ? '--:--' : (selectedAttendance?.check_in || '--:--')}</strong>
                            <span className="text-secondary text-sm">First punch or approved corrected login time.</span>
                          </div>
                          <div className="catalogue-modal-insight">
                            <span className="catalogue-summary-title">Logout Hour</span>
                            <strong>{adminSelectionPending ? '--:--' : (selectedAttendance?.check_out || '--:--')}</strong>
                            <span className="text-secondary text-sm">Open day until punch out or manual close.</span>
                          </div>
                          <div className="catalogue-modal-insight">
                            <span className="catalogue-summary-title">Worked / Leave</span>
                            <strong>{adminSelectionPending ? '--:--' : (selectedLeave ? `${Number(selectedLeave.total_days || 1).toFixed(1)} day(s)` : formatHoursLabel(selectedAttendanceSignal.workedHours))}</strong>
                            <span className="text-secondary text-sm">{adminSelectionPending ? 'Attendance details appear after employee selection.' : (selectedLeave ? `${selectedLeave.leave_type} leave request linked to this date.` : `Required ${requiredWorkHours.toFixed(1)} hrs each working day.`)}</span>
                          </div>
                        </div>
                        {!adminSelectionPending && !selectedApprovedLeave && selectedAttendanceSignal.needsRegularization && (
                          <div style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(239,68,68,0.28)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)' }}>
                            {selectedAttendanceSignal.status === 'leave_pending'
                              ? 'Leave is still pending approval. Until the manager approves leave or regularization, this day stays absent.'
                              : `Worked ${selectedAttendanceSignal.workedHours.toFixed(2)} hrs against required ${requiredWorkHours.toFixed(1)} hrs. This day stays absent until approved regularization or approved leave is available.`}
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <form onSubmit={submitAttendance} style={{ display: 'grid', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <div>
                            <h4>Manual Attendance Update</h4>
                            <div className="text-secondary text-sm">HR admins can still update attendance directly after reviewing the calendar.</div>
                          </div>
                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Date</label>
                              <input type="date" className="form-control" value={attendanceForm.attendance_date} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, attendance_date: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Status</label>
                              <select className="form-control" value={attendanceForm.status} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, status: e.target.value }))}>
                                {ATTENDANCE_STATUSES.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Check In</label>
                              <input type="time" className="form-control" value={attendanceForm.check_in} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, check_in: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Check Out</label>
                              <input type="time" className="form-control" value={attendanceForm.check_out} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, check_out: e.target.value }))} />
                            </div>
                          </div>
                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Work Mode</label>
                              <select className="form-control" value={attendanceForm.work_mode} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, work_mode: e.target.value }))}>
                                {WORK_MODES.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Overtime Hours</label>
                              <input type="number" min="0" step="0.5" className="form-control" value={attendanceForm.overtime_hours} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, overtime_hours: e.target.value }))} />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea className="form-control" rows={2} value={attendanceForm.notes} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, notes: e.target.value }))} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="text-secondary text-sm">Auto-calculated hours: <strong>{attendanceForm.status === 'absent' ? '0.00' : calculateHours(attendanceForm.check_in, attendanceForm.check_out).toFixed(2)} hrs</strong></div>
                            <button className="btn btn-primary" type="submit">Save Attendance</button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3>Attendance & Quick Links</h3>
                        <div className="page-subtitle">{canApproveTeamRequests ? 'Employee self-service on top, with manager approvals built into the same desk.' : 'Quick actions for leave, regularization, and punch operations.'}</div>
                      </div>
                      <CheckCircle2 size={18} color="var(--success)" />
                    </div>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      <div className="grid-3">
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">Month Login Hours</span>
                          <strong>{adminSelectionPending ? '--:--' : formatHoursLabel(attendanceCalendarSummary.hoursWorked)}</strong>
                          <span className="text-secondary text-sm">{adminSelectionPending ? 'Choose an employee to load monthly attendance.' : `${attendanceCalendarSummary.workingDays} completed day(s) at ${requiredWorkHours.toFixed(1)} hrs target.`}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">Selected Day</span>
                          <strong style={{ textTransform: 'capitalize' }}>{adminSelectionPending ? 'select employee' : selectedAttendanceSignal.label}</strong>
                          <span className="text-secondary text-sm">{adminSelectionPending ? 'No attendance data is shown until an employee is selected.' : (selectedAttendance?.check_in ? `Login ${selectedAttendance.check_in} · ${selectedAttendanceSignal.workedHours.toFixed(2)} hrs` : 'No login captured for the selected day yet.')}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">{canApproveTeamRequests ? 'Pending Approvals' : 'Punch State'}</span>
                          <strong>{canApproveTeamRequests ? (pendingLeaveApprovals.length + pendingRegularizationApprovals.length) : (selfAttendanceSignal.needsRegularization ? 'Regularize' : selfAttendanceToday?.check_out ? 'Closed' : selfAttendanceToday?.check_in ? 'Open' : 'Idle')}</strong>
                          <span className="text-secondary text-sm">{canApproveTeamRequests ? 'Leave and regularization requests waiting for action.' : (selfAttendanceSignal.needsRegularization ? 'Today is under the required work-hour threshold.' : 'Shows whether today&apos;s login cycle is still open.')}</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        <button className="btn btn-primary" type="button" onClick={() => setActiveTab('leave')}>
                          <Calendar size={14} /> Apply Leave
                        </button>
                        {!isAdmin && (
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => setRegularizationForm((prev) => ({
                              ...prev,
                              employee_id: selfEmployee?.id || '',
                              attendance_date: selectedDate,
                              requested_check_in: selectedAttendance?.check_in || prev.requested_check_in,
                              requested_check_out: selectedAttendance?.check_out || prev.requested_check_out,
                              requested_status: selectedAttendanceSignal.needsRegularization ? 'present' : (selectedAttendance?.status || prev.requested_status)
                            }))}
                          >
                            <RefreshCw size={14} /> Request Regularize
                          </button>
                        )}
                        {!isAdmin && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                            <button className="btn btn-primary" type="button" onClick={() => punchAttendance('in')} disabled={!selfEmployee || Boolean(selfAttendanceToday?.check_in)}>
                              <LogIn size={14} /> Punch In
                            </button>
                            <button className="btn btn-secondary" type="button" onClick={() => punchAttendance('out')} disabled={!selfEmployee || !selfAttendanceToday?.check_in || Boolean(selfAttendanceToday?.check_out)}>
                              <LogOut size={14} /> Punch Out
                            </button>
                          </div>
                        )}
                      </div>

                      {!isAdmin && (
                        <form onSubmit={submitRegularization} style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <div>
                            <h4>Attendance Regularization</h4>
                            <div className="text-secondary text-sm">Employees can request a correction, and the reporting manager can approve it.</div>
                          </div>
                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Attendance Date</label>
                              <input type="date" className="form-control" value={regularizationForm.attendance_date} onChange={(e) => setRegularizationForm((prev) => ({ ...prev, attendance_date: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Requested Status</label>
                              <select className="form-control" value={regularizationForm.requested_status} onChange={(e) => setRegularizationForm((prev) => ({ ...prev, requested_status: e.target.value }))}>
                                {ATTENDANCE_STATUSES.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid-2">
                            <div className="form-group">
                              <label className="form-label">Requested Check In</label>
                              <input type="time" className="form-control" value={regularizationForm.requested_check_in} onChange={(e) => setRegularizationForm((prev) => ({ ...prev, requested_check_in: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Requested Check Out</label>
                              <input type="time" className="form-control" value={regularizationForm.requested_check_out} onChange={(e) => setRegularizationForm((prev) => ({ ...prev, requested_check_out: e.target.value }))} />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Reason</label>
                            <textarea className="form-control" rows={2} value={regularizationForm.reason} onChange={(e) => setRegularizationForm((prev) => ({ ...prev, reason: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Comments</label>
                            <textarea className="form-control" rows={2} value={regularizationForm.comments} onChange={(e) => setRegularizationForm((prev) => ({ ...prev, comments: e.target.value }))} />
                          </div>
                          <button className="btn btn-primary" type="submit">Submit Regularization</button>
                        </form>
                      )}

                      {!isAdmin && (
                        <div style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <div>
                            <h4>{canApproveTeamRequests ? 'My Regularization Requests' : 'Pending Regularization'}</h4>
                            <div className="text-secondary text-sm">
                              {canApproveTeamRequests
                                ? 'Your own attendance correction requests and their latest approval status.'
                                : 'Track the regularization requests you have raised from this login.'}
                            </div>
                          </div>
                          <div className="grid-3">
                            <div className="catalogue-modal-insight">
                              <span className="catalogue-summary-title">Pending</span>
                              <strong>{visibleRegularizationRequests.filter((row) => row.employee_id === selfEmployee?.id && row.status === 'pending').length}</strong>
                              <span className="text-secondary text-sm">Waiting for manager action.</span>
                            </div>
                            <div className="catalogue-modal-insight">
                              <span className="catalogue-summary-title">Approved</span>
                              <strong>{visibleRegularizationRequests.filter((row) => row.employee_id === selfEmployee?.id && row.status === 'approved').length}</strong>
                              <span className="text-secondary text-sm">Applied to attendance.</span>
                            </div>
                            <div className="catalogue-modal-insight">
                              <span className="catalogue-summary-title">Rejected</span>
                              <strong>{visibleRegularizationRequests.filter((row) => row.employee_id === selfEmployee?.id && row.status === 'rejected').length}</strong>
                              <span className="text-secondary text-sm">Closed without update.</span>
                            </div>
                          </div>
                          <div className="table-container" style={{ maxHeight: 220 }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Request</th>
                                  <th>Requested Hours</th>
                                  <th>Reason</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleRegularizationRequests.filter((row) => row.employee_id === selfEmployee?.id).length === 0 && (
                                  <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                      No regularization requests submitted yet.
                                    </td>
                                  </tr>
                                )}
                                {visibleRegularizationRequests
                                  .filter((row) => row.employee_id === selfEmployee?.id)
                                  .map((row) => (
                                    <tr key={row.id}>
                                      <td>
                                        <div style={{ fontWeight: 600 }}>{row.request_number}</div>
                                        <div className="text-secondary text-sm">{formatDate(row.attendance_date)}</div>
                                      </td>
                                      <td>{row.requested_check_in || '--:--'} - {row.requested_check_out || '--:--'}</td>
                                      <td style={{ maxWidth: 260 }}>{row.reason || '-'}</td>
                                      <td>
                                        <span className={badgeClass(row.status)}>{row.status}</span>
                                        {row.approver_name && <div className="text-secondary text-sm" style={{ marginTop: 4 }}>By {row.approver_name}</div>}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {canApproveTeamRequests && (
                        <div style={{ display: 'grid', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <div>
                            <h4>Manager Approval Desk</h4>
                            <div className="text-secondary text-sm">Direct-report leave and regularization requests can be approved from here.</div>
                          </div>
                          <div className="table-container" style={{ maxHeight: 160 }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Leave Request</th>
                                  <th>Duration</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pendingLeaveApprovals.length === 0 && (<tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No leave approvals pending.</td></tr>)}
                                {pendingLeaveApprovals.slice(0, 4).map((row) => (
                                  <tr key={row.id}>
                                    <td><div style={{ fontWeight: 600 }}>{row.employee_name}</div><div className="text-secondary text-sm">{row.leave_number} · {row.leave_type}</div></td>
                                    <td>{formatDate(row.start_date)} - {formatDate(row.end_date)}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-success btn-sm" onClick={() => updateLeaveStatus(row, 'approved')}>Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => updateLeaveStatus(row, 'rejected')}>Reject</button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="table-container" style={{ maxHeight: 160 }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Regularization</th>
                                  <th>Requested Hours</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pendingRegularizationApprovals.length === 0 && (<tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No regularization approvals pending.</td></tr>)}
                                {pendingRegularizationApprovals.slice(0, 4).map((row) => (
                                  <tr key={row.id}>
                                    <td><div style={{ fontWeight: 600 }}>{row.employee_name}</div><div className="text-secondary text-sm">{formatDate(row.attendance_date)}</div></td>
                                    <td>{row.requested_check_in || '--:--'} - {row.requested_check_out || '--:--'}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-success btn-sm" onClick={() => updateRegularizationStatus(row, 'approved')}>Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => updateRegularizationStatus(row, 'rejected')}>Reject</button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <div className="grid-3">
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">Present</span>
                          <strong>{isAdmin ? overview.presentToday : (selfAttendanceSignal.status === 'present' ? 1 : 0)}</strong>
                          <span className="text-secondary text-sm">{isAdmin ? 'Employee(s) marked in today.' : `Required daily hours: ${requiredWorkHours.toFixed(1)}.`}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">{isAdmin ? 'On Leave' : 'Punch State'}</span>
                          <strong>{isAdmin ? overview.onLeaveToday : (selfAttendanceSignal.needsRegularization ? 'Regularize' : selfAttendanceToday?.check_out ? 'Closed' : selfAttendanceToday?.check_in ? 'Open' : 'Idle')}</strong>
                          <span className="text-secondary text-sm">{isAdmin ? 'Approved leave active today.' : (selfAttendanceSignal.needsRegularization ? 'Worked hours are below the required company threshold.' : 'Shows whether today&apos;s punch cycle is still open.')}</span>
                        </div>
                        <div className="catalogue-modal-insight">
                          <span className="catalogue-summary-title">{isAdmin ? 'Uncovered' : 'Hours Today'}</span>
                          <strong>{isAdmin ? attendanceHighlights.absentCount : selfAttendanceSignal.workedHours.toFixed(2)}</strong>
                          <span className="text-secondary text-sm">{isAdmin ? 'Still not marked or absent.' : `Shortfall ${Math.max(requiredWorkHours - selfAttendanceSignal.workedHours, 0).toFixed(2)} hrs.`}</span>
                        </div>
                      </div>
                      <div className="table-container" style={{ maxHeight: 360 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Date</th>
                              <th>Check In</th>
                              <th>Check Out</th>
                              <th>Status</th>
                              <th>Mode</th>
                              <th>Hours</th>
                              <th>Overtime</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleAttendance.length === 0 && (<tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Attendance history will appear here after punch in, punch out, or manual attendance saves.</td></tr>)}
                            {visibleAttendance.slice(0, 16).map((row) => (
                              <tr key={row.id}>
                                <td><div style={{ fontWeight: 600 }}>{row.employee_name}</div><div className="text-secondary text-sm">{row.department || '-'} · {row.designation || '-'}</div></td>
                                <td>{formatDate(row.attendance_date)}</td>
                                <td>{row.check_in || '--:--'}</td>
                                <td>{row.check_out || '--:--'}</td>
                                <td>
                                  <span className={badgeClass(getAttendanceSignal({
                                    attendanceRow: row,
                                    leaveRow: null,
                                    requiredHours: requiredWorkHours,
                                    dateKey: row.attendance_date
                                  }).status === 'regularize_required' ? 'rejected' : getAttendanceSignal({
                                    attendanceRow: row,
                                    leaveRow: null,
                                    requiredHours: requiredWorkHours,
                                    dateKey: row.attendance_date
                                  }).status)}>
                                    {getAttendanceSignal({
                                      attendanceRow: row,
                                      leaveRow: null,
                                      requiredHours: requiredWorkHours,
                                      dateKey: row.attendance_date
                                    }).label}
                                  </span>
                                </td>
                                <td>{row.work_mode?.replace('_', ' ')}</td>
                                <td>{Number(row.hours_worked || 0).toFixed(2)} hrs</td>
                                <td>{Number(row.overtime_hours || 0).toFixed(2)} hrs</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {employeeModalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          employees={employees}
          users={users}
          currentUser={currentUser}
          onClose={() => { setEmployeeModalOpen(false); setEditingEmployee(null); }}
          onSaved={handleEmployeeSaved}
        />
      )}
    </div>
  );
}

