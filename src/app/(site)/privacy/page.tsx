import { ContentPage, contentMetadata } from '@/components/ContentPage'

export const generateMetadata = () => contentMetadata('privacy')
export default function PrivacyPage() {
  return <ContentPage slug="privacy" />
}
