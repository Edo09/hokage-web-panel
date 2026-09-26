import { useDesign } from '@/hooks/useDesign';
import { LegacyProgramBuilder } from '@/components/program/LegacyProgramBuilder';
import { ProgramWorkspace } from '@/components/program/ProgramWorkspace';
import type { ProgramBuilderProps } from '@/components/program/useProgramBuilder';

/**
 * The program builder, as the Programas pages mount it. The workspace is the
 * builder; the 4-step wizard only renders for the deprecated "Clásico
 * (legacy)" panel style. Both share useProgramBuilder (same draft slot, same
 * save), so switching style mid-edit loses nothing.
 */
export function ProgramBuilder(props: ProgramBuilderProps) {
  const { design } = useDesign();
  return design === 'legacy' ? <LegacyProgramBuilder {...props} /> : <ProgramWorkspace {...props} />;
}
