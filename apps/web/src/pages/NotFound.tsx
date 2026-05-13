import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { strings } from '@/lib/strings'
import { Button, Card } from '@/components/ui'

export function NotFound(): JSX.Element {
  const error = useRouteError()
  // Catch-all `*` route renders us as element with no error → treat as 404.
  // Thrown 4xx Response also treated as 404. Only thrown 5xx / unknown errors
  // surface the generic "something went wrong" copy.
  const isServerError = isRouteErrorResponse(error) && error.status >= 500
  const isUnknownError = error != null && !isRouteErrorResponse(error)
  const showGenericError = isServerError || isUnknownError
  const title = showGenericError ? strings.ERROR_BOUNDARY_TITLE : strings.NOT_FOUND_TITLE
  const description = showGenericError
    ? strings.ERROR_BOUNDARY_DESCRIPTION
    : strings.NOT_FOUND_DESCRIPTION

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-[480px] text-center">
        <div className="w-[44px] h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-[24px] font-medium text-n-0 mx-auto mb-6">
          R
        </div>
        <h1 className="text-h2 mb-3">{title}</h1>
        <p className="text-[13px] font-sans text-n-500 max-w-[42ch] leading-relaxed mx-auto mb-6">
          {description}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild variant="primary">
            <Link to="/dashboard">{strings.NOT_FOUND_GO_HOME}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/pacientes">{strings.NOT_FOUND_GO_PATIENTS}</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
