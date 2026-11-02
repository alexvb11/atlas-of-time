// "Report a mistake": opens a pre-filled issue on the project's public GitHub page with a link to
// exactly this view (year, place, article), so a correction can be checked against sources and
// fixed. Nothing is sent from the page itself; the visitor reviews and submits the report on
// GitHub (an account is needed there).
import { currentLink } from '../app/shareLink'

const REPO = 'https://github.com/alexvb11/atlas-of-time'

export function reportUrl(subject: string, context: string) {
  const title = `Possible mistake: ${subject}`
  const body = [
    'What is wrong, and what should it say?',
    '',
    '',
    'A source for the correction (link, book, page):',
    '',
    '',
    '---',
    `View: ${currentLink()}`,
    context,
  ].join('\n')
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}

export function ReportMistake({ subject, context = '' }: { subject: string; context?: string }) {
  return (
    <a
      href={reportUrl(subject, context)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-6 items-center gap-1.5 text-[11.5px] text-dim underline-offset-2 hover:text-cyan hover:underline"
      title="Opens a pre-filled report on GitHub; you can review it before sending"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14V2.5M3 3h8l-1.5 3L11 9H3" /></svg>
      Report a mistake
    </a>
  )
}
