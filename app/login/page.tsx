import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Casa Nostra
          </h1>
          <p className="mt-1 text-sm text-muted">Accedi per gestire le spese</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
