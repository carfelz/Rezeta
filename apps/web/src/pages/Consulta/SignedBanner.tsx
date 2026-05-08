import { formatDate } from './helpers'

export interface SignedBannerProps {
  signedAt: string
  doctorName: string
}

export function SignedBanner({ signedAt, doctorName }: SignedBannerProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-p-50 border border-p-100 rounded-md text-[12.5px] text-p-700 mb-5">
      <i className="ph ph-seal-check text-[14px]" />
      Firmada el {formatDate(signedAt)} por {doctorName}
    </div>
  )
}
