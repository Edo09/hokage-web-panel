import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCoach } from '@/hooks/useCoach';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const { signIn } = useAuth();
  const { coach } = useCoach();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn();
    navigate('/');
    toast.success(`Bienvenido de nuevo, ${coach.display_name}`);
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
            alt="Hokage Coaching"
            className="h-[76px] w-[76px] rounded-[20px] border border-border object-cover"
          />
          <div className="text-center">
            <div className="font-heading text-xl font-bold tracking-wide">Hokage Coaching</div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">Panel de administración</div>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="coach@hokage.do"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" size="lg" className="mt-1.5">
            Iniciar sesión
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-faint">Acceso exclusivo para el coach</p>
      </div>
    </div>
  );
}
