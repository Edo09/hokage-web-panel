/** Shared by Dialog and AlertDialog: a bottom sheet on phones (full width,
 *  in thumb reach), a centred card from `sm` up. Kept out of the component
 *  files so they export only components (react-refresh). */
export const SHEET_CLASSES = [
  'fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] w-full gap-5 overflow-y-auto rounded-t-2xl border-t border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-6 data-[state=open]:slide-in-from-bottom-6',
  'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
].join(' ');
