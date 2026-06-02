import { Button, Card, Stack } from '../ui'
import { useI18n } from '../lib/i18n'

type RoundEndViewProps = {
  correct: number
  total: number
  sessionTotal: number
  roundNumber: number
  onContinue: () => void
  onRestart: () => void
  onPrepareNew: () => void
}

export function RoundEndView({
  correct, total, sessionTotal, roundNumber,
  onContinue, onRestart, onPrepareNew,
}: RoundEndViewProps) {
  const { t } = useI18n()
  const wrong = total - correct
  const emoji = correct === total ? '🎉' : correct > total / 2 ? '👍' : '💪'
  return (
    <Card maxWidth={400} padding="xl" center>
      <div style={{ fontSize: 48, marginBottom: 8 }}>{emoji}</div>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>{t('deck.roundDone', { n: roundNumber })}</h2>
      <p style={{ color: 'var(--c-muted-t)', marginBottom: 24 }}>
        <strong style={{ color: 'var(--c-success)', fontSize: 20 }}>{correct}</strong>
        <span style={{ color: 'var(--c-ghost)' }}> / {total}</span> {t('deck.correctLabel')}
        {wrong > 0 && <span style={{ color: 'var(--c-gray-600)' }}> · {wrong} {t('deck.toRepeat')}</span>}
      </p>
      <Stack>
        <Button variant="primary" size="xl" block onClick={onContinue}>
          {t('deck.continueBtn', { n: wrong })}
        </Button>
        <Button variant="ghost" size="lg" block onClick={onPrepareNew}>
          {t('deck.prepareNew')}
        </Button>
        <Button variant="ghost" size="lg" block onClick={onRestart}>
          {t('deck.startOver', { n: sessionTotal })}
        </Button>
      </Stack>
    </Card>
  )
}

type AllDoneViewProps = {
  correct: number
  total: number
  roundNumber: number
  onRestart: () => void
  onClose: () => void
  onPrepareNew: () => void
}

export function AllDoneView({
  correct, total, roundNumber,
  onRestart, onClose, onPrepareNew,
}: AllDoneViewProps) {
  const { t } = useI18n()
  return (
    <Card maxWidth={400} padding="xl" center>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>{t('deck.allDone')}</h2>
      <p style={{ color: 'var(--c-gray-600)', marginBottom: 4 }}>
        {t('deck.allDoneMsg', { n: total })}
      </p>
      <p style={{ color: 'var(--c-faint)', fontSize: 14, marginBottom: 28 }}>
        {roundNumber === 1 ? t('deck.firstTry') : t('deck.finishedIn', { n: roundNumber })}
      </p>
      <Stack>
        <Button variant="primary" size="lg" block onClick={onPrepareNew}>{t('deck.prepareNew')}</Button>
        <Button variant="ghost" size="lg" block onClick={onClose}>{t('deck.exitLib')}</Button>
        <Button variant="link" block onClick={onRestart}>{t('deck.goAgain')}</Button>
      </Stack>
    </Card>
  )
}
