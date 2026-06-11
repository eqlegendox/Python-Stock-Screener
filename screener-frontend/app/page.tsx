import { getScreen } from '@/lib/data'
import Dashboard from '@/components/Dashboard'

export default function Page() {
  const screen = getScreen()
  return <Dashboard rows={screen.stocks} generatedAt={screen.generatedAt} />
}
