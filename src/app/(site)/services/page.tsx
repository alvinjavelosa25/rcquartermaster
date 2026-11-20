import { ContentPage, contentMetadata } from '@/components/ContentPage'

export const generateMetadata = () => contentMetadata('services')
export default function ServicesPage() {
  return <ContentPage slug="services" showRfqCta />
}
