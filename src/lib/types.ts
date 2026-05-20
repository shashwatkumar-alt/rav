// ============================================================
// Type Definitions for School Result Generation
// ============================================================

export type ResultType = 'FIRST_TERM' | 'FINAL';

export interface SubjectMarks {
  /** Per-score-type marks for this subject */
  [scoreType: string]: number | string | undefined;
}

export interface AttendanceData {
  workingDays: string;
  daysAttended: string;
  percentage: string;
  remarks: string;
}

export interface StudentData {
  name: string;
  fatherName: string;
  motherName: string;
  dob: string;
  class: string;
  rollNo: string;
  admNo: string;
  /** subject name -> { PT, NB, SEA, SA, Total, ... } */
  subjects: Record<string, SubjectMarks>;
  /** Co-scholastic item name -> grade (e.g. "A", "B", "C") */
  coScholastic: Record<string, string>;
  /** Discipline item name -> grade */
  discipline: Record<string, string>;
  /** Attendance data */
  attendance: AttendanceData;
  /** Overall remarks from the Grand Score section */
  overallRemarks: string;
  /** SUPW grade */
  supw: string;
  /** Rank/Position */
  rank: string;
  /** Any extra columns that aren't metadata or subjects */
  extras: Record<string, string | number>;
}

export interface ColumnMapping {
  /** The column index in the raw data */
  colIndex: number;
  /** The subject this column belongs to (e.g. "ENGLISH") */
  subject: string;
  /** The score type (e.g. "PT", "NB", "SEA", "SA-I", "Total") */
  scoreType: string;
  /** Term group prefix: '1T_' for 1st term, '2T_' for 2nd term, 'FR_' for final result */
  termGroup?: string;
}

export interface SheetData {
  sheetName: string;
  className: string;
  /** All raw header names from row 1 */
  headers: string[];
  /** Real subject names detected (e.g. ["ENGLISH", "HINDI", "MATHS"]) */
  subjectNames: string[];
  /** Score type columns detected (e.g. ["PT", "NB", "SEA", "SA-I", "Total"]) */
  scoreTypes: string[];
  /** Full column mapping */
  columnMappings: ColumnMapping[];
  /** Metadata column names detected */
  metadataColumns: string[];
  students: StudentData[];
  rawData: (string | number)[][];
  errors: ValidationError[];
}

export interface ValidationError {
  sheet: string;
  row?: number;
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: SheetData[];
  errors: ValidationError[];
  isValid: boolean;
}

export interface GenerationRequest {
  workbookData: ParsedWorkbook;
  resultType: ResultType;
  sessionYear: string;
}
