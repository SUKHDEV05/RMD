import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClock,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

const TASKS_KEY = 'taskday.tasks'
const ALERTED_KEY = 'taskday.alerted'
const FILTERS = ['All', 'Today', 'Pending', 'Completed', 'Overdue']

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const pad = (n) => String(n).padStart(2, '0')
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dueOf = (t) => new Date(`${t.date}T${t.time}`)
const isOverdue = (t, now) => !t.completed && dueOf(t) < now
const alertKey = (t) => `${t.id}|${t.date}|${t.time}`

const formatDue = (t) =>
  dueOf(t).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const emptyForm = () => ({ title: '', date: todayStr(), time: '', notes: '' })

export default function App() {
  const [tasks, setTasks] = useState(() => load(TASKS_KEY, []))
  const [alerted, setAlerted] = useState(() => load(ALERTED_KEY, []))
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [sortAsc, setSortAsc] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [toasts, setToasts] = useState([])
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  useEffect(() => localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)), [tasks])
  useEffect(() => localStorage.setItem(ALERTED_KEY, JSON.stringify(alerted)), [alerted])

  // Due-time alerts: checked on a timer while the app is open
  const checkDueRef = useRef(null)
  useEffect(() => {
    checkDueRef.current = () => {
      const current = new Date()
      setNow(current)
      const due = tasks.filter(
        (t) => !t.completed && dueOf(t) <= current && !alerted.includes(alertKey(t)),
      )
      if (!due.length) return
      setAlerted((a) => [...a, ...due.map(alertKey)])
      setToasts((ts) => [...ts, ...due.map((t) => ({ id: alertKey(t), title: t.title }))])
      if (permission === 'granted') {
        due.forEach((t) => new Notification('Task due', { body: t.title, icon: '/favicon.svg' }))
      }
    }
  })

  useEffect(() => {
    const tick = () => checkDueRef.current()
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 15000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [])

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => !t.completed).length,
      completed: tasks.filter((t) => t.completed).length,
      overdue: tasks.filter((t) => isOverdue(t, now)).length,
    }),
    [tasks, now],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const today = todayStr()
    return tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .filter((t) => {
        switch (filter) {
          case 'Today':
            return t.date === today
          case 'Pending':
            return !t.completed
          case 'Completed':
            return t.completed
          case 'Overdue':
            return isOverdue(t, now)
          default:
            return true
        }
      })
      .sort((a, b) => (sortAsc ? 1 : -1) * (dueOf(a) - dueOf(b)))
  }, [tasks, query, filter, sortAsc, now])

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.date) e.date = 'Date is required'
    if (!form.time) e.time = 'Time is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const data = { ...form, title: form.title.trim(), notes: form.notes.trim() }
    if (editingId) {
      setTasks((ts) => ts.map((t) => (t.id === editingId ? { ...t, ...data } : t)))
    } else {
      setTasks((ts) => [...ts, { ...data, id: crypto.randomUUID(), completed: false }])
    }
    cancelEdit()
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setForm({ title: t.title, date: t.date, time: t.time, notes: t.notes || '' })
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm())
    setErrors({})
  }

  const toggle = (id) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))

  const remove = (id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id))
    if (editingId === id) cancelEdit()
  }

  const enableNotifications = async () => {
    if (permission === 'unsupported') return
    setPermission(await Notification.requestPermission())
  }

  const field = (name) =>
    `w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
      errors[name] ? 'border-rose-400' : 'border-slate-300'
    }`

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-600 p-2 text-white">
            <ListTodo size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Taskday</h1>
            <p className="text-sm text-slate-500">Daily tasks, made simple</p>
          </div>
        </div>
        {permission !== 'unsupported' && (
          <button
            onClick={enableNotifications}
            disabled={permission !== 'default'}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100 disabled:cursor-default disabled:opacity-70"
          >
            {permission === 'granted' ? <Bell size={16} /> : <BellOff size={16} />}
            {permission === 'granted'
              ? 'Desktop alerts on'
              : permission === 'denied'
                ? 'Desktop alerts blocked'
                : 'Enable desktop alerts'}
          </button>
        )}
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total', stats.total, 'text-slate-800'],
          ['Pending', stats.pending, 'text-amber-600'],
          ['Completed', stats.completed, 'text-emerald-600'],
          ['Overdue', stats.overdue, 'text-rose-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <form
        onSubmit={submit}
        noValidate
        className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 font-semibold">{editingId ? 'Edit task' : 'Add a task'}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <input
              className={field('title')}
              placeholder="What needs to be done?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-600">{errors.title}</p>}
          </div>
          <div>
            <input
              type="date"
              className={field('date')}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            {errors.date && <p className="mt-1 text-xs text-rose-600">{errors.date}</p>}
          </div>
          <div>
            <input
              type="time"
              className={field('time')}
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
            {errors.time && <p className="mt-1 text-xs text-rose-600">{errors.time}</p>}
          </div>
        </div>
        <textarea
          className={`${field('notes')} mt-3`}
          rows={2}
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {editingId ? 'Save changes' : 'Add task'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-300 bg-white hover:bg-slate-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortAsc((s) => !s)}
          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          <Clock size={14} /> {sortAsc ? 'Soonest first' : 'Latest first'}
        </button>
      </section>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {tasks.length ? 'No tasks match your search or filter.' : 'No tasks yet — add one above.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((t) => {
            const overdue = isOverdue(t, now)
            return (
              <li
                key={t.id}
                className={`flex gap-3 rounded-xl border bg-white p-4 shadow-sm ${
                  overdue ? 'border-rose-300' : 'border-slate-200'
                }`}
              >
                <button
                  onClick={() => toggle(t.id)}
                  aria-label={t.completed ? 'Mark as pending' : 'Mark as completed'}
                  className="mt-0.5 text-indigo-600"
                >
                  {t.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium break-words ${t.completed ? 'text-slate-400 line-through' : ''}`}>
                    {t.title}
                  </p>
                  {t.notes && <p className="mt-1 text-sm break-words text-slate-500">{t.notes}</p>}
                  <p
                    className={`mt-2 flex items-center gap-1 text-xs ${
                      overdue ? 'font-medium text-rose-600' : 'text-slate-500'
                    }`}
                  >
                    <AlarmClock size={14} /> {formatDue(t)}
                    {overdue && ' · Overdue'}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => startEdit(t)}
                    aria-label="Edit task"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    aria-label="Delete task"
                    className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="fixed right-4 bottom-4 flex w-72 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-slate-900 p-3 text-sm text-white shadow-lg"
          >
            <Bell size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-medium">Task due</p>
              <p className="break-words text-slate-300">{toast.title}</p>
            </div>
            <button
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== toast.id))}
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
