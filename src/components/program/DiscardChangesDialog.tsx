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

/**
 * The builders' "Cancelar" confirmation (workspace and Clásico wizard), shown
 * only when there's work to lose — see useProgramBuilder#hasChanges.
 * `onDiscard` drops the autosave and closes the builder.
 */
export function DiscardChangesDialog({
  open,
  onOpenChange,
  isTemplate,
  editing,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTemplate: boolean;
  /** Editing a saved program/template (vs. a new one). */
  editing: boolean;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            {editing
              ? `Se pierde lo que cambiaste desde que abriste ${isTemplate ? 'la plantilla' : 'el programa'}. La versión guardada queda como estaba.`
              : `Se pierde lo que llevas de ${isTemplate ? 'esta plantilla' : 'este programa'}. No se guardó ni se asignó nada.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Seguir editando</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>Descartar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
