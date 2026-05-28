import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ProfileForm } from './ProfileForm'
import { PasswordForm } from './PasswordForm'
import { LogoutButton } from './LogoutButton'

export default async function ImpostazioniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>

      <Section title="Profilo">
        <ProfileForm
          currentDisplayName={profile?.display_name ?? ''}
          email={user.email ?? ''}
        />
      </Section>

      <Section title="Sicurezza">
        <PasswordForm />
      </Section>

      <Section title="Aspetto">
        <ThemeToggle />
      </Section>

      <Section title="Sessione">
        <LogoutButton />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {title}
          </h2>
        </CardHeader>
        <CardContent className="pb-4">{children}</CardContent>
      </Card>
    </section>
  )
}
