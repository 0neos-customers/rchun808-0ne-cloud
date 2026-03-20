import { redirect } from 'next/navigation'

export default function BankingRedirect() {
  redirect('/settings/integrations')
}
