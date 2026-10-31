import { ProgramWorkspace } from '@/components/program/ProgramWorkspace';
import type { ProgramBuilderProps } from '@/components/program/useProgramBuilder';

/**
 * The program builder, as the Programas pages mount it. State, autosave and
 * save live in useProgramBuilder; ProgramWorkspace is the layout.
 */
export function ProgramBuilder(props: ProgramBuilderProps) {
  return <ProgramWorkspace {...props} />;
}
