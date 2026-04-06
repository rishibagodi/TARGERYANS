import { useMemo, useState } from 'react'

const formatCurrency = (value) => `₹${value.toLocaleString()}`

function App() {
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [futureEmi, setFutureEmi] = useState('')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [emiRows, setEmiRows] = useState([
    { id: 1, loanName: 'Bike Loan', amount: '' },
    { id: 2, loanName: 'Phone Loan', amount: '' },
  ])

  const totals = useMemo(() => {
    const income = Number(monthlyIncome) || 0
    const totalEmi = emiRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    const ratio = income > 0 ? (totalEmi / income) * 100 : 0

    const future = Number(futureEmi) || 0
    const futureTotal = totalEmi + future
    const futureRatio = income > 0 ? (futureTotal / income) * 100 : 0

    return {
      income,
      totalEmi,
      ratio,
      future,
      futureTotal,
      futureRatio,
    }
  }, [emiRows, monthlyIncome, futureEmi])

  const getRiskMeta = (ratio) => {
    if (ratio <= 30) {
      return {
        label: 'Safe',
        color: '#16a34a',
        badge: 'bg-green-100 text-green-700 border-green-200',
        advice: 'Your EMI load is healthy. Keep an emergency buffer and avoid stretching beyond needs.',
      }
    }

    if (ratio <= 45) {
      return {
        label: 'Moderate',
        color: '#d97706',
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        advice: 'Your EMI obligations are manageable but tight. Reduce new borrowing and boost savings.',
      }
    }

    return {
      label: 'High Risk',
      color: '#dc2626',
      badge: 'bg-red-100 text-red-700 border-red-200',
      advice: 'Your EMI burden is high. Prioritize debt reduction and delay new loans where possible.',
    }
  }

  const currentRisk = getRiskMeta(totals.ratio)
  const futureRisk = getRiskMeta(totals.futureRatio)

  const addEmiRow = () => {
    setEmiRows((rows) => [
      ...rows,
      { id: Date.now(), loanName: `Loan ${rows.length + 1}`, amount: '' },
    ])
  }

  const removeEmiRow = (id) => {
    setEmiRows((rows) => {
      if (rows.length === 1) {
        return rows
      }
      return rows.filter((row) => row.id !== id)
    })
  }

  const updateRow = (id, field, value) => {
    setEmiRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  const onAnalyze = () => {
    setHasAnalyzed(true)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#f5f7ff_0%,#eff6ff_35%,#f8fafc_100%)] px-4 py-10 md:px-8">
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-12 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-sky-100/60 blur-3xl" />

      <div className="relative mx-auto max-w-5xl space-y-8">
        <header className="rise-in text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 md:text-sm">
            EMI Risk Analyzer
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Plan Borrowing With Clarity
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
            A clean monthly snapshot of your current EMI pressure and future loan impact.
          </p>

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            <div className="hero-chip">No page reloads</div>
            <div className="hero-chip">Dynamic EMI rows</div>
            <div className="hero-chip">Risk aware insights</div>
            <div className="hero-chip">Future snapshot</div>
          </div>
        </header>

        <section className="rise-in rounded-3xl border border-white/60 bg-[linear-gradient(115deg,#0f172a_0%,#1e293b_42%,#0c4a6e_100%)] p-6 text-white shadow-[0_20px_40px_rgba(15,23,42,0.25)] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-sky-200">Live Overview</p>
              <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Your EMI Dashboard</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-200">
                Add loans, analyze instantly, and make borrowing decisions backed by a clear risk ratio.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 md:w-auto md:min-w-[380px]">
              <div className="hero-stat">
                <p className="hero-stat-label">Current EMI</p>
                <p className="hero-stat-value">{formatCurrency(totals.totalEmi)}</p>
              </div>
              <div className="hero-stat">
                <p className="hero-stat-label">Income</p>
                <p className="hero-stat-value">{formatCurrency(totals.income)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rise-in-delay glass-card p-5 md:p-8">
          <h2 className="text-xl font-semibold text-slate-900">Input Section</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Monthly Income</span>
              <input
                type="number"
                min="0"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="Enter monthly income"
                className="input-field"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Planning a new loan?</span>
              <input
                type="number"
                min="0"
                value={futureEmi}
                onChange={(e) => setFutureEmi(e.target.value)}
                placeholder="Optional future EMI"
                className="input-field"
              />
            </label>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Current EMIs</h3>
              <button
                type="button"
                onClick={addEmiRow}
                className="pill-btn"
              >
                + Add EMI
              </button>
            </div>

            {emiRows.map((row) => (
              <div
                key={row.id}
                className="rise-in grid gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm md:grid-cols-[2fr_1.5fr_auto]"
              >
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Loan Name
                  </span>
                  <input
                    type="text"
                    value={row.loanName}
                    onChange={(e) => updateRow(row.id, 'loanName', e.target.value)}
                    placeholder="Bike, Phone, Education..."
                    className="input-field"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Monthly EMI
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                    placeholder="Amount"
                    className="input-field"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeEmiRow(row.id)}
                  className="danger-btn self-end"
                >
                  - Remove
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            className="pill-btn mt-6 w-full md:w-auto"
          >
            Analyze
          </button>
        </section>

        {hasAnalyzed && (
          <section className="rise-in glass-card space-y-5 p-5 md:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Results Section</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="metric-card">
                <p className="text-sm text-slate-500">Total EMI</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(totals.totalEmi)}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-slate-500">Monthly Income</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(totals.income)}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-slate-500">EMI Ratio</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{totals.ratio.toFixed(1)}%</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-slate-700">Risk Status</p>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${currentRisk.badge}`}
                >
                  {currentRisk.label}
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100/80">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(totals.ratio, 100)}%`,
                    backgroundColor: currentRisk.color,
                  }}
                />
              </div>

              <p className="mt-4 text-sm text-slate-700">{currentRisk.advice}</p>
            </div>

            {totals.future > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Future Snapshot</h3>
                <p className="mt-1 text-sm text-slate-600">
                  If you add {formatCurrency(totals.future)} EMI, your projected ratio becomes{' '}
                  <span className="font-semibold text-slate-900">{totals.futureRatio.toFixed(1)}%</span>.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${futureRisk.badge}`}
                  >
                    {futureRisk.label}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-700">{futureRisk.advice}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

export default App
