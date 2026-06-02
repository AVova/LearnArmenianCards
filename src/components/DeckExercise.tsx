// Card-flip exercise UI. Pure display component — all session logic lives in Deck.tsx.
// ExerciseView renders the current card and answer buttons.
// ActionButton is the styled Wrong/Correct button with keyboard-press feedback.

import { useState } from 'react'
import { Word } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { Button } from '../ui'

type ExerciseViewProps = {
  word: Word
  flipped: boolean
  animClass: string
  entering: boolean
  index: number
  total: number
  roundNumber: number
  btnWrong: boolean
  btnCorrect: boolean
  canUndo: boolean
  onFlip: () => void
  onAnswer: (correct: boolean) => void
  onUndo: () => void
  learnedLang?: string
  knownLang?: string
}

export function ExerciseView({
  word, flipped, animClass, entering, index, total, roundNumber,
  btnWrong, btnCorrect, canUndo, onFlip, onAnswer, onUndo,
  learnedLang, knownLang,
}: ExerciseViewProps) {
  const { t } = useI18n()
  const back = word.translations.map(tr => tr.text).join(' · ')
  const [mouseWrong, setMouseWrong]     = useState(false)
  const [mouseCorrect, setMouseCorrect] = useState(false)
  const wrongActive   = mouseWrong   || btnWrong
  const correctActive = mouseCorrect || btnCorrect

  const handleWrong   = () => { setMouseWrong(true);   setTimeout(() => setMouseWrong(false), 200);   onAnswer(false) }
  const handleCorrect = () => { setMouseCorrect(true); setTimeout(() => setMouseCorrect(false), 200); onAnswer(true) }

  const overlayKind = animClass.includes('correct') ? 'correct' : animClass.includes('wrong') ? 'wrong' : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 560, padding: '0 16px' }}>
      <div style={{ marginBottom: 16, color: 'var(--c-muted-t)', fontSize: 14 }}>
        {t('deck.roundLabel', { round: roundNumber, idx: index + 1, total })}
      </div>

      <div
        className={animClass || (entering ? 'card-enter' : '')}
        onClick={onFlip}
        style={{ position: 'relative', width: '100%', height: 240, perspective: 800, cursor: 'pointer', marginBottom: 28 }}
      >
        {overlayKind && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 16, pointerEvents: 'none',
            backgroundColor: overlayKind === 'correct' ? 'rgba(40,167,69,0.12)' : 'rgba(220,53,69,0.12)',
          }}>
            <span style={{
              fontSize: 160, lineHeight: 1,
              color: overlayKind === 'correct' ? 'var(--c-success)' : 'var(--c-danger)', fontWeight: 900,
              textShadow: overlayKind === 'correct' ? '0 0 40px rgba(40,167,69,0.4)' : '0 0 40px rgba(220,53,69,0.4)',
            }}>
              {overlayKind === 'correct' ? '✓' : '✕'}
            </span>
          </div>
        )}

        <div style={{
          width: '100%', height: '100%', position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s cubic-bezier(0.4,0.2,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            {learnedLang && (
              <div style={{ position: 'absolute', top: 12, left: 16, fontSize: 11, fontWeight: 600,
                color: '#4a90e2', backgroundColor: '#eef4ff', padding: '2px 8px', borderRadius: 10 }}>
                {learnedLang}
              </div>
            )}
            <div style={{ fontSize: 36, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>{word.word}</div>
            {word.transcription && <div style={{ fontSize: 18, color: 'var(--c-muted-t)', textAlign: 'center' }}>{word.transcription}</div>}
            <div style={{ marginTop: 20, fontSize: 13, color: '#bbb' }}>{t('deck.flipHint')}</div>
          </div>

          {/* Back */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
            transform: 'rotateY(180deg)',
          }}>
            {knownLang && (
              <div style={{ position: 'absolute', top: 12, left: 16, fontSize: 11, fontWeight: 600,
                color: '#4a90e2', backgroundColor: '#eef4ff', padding: '2px 8px', borderRadius: 10 }}>
                {knownLang}
              </div>
            )}
            <div style={{ fontSize: 28, fontWeight: 600, textAlign: 'center', color: '#1a1a2e' }}>{back}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ActionButton label={t('deck.wrong')}   icon="✕" color="var(--c-danger)" active={wrongActive}   hint={t('deck.wrongHint')} onClick={handleWrong} />
        <div style={{ color: 'var(--c-ghost)', fontSize: 13, textAlign: 'center' }}>{t('deck.flipLabel')}<br/>Space</div>
        <ActionButton label={t('deck.correct')} icon="✓" color="var(--c-success)" active={correctActive} hint={t('deck.correctHint')} onClick={handleCorrect} />
      </div>

      <Button variant="link" size="sm" onClick={onUndo} disabled={!canUndo} style={{ marginTop: 20 }}>
        {t('deck.undoLast')}
      </Button>
    </div>
  )
}

export function ActionButton({ label, icon, color, active, hint, onClick }: {
  label: string; icon: string; color: string; active: boolean; hint: string; onClick: () => void
}) {
  return (
    <button
      className="action-btn"
      onClick={onClick}
      style={{
        backgroundColor: active ? color : '#fff',
        color: active ? '#fff' : color,
        border: `2px solid ${color}`,
        transform: active ? 'scale(1.12)' : 'scale(1)',
        boxShadow: active ? `0 4px 16px ${color}55` : 'var(--shadow-sm)',
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <span style={{ fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.67)' : 'var(--c-faint)', fontWeight: 400 }}>{hint}</span>
    </button>
  )
}
