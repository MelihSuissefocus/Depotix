import { redirect } from 'next/navigation';

// Redirect to default German locale
export default function RootPage() {
  redirect('/de');
}