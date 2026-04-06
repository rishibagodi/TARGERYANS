import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = Number(process.env.PORT) || 4000
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY

const anthropic = CLAUDE_API_KEY ? new Anthropic({ apiKey: CLAUDE_API_KEY }) : null

app.use(cors({ origin: FRONTEND_ORIGIN }))
app.use(express.json())

const SAFE_THRESHOLD = 30
const MODERATE_THRESHOLD = 45

function calculateMonthlyRepayment(totalAmount, tenureMonths) {
  const amount = Number(totalAmount) || 0
  const tenure = Number(tenureMonths) || 0

  if (amount <= 0 || tenure <= 0) {
    return 0
  }

  return amount / tenure
}

function buildFallbackAdvice({ monthlyIncome, monthlyExpenses, totalEmi, ratio, riskLabel, emiBreakdown }) {
  const topLoan = Array.isArray(emiBreakdown)
    ? [...emiBreakdown].sort((a, b) => (Number(b.monthlyEmi) || 0) - (Number(a.monthlyEmi) || 0))[0]
    : null

  const monthlyBuffer = Math.max(monthlyIncome - totalEmi - (Number(monthlyExpenses) || 0), 0)
  const totalLoanAmount = Array.isArray(emiBreakdown)
    ? emiBreakdown.reduce((sum, loan) => sum + (Number(loan.totalAmount) || 0), 0)
    : 0
  const payoffMonths = monthlyBuffer > 0 ? Math.ceil(totalLoanAmount / monthlyBuffer) : null
  const topLoanText = topLoan?.loanName
    ? `Your largest monthly repayment is ${topLoan.loanName} at Rs.${Number(topLoan.monthlyEmi || 0).toLocaleString()}, so prepaying that loan first will reduce pressure faster.`
    : 'Prioritize the loan with the largest monthly repayment first so your obligations fall sooner.'

  if (ratio <= SAFE_THRESHOLD) {
    return [
      `Your EMI ratio is ${ratio.toFixed(1)} percent (${riskLabel}), leaving about Rs.${monthlyBuffer.toLocaleString()} each month for savings and goals.`,
      topLoanText,
      payoffMonths
        ? `If you direct the full monthly surplus toward prepayment, the current loan balance can be cleared in about ${payoffMonths} months.`
        : 'Use extra cash to prepay the loans with the highest monthly repayment before taking on anything new.',
      'Keep at least 3 to 6 months of expenses in an emergency fund and avoid taking new debt unless it builds long-term value.',
    ].join('\n')
  }

  if (ratio <= MODERATE_THRESHOLD) {
    return [
      `Your EMI ratio is ${ratio.toFixed(1)} percent (${riskLabel}), so your cash flow is manageable but tight with about Rs.${monthlyBuffer.toLocaleString()} left monthly.`,
      topLoanText,
      payoffMonths
        ? `Redirect any extra savings to prepayment and the full balance can be cleared in roughly ${payoffMonths} months.`
        : 'Redirect any extra savings to prepayment before stretching for another loan.',
      'Delay discretionary purchases for 3 to 6 months and direct that amount to prepayments until your ratio moves closer to 30 percent.',
    ].join('\n')
  }

  return [
    `Your EMI ratio is ${ratio.toFixed(1)} percent (${riskLabel}), which is high and leaves only about Rs.${monthlyBuffer.toLocaleString()} monthly cushion.`,
    topLoanText,
    payoffMonths
      ? `Until the balance drops, stay focused on prepayment because the full amount would need about ${payoffMonths} months to clear at your current surplus.`
      : 'Until the balance drops, avoid adding any new borrowing and concentrate on reducing the biggest monthly repayment.',
    'Pause new loans, cut non-essential spending immediately, and target an EMI ratio below 40 percent as your first stabilization goal.',
  ].join('\n')
}

function getRiskMeta(ratio) {
  if (ratio <= SAFE_THRESHOLD) {
    return {
      label: 'Safe',
      color: '#16a34a',
      badge: 'bg-green-100 text-green-700 border-green-200',
      advice:
        'Your EMI load is healthy. Keep an emergency buffer and avoid stretching beyond needs.',
    }
  }

  if (ratio <= MODERATE_THRESHOLD) {
    return {
      label: 'Moderate',
      color: '#d97706',
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      advice:
        'Your EMI obligations are manageable but tight. Reduce new borrowing and boost savings.',
    }
  }

  return {
    label: 'High Risk',
    color: '#dc2626',
    badge: 'bg-red-100 text-red-700 border-red-200',
    advice: 'Your EMI burden is high. Prioritize debt reduction and delay new loans where possible.',
  }
}

