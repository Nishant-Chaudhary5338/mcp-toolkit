import { describe, it, expect } from 'vitest';
import { calculateGrade } from './utils.js';
import type { PipelineStage } from './utils.js';

function stage(status: PipelineStage['status']): PipelineStage {
  return { name: 'test', status, duration: 0, summary: '', details: {} };
}

describe('calculateGrade', () => {
  it('returns A when all stages pass', () => {
    expect(calculateGrade([stage('pass'), stage('pass'), stage('pass')])).toBe('A');
  });

  it('returns B with exactly one warning and no failures', () => {
    expect(calculateGrade([stage('pass'), stage('warn')])).toBe('B');
  });

  it('returns C with two warnings and no failures', () => {
    expect(calculateGrade([stage('warn'), stage('warn')])).toBe('C');
  });

  it('returns D with exactly one failure', () => {
    expect(calculateGrade([stage('fail'), stage('pass')])).toBe('D');
  });

  it('returns F with two or more failures', () => {
    expect(calculateGrade([stage('fail'), stage('fail')])).toBe('F');
  });

  it('ignores skipped stages', () => {
    expect(calculateGrade([stage('pass'), stage('skip'), stage('skip')])).toBe('A');
  });

  it('returns A for empty stage list', () => {
    expect(calculateGrade([])).toBe('A');
  });

  it('returns A when all stages are skipped', () => {
    expect(calculateGrade([stage('skip'), stage('skip')])).toBe('A');
  });
});
