import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { examById, TOPICS } from '../data/exams'
import { buildPaper, QUESTIONS } from '../data/questions'
import { getTest } from '../lib/tests'
import { Card, CardHead, Pill, Button, Modal, useToast } from '../components/ui'
import { formatTime } from '../lib/utils'

const KEYS = ['A', 'B', 'C', 'D', 'E']

export default function TestRunner({ examId, testId, mode = 'mock' }) {
  const { state, addAttempt, toggleBookmark, saveNote } = useStore()
  const L = useL()
  const toast = useToast()
  const exam = examById(examId)
  const test = getTest(examId, testId)

  const paper = useMemo(() => {
    if (!exam || !test) return []
    let topicIds = null
    if (test.topic) topicIds = [test.topic]
    else if (test.subject) {
      topicIds = Object.keys(TOPICS).filter((t) => TOPICS[t].subject === test.subject && testId.includes(t))
    }
    return buildPaper(exam, { count: test.questions, seed: testId.length * 137 + examId.length * 31, topicIds })
  }, [exam, test, testId, examId])

  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState({})
  const [remaining, setRemaining] = useState((test?.duration || 30) * 60)
  const [elapsed, setElapsed] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [revealed, setRevealed] = useState({})
  const qStart = useRef(Date.now())
  const perQ = useRef({})
  const timerRef = useRef(null)

  const isPractice = mode === 'practice'
  const q = paper[idx]

  // ── Timer ─────────────────────────────────────────────
  useEffect(() => {
    if (submitted) return
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1)
      if (!isPractice) {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(timerRef.current)
            setSubmitted(true)
            return 0
          }
          return r - 1
        })
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [isPractice, submitted])

  // ── Keyboard shortcuts ───────────────────────────────
  const choose = useCallback(
    (i) => {
      if (!q) return
      if (isPractice && revealed[q.id]) return
      setAnswers((a) => ({ ...a, [q.id]: i }))
      perQ.current[q.id] = perQ.current[q.id] || { qid: q.id, chosen: i, time: 0 }
      perQ.current[q.id].chosen = i
      if (isPractice) setRevealed((r) => ({ ...r, [q.id]: true }))
    },
    [q, isPractice]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (showConfirm || showNote) return
      const k = e.key.toUpperCase()
      if (KEYS.includes(k) && k.length === 1) {
        const i = KEYS.indexOf(k)
        if (i < (q?.o?.length || 0)) choose(i)
      }
      if (e.key === 'ArrowRight') setIdx((v) => Math.min(paper.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setIdx((v) => Math.max(0, v - 1))
      if (e.key === 'ArrowDown') setIdx((v) => Math.min(paper.length - 1, v + 1))
      if (e.key === 'ArrowUp') setIdx((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, paper.length, q, showConfirm, showNote])

  // track per-question time
  useEffect(() => {
    if (!q) return
    qStart.current = Date.now()
    return () => {
      const spent = Math.round((Date.now() - qStart.current) / 1000)
      if (q) {
        perQ.current[q.id] = perQ.current[q.id] || { qid: q.id, chosen: -1, time: 0 }
        perQ.current[q.id].time += spent
      }
    }
  }, [idx, q])

  const submit = useCallback(() => {
    const perQuestion = paper.map((pq) => {
      const rec = perQ.current[pq.id] || {}
      return { qid: pq.id, chosen: rec.chosen != null ? rec.chosen : -1, time: rec.time || 0 }
    })
    let correct = 0
    perQuestion.forEach((pq) => {
      const item = QUESTIONS.find((x) => x.id === pq.qid)
      if (item && pq.chosen === item.a) correct++
    })
    const answered = perQuestion.filter((p) => p.chosen >= 0).length
    const wrong = answered - correct
    const unattended = paper.length - answered
    const score = Math.round((correct * exam.marksPerQ - wrong * exam.negative) * 10) / 10

    const attempt = {
      id: `a-${Date.now()}`,
      examId,
      testId,
      title: test.title,
      mode: isPractice ? 'practice' : 'mock',
      date: Date.now(),
      score,
      maxScore: paper.length * exam.marksPerQ,
      correct,
      wrong,
      unattempted: unattended,
      accuracy: paper.length ? correct / paper.length : 0,
      timeSpent: isPractice ? elapsed : (test.duration * 60 - remaining),
      perQuestion,
      totalQuestions: paper.length,
    }
    submitAttempt(attempt)
    setShowConfirm(false)
    navigate(`/result/${attempt.id}`)
  }, [paper, exam, submitAttempt, navigate, elapsed, remaining, isPractice, examId, test])

  useEffect(() => {
    if (submitted && !showConfirm) {
      toast(L({ en: 'Time up — paper auto-submitted', hi: 'समय समाप्त — पेपर ऑटो-सबमिट' }), '⏱')
      const t = setTimeout(submit, 900)
      return () => clearTimeout(t)
    }
  }, [submitted])

  if (!exam || !test || !q) {
    return (
      <div className="empty">
        <div className="ico">🧩</div>
        Test not found.
        <div style={{ marginTop: 14 }}>
          <Button onClick={() => navigate('/exams')}>Back to exams</Button>
        </div>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length
  const flaggedCount = Object.keys(flags).filter((f) => flags[f]).length
  const selected = answers[q.id]
  const showSolution = isPractice && revealed[q.id]
  const isBookmarked = state.bookmarks.includes(q.id)

  const timerClass = isPractice ? '' : remaining < 60 ? 'danger' : remaining < 300 ? 'warn' : ''

  return (
    <div>
      {/* ── Runner bar ── */}
      <div className="runner-bar" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="spread" style={{ padding: '11px 26px', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="bold small nowrap">{L({ en: test.title, hi: test.hi })}</div>
            <div className="tiny muted">
              {exam.name} · {isPractice ? L({ en: 'Practice mode', hi: 'प्रैक्टिस मोड' }) : L({ en: 'Mock mode', hi: 'मॉक मोड' })} · Q{idx + 1}/{paper.length}
            </div>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div className="center">
              <div className="tiny muted">{isPractice ? L({ en: 'Elapsed', hi: 'बीता समय' }) : L({ en: 'Time left', hi: 'शेष समय' })}</div>
              <div className={`timer ${timerClass}`}>{isPractice ? formatTime(elapsed) : formatTime(remaining)}</div>
            </div>
            <div className="center hide-sm">
              <div className="tiny muted">{L({ en: 'Answered', hi: 'उत्तरित' })}</div>
              <div className="bold num">
                {answeredCount}/{paper.length}
              </div>
            </div>
            <Button size="sm" variant="success" onClick={() => setShowConfirm(true)}>
              {L({ en: 'Submit', hi: 'सबमिट' })}
            </Button>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="runner">
          {/* ── Question ── */}
          <div className="stack" style={{ gap: 16 }}>
            <Card>
              <div className="spread" style={{ marginBottom: 12 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Pill tone="brand">Q{idx + 1}</Pill>
                  <Pill>{TOPICS[q.topic]?.name}</Pill>
                  <Pill tone={q.diff === 'easy' ? 'success' : q.diff === 'medium' ? 'warn' : 'danger'}>{q.diff}</Pill>
                </div>
                <div className="row" style={{ gap: 7 }}>
                  <button
                    className="icon-btn"
                    title="Save for later"
                    style={isBookmarked ? { color: '#fbbf24', borderColor: 'rgba(245,158,11,0.5)' } : undefined}
                    onClick={() => {
                      toggleBookmark(q.id)
                      toast(isBookmarked ? 'Removed from saved' : 'Saved for later', '🔖')
                    }}
                  >
                    {isBookmarked ? '★' : '☆'}
                  </button>
                  <button className="icon-btn" title="Add note" onClick={() => setShowNote(true)}>
                    ✎
                  </button>
                  <button
                    className="icon-btn"
                    title="Flag for review"
                    style={flags[q.id] ? { color: '#fbbf24', borderColor: 'rgba(245,158,11,0.5)' } : undefined}
                    onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
                  >
                    ⚑
                  </button>
                </div>
              </div>

              <div className="q-text">{L(q.q)}</div>

              <div>
                {q.o.map((o, i) => {
                  let cls = ''
                  if (showSolution) {
                    if (i === q.a) cls = 'correct'
                    else if (selected === i) cls = 'wrong'
                  } else if (selected === i) cls = 'sel'
                  return (
                    <div key={i} className={`option ${cls}`} onClick={() => choose(i)}>
                      <div className="opt-key">{KEYS[i]}</div>
                      <div style={{ flex: 1 }}>{L(o)}</div>
                      {showSolution && i === q.a && <span className="pill success">✓</span>}
                      {showSolution && selected === i && i !== q.a && <span className="pill danger">✕</span>}
                    </div>
                  )
                })}
              </div>

              {showSolution && (
                <div className="explain" style={{ marginTop: 14 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <span className="pill brand">💡 {L({ en: 'Solution', hi: 'समाधान' })}</span>
                    {!isPractice && <span className="pill">{L({ en: 'Practice mode shows instant solutions', hi: 'प्रैक्टिस मोड में तुरंत समाधान' })}</span>}
                  </div>
                  {L(q.exp)}
                </div>
              )}

              <div className="spread" style={{ marginTop: 18 }}>
                <Button
                  disabled={idx === 0}
                  onClick={() => setIdx((v) => Math.max(0, v - 1))}
                >
                  ← {L({ en: 'Previous', hi: 'पिछला' })}
                </Button>
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAnswers((a) => {
                        const n = { ...a }
                        delete n[q.id]
                        return n
                      })
                      setRevealed((r) => ({ ...r, [q.id]: false }))
                    }}
                  >
                    {L({ en: 'Clear', hi: 'हटाएँ' })}
                  </Button>
                  {idx < paper.length - 1 ? (
                    <Button variant="primary" onClick={() => setIdx((v) => v + 1)}>
                      {L({ en: 'Next', hi: 'अगला' })} →
                    </Button>
                  ) : (
                    <Button variant="success" onClick={() => setShowConfirm(true)}>
                      {L({ en: 'Submit test', hi: 'टेस्ट सबमिट करें' })}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <div className="tiny muted center" style={{ paddingBottom: 6 }}>
              {L({
                en: 'Tip: use keys A–D to answer and ← → to navigate.',
                hi: 'टिप: उत्तर देने के लिए A–D कुंजियों और ← → से नेविगेशन करें।',
              })}
            </div>
          </div>

          {/* ── Palette ── */}
          <Card className="palette-card">
            <CardHead
              title={L({ en: 'Question palette', hi: 'प्रश्न पैलेट' })}
              sub={L({ en: 'Jump to any question', hi: 'किसी भी प्रश्न पर जाएँ' })}
              right={
                <div className="row" style={{ gap: 5 }}>
                  <span className="tiny muted num">{answeredCount}/{paper.length}</span>
                </div>
              }
            />
            <div className="palette">
              {paper.map((pq, i) => {
                const sel = answers[pq.id] !== undefined
                const isCur = i === idx
                const fl = flags[pq.id]
                return (
                  <button
                    key={pq.id}
                    className={`pal-btn ${sel ? 'answered' : ''} ${fl ? 'flagged' : ''} ${isCur ? 'current' : ''}`}
                    onClick={() => setIdx(i)}
                    title={`Question ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>

            <div className="sep" />
            <div className="row wrap tiny muted" style={{ gap: 12 }}>
              <span className="row" style={{ gap: 6 }}>
                <i style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(99,102,241,0.45)' }} /> {L({ en: 'Answered', hi: 'उत्तरित' })}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <i style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--surface-3)' }} /> {L({ en: 'Not answered', hi: 'अनुत्तरित' })}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <i style={{ width: 11, height: 11, borderRadius: 3, outline: '2px solid #fbbf24' }} /> {L({ en: 'Flagged', hi: 'चिह्नित' })}
              </span>
            </div>

            <div className="sep" />
            <div className="stack sm">
              <div className="kv">
                <span className="k">{L({ en: 'Marking scheme', hi: 'अंकन योजना' })}</span>
                <span className="bold">+{exam.marksPerQ} / −{exam.negative}</span>
              </div>
              <div className="kv">
                <span className="k">{L({ en: 'Flagged for review', hi: 'समीक्षा हेतु चिह्नित' })}</span>
                <span className="bold">{flaggedCount}</span>
              </div>
              <div className="kv">
                <span className="k">{L({ en: 'Max marks', hi: 'अधिकतम अंक' })}</span>
                <span className="bold">{paper.length * exam.marksPerQ}</span>
              </div>
            </div>

            {flaggedCount > 0 && (
              <>
                <div className="sep" />
                <Button size="sm" className="block" onClick={() => setIdx(paper.findIndex((pq) => flags[pq.id]) >= 0 ? paper.findIndex((pq) => flags[pq.id]) : 0)}>
                  {L({ en: 'Jump to next flagged', hi: 'अगले चिह्नित पर जाएँ' })} ⚑
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ── Submit confirm ── */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title={L({ en: 'Submit your test?', hi: 'टेस्ट सबमिट करें?' })}>
        <div className="stack sm" style={{ marginBottom: 16 }}>
          <div className="kv"><span className="k">{L({ en: 'Questions answered', hi: 'उत्तरित प्रश्न' })}</span><span className="bold">{answeredCount}/{paper.length}</span></div>
          <div className="kv"><span className="k">{L({ en: 'Left unanswered', hi: 'अनुत्तरित' })}</span><span className="bold">{paper.length - answeredCount}</span></div>
          <div className="kv"><span className="k">{L({ en: 'Flagged for review', hi: 'चिह्नित' })}</span><span className="bold">{flaggedCount}</span></div>
          <div className="kv"><span className="k">{L({ en: 'Time used', hi: 'उपयोग किया गया समय' })}</span><span className="bold">{formatTime(isPractice ? elapsed : test.duration * 60 - remaining)}</span></div>
        </div>
        {paper.length - answeredCount > 0 && (
          <div className="explain" style={{ marginBottom: 16 }}>
            {L({
              en: `You still have ${paper.length - answeredCount} question(s) unanswered. Unanswered questions score zero.`,
              hi: `आपके पास अभी भी ${paper.length - answeredCount} प्रश्न अनुत्तरित हैं। अनुत्तरित प्रश्नों के लिए शून्य अंक मिलेंगे।`,
            })}
          </div>
        )}
        <div className="row" style={{ gap: 10 }}>
          <Button className="block" onClick={() => setShowConfirm(false)}>
            {L({ en: 'Keep writing', hi: 'जारी रखें' })}
          </Button>
          <Button variant="success" className="block" onClick={submit}>
            {L({ en: 'Submit now', hi: 'अभी सबमिट करें' })}
          </Button>
        </div>
      </Modal>

      {/* ── Note ── */}
      <Modal open={showNote} onClose={() => setShowNote(false)} title={L({ en: 'My note', hi: 'मेरा नोट' })}>
        <div className="field">
          <textarea
            className="input"
            rows={5}
            placeholder={L({ en: 'Write a quick note for this question…', hi: 'इस प्रश्न के लिए एक त्वरित नोट लिखें…' })}
            defaultValue={state.notes[q.id] || ''}
            id="note-area"
          />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Button
            className="block"
            onClick={() => {
              saveNote(q.id, '')
              setShowNote(false)
              toast('Note removed', '🗑')
            }}
          >
            {L({ en: 'Delete note', hi: 'नोट हटाएँ' })}
          </Button>
          <Button
            variant="primary"
            className="block"
            onClick={() => {
              const el = document.getElementById('note-area')
              saveNote(q.id, el.value)
              setShowNote(false)
              toast('Note saved', '📝')
            }}
          >
            {L({ en: 'Save note', hi: 'नोट सहेजें' })}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
