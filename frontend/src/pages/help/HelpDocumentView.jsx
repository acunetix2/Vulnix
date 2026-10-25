import { HelpLayout } from './HelpLayout'
import { Info, ShieldAlert, CheckCircle2 } from 'lucide-react'

export function HelpDocumentView({ data, children }) {
  if (!data) return null

  return (
    <HelpLayout doc={data}>
      <div className="space-y-10">
        {data.sections?.map((sec) => (
          <section key={sec.id} id={sec.id} className="scroll-mt-20 space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight border-b border-[#1c272c] pb-2.5 flex items-baseline gap-2">
              <span className="text-emerald-400 font-mono text-sm">{sec.number}.</span>
              <span>{sec.title}</span>
            </h2>

            <div className="space-y-3">
              {sec.content?.map((paragraph, pIdx) => {
                if (paragraph.startsWith('•') || paragraph.startsWith('-')) {
                  return (
                    <div key={pIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300 pl-2">
                      <span className="text-emerald-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="leading-relaxed">{paragraph.replace(/^[•-]\s*/, '')}</span>
                    </div>
                  )
                }

                return (
                  <p key={pIdx} className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    {paragraph}
                  </p>
                )
              })}
            </div>

            {/* Callout box if specified */}
            {sec.callout && (
              <div
                className={`
                  p-4 rounded-lg border text-xs sm:text-sm my-4 flex items-start gap-3
                  ${
                    sec.callout.type === 'warning'
                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                      : sec.callout.type === 'important'
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                      : 'bg-[#11181c] border-[#233137] text-zinc-300'
                  }
                `}
              >
                {sec.callout.type === 'warning' ? (
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : sec.callout.type === 'important' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  {sec.callout.title && (
                    <div className="font-semibold text-white tracking-wide">
                      {sec.callout.title}
                    </div>
                  )}
                  <p className="text-xs sm:text-sm leading-relaxed opacity-90">
                    {sec.callout.text}
                  </p>
                </div>
              </div>
            )}
          </section>
        ))}

        {children}
      </div>
    </HelpLayout>
  )
}