function sanitizeLoans(loans) {
  if (!Array.isArray(loans)) {
    return []
  }

  return loans
    .map((loan) => {
      const loanName = typeof loan.loanName === 'string' ? loan.loanName.trim() : ''
      const totalAmount = Number(loan.totalAmount ?? loan.amount) || 0
      const tenureMonths = Number(loan.tenureMonths) || 0
      const monthlyEmi = calculateMonthlyRepayment(totalAmount, tenureMonths)

      return {
        loanName,
        totalAmount,
        tenureMonths,
        monthlyEmi,
      }
    })
    .filter((loan) => loan.loanName.length > 0 || loan.totalAmount > 0 || loan.tenureMonths > 0)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'emi-backend' })
})

app.post('/api/analyze', (req, res) => {
  const monthlyIncome = Number(req.body.monthlyIncome) || 0
  const futureEmi = Number(req.body.futureEmi) || 0
  const loans = sanitizeLoans(req.body.loans || req.body.emis)

  if (monthlyIncome <= 0) {
    return res.status(400).json({
      message: 'Monthly income must be greater than zero.',
    })
  }

  const totalLoanAmount = loans.reduce((sum, item) => sum + item.totalAmount, 0)
  const totalEmi = loans.reduce((sum, item) => sum + item.monthlyEmi, 0)
  const ratio = (totalEmi / monthlyIncome) * 100
  const currentRisk = getRiskMeta(ratio)

  const hasFuture = futureEmi > 0
  const futureTotal = totalEmi + futureEmi
  const futureRatio = (futureTotal / monthlyIncome) * 100
  const futureRisk = hasFuture ? getRiskMeta(futureRatio) : null

  return res.json({
    summary: {
      totalEmi,
      totalLoanAmount,
      monthlyIncome,
      ratio,
    },
    loanBreakdown: loans,
    currentRisk,
    futureSnapshot: hasFuture
      ? {
          futureEmi,
          futureTotal,
          futureRatio,
          futureRisk,
        }
      : null,
  })
})

app.post('/api/advice', async (req, res) => {
  const { monthlyIncome, monthlyExpenses, totalEmi, ratio, riskLabel, emiBreakdown } = req.body

  if (!anthropic) {
    return res.json({
      advice: buildFallbackAdvice({
        monthlyIncome,
        monthlyExpenses,
        totalEmi,
        ratio,
        riskLabel,
        emiBreakdown,
      }),
      source: 'fallback',
      message: 'Claude API not configured. Showing generated local advice.',
    })
  }

  try {
    const breakdownText = emiBreakdown
      ?.map((emi) =>
        `${emi.loanName}: ₹${Number(emi.totalAmount || 0).toLocaleString()} over ${Number(emi.tenureMonths || 0)} months (₹${Number(emi.monthlyEmi || 0).toLocaleString()}/month)`,
      )
      .join(', ') || 'Not provided'

    const prompt = `You are a financial advisor. Based on this information, provide exactly 3 lines of practical, personalized financial advice (no numbering or bullet points, just concise sentences):

Monthly Income: ₹${monthlyIncome}
Monthly Expenses: ₹${Number(monthlyExpenses) || 0}
Total Monthly EMI: ₹${totalEmi}
EMI Ratio: ${ratio.toFixed(1)}%
Risk Status: ${riskLabel}
EMI Breakdown: ${breakdownText}

Provide clear, actionable advice tailored to their situation.`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const advice = message.content[0].type === 'text' ? message.content[0].text : ''

    return res.json({ advice })
  } catch (error) {
    console.error('Claude API error:', error.message)
    return res.json({
      advice: buildFallbackAdvice({
        monthlyIncome,
        monthlyExpenses,
        totalEmi,
        ratio,
        riskLabel,
        emiBreakdown,
      }),
      source: 'fallback',
      message: 'Claude request failed. Showing generated local advice.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`EMI backend running on port ${PORT}`)
})
