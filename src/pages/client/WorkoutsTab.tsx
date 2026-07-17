import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import type { ClientWithMeta } from '@/types';
import { assignRoutine } from '@/services/clients';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OwnerBadge } from '@/components/shared/StatusBadge';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface BuilderRow {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
}

const emptyRow = (): BuilderRow => ({ name: '', sets: '4', reps: '10', weight: '', rest: '90' });

const ROW_GRID = 'grid gap-2 [grid-template-columns:2fr_64px_64px_84px_84px_36px]';

/** RoutineBuilder — repeatable exercise rows, assigns a COACH routine. */
function RoutineBuilder({
  client,
  onClose,
  onAssigned,
}: {
  client: ClientWithMeta;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [day, setDay] = useState('Lunes');
  const [rows, setRows] = useState<BuilderRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  const upd = (i: number, field: keyof BuilderRow, value: string) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [field]: value } : r)));

  const submit = async () => {
    const n = name.trim();
    const exs = rows.filter((r) => r.name.trim());
    if (!n || !exs.length) {
      toast.error('Ponle nombre y al menos un ejercicio');
      return;
    }
    setSaving(true);
    await assignRoutine(client.id, {
      name: n,
      description: desc.trim() || 'Rutina asignada por el coach.',
      day_of_week: day,
      exercises: exs.map((r, j) => ({
        name: r.name.trim(),
        sets: +r.sets || 3,
        reps: +r.reps || 10,
        weight_kg: +r.weight || 0,
        rest_seconds: +r.rest || 60,
        sort_order: j,
      })),
    });
    setSaving(false);
    onAssigned();
    toast.success(`Rutina asignada a ${client.display_name.split(' ')[0]}`);
  };

  return (
    <Card className="animate-fade-up border-[1.5px] border-primary p-[22px]">
      <div className="mb-4 font-heading text-[15px] font-semibold">Nueva rutina asignada</div>

      <div className="mb-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-name">Nombre</Label>
          <Input
            id="rb-name"
            placeholder="Ej. Empuje — Pecho y Hombro"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-day">Día</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger id="rb-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-1.5">
        <Label htmlFor="rb-desc">Descripción</Label>
        <Input
          id="rb-desc"
          placeholder="Objetivo de la sesión…"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className={`${ROW_GRID} mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wider text-faint`}>
            <span>Ejercicio</span>
            <span>Series</span>
            <span>Reps</span>
            <span>Peso kg</span>
            <span>Desc. s</span>
            <span></span>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className={`${ROW_GRID} items-center`}>
                <Input
                  aria-label="Nombre del ejercicio"
                  placeholder="Ej. Press de banca"
                  className="h-9 rounded-[9px] text-[13px]"
                  value={row.name}
                  onChange={(e) => upd(i, 'name', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Series"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.sets}
                  onChange={(e) => upd(i, 'sets', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Repeticiones"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.reps}
                  onChange={(e) => upd(i, 'reps', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Peso en kilogramos"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.weight}
                  onChange={(e) => upd(i, 'weight', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Descanso en segundos"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.rest}
                  onChange={(e) => upd(i, 'rest', e.target.value)}
                />
                <button
                  onClick={() => rows.length > 1 && setRows((rs) => rs.filter((_, k) => k !== i))}
                  aria-label="Quitar ejercicio"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setRows((rs) => [...rs, { ...emptyRow(), sets: '3', reps: '12', rest: '60' }])}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-strong py-2.5 text-[12.5px] font-semibold text-secondary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Añadir ejercicio
      </button>

      <div className="mt-[18px] flex justify-end gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? 'Asignando…' : `Asignar a ${client.display_name.split(' ')[0]}`}
        </Button>
      </div>
    </Card>
  );
}

const EX_GRID = 'grid gap-1.5 [grid-template-columns:2fr_52px_52px_62px_62px]';

export function WorkoutsTab({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {client.routines.length} rutinas · las marcadas <OwnerBadge assignedBy="coach" /> son tuyas
        </div>
        <Button onClick={() => setBuilderOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Asignar rutina
        </Button>
      </div>

      {builderOpen && (
        <RoutineBuilder
          client={client}
          onClose={() => setBuilderOpen(false)}
          onAssigned={() => {
            setBuilderOpen(false);
            onChanged();
          }}
        />
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
        {client.routines.map((rt) => (
          <Card key={rt.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-heading text-sm font-semibold">{rt.name}</span>
              <OwnerBadge assignedBy={rt.assigned_by} />
              <span className="flex-none rounded-full bg-muted px-2.5 py-[3px] text-[11px] font-semibold text-muted-foreground">
                {rt.day_of_week}
              </span>
            </div>
            <p className="mb-3 mt-1.5 text-[12.5px] text-faint">{rt.description}</p>
            <div className={`${EX_GRID} border-b border-border pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-faint`}>
              <span>Ejercicio</span>
              <span className="text-center">Ser.</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Peso</span>
              <span className="text-center">Desc.</span>
            </div>
            {rt.exercises.map((ex, i) => (
              <div key={i} className={`${EX_GRID} items-center border-b border-border py-[7px] text-[12.5px]`}>
                <span className="truncate font-medium">{ex.name}</span>
                <span className="text-center text-muted-foreground">{ex.sets}</span>
                <span className="text-center text-muted-foreground">{ex.reps}</span>
                <span className="text-center text-muted-foreground">{ex.weight_kg ? `${ex.weight_kg} kg` : '—'}</span>
                <span className="text-center text-muted-foreground">{ex.rest_seconds}s</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
