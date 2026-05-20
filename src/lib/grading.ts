// ============================================================
// Grading Logic — from school's official template
// ============================================================

export interface GradeInfo {
  grade: string;
  minPercent: number;
  maxPercent: number;
}

const GRADING_SCALE: GradeInfo[] = [
  { grade: 'A+', minPercent: 91, maxPercent: 100 },
  { grade: 'A', minPercent: 81, maxPercent: 90 },
  { grade: 'B+', minPercent: 71, maxPercent: 80 },
  { grade: 'B', minPercent: 61, maxPercent: 70 },
  { grade: 'C+', minPercent: 51, maxPercent: 60 },
  { grade: 'C', minPercent: 41, maxPercent: 50 },
  { grade: 'D', minPercent: 33, maxPercent: 40 },
  { grade: 'E+', minPercent: 21, maxPercent: 33 },
  { grade: 'E', minPercent: 11, maxPercent: 20 },
  { grade: 'F', minPercent: 0, maxPercent: 10 },
];

/**
 * Get grade from percentage
 */
export function getGrade(percentage: number): string {
  if (isNaN(percentage) || percentage < 0) return 'F';
  if (percentage > 100) return 'A+';

  for (const g of GRADING_SCALE) {
    if (percentage >= g.minPercent && percentage <= g.maxPercent) {
      return g.grade;
    }
  }
  return 'F';
}

/**
 * Get the full grading scale string for display
 */
export function getGradingScaleText(): string {
  return 'Eight Point Grading Scale : A+( 91% − 100% ), A ( 81% − 90% ), B+(71% – 80%), B(61% – 70%), C+(51% – 60%), C(41% – 50%), D(33% – 40%), E+(21% – 33%), E(11% – 20%), F(0% – 10%)';
}

export { GRADING_SCALE };
