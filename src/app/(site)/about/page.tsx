import { ContentPage, contentMetadata } from '@/components/ContentPage'

export const generateMetadata = () => contentMetadata('about')
export default function AboutPage() {
  return <ContentPage slug="about" showCredentials showRfqCta />
}
