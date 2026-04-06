import { useEffect, useMemo, useState } from 'react'

const formatCurrency = (value) => `₹${value.toLocaleString()}`
const digitsOnly = (value) => value.replace(/\D/g, '')
const calculateMonthlyRepayment = (totalAmount, tenureMonths) => {
  const amount = Number(totalAmount) || 0
  const tenure = Number(tenureMonths) || 0

  if (amount <= 0 || tenure <= 0) {
    return 0
  }

  return amount / tenure
}
const SAVINGS_LEDGER_KEY = 'emi-savings-ledger-v1'
const SAVINGS_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function App() {
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [monthlyExpenses, setMonthlyExpenses] = useState('')
  const [monthlySavingGoal, setMonthlySavingGoal] = useState('')
  const [futureEmi, setFutureEmi] = useState('')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [advice, setAdvice] = useState(null)
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false)
  const [savingsLedger, setSavingsLedger] = useState(() => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const stored = window.localStorage.getItem(SAVINGS_LEDGER_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [savedMoneyByMonth, setSavedMoneyByMonth] = useState(
    SAVINGS_MONTHS.reduce((acc, month) => ({ ...acc, [month]: '' }), {}),
  )
  const [prepaymentLoanId, setPrepaymentLoanId] = useState(1)
  const [prepaymentExtraPayment, setPrepaymentExtraPayment] = useState('')
  const [emiRows, setEmiRows] = useState([
    { id: 1, loanName: 'Bike Loan', totalAmount: '', tenureMonths: '12' },
    { id: 2, loanName: 'Phone Loan', totalAmount: '', tenureMonths: '12' },
  ])

  const totals = useMemo(() => {
    const income = Number(monthlyIncome) || 0
    const expenses = Number(monthlyExpenses) || 0
    const totalLoanAmount = emiRows.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0)
    const totalEmi = emiRows.reduce(
      (sum, row) => sum + calculateMonthlyRepayment(row.totalAmount, row.tenureMonths),
      0,
    )
    const ratio = income > 0 ? (totalEmi / income) * 100 : 0
    const monthlyBalance = income - totalEmi - expenses

    const future = Number(futureEmi) || 0
    const futureTotal = totalEmi + future
    const futureRatio = income > 0 ? (futureTotal / income) * 100 : 0
    const futureBalance = income - futureTotal - expenses

    return {
      income,
      expenses,
      totalLoanAmount,
      totalEmi,
      ratio,
      monthlyBalance,
      future,
      futureTotal,
      futureRatio,
      futureBalance,
    }
  }, [emiRows, monthlyIncome, monthlyExpenses, futureEmi])

  const savingsSnapshot = useMemo(() => {
    if (!analysisResult) {
      return null
    }

    const income = analysisResult.summary.monthlyIncome
    const totalEmi = analysisResult.summary.totalEmi
    const totalLoanAmount = analysisResult.summary.totalLoanAmount || 0
    const expenses = Number(monthlyExpenses) || 0
    const monthlyBalance = income - totalEmi - expenses
    const currentSurplus = Math.max(monthlyBalance, 0)
    const recommendedMonthlySaving = Math.max(Math.min(income * 0.2, currentSurplus), 0)
    const emergencyFundTarget = Math.max(expenses * 6, income * 0.5)
    const monthsToEmergencyFund =
      recommendedMonthlySaving > 0
        ? Math.ceil(emergencyFundTarget / recommendedMonthlySaving)
        : null
    const recommendedSavingRate = income > 0 ? (recommendedMonthlySaving / income) * 100 : 0
    const surplusRatio = income > 0 ? (currentSurplus / income) * 100 : 0
    const activeSavedAmount = [...savingsLedger].sort((a, b) => b.periodKey.localeCompare(a.periodKey))[0]?.savedAmount || 0
    const savingGoal = Number(monthlySavingGoal) || activeSavedAmount || 0
    const goalFeasible = currentSurplus >= savingGoal
    const postGoalBalance = currentSurplus - savingGoal
    const goalCoverageRatio = savingGoal > 0 ? (currentSurplus / savingGoal) * 100 : 0
    const debtClearanceMonths = currentSurplus > 0 ? Math.ceil(totalLoanAmount / currentSurplus) : null
    const balanceAfterSaving = monthlyBalance - activeSavedAmount

    const futureSurplus = analysisResult.futureSnapshot
      ? Math.max(income - analysisResult.futureSnapshot.futureTotal - expenses, 0)
      : null

    return {
      monthlyBalance,
      currentSurplus,
      recommendedMonthlySaving,
      emergencyFundTarget,
      monthsToEmergencyFund,
      recommendedSavingRate,
      surplusRatio,
      savingGoal,
      goalFeasible,
      postGoalBalance,
      goalCoverageRatio,
      totalLoanAmount,
      debtClearanceMonths,
      activeSavedAmount,
      balanceAfterSaving,
      futureSurplus,
    }
  }, [analysisResult, monthlyExpenses, monthlySavingGoal, savingsLedger])

  const prepaymentPlanner = useMemo(() => {
    if (!analysisResult) {
      return null
    }

    const selectedLoan = emiRows.find((row) => String(row.id) === String(prepaymentLoanId)) || emiRows[0]

    if (!selectedLoan) {
      return null
    }

    const totalAmount = Number(selectedLoan.totalAmount) || 0
    const tenureMonths = Number(selectedLoan.tenureMonths) || 0
    const baseMonthlyRepayment = calculateMonthlyRepayment(totalAmount, tenureMonths)
    const extraPayment = Number(prepaymentExtraPayment) || 0
    const availableSurplus = savingsSnapshot?.currentSurplus || 0
    const usableExtraPayment = Math.max(Math.min(extraPayment, availableSurplus), 0)
    const acceleratedMonthlyPayment = baseMonthlyRepayment + usableExtraPayment
    const payoffMonths =
      totalAmount > 0 && acceleratedMonthlyPayment > 0 ? Math.ceil(totalAmount / acceleratedMonthlyPayment) : null
    const standardPayoffMonths = totalAmount > 0 && baseMonthlyRepayment > 0 ? tenureMonths || null : null
    const monthsSaved =
      standardPayoffMonths && payoffMonths ? Math.max(standardPayoffMonths - payoffMonths, 0) : null

    return {
      selectedLoan,
      totalAmount,
      tenureMonths,
      baseMonthlyRepayment,
      extraPayment,
      usableExtraPayment,
      availableSurplus,
      acceleratedMonthlyPayment,
      payoffMonths,
      standardPayoffMonths,
      monthsSaved,
      extraPaymentTooHigh: extraPayment > availableSurplus,
    }
  }, [analysisResult, emiRows, prepaymentExtraPayment, prepaymentLoanId, savingsSnapshot?.currentSurplus])

  const historicalSavings = useMemo(() => {
    const entries = Object.entries(savedMoneyByMonth)
    const totals = entries.reduce(
      (acc, [month, amount]) => {
        const numericAmount = Number(amount) || 0
        return {
          totalSaved: acc.totalSaved + numericAmount,
          activeMonths: acc.activeMonths + (numericAmount > 0 ? 1 : 0),
          highestMonth:
            numericAmount > acc.highestMonth.amount
              ? { month, amount: numericAmount }
              : acc.highestMonth,
        }
      },
      { totalSaved: 0, activeMonths: 0, highestMonth: { month: '-', amount: 0 } },
    )

    const averageSaved = totals.activeMonths > 0 ? totals.totalSaved / totals.activeMonths : 0

    return {
      ...totals,
      averageSaved,
    }
  }, [savedMoneyByMonth])

  const latestLedgerEntry = useMemo(() => {
    if (savingsLedger.length === 0) {
      return null
    }
    return [...savingsLedger].sort((a, b) => b.periodKey.localeCompare(a.periodKey))[0]
  }, [savingsLedger])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SAVINGS_LEDGER_KEY, JSON.stringify(savingsLedger))
  }, [savingsLedger])

  const updateSavedMoney = (month, value) => {
    setSavedMoneyByMonth((prev) => ({
      ...prev,
      [month]: digitsOnly(value),
    }))
  }

  const addEmiRow = () => {
    setEmiRows((rows) => [
      ...rows,
      { id: Date.now(), loanName: `Loan ${rows.length + 1}`, totalAmount: '', tenureMonths: '12' },
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

  const clearAllData = () => {
    setMonthlyIncome('')
    setMonthlyExpenses('')
    setMonthlySavingGoal('')
    setFutureEmi('')
    setHasAnalyzed(false)
    setAnalysisResult(null)
    setApiError('')
    setAdvice(null)
    setEmiRows([
      { id: 1, loanName: 'Bike Loan', totalAmount: '', tenureMonths: '12' },
      { id: 2, loanName: 'Phone Loan', totalAmount: '', tenureMonths: '12' },
    ])
    setSavedMoneyByMonth(SAVINGS_MONTHS.reduce((acc, month) => ({ ...acc, [month]: '' }), {}))
    setPrepaymentLoanId(1)
    setPrepaymentExtraPayment('')
    setSavingsLedger([])
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SAVINGS_LEDGER_KEY)
    }
  }

  const onAnalyze = async () => {
    setApiError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyIncome: Number(monthlyIncome) || 0,
          futureEmi: Number(futureEmi) || 0,
          loans: emiRows.map((row) => ({
            loanName: row.loanName,
            totalAmount: Number(row.totalAmount) || 0,
            tenureMonths: Number(row.tenureMonths) || 0,
          })),
          emis: emiRows.map((row) => ({
            loanName: row.loanName,
            amount: calculateMonthlyRepayment(row.totalAmount, row.tenureMonths),
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to analyze EMI details right now.')
      }

      setAnalysisResult(data)
      setHasAnalyzed(true)
      setAdvice(null)

      const now = new Date()
      const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthYearLabel = now.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      })
      const computedMonthlyBalance =
        data.summary.monthlyIncome - data.summary.totalEmi - (Number(monthlyExpenses) || 0)
      const computedSavedAmount = Math.max(computedMonthlyBalance, 0)

      setSavingsLedger((prev) => {
        const existingIndex = prev.findIndex((item) => item.periodKey === periodKey)
        const postSavingBalance = computedMonthlyBalance - computedSavedAmount
        const newEntry = {
          periodKey,
          monthYearLabel,
          savedAmount: computedSavedAmount,
          monthlyBalance: postSavingBalance,
          income: data.summary.monthlyIncome,
          expenses: Number(monthlyExpenses) || 0,
          emi: data.summary.totalEmi,
          updatedAt: new Date().toISOString(),
        }

        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = newEntry
          return updated
        }

        return [...prev, newEntry]
      })

      const currentMonth = now.toLocaleDateString('en-IN', { month: 'long' })
      setSavedMoneyByMonth((prev) => ({
        ...prev,
        [currentMonth]: String(computedSavedAmount),
      }))

      // Fetch personalized advice from Claude
      setIsLoadingAdvice(true)
      try {
        const adviceResponse = await fetch('/api/advice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            monthlyIncome: Number(monthlyIncome) || 0,
            monthlyExpenses: Number(monthlyExpenses) || 0,
            totalEmi: data.summary.totalEmi,
            ratio: data.summary.ratio,
            riskLabel: data.currentRisk.label,
            emiBreakdown: emiRows
              .map((row) => ({
                loanName: row.loanName,
                totalAmount: Number(row.totalAmount) || 0,
                tenureMonths: Number(row.tenureMonths) || 0,
                monthlyEmi: calculateMonthlyRepayment(row.totalAmount, row.tenureMonths),
              }))
              .filter((row) => row.totalAmount > 0 && row.tenureMonths > 0),
          }),
        })

        const rawAdvice = await adviceResponse.text()
        let adviceData = {}

        if (rawAdvice) {
          try {
            adviceData = JSON.parse(rawAdvice)
          } catch {
            adviceData = {}
          }
        }

        if (!adviceResponse.ok) {
          setAdvice(
            adviceData.message ||
              adviceData.advice ||
              'Claude advice is unavailable. Set CLAUDE_API_KEY in emi-backend/.env and restart backend.',
          )
        } else {
          setAdvice(adviceData.advice || 'Unable to generate advice at this time.')
        }
      } catch (error) {
        console.error('Advice fetch error:', error)
        setAdvice('Unable to generate personalized advice right now.')
      } finally {
        setIsLoadingAdvice(false)
      }
    } catch (error) {
      setApiError(error.message)
      setHasAnalyzed(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8 md:py-12">
      <div className="pointer-events-none absolute -left-28 top-12 h-80 w-80 rounded-full bg-sky-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-blue-200/35 blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="rise-in text-center">
          <p className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700 shadow-sm">
            LoanLens
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            EMI Planning That Feels Executive
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
            Evaluate your monthly debt load, project future loans, and track realistic savings goals with a dashboard built for clear decision making.
          </p>

          <div className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
            <div className="hero-chip">Fast risk classification</div>
            <div className="hero-chip">Smart savings snapshots</div>
            <div className="hero-chip">Month-year ledger tracking</div>
            <div className="hero-chip">AI financial guidance</div>
          </div>
        </header>

        <section className="rise-in panel-deep">
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
                <p className="hero-stat-label">Monthly Commitment</p>
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
          <p className="section-kicker">Data Capture</p>
          <h2 className="section-title">Input Section</h2>
          <p className="section-note">Capture income, monthly expenses, and each loan's total amount plus tenure to generate a precise affordability view.</p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Monthly Income</span>
              <input
                type="text"
                inputMode="numeric"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(digitsOnly(e.target.value))}
                placeholder="Enter monthly income"
                className="input-field"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Planning a new loan?</span>
              <input
                type="text"
                inputMode="numeric"
                value={futureEmi}
                onChange={(e) => setFutureEmi(digitsOnly(e.target.value))}
                placeholder="Optional future EMI"
                className="input-field"
              />
            </label>
          </div>

          <div className="sub-panel mt-5">
            <h3 className="text-lg font-semibold text-slate-800">Own Expenses</h3>
            <p className="mt-1 text-sm text-slate-600">
              Add your regular monthly living expenses to calculate actual monthly balance.
            </p>

            <label className="mt-3 block space-y-2">
              <span className="text-sm font-medium text-slate-600">Monthly Expenses</span>
              <input
                type="text"
                inputMode="numeric"
                value={monthlyExpenses}
                onChange={(e) => setMonthlyExpenses(digitsOnly(e.target.value))}
                placeholder="Rent, food, travel, utilities..."
                className="input-field"
              />
            </label>

          </div>

          <div className="sub-panel mt-5">
            <h3 className="text-lg font-semibold text-slate-800">Saved Money (Month-wise)</h3>
            <p className="mt-1 text-sm text-slate-600">
              On every Analyze click, the app auto-saves this month's amount with month and year.
            </p>

            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
              <p className="text-xs uppercase tracking-wide text-sky-700">Latest Auto-Saved Record</p>
              {latestLedgerEntry ? (
                <p className="mt-1 text-sm text-slate-700">
                  {latestLedgerEntry.monthYearLabel}: <span className="font-semibold text-slate-900">{formatCurrency(latestLedgerEntry.savedAmount)}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">No monthly record yet. Click Analyze to auto-save current month.</p>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SAVINGS_MONTHS.map((month) => (
                <label key={month} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-sm font-medium text-slate-700">{month}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={savedMoneyByMonth[month]}
                    onChange={(e) => updateSavedMoney(month, e.target.value)}
                    placeholder="Saved amount"
                    className="input-field"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Total Saved So Far</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-800">
                {formatCurrency(historicalSavings.totalSaved)}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Month & Year Ledger</p>
              <div className="mt-2 max-h-48 space-y-2 overflow-auto pr-1">
                {savingsLedger.length === 0 ? (
                  <p className="text-sm text-slate-500">No entries yet.</p>
                ) : (
                  [...savingsLedger]
                    .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
                    .map((entry) => (
                      <div key={entry.periodKey} className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-700">{entry.monthYearLabel}</span>
                          <span className="font-semibold text-emerald-700">{formatCurrency(entry.savedAmount)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Balance: {formatCurrency(entry.monthlyBalance)} | Income: {formatCurrency(entry.income)} | Expenses: {formatCurrency(entry.expenses)} | EMI: {formatCurrency(entry.emi)}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Loan Schedule</h3>
              <button
                type="button"
                onClick={addEmiRow}
                className="pill-btn"
              >
                + Add Loan
              </button>
            </div>

            {emiRows.map((row) => (
              <div
                key={row.id}
                className="rise-in grid gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm md:grid-cols-[2fr_1.35fr_1.2fr_auto]"
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
                    Total Loan Amount
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.totalAmount}
                    onChange={(e) => updateRow(row.id, 'totalAmount', digitsOnly(e.target.value))}
                    placeholder="Total amount borrowed"
                    className="input-field"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    EMI Period (Months)
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.tenureMonths}
                    onChange={(e) => updateRow(row.id, 'tenureMonths', digitsOnly(e.target.value))}
                    placeholder="12"
                    className="input-field"
                  />
                  <p className="text-xs text-slate-500">
                    Estimated monthly EMI: <span className="font-semibold text-slate-700">{formatCurrency(calculateMonthlyRepayment(row.totalAmount, row.tenureMonths))}</span>
                  </p>
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isLoading}
              className="pill-btn flex-1 sm:flex-none"
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
            <button
              type="button"
              onClick={clearAllData}
              className="danger-btn flex-1 sm:flex-none"
            >
              Clear All Data
            </button>
          </div>

          {apiError && <p className="mt-4 text-sm font-medium text-rose-600">{apiError}</p>}
        </section>

        {hasAnalyzed && analysisResult && (
          <section className="rise-in glass-card space-y-5 p-5 md:p-8">
            <p className="section-kicker">Insights</p>
            <h2 className="section-title">Results Section</h2>
            <p className="section-note">Review your ratio, risk profile, future debt impact, and savings plan in one place.</p>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">How much do you want to save this month?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Based on your current expenses and EMI, you have a monthly surplus of <span className="font-semibold text-amber-700">{formatCurrency(savingsSnapshot?.currentSurplus || 0)}</span> available.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-2">
                  <span className="text-sm font-medium text-slate-600">Monthly Saving Goal</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={monthlySavingGoal}
                    onChange={(e) => setMonthlySavingGoal(digitsOnly(e.target.value))}
                    placeholder="Enter amount you want to save"
                    className="input-field"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (monthlySavingGoal && Number(monthlySavingGoal) > 0) {
                      const savingAmount = Number(monthlySavingGoal)
                      const now = new Date()
                      const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                      const currentMonth = now.toLocaleDateString('en-IN', { month: 'long' })
                      const monthYearLabel = now.toLocaleDateString('en-IN', {
                        month: 'long',
                        year: 'numeric',
                      })
                      const currentMonthlyBalance =
                        analysisResult.summary.monthlyIncome -
                        analysisResult.summary.totalEmi -
                        (Number(monthlyExpenses) || 0)
                      const postSavingBalance = currentMonthlyBalance - savingAmount
                      
                      setSavingsLedger((prev) => {
                        const existingIndex = prev.findIndex((item) => item.periodKey === periodKey)
                        const newEntry = {
                          periodKey,
                          monthYearLabel,
                          savedAmount: savingAmount,
                          monthlyBalance: postSavingBalance,
                          income: analysisResult.summary.monthlyIncome,
                          expenses: Number(monthlyExpenses) || 0,
                          emi: analysisResult.summary.totalEmi,
                          updatedAt: new Date().toISOString(),
                        }

                        if (existingIndex >= 0) {
                          const updated = [...prev]
                          updated[existingIndex] = newEntry
                          return updated
                        }

                        return [...prev, newEntry]
                      })

                      setSavedMoneyByMonth((prev) => ({
                        ...prev,
                        [currentMonth]: String(savingAmount),
                      }))
                      
                      setMonthlySavingGoal('')
                    }
                  }}
                  className="pill-btn"
                >
                  Add to Dashboard
                </button>
              </div>

              {monthlySavingGoal && Number(monthlySavingGoal) > 0 && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-white/80 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">After saving {formatCurrency(Number(monthlySavingGoal))}:</span>
                    <span className={`font-semibold ${Number(monthlySavingGoal) <= (savingsSnapshot?.currentSurplus || 0) ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency((savingsSnapshot?.currentSurplus || 0) - Number(monthlySavingGoal))} left
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="metric-card">
                <p className="text-sm text-slate-500">Total EMI</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(analysisResult.summary.totalEmi)}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-slate-500">Monthly Income</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(analysisResult.summary.monthlyIncome)}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-slate-500">EMI Ratio</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{analysisResult.summary.ratio.toFixed(1)}%</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-slate-500">Monthly Balance After Saving</p>
                {savingsSnapshot?.activeSavedAmount > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Saved amount: {formatCurrency(savingsSnapshot.activeSavedAmount)}
                  </p>
                )}
                <p
                  className={`mt-1 text-2xl font-semibold ${
                    (savingsSnapshot?.balanceAfterSaving ?? totals.monthlyBalance) >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(savingsSnapshot?.balanceAfterSaving ?? totals.monthlyBalance)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-slate-700">Risk Status</p>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${analysisResult.currentRisk.badge}`}
                >
                  {analysisResult.currentRisk.label}
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100/80">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(analysisResult.summary.ratio, 100)}%`,
                    backgroundColor: analysisResult.currentRisk.color,
                  }}
                />
              </div>

              <p className="mt-4 text-sm text-slate-700">{analysisResult.currentRisk.advice}</p>
            </div>

            {analysisResult.futureSnapshot && (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Future Snapshot</h3>
                <p className="mt-1 text-sm text-slate-600">
                  If you add {formatCurrency(analysisResult.futureSnapshot.futureEmi)} EMI, your projected ratio becomes{' '}
                  <span className="font-semibold text-slate-900">{analysisResult.futureSnapshot.futureRatio.toFixed(1)}%</span>.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${analysisResult.futureSnapshot.futureRisk.badge}`}
                  >
                    {analysisResult.futureSnapshot.futureRisk.label}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-700">{analysisResult.futureSnapshot.futureRisk.advice}</p>
              </div>
            )}

            {savingsSnapshot && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Savings Dashboard</h3>
                <p className="mt-1 text-sm text-slate-600">
                  A practical monthly savings plan based on your current EMI load.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-emerald-100 bg-white/90 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly Balance After Saving</p>
                    <p
                      className={`mt-1 text-xl font-semibold ${
                        savingsSnapshot.balanceAfterSaving >= 0 ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(savingsSnapshot.balanceAfterSaving)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-white/90 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly Surplus</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">
                      {formatCurrency(savingsSnapshot.currentSurplus)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-white/90 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Suggested Monthly Savings</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">
                      {formatCurrency(savingsSnapshot.recommendedMonthlySaving)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-white/90 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Emergency Fund Target</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">
                      {formatCurrency(savingsSnapshot.emergencyFundTarget)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-100 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">Monthly Saving Goal Check</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        savingsSnapshot.goalFeasible
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {savingsSnapshot.goalFeasible ? 'Goal is achievable' : 'Goal exceeds leftover amount'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Your Goal</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCurrency(savingsSnapshot.savingGoal)}
                      </p>
                      {savingsSnapshot.activeSavedAmount > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          Using saved amount: {formatCurrency(savingsSnapshot.activeSavedAmount)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Left After Saving</p>
                      <p
                        className={`mt-1 text-lg font-semibold ${
                          savingsSnapshot.postGoalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrency(savingsSnapshot.postGoalBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {savingsSnapshot.savingGoal > 0
                          ? `${Math.min(savingsSnapshot.goalCoverageRatio, 999).toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-700">Savings Capacity Ratio</p>
                      <span className="text-sm font-semibold text-emerald-700">
                        {savingsSnapshot.surplusRatio.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(savingsSnapshot.surplusRatio, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-700">Target Savings Rate</p>
                      <span className="text-sm font-semibold text-emerald-700">
                        {savingsSnapshot.recommendedSavingRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${Math.min(savingsSnapshot.recommendedSavingRate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-sky-100 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Prepayment Planner</p>
                      <p className="mt-1 text-sm text-slate-600">
                        See how extra monthly payment can shorten the selected loan.
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                      Uses monthly surplus first
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
                    <label className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Select Loan</span>
                      <select
                        value={prepaymentLoanId}
                        onChange={(e) => setPrepaymentLoanId(e.target.value)}
                        className="input-field"
                      >
                        {emiRows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.loanName || `Loan ${row.id}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Extra Monthly Payment</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={prepaymentExtraPayment}
                        onChange={(e) => setPrepaymentExtraPayment(digitsOnly(e.target.value))}
                        placeholder="Optional extra payment"
                        className="input-field"
                      />
                    </label>

                    <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Available Surplus</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCurrency(savingsSnapshot.currentSurplus)}
                      </p>
                    </div>
                  </div>

                  {prepaymentPlanner && (
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Loan EMI</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrency(prepaymentPlanner.baseMonthlyRepayment)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">With Extra Payment</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrency(prepaymentPlanner.acceleratedMonthlyPayment)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">New Payoff Time</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {prepaymentPlanner.payoffMonths ?? 'N/A'} months
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Months Saved</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {prepaymentPlanner.monthsSaved ?? 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}

                  {prepaymentPlanner && (
                    <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-700">
                      <p>
                        The selected loan is{' '}
                        <span className="font-semibold text-slate-900">{prepaymentPlanner.selectedLoan.loanName}</span>.
                      </p>
                      <p className="mt-1">
                        If you add{' '}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(prepaymentPlanner.usableExtraPayment)}
                        </span>{' '}
                        extra every month, it can be cleared in about{' '}
                        <span className="font-semibold text-slate-900">{prepaymentPlanner.payoffMonths ?? 'N/A'} months</span>.
                      </p>
                      {prepaymentPlanner.extraPaymentTooHigh && (
                        <p className="mt-1 text-rose-700">
                          Your extra payment is higher than the current surplus, so the planner is using the available surplus amount instead.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-emerald-100 bg-white/90 p-4 text-sm text-slate-700">
                  <p>
                    You can reach your emergency fund target in approximately{' '}
                    <span className="font-semibold text-slate-900">
                      {savingsSnapshot.monthsToEmergencyFund ?? 'N/A'} months
                    </span>{' '}
                    if you save the suggested amount consistently.
                  </p>
                  {savingsSnapshot.futureSurplus !== null && (
                    <p className="mt-2">
                      With the planned future EMI, your monthly surplus could become{' '}
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(savingsSnapshot.futureSurplus)}
                      </span>
                      .
                    </p>
                  )}
                  <p className="mt-2">
                    You have already saved{' '}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(historicalSavings.totalSaved)}
                    </span>{' '}
                    this year, with an average of{' '}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(historicalSavings.averageSaved)}
                    </span>{' '}
                    in active savings months.
                  </p>
                  <p className="mt-2">
                    Your highest savings month is{' '}
                    <span className="font-semibold text-slate-900">
                      {historicalSavings.highestMonth.month}
                    </span>{' '}
                    at{' '}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(historicalSavings.highestMonth.amount)}
                    </span>
                    .
                  </p>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Debt Clearance Plan</p>
                    <p className="mt-1">
                      With a total loan amount of{' '}
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(savingsSnapshot.totalLoanAmount)}
                      </span>{' '}
                      and your current monthly surplus, you can clear the full amount in about{' '}
                      <span className="font-semibold text-slate-900">
                        {savingsSnapshot.debtClearanceMonths ?? 'N/A'} months
                      </span>{' '}
                      if you direct the surplus to prepayment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isLoadingAdvice ? (
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="animate-pulse text-sm text-slate-600">Generating personalized advice from Claude...</p>
              </div>
            ) : advice ? (
              <div className="rounded-2xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 p-5 shadow-md">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✨</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Your Personalized Financial Advice</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{advice}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  )
}

export default App

