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
 * Every builder's close confirmation, shown only when there's work to lose.
 * `onDiscard` drops the draft and closes the builder.
 */
export function DiscardChangesDialog({
  open,
  onOpenChange,
  editing,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing something already saved (vs. a new one). */
  editing: boolean;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            {editing ? 'La versión guardada no cambia.' : 'Todavía no se ha guardado nada.'}
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
