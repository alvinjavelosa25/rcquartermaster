import { notFound } from 'next/navigation'

/**
 * Catch-all so that unknown URLs render the branded 404 inside the site layout, with a real 404 status.
 * (The Payload admin and API live in a separate route group with their own root layout.)
 */
export default function CatchAll() {
  notFound()
}
