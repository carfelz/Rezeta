import { useToast } from '@/hooks/use-toast'
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './Toast'

export function Toaster(): JSX.Element {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, icon, variant, open, ...props }) => (
        <Toast key={id} open={open} variant={variant} icon={icon} {...props}>
          {title && <ToastTitle>{title}</ToastTitle>}
          {description && <ToastDescription>{description}</ToastDescription>}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
