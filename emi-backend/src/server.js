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

function buildFallbackAdvice({ monthlyIncome, monthlyExpenses, totalEmi, ratio, riskLabel, emiBreakdown }) {
  const topLoan = Array.isArray(emiBreakdown)
    ? [...emiBreakdown].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0]
    : null

  const monthlyBuffer = Math.max(monthlyIncome - totalEmi - (Number(monthlyExpenses) || 0), 0)
  const topLoanText = topLoan?.loanName
    ? `Your highest EMI is ${topLoan.loanName} at Rs.${Number(topLoan.amount || 0).toLocaleString()}, so consider prepaying that first to reduce pressure faster.`
    : 'Prioritize clearing your costliest EMI first so your monthly obligations fall sooner.'

  if (ratio <= SAFE_THRESHOLD) {
    return [
      `Your EMI ratio is ${ratio.toFixed(1)} percent (${riskLabel}), leaving about Rs.${monthlyBuffer.toLocaleString()} each month for savings and goals.`,
      topLoanText,
      'Keep at least 3 to 6 months of expenses in an emergency fund and avoid taking new debt unless it builds long-term value.',
    ].join('\n')
  }

  if (ratio <= MODERATE_THRESHOLD) {
    return [
      `Your EMI ratio is ${ratio.toFixed(1)} percent (${riskLabel}), so your cash flow is manageable but tight with about Rs.${monthlyBuffer.toLocaleString()} left monthly.`,
      topLoanText,
      'Delay discretionary purchases for 3 to 6 months and direct that amount to prepayments until your ratio moves closer to 30 percent.',
    ].join('\n')
  }

  return [
    `Your EMI ratio is ${ratio.toFixed(1)} percent (${riskLabel}), which is high and leaves only about Rs.${monthlyBuffer.toLocaleString()} monthly cushion.`,
    topLoanText,
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

function sanitizeEmis(emis) {
  if (!Array.isArray(emis)) {
    return []
  }

  return emis
    .map((emi) => ({
      loanName: typeof emi.loanName === 'string' ? emi.loanName.trim() : '',
      amount: Number(emi.amount) || 0,
    }))
    .filter((emi) => emi.loanName.length > 0 || emi.amount > 0)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'emi-backend' })
})

app.post('/api/analyze', (req, res) => {
  const monthlyIncome = Number(req.body.monthlyIncome) || 0
  const futureEmi = Number(req.body.futureEmi) || 0
  const emis = sanitizeEmis(req.body.emis)

  if (monthlyIncome <= 0) {
    return res.status(400).json({
      message: 'Monthly income must be greater than zero.',
    })
  }

  const totalEmi = emis.reduce((sum, item) => sum + item.amount, 0)
  const ratio = (totalEmi / monthlyIncome) * 100
  const currentRisk = getRiskMeta(ratio)

  const hasFuture = futureEmi > 0
  const futureTotal = totalEmi + futureEmi
  const futureRatio = (futureTotal / monthlyIncome) * 100
  const futureRisk = hasFuture ? getRiskMeta(futureRatio) : null

  return res.json({
    summary: {
      totalEmi,
      monthlyIncome,
      ratio,
    },
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
      ?.map((emi) => `${emi.loanName}: ₹${emi.amount}`)
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
