export default function CompletionSummary({
  label,
  completed,
  total,
}: {
  label: string
  completed: number
  total: number
}) {
  const percent = total ? Math.round((completed / total) * 100) : 0
  return (
    <section className="completion-summary" aria-label={label}>
      <div className="completion-summary-count">
        <span>{label}</span>
        <strong>
          {completed} <small>/ {total}</small>
        </strong>
      </div>
      <div className="completion-summary-meter">
        <progress aria-label={`${label}进度`} max={total || 1} value={completed} />
        <span>{percent}%</span>
      </div>
    </section>
  )
}
