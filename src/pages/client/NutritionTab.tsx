import { useState } from 'react';
import { toast } from 'sonner';
import { UtensilsCrossed } from 'lucide-react';
import type { ClientWithMeta } from '@/types';
import { updateClient } from '@/services/clients';
import { MEAL_TYPE_LABELS } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OwnerBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';

const ITEM_GRID = 'grid gap-1.5 [grid-template-columns:2fr_60px_44px_44px_44px]';

export function NutritionTab({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setInput(String(client.calorie_goal ?? 2000));
    setEditing(true);
  };

  const save = async () => {
    const v = Math.min(6000, Math.max(800, parseInt(input, 10) || client.calorie_goal || 2000));
    setSaving(true);
    await updateClient(client.id, { calorie_goal: v });
    setSaving(false);
    setEditing(false);
    onChanged();
    toast.success(`Meta actualizada: ${v.toLocaleString('en-US')} kcal`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Calorie goal */}
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-[220px] flex-1">
          <div className="font-heading text-[14.5px] font-semibold">Meta diaria de calorías</div>
          <p className="mt-0.5 text-[12.5px] text-faint">Se muestra al cliente en su pantalla de inicio.</p>
        </div>
        {!editing ? (
          <div className="flex items-center gap-3.5">
            <span className="font-heading text-[30px] font-bold text-primary">
              {(client.calorie_goal ?? 0).toLocaleString('en-US')}{' '}
              <span className="text-sm font-medium text-faint">kcal</span>
            </span>
            <Button variant="outline" size="sm" onClick={startEdit}>
              Editar
            </Button>
          </div>
        ) : (
          <form
            className="flex items-center gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              type="number"
              aria-label="Meta de calorías"
              className="w-[110px] text-[15px] font-semibold"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <span className="text-[13px] text-faint">kcal</span>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </Card>

      {/* Meals */}
      {client.meals.length === 0 ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={UtensilsCrossed}
            title="Sin plan de comidas"
            description={`${(client.display_name ?? client.email).split(' ')[0]} aún no tiene comidas asignadas. El editor de planes de comida llega en la próxima iteración.`}
          />
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
          {client.meals.map((m) => {
            const tot = m.meal_items.reduce(
              (a, i) => ({
                cal: a.cal + i.calories,
                p: a.p + i.protein_g,
                c: a.c + i.carbs_g,
                f: a.f + i.fat_g,
              }),
              { cal: 0, p: 0, c: 0, f: 0 },
            );
            return (
              <Card key={m.id} className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex-none rounded-full bg-secondary/10 px-2.5 py-[3px] text-[11px] font-bold text-secondary dark:bg-secondary/15">
                    {MEAL_TYPE_LABELS[m.meal_type] ?? m.meal_type}
                  </span>
                  <span className="min-w-0 flex-1 font-heading text-sm font-semibold">{m.name}</span>
                  {m.assigned_by && <OwnerBadge assignedBy={m.assigned_by} />}
                </div>
                <div
                  className={`${ITEM_GRID} border-b border-border pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-faint`}
                >
                  <span>Alimento</span>
                  <span className="text-right">kcal</span>
                  <span className="text-right">P</span>
                  <span className="text-right">C</span>
                  <span className="text-right">G</span>
                </div>
                {m.meal_items.map((it, i) => (
                  <div key={i} className={`${ITEM_GRID} items-center border-b border-border py-[7px] text-[12.5px]`}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it.name}</span>
                      <span className="block text-[11px] text-faint">{it.portion}</span>
                    </span>
                    <span className="text-right text-muted-foreground">{it.calories}</span>
                    <span className="text-right text-muted-foreground">{it.protein_g}</span>
                    <span className="text-right text-muted-foreground">{it.carbs_g}</span>
                    <span className="text-right text-muted-foreground">{it.fat_g}</span>
                  </div>
                ))}
                <div className={`${ITEM_GRID} pt-2 text-[12.5px] font-bold`}>
                  <span>Total</span>
                  <span className="text-right text-primary">{tot.cal}</span>
                  <span className="text-right">{tot.p}</span>
                  <span className="text-right">{tot.c}</span>
                  <span className="text-right">{tot.f}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
