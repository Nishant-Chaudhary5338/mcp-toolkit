export interface PipelineStage {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  duration: number;
  summary: string;
  details: unknown;
}

export function calculateGrade(stages: PipelineStage[]): string {
  const active = stages.filter(s => s.status !== 'skip');
  const fails = active.filter(s => s.status === 'fail').length;
  const warns = active.filter(s => s.status === 'warn').length;
  if (fails === 0 && warns === 0) return 'A';
  if (fails === 0 && warns === 1) return 'B';
  if (fails === 0 && warns <= 2) return 'C';
  if (fails === 1) return 'D';
  return 'F';
}
