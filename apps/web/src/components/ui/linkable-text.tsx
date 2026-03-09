import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Renders text with F-XXX and step-XX patterns converted to clickable links.
 *
 * F-XXX links navigate to /projects/:slug/features (query param f=F-XXX) if
 * within a project context, otherwise just render as styled text.
 *
 * step-XX links navigate to /projects/:slug/waves/:waveNumber/steps/:stepIndex
 * when slug and waveNumber are available in the current route context.
 */
export function LinkableText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  // Extract route params from pathname
  const routeParams = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    const result: { slug?: string; waveNumber?: string } = {}
    if (segments[0] === "projects" && segments[1]) {
      result.slug = segments[1]
    }
    if (segments[2] === "waves" && segments[3]) {
      result.waveNumber = segments[3]
    }
    return result
  }, [pathname])

  const parts = React.useMemo(
    () => parseText(text, routeParams),
    [text, routeParams]
  )

  return (
    <span className={cn("inline", className)}>
      {parts.map((part, idx) => {
        if (part.type === "text") {
          return <React.Fragment key={idx}>{part.value}</React.Fragment>
        }
        if (part.type === "feature") {
          if (part.href) {
            return (
              <Link
                key={idx}
                to={part.href}
                className="font-mono text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {part.value}
              </Link>
            )
          }
          return (
            <span
              key={idx}
              className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              {part.value}
            </span>
          )
        }
        if (part.type === "step") {
          if (part.href) {
            return (
              <Link
                key={idx}
                to={part.href}
                className="font-mono text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
              >
                {part.value}
              </Link>
            )
          }
          return (
            <span
              key={idx}
              className="font-mono text-xs font-medium text-violet-600 dark:text-violet-400"
            >
              {part.value}
            </span>
          )
        }
        return null
      })}
    </span>
  )
}

type TextPart =
  | { type: "text"; value: string }
  | { type: "feature"; value: string; href?: string }
  | { type: "step"; value: string; href?: string }

function parseText(
  text: string,
  params: { slug?: string; waveNumber?: string }
): TextPart[] {
  // Pattern: F-XXX (feature refs) or step-XX (step refs)
  const pattern = /(F-\d{3}|step-\d+)/gi
  const parts: TextPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }

    const token = match[0]!
    const isFeature = /^F-\d{3}$/i.test(token)
    const isStep = /^step-\d+$/i.test(token)

    if (isFeature) {
      parts.push({
        type: "feature",
        value: token.toUpperCase(),
        // Feature links: no dedicated page yet, use projects list as fallback
        href: params.slug
          ? `/projects/${params.slug}`
          : undefined,
      })
    } else if (isStep) {
      const stepIndex = token.split("-")[1]!
      parts.push({
        type: "step",
        value: token,
        href:
          params.slug && params.waveNumber
            ? `/projects/${params.slug}/waves/${params.waveNumber}/steps/${stepIndex}`
            : undefined,
      })
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) })
  }

  return parts
}
