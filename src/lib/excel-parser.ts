import * as XLSX from 'xlsx';
import type { ParsedWorkbook, SheetData, StudentData, ValidationError, ColumnMapping, AttendanceData } from './types';

// ============================================================
// Known metadata column patterns (case-insensitive matching)
// ============================================================
const METADATA_PATTERNS: Record<string, RegExp[]> = {
  name: [/^(student('?s?)?\s*name|name)$/i],
  fatherName: [/^(father('?s?)?\s*name)$/i],
  motherName: [/^(mother('?s?)?\s*name)$/i],
  dob: [/^(d\.?o\.?b\.?|date\s*of\s*birth|dob)$/i],
  rollNo: [/^(roll\s*(no\.?|number)|roll\s*no\.?)$/i],
  admNo: [/^(adm\.?\s*(no\.?|number)|admission\s*(no\.?|number)|regd?\s*no\.?)$/i],
};

const NON_SUBJECT_PATTERNS: RegExp[] = [
  /^(s\.?\s*no\.?|sr\.?\s*no\.?|sl\.?\s*no\.?|serial\s*(no\.?|number)|regd?\s*no\.?)$/i,
  /^(total\s*marks?|grand\s*total|grand\s*score|grant\s*total)$/i,
  /^(percentage|%|percent)$/i,
  /^(overall\s*grade|grade\s*$)/i,
  /^(rank|position)$/i,
  /^(remarks?|comment|remark)$/i,
  /^(attendance|attendence|present|absent|working\s*days|total\s*working\s*days)$/i,
  /^(result|pass\/fail|status)$/i,
  /^(supw)$/i,
  /^(scholastic|co[\s-]*scholastic|academic)/i,
  /^(discipline)/i,
  /^(regularity|sincerity|behaviour|respectfulness|attitude)/i,
  /^(work\s*education|art\s*education|health|physical\s*education)/i,
  /^(scientific\s*skills?|thinking\s*skill|social\s*skill)/i,
  /^(yoga|ncc|sports)/i,
  /^(class\s*teacher|parent|principal|signature)/i,
  /^(students?\s*details?)$/i,
  /^(blood\s*group)$/i,
  /^(house)$/i,
  /^(uid\s*no\.?)$/i,
  /^(class|sec|section|year)$/i,
  /^(obtained|marks\s*\(\d+\))$/i,
  /^\(a\s*-\s*f\)$/i,
  /^\(position\)$/i,
  /^(working\s*days|attended)$/i,
  /^(descriptive\s*indicator)$/i,
  /^(total\s*grade)$/i,
  /^(marks\s*strength)/i,
  /^(over\s*all)/i,
  /^(grand)$/i,
  /^(total)$/i,
  /^(strn)$/i,
  /^(\(80\+20\))/i,
  /^(bg|cl|exam)$/i,
  ...Object.values(METADATA_PATTERNS).flat(),
];

// Score type patterns — sub-columns under each subject
const SCORE_TYPE_PATTERNS: RegExp[] = [
  /^pt(\s*\(\d+\))?$/i,
  /^nb(\s*\(\d+\))?$/i,
  /^n\.?b\.?(\s*\(\d+\))?$/i,
  /^sea(\s*\(\d+\))?$/i,
  /^s\.?e\.?a\.?(\s*\(\d+\))?$/i,
  /^sa[\s-]?(i{1,2}|1|2)(\s*\(\d+\))?$/i,
  /^sa(\s*\(\d+\))?$/i,
  /^f(\s*\(\d+\))$/i,  // F (60) — only match with parentheses
  /^total(\s*avg)?$/i,
  /^1st\s*term$/i,
  /^2nd\s*term$/i,
  /^80\s*%?$/i,
  /^20\s*%?$/i,
  /^grand\s*total$/i,
  /^g\.?\s*t\.?$/i,
  /^grade$/i,
  /^marks(\s*\(\d+\))?$/i,
  /^final\s*grade$/i,
  /^total\s*avg$/i,
  /^av$/i,
  /^gr\s?\w*$/i,  // GR EN, GR HN, GR MTH, etc.
  /^ts$/i,
  /^mx$/i,
];

// Term group headers (Row 1 in the 3-row format) — NOT score types
const TERM_GROUP_PATTERNS: RegExp[] = [
  /^1st\s*term$/i,
  /^2nd\s*term$/i,
  /^final\s*result$/i,
  /^final$/i,
  /^term\s*(i{1,2}|1|2)$/i,
];

// ============================================================
// Co-scholastic item mapping: Excel abbreviation -> display name
// ============================================================
const CO_SCHOLASTIC_MAP: { pattern: RegExp; name: string }[] = [
  { pattern: /^we/i, name: 'Work education' },
  { pattern: /^ae/i, name: 'Art Education' },
  { pattern: /^h\s*[&]\s*p/i, name: 'Health and Physical Education' },
  { pattern: /^sc\.?\s*sk/i, name: 'Scientific Skills' },
  { pattern: /^thnk\.?\s*sk/i, name: 'Thinking Skill' },
  { pattern: /^socl\.?\s*sk/i, name: 'Social Skill' },
  { pattern: /^yoga/i, name: 'Yoga /NCC' },
];

// Discipline item mapping
const DISCIPLINE_MAP: { pattern: RegExp; name: string }[] = [
  { pattern: /^reg/i, name: 'Regularity and punctuality' },
  { pattern: /^sincr/i, name: 'Sincerity' },
  { pattern: /^bhvr/i, name: 'Behaviour and Values' },
  { pattern: /^rspt/i, name: 'Respectfulness of Rules and Regulations' },
  { pattern: /^at\.?\s*tchr/i, name: 'Attitude Towards Teachers' },
  { pattern: /^at\.?\s*clmt/i, name: 'Attitude towards classmates' },
  { pattern: /^at\.?\s*(nat|sct)/i, name: 'Attitude Towards society' },
];

function identifyMetadataField(header: string): string | null {
  const trimmed = header.trim();
  if (!trimmed) return null;
  for (const [field, patterns] of Object.entries(METADATA_PATTERNS)) {
    if (patterns.some((p) => p.test(trimmed))) return field;
  }
  return null;
}

function isMetadataOrNonSubject(header: string): boolean {
  const trimmed = header.trim();
  if (!trimmed) return true;
  return NON_SUBJECT_PATTERNS.some((p) => p.test(trimmed));
}

function isScoreType(header: string): boolean {
  const trimmed = header.trim();
  if (!trimmed) return false;
  return SCORE_TYPE_PATTERNS.some((p) => p.test(trimmed));
}

function normalizeScoreType(raw: string): string {
  const t = raw.trim();
  if (/^pt/i.test(t)) return 'PT';
  if (/^n\.?b\.?/i.test(t)) return 'NB';
  if (/^s\.?e\.?a\.?/i.test(t)) return 'SEA';
  if (/^sa[\s-]?i$/i.test(t) || /^sa[\s-]?1$/i.test(t)) return 'SA-I';
  if (/^sa[\s-]?ii$/i.test(t) || /^sa[\s-]?2$/i.test(t)) return 'SA-II';
  if (/^sa/i.test(t)) return 'SA';
  if (/^f\s*\(\d+\)/i.test(t)) return 'SA-I'; // F (60) = the main exam (SA)
  if (/^total\s*avg$/i.test(t)) return 'Total';
  if (/^total$/i.test(t)) return 'Total';
  if (/^1st\s*term$/i.test(t)) return '1st Term';
  if (/^2nd\s*term$/i.test(t)) return '2nd Term';
  if (/^80\s*%?$/i.test(t)) return '80%';
  if (/^20\s*%?$/i.test(t)) return '20%';
  if (/^grand\s*total$/i.test(t) || /^g\.?\s*t\.?$/i.test(t)) return 'Grand Total';
  if (/^(final\s*)?grade$/i.test(t)) return 'Grade';
  if (/^marks/i.test(t)) return 'Marks';
  if (/^av$/i.test(t)) return 'Total';
  if (/^ts$/i.test(t)) return 'TS';
  return t;
}

function isBlankOrEmpty(val: string): boolean {
  return !val || val.startsWith('__EMPTY');
}

/**
 * Convert an Excel serial date number to a DD/MM/YYYY string.
 */
function excelSerialToDate(serial: number): string {
  // Guard against invalid serial numbers
  if (!Number.isFinite(serial) || serial <= 0) return '';
  // Excel serial date: days since 1900-01-01 (with Lotus 1-2-3 leap year bug)
  // The bug counts 29 Feb 1900 as a valid date, so for serial > 59 we subtract 1
  const adjustedSerial = serial > 59 ? serial - 1 : serial;
  const epoch = new Date(1900, 0, 1); // Jan 1, 1900
  const date = new Date(epoch.getTime() + (adjustedSerial - 1) * 86400000);
  // Verify the resulting date is valid
  if (isNaN(date.getTime())) return String(serial);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format a DOB value — handles Excel serial numbers, Date objects, and strings.
 */
function formatDOB(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  
  // If it's a number, it's likely an Excel serial date
  if (typeof val === 'number' && val > 0 && val < 100000) {
    return excelSerialToDate(val);
  }
  
  // If it's a Date object
  if (val instanceof Date) {
    // Guard against invalid Date objects
    if (isNaN(val.getTime())) return '';
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const yyyy = val.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  
  // If it's a string that looks like a number (serial date as string)
  const str = String(val).trim();
  const num = parseFloat(str);
  if (!isNaN(num) && num > 1000 && num < 100000 && str === String(num)) {
    return excelSerialToDate(num);
  }
  
  return str;
}

/**
 * Detect the number of header rows in a sheet.
 * The row with the MOST score type matches is the last header row.
 * We check up to 4 rows.
 */
function detectHeaderRowCount(rows: (string | number | undefined)[][]): number {
  let bestRow = 0;
  let bestCount = 0;
  
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const rowVals = (rows[r] || []).map((v) => String(v ?? '').trim());
    const scoreTypeCount = rowVals.filter((v) => v && isScoreType(v)).length;
    if (scoreTypeCount > bestCount) {
      bestCount = scoreTypeCount;
      bestRow = r;
    }
  }
  
  // If the best row has at least 3 score types, use it
  if (bestCount >= 3) {
    return bestRow + 1;
  }
  
  // Default: assume 1 header row
  return 1;
}


/**
 * Parse co-scholastic or discipline grades from a section of the sheet.
 * The section has pairs of columns: MX (marks number), GR (grade letter).
 * We match the item headers from the row above (row 1 of headers) to map them.
 */
function parseGradedSection(
  headerRows: string[][],
  dataRow: (string | number | undefined)[],
  sectionStartCol: number,
  sectionEndCol: number,
  itemMap: { pattern: RegExp; name: string }[],
  resultType: 'FIRST_TERM' | 'FINAL'
): Record<string, string> {
  const result: Record<string, string> = {};

  // Scan header rows for item names in the section range
  // The item names are typically in row 1 (e.g., "WE (TERM 1)", "AE (TERM 2)")
  // or row 11 in the SA-II format (e.g., "WE", "AE")
  // Each item has MX and GR sub-columns

  // Strategy: Find GR columns and look at the row above to determine which item
  for (let c = sectionStartCol; c <= sectionEndCol; c++) {
    // Look for "GR" label in the last header row (score type row)
    const lastRow = headerRows[headerRows.length - 1];
    const val = (c < lastRow.length ? lastRow[c] : '').toUpperCase().trim();
    
    if (val === 'GR') {
      // Found a GR column — determine which item this belongs to
      // Check the row above for the item label
      for (let r = 0; r < headerRows.length - 1; r++) {
        const label = (c < headerRows[r].length ? headerRows[r][c] : '').trim();
        const prevLabel = (c - 1 >= 0 && c - 1 < headerRows[r].length ? headerRows[r][c - 1] : '').trim();
        // The label might be on the MX column (c-1) due to merged cells, or on GR itself
        const checkLabel = label || prevLabel;
        
        if (checkLabel) {
          // Determine if this is term 1 or term 2
          const isTerm1 = /term\s*1|term\s*i(?!i)/i.test(checkLabel);
          const isTerm2 = /term\s*2|term\s*ii/i.test(checkLabel);
          
          // Only use data for the correct term
          if (resultType === 'FIRST_TERM' && isTerm2) continue;
          if (resultType === 'FINAL' && isTerm1) continue;
          
          // If no term specified, and there's both terms, we want the correct one
          // Match the item
          for (const item of itemMap) {
            if (item.pattern.test(checkLabel)) {
              const gradeVal = String(dataRow[c] ?? '').trim();
              if (gradeVal && !result[item.name]) {
                result[item.name] = gradeVal;
              }
              break;
            }
          }
          break; // found the label row
        }
      }

      // If we didn't find a label in rows above, try matching by position
      // (items go in order within the section)
    }
  }

  // Fallback: if we got nothing from label matching, try positional matching
  // Collect all GR column values in order and map them to items
  if (Object.keys(result).length === 0) {
    const grValues: string[] = [];
    const lastRow = headerRows[headerRows.length - 1];
    
    for (let c = sectionStartCol; c <= sectionEndCol; c++) {
      const val = (c < lastRow.length ? lastRow[c] : '').toUpperCase().trim();
      if (val === 'GR') {
        grValues.push(String(dataRow[c] ?? '').trim());
      }
    }

    // For sections with Term 1 + Term 2 alternating, GR values alternate:
    // Term1 GR, Term2 GR, Term1 GR, Term2 GR, ...
    // Or they might be grouped: all Term1 then all Term2
    if (grValues.length === itemMap.length * 2) {
      // Alternating pattern: item1-T1, item1-T2, item2-T1, item2-T2, ...
      const offset = resultType === 'FIRST_TERM' ? 0 : 1;
      for (let i = 0; i < itemMap.length; i++) {
        const val = grValues[i * 2 + offset];
        if (val) result[itemMap[i].name] = val;
      }
    } else if (grValues.length === itemMap.length) {
      // One value per item (single term)
      for (let i = 0; i < itemMap.length; i++) {
        if (grValues[i]) result[itemMap[i].name] = grValues[i];
      }
    } else if (grValues.length > 0) {
      // Best effort: map whatever we have
      for (let i = 0; i < Math.min(grValues.length, itemMap.length); i++) {
        if (grValues[i]) result[itemMap[i].name] = grValues[i];
      }
    }
  }

  return result;
}

/**
 * Parse attendance data from the attendance section columns.
 */
function parseAttendance(
  headerRows: string[][],
  dataRow: (string | number | undefined)[],
  attendanceStartCol: number,
  attendanceEndCol: number
): AttendanceData {
  const attendance: AttendanceData = {
    workingDays: '',
    daysAttended: '',
    percentage: '',
    remarks: '',
  };

  const lastRow = headerRows[headerRows.length - 1];
  
  for (let c = attendanceStartCol; c <= attendanceEndCol; c++) {
    const headerVal = (c < lastRow.length ? lastRow[c] : '').trim().toUpperCase();
    const cellVal = dataRow[c];
    const strVal = cellVal !== undefined && cellVal !== null && cellVal !== '' ? String(cellVal).trim() : '';
    
    if (/^(working|days)$/i.test(headerVal) || /^total$/i.test(headerVal)) {
      if (!attendance.workingDays && strVal) attendance.workingDays = strVal;
      else if (attendance.workingDays && !attendance.daysAttended && strVal) attendance.daysAttended = strVal;
    } else if (/^(attend|attain)/i.test(headerVal)) {
      attendance.daysAttended = strVal;
    } else if (headerVal === '%') {
      // Format percentage
      const pctNum = parseFloat(strVal);
      attendance.percentage = !isNaN(pctNum) ? pctNum.toFixed(2) + '%' : strVal;
    } else if (/^remarks?$/i.test(headerVal)) {
      attendance.remarks = strVal;
    }
  }

  // If we still don't have separated working/attended, try positional approach
  // Typical order: TOTAL/WORKING DAYS, TOTAL/ATTENDED, %, REMARKS
  if (!attendance.workingDays || !attendance.daysAttended) {
    const values: string[] = [];
    for (let c = attendanceStartCol; c <= attendanceEndCol; c++) {
      const v = dataRow[c];
      if (v !== undefined && v !== null && v !== '') values.push(String(v).trim());
    }
    if (values.length >= 4) {
      attendance.workingDays = attendance.workingDays || values[0];
      attendance.daysAttended = attendance.daysAttended || values[1];
      const pctNum = parseFloat(values[2]);
      attendance.percentage = attendance.percentage || (!isNaN(pctNum) ? pctNum.toFixed(2) + '%' : values[2]);
      attendance.remarks = attendance.remarks || values[3];
    } else if (values.length >= 2) {
      attendance.workingDays = attendance.workingDays || values[0];
      attendance.daysAttended = attendance.daysAttended || values[1];
      if (values[2]) {
        const pctNum = parseFloat(values[2]);
        attendance.percentage = !isNaN(pctNum) ? pctNum.toFixed(2) + '%' : values[2];
      }
    }
  }

  return attendance;
}

/**
 * Parse an Excel workbook buffer into structured data.
 * Handles multi-row merged headers (2 or 3 rows).
 */
export function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string
): ParsedWorkbook {
  const errors: ValidationError[] = [];

  if (!buffer || buffer.byteLength === 0) {
    return {
      fileName, sheets: [], isValid: false,
      errors: [{ sheet: '', message: 'File is empty (0 bytes).', severity: 'error' }],
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    return {
      fileName, sheets: [], isValid: false,
      errors: [{ sheet: '', message: 'Failed to open workbook. File may be corrupted.', severity: 'error' }],
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      fileName, sheets: [], isValid: false,
      errors: [{ sheet: '', message: 'Workbook contains no sheets.', severity: 'error' }],
    };
  }

  const sheets: SheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    // Skip sheets starting with "SPARE" (template/spare sheets)
    if (sheetName.toUpperCase().startsWith('SPARE')) continue;
    if (sheetName.toUpperCase() === 'SHEET1') continue;

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      errors.push({ sheet: sheetName, message: `Sheet "${sheetName}" is empty.`, severity: 'warning' });
      continue;
    }

    // Read as array-of-arrays to handle merged headers
    const rawRows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
      worksheet, { header: 1, defval: '' }
    );

    if (rawRows.length < 2) {
      errors.push({ sheet: sheetName, message: `Sheet "${sheetName}" needs at least 2 rows.`, severity: 'warning' });
      continue;
    }

    const headerRowCount = detectHeaderRowCount(rawRows);
    const headerRows = rawRows.slice(0, headerRowCount).map(
      (row) => (row || []).map((v) => String(v ?? '').trim())
    );

    // ── Build column mappings ──
    const columnMappings: ColumnMapping[] = [];
    const metadataColumns: string[] = [];
    const metadataMap: Record<number, string> = {};
    const subjectNames: string[] = [];
    const scoreTypesSet = new Set<string>();

    // The LAST header row is the score type / column definition row
    const scoreTypeRow = headerRows[headerRowCount - 1];
    
    // ── Identify special section boundaries ──
    // Find CO-SCHOLASTIC AREAS, DISCIPLINE, ATTENDANCE sections from row 0 or 1
    let coScholasticStartCol = -1;
    let disciplineStartCol = -1;
    let attendanceStartCol = -1;
    let grandScoreStartCol = -1;
    
    // Also track SUPW, RANK, REMARK columns from the score type row
    let supwCol = -1;
    let supwTerm1Col = -1;
    let supwTerm2Col = -1;
    let supwFinalCol = -1;
    let rankCol = -1;
    let remarkCol = -1;
    
    // Scan all header rows for section headers
    for (let r = 0; r < headerRows.length; r++) {
      for (let c = 0; c < headerRows[r].length; c++) {
        const h = headerRows[r][c].toUpperCase();
        if (/CO[\s-]*SCHOLASTIC/i.test(h) && coScholasticStartCol === -1) {
          coScholasticStartCol = c;
        }
        if (/^DISCIPLINE$/i.test(h) && disciplineStartCol === -1 && c > (coScholasticStartCol > 0 ? coScholasticStartCol : 0)) {
          disciplineStartCol = c;
        }
        if (/ATTEND/i.test(h) && attendanceStartCol === -1) {
          attendanceStartCol = c;
        }
        if (/GRAND\s*(SCORE|TOTAL)/i.test(h) && grandScoreStartCol === -1) {
          grandScoreStartCol = c;
        }
      }
    }
    
    // Scan score type row for SUPW, RANK, REMARK
    for (let c = 0; c < scoreTypeRow.length; c++) {
      const h = scoreTypeRow[c].toUpperCase().trim();
      if (/^SUPW$/i.test(h)) supwCol = c;
      if (/^(rank|\(position\)|position)$/i.test(h)) rankCol = c;
      if (/^remarks?$/i.test(h) && c < (attendanceStartCol > 0 ? attendanceStartCol : 999)) remarkCol = c;
    }
    
    // Scan all header rows for SUPW section header (row 0 typically has "SUPW")
    // It has sub-columns: "1ST TERM", "2ND TERM", "FINAL" in row 1
    // and "MARKS (100)" in the score type row
    for (let r = 0; r < headerRows.length; r++) {
      for (let c = 0; c < headerRows[r].length; c++) {
        if (/^SUPW$/i.test(headerRows[r][c].trim())) {
          // Found SUPW section — now find sub-columns in the rows below
          // Look at the next row for term labels
          if (r + 1 < headerRows.length) {
            // Scan a few columns from the SUPW position
            for (let sc = c; sc < Math.min(c + 5, headerRows[r + 1].length); sc++) {
              const subH = headerRows[r + 1][sc].trim().toUpperCase();
              if (/1ST\s*TERM/i.test(subH)) supwTerm1Col = sc;
              else if (/2ND\s*TERM/i.test(subH)) supwTerm2Col = sc;
              else if (/^FINAL$/i.test(subH)) supwFinalCol = sc;
            }
          }
          // If no sub-columns found (single column SUPW), use the main column
          if (supwTerm1Col === -1 && supwTerm2Col === -1 && supwFinalCol === -1) {
            supwCol = c;
          }
          break;
        }
      }
      if (supwTerm1Col >= 0 || supwCol >= 0) break;
    }

    // Determine section boundaries
    const allSectionStarts = [coScholasticStartCol, disciplineStartCol, attendanceStartCol, grandScoreStartCol]
      .filter(c => c >= 0)
      .sort((a, b) => a - b);
    
    // Find the end of subject columns: the first section start
    const subjectEndCol = allSectionStarts.length > 0 ? Math.min(...allSectionStarts) - 1 : scoreTypeRow.length - 1;

    // Calculate end columns for each section
    const getNextSectionStart = (currentStart: number): number => {
      const nextStarts = allSectionStarts.filter(c => c > currentStart);
      return nextStarts.length > 0 ? nextStarts[0] - 1 : scoreTypeRow.length - 1;
    };

    const attendanceEndCol = attendanceStartCol >= 0 ? getNextSectionStart(attendanceStartCol) : -1;
    const coScholasticEndCol = coScholasticStartCol >= 0 ? getNextSectionStart(coScholasticStartCol) : -1;
    const disciplineEndCol = disciplineStartCol >= 0 ? getNextSectionStart(disciplineStartCol) : -1;
    
    // Identify metadata columns from the LAST header row (where field names live)
    for (let col = 0; col < scoreTypeRow.length; col++) {
      const val = scoreTypeRow[col];
      if (!val || isBlankOrEmpty(val)) continue;
      const metaField = identifyMetadataField(val);
      if (metaField && !metadataMap[col]) {
        metadataMap[col] = metaField;
        if (!metadataColumns.includes(val)) metadataColumns.push(val);
      }
    }

    if (headerRowCount >= 2) {
      // Multi-row header mode
      const subjectRow = headerRows[0]; // Subjects are always in the first row
      const termRow = headerRowCount >= 2 ? headerRows[1] : null; // Row 1 has term groups
      
      let currentSubject = '';
      let currentTermGroup = ''; // tracks "1ST TERM", "2ND TERM", "FINAL RESULT" etc.

      const colCount = headerRows.length > 0 ? Math.max(0, ...headerRows.map(r => r.length)) : 0;
      for (let col = 0; col < Math.min(colCount, subjectEndCol + 1); col++) {
        // If this column is already identified as metadata, skip
        if (metadataMap[col]) continue;

        const subjectVal = col < subjectRow.length ? subjectRow[col] : '';
        const scoreVal = col < scoreTypeRow.length ? scoreTypeRow[col] : '';
        
        // Forward-fill term group from row 1
        if (termRow && col < termRow.length) {
          const termVal = termRow[col];
          if (termVal && !isBlankOrEmpty(termVal) && TERM_GROUP_PATTERNS.some(p => p.test(termVal))) {
            currentTermGroup = termVal;
          }
        }
        
        // Determine term prefix from current term group
        let termPrefix: string | undefined;
        if (/1st\s*term/i.test(currentTermGroup)) {
          termPrefix = '1T_';
        } else if (/2nd\s*term/i.test(currentTermGroup)) {
          termPrefix = '2T_';
        } else if (/final/i.test(currentTermGroup)) {
          termPrefix = 'FR_';
        }
        
        // Check if the score type row value is a non-subject / metadata
        if (scoreVal && isMetadataOrNonSubject(scoreVal) && !isScoreType(scoreVal)) {
          continue;
        }

        // Update current subject from subject row (forward-fill blanks)
        if (subjectVal && !isBlankOrEmpty(subjectVal) && !isMetadataOrNonSubject(subjectVal) && !isScoreType(subjectVal)) {
          // Ignore if it's just the class name (sheet name) in row 0
          if (subjectVal.toUpperCase() !== sheetName.toUpperCase() && subjectVal.toUpperCase() !== 'STUDENTS DETAILS') {
            // Also ignore term group labels in row 0
            if (!TERM_GROUP_PATTERNS.some(p => p.test(subjectVal))) {
              currentSubject = subjectVal;
              if (!subjectNames.includes(currentSubject)) {
                subjectNames.push(currentSubject);
              }
            }
          }
        }

        // Map the score type column
        if (currentSubject && scoreVal && !isBlankOrEmpty(scoreVal) && isScoreType(scoreVal)) {
          const scoreType = normalizeScoreType(scoreVal);
          scoreTypesSet.add(scoreType);
          columnMappings.push({ colIndex: col, subject: currentSubject, scoreType, termGroup: termPrefix });
        }
      }

    } else {
      // Single-row header mode (simple flat headers)
      const headers = headerRows[0];
      for (let col = 0; col < headers.length; col++) {
        const h = headers[col];
        if (!h || isBlankOrEmpty(h)) continue;
        if (metadataMap[col]) continue;
        if (isMetadataOrNonSubject(h)) continue;

        if (!subjectNames.includes(h)) subjectNames.push(h);
        columnMappings.push({ colIndex: col, subject: h, scoreType: 'Marks' });
        scoreTypesSet.add('Marks');
      }
    }

    // ── Parse student data rows ──
    const dataStartRow = headerRowCount;
    const students: StudentData[] = [];
    const sheetErrors: ValidationError[] = [];

    for (let rowIdx = dataStartRow; rowIdx < rawRows.length; rowIdx++) {
      const row = rawRows[rowIdx];
      if (!row) continue;

      // Skip entirely empty rows
      const hasAnyData = row.some((cell) =>
        cell !== undefined && cell !== null && cell !== '' &&
        (typeof cell === 'number' || String(cell).trim().length > 0)
      );
      if (!hasAnyData) continue;

      // Skip rows that look like headers (e.g., the 3rd header row that was missed)
      const firstCellStr = String(row[0] ?? '').trim().toUpperCase();
      if (/^(REGD?\s*NO\.?|S\.?\s*NO\.?|SR\.?\s*NO\.?|SL\.?\s*NO\.?|SERIAL\s*(NO\.?|NUMBER))$/i.test(firstCellStr)) {
        continue; // This is a header row, not data
      }
      
      // Also skip rows that are section headers (e.g., "CLASS II", "ACADEMIC PERFORMANCE")
      const secondCellStr = String(row[1] ?? '').trim().toUpperCase();
      if (secondCellStr.startsWith('CLASS ')) continue;
      // Check all cells in the row for ACADEMIC PERFORMANCE (not just column 14)
      const rowHasAcademicPerformance = row.some(cell => /ACADEMIC\s*PERFORMANCE/i.test(String(cell ?? '')));
      if (rowHasAcademicPerformance) continue;

      const student: StudentData = {
        name: '', fatherName: '', motherName: '', dob: '',
        class: sheetName, rollNo: '', admNo: '',
        subjects: {},
        coScholastic: {},
        discipline: {},
        attendance: { workingDays: '', daysAttended: '', percentage: '', remarks: '' },
        overallRemarks: '',
        supw: '',
        rank: '',
        extras: {},
      };

      // Fill metadata
      for (const [colStr, metaField] of Object.entries(metadataMap)) {
        const colIdx = parseInt(colStr, 10);
        const rawVal = row[colIdx];
        const val = String(rawVal ?? '').trim();
        switch (metaField) {
          case 'name': student.name = val; break;
          case 'fatherName': student.fatherName = val; break;
          case 'motherName': student.motherName = val; break;
          case 'dob': student.dob = formatDOB(rawVal); break;
          case 'rollNo': student.rollNo = val; break;
          case 'admNo': student.admNo = val; break;
        }
      }

      // Skip students with no name
      if (!student.name && !student.rollNo) continue;

      // Fill subject marks
      for (const mapping of columnMappings) {
        const cellValue = row[mapping.colIndex];
        if (!student.subjects[mapping.subject]) {
          student.subjects[mapping.subject] = {};
        }
        // Store with standard key (may be overwritten by later columns for same key)
        student.subjects[mapping.subject][mapping.scoreType] = cellValue ?? '';
        // Also store with term-prefixed key for precise term selection
        if (mapping.termGroup) {
          student.subjects[mapping.subject][mapping.termGroup + mapping.scoreType] = cellValue ?? '';
        }
      }
      
      // Fill SUPW — pick the right column based on available data
      if (supwTerm1Col >= 0) {
        // Store all three SUPW term values for the PDF generator to pick
        student.supw = String(row[supwTerm1Col] ?? '').trim();
        // Store term2 and final in extras for the PDF generator
        if (supwTerm2Col >= 0) student.extras['supw_term2'] = String(row[supwTerm2Col] ?? '').trim();
        if (supwFinalCol >= 0) student.extras['supw_final'] = String(row[supwFinalCol] ?? '').trim();
      } else if (supwCol >= 0) {
        student.supw = String(row[supwCol] ?? '').trim();
      }
      if (rankCol >= 0) student.rank = String(row[rankCol] ?? '').trim();
      if (remarkCol >= 0) student.overallRemarks = String(row[remarkCol] ?? '').trim();
      
      // Fill attendance
      if (attendanceStartCol >= 0) {
        student.attendance = parseAttendance(headerRows, row, attendanceStartCol, attendanceEndCol);
      }
      
      // Fill co-scholastic grades
      if (coScholasticStartCol >= 0) {
        student.coScholastic = parseGradedSection(
          headerRows, row, coScholasticStartCol, coScholasticEndCol,
          CO_SCHOLASTIC_MAP, 'FINAL' // default to FINAL to get term 2 grades; term selection is done at render time
        );
      }
      
      // Fill discipline grades
      if (disciplineStartCol >= 0) {
        student.discipline = parseGradedSection(
          headerRows, row, disciplineStartCol, disciplineEndCol,
          DISCIPLINE_MAP, 'FINAL'
        );
      }

      students.push(student);
    }

    // Add validation warnings for sheets with no students or no subjects detected
    if (students.length === 0) {
      sheetErrors.push({ sheet: sheetName, message: `Sheet "${sheetName}" has no student data rows.`, severity: 'warning' });
    }
    if (subjectNames.length === 0 && students.length > 0) {
      sheetErrors.push({ sheet: sheetName, message: `Sheet "${sheetName}" has students but no subjects detected. Check header format.`, severity: 'warning' });
    }

    sheets.push({
      sheetName, className: sheetName,
      headers: headerRows[0] || [],
      subjectNames, scoreTypes: Array.from(scoreTypesSet),
      columnMappings, metadataColumns,
      students,
      rawData: rawRows.map(r => (r || []).map(v => v ?? '') as (string | number)[]),
      errors: sheetErrors,
    });

    errors.push(...sheetErrors);
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { fileName, sheets, errors, isValid: !hasErrors && sheets.length > 0 };
}
