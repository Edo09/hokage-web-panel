import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate('/');
    toast.success('Bienvenido de nuevo');
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, hsl(var(--primary) / 0.09), transparent 60%), hsl(var(--background))',
      }}
    >
      <div className="w-full max-w-[400px] animate-fade-up rounded-[20px] border border-border bg-card p-8 pt-9 shadow-card">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src="/logo.jpg"
            alt="The Hokage Coaching"
            className="h-[76px] w-[76px] rounded-[20px] border border-border object-cover"
          />
          <div className="text-center">
            <div className="font-brand text-[26px] tracking-wide">The Hokage Coaching</div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">Panel de administración</div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            void submit(e);
          }}
          className="flex flex-col gap-3.5"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="coach@hokage.do"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              autoComplete="username"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-[12.5px] text-primary">{error}</p>}
          <Button type="submit" size="lg" className="mt-1.5" disabled={loading}>
            {loading ? 'Iniciando…' : 'Iniciar sesión'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-faint">Acceso exclusivo para el coach</p>
      </div>
    </div>
  );
}
