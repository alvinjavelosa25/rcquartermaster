import { ContentPage, contentMetadata } from '@/components/ContentPage'

export const generateMetadata = () => contentMetadata('accessibility')
export default function AccessibilityPage() {
  return <ContentPage slug="accessibility" />
}
