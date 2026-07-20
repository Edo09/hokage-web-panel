import { useState } from 'react';
import { toast } from 'sonner';
import type { ClientWithMeta, Membership, MembershipStatus } from '@/types';
import { renewMembership, updateMembership } from '@/services/clients';
import { cn, expiryInfo, fmtDate, fromDateInput, money, STATUS_LABELS, toDateInput } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TONE_CLASS = {
  normal: 'text-foreground',
  warning: 'text-warning',
  danger: 'text-primary',
  muted: 'text-faint',
} as const;

const STATUSES: MembershipStatus[] = ['active', 'paused', 'expired', 'cancelled'];

const EMPTY_MEMBERSHIP: Membership = {
  id: '',
  client_id: '',
  coach_id: null,
  plan_name: '',
  status: 'paused',
  price: 0,
  currency: 'DOP',
  started_at: new Date().toISOString(),
  expires_at: null,
  notes: '',
  created_at: '',
  updated_at: '',
};

export function MembershipTab({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const m = client.membership ?? EMPTY_MEMBERSHIP;
  const exp = expiryInfo(client.membership);

  const [plan, setPlan] = useState(m.plan_name ?? '');
  const [status, setStatus] = useState<MembershipStatus>(m.status);
  const [price, setPrice] = useState(String(m.price ?? 0));
  const [start, setStart] = useState(toDateInput(m.started_at));
  const [expiresAt, setExpiresAt] = useState(toDateInput(m.expires_at));
  const [notes, setNotes] = useState(m.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateMembership(client.id, {
        plan_name: plan,
        status,
        price: +price || 0,
        started_at: fromDateInput(start) ?? m.started_at,
        expires_at: fromDateInput(expiresAt),
        notes,
      });
      onChanged();
      toast.success('Membresía actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la membresía');
    } finally {
      setSaving(false);
    }
  };

  const renew = async () => {
    try {
      const updated = await renewMembership(client.id);
      setStatus('active');
      setExpiresAt(toDateInput(updated.expires_at));
      onChanged();
      toast.success(`Membresía renovada hasta ${fmtDate(updated.expires_at)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo renovar la membresía');
    }
  };

  const pause = async () => {
    try {
      await updateMembership(client.id, { status: 'paused' });
      setStatus('paused');
      setPauseOpen(false);
      onChanged();
      toast.success('Membresía pausada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo pausar la membresía');
    }
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(340px,1.4fr)]">
      {/* Current status */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Estado actual</CardTitle>
          <StatusBadge status={m.status} />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Plan</span>
              <span className="font-semibold">{m.plan_name}</span>
            </div>
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Precio</span>
              <span className="font-semibold">{money(m.price)}</span>
            </div>
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Inicio</span>
              <span className="font-semibold">{fmtDate(m.started_at)}</span>
            </div>
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Vence</span>
              <span className={cn('font-semibold', TONE_CLASS[exp.tone])}>{exp.label}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button className="flex-1 whitespace-nowrap" onClick={() => void renew()}>
              Renovar 30 días
            </Button>
            <Button
              variant="outline"
              className="flex-1 whitespace-nowrap"
              disabled={m.status !== 'active'}
              onClick={() => setPauseOpen(true)}
            >
              Pausar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>Editar membresía</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mem-plan">Plan</Label>
                <Input id="mem-plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mem-status">Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as MembershipStatus)}>
                  <SelectTrigger id="mem-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mem-price">Precio (DOP)</Label>
                <Input id="mem-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="hidden sm:block" />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mem-start">Inicio</Label>
                <Input id="mem-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mem-exp">Vencimiento</Label>
                <Input id="mem-exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="mem-notes">Notas</Label>
              <Textarea
                id="mem-notes"
                rows={3}
                placeholder="Notas internas sobre esta membresía…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar membresía</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Pausar la membresía de {client.display_name}? El cliente conservará su acceso a la app pero se marcará
              como en pausa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void pause()}>Pausar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
