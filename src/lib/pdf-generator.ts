import jsPDF from 'jspdf';
import type { ParsedWorkbook, ResultType, StudentData } from './types';
import { getGrade } from './grading';

function formatDisplayValue(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    return Math.round(val).toString();
  }
  const str = String(val);
  const num = parseFloat(str);
  if (!isNaN(num) && str === String(num)) {
    return Math.round(num).toString();
  }
  return str;
}

function getSupwGrade(marksStr: string | number | undefined | null): string {
  if (marksStr === undefined || marksStr === null || marksStr === '') return '';
  const marks = Number(marksStr);
  if (isNaN(marks)) return String(marksStr);
  if (marks > 90) return 'A+';
  if (marks > 80) return 'A';
  if (marks > 70) return 'B+';
  if (marks > 60) return 'B';
  if (marks > 50) return 'C+';
  if (marks > 40) return 'C';
  if (marks > 33) return 'D';
  if (marks > 20) return 'E';
  return 'F';
}

/**
 * Grading scale for Additional Subjects (out of 50 marks).
 * 46–50 → A+, 41–45 → A, 36–40 → B+, 31–35 → B,
 * 26–30 → C+, 21–25 → C, 17–20 → D, 11–16 → E, 0–10 → F
 */
function getGradeFor50(marks: number): string {
  if (isNaN(marks) || marks < 0) return 'F';
  if (marks >= 46) return 'A+';
  if (marks >= 41) return 'A';
  if (marks >= 36) return 'B+';
  if (marks >= 31) return 'B';
  if (marks >= 26) return 'C+';
  if (marks >= 21) return 'C';
  if (marks >= 17) return 'D';
  if (marks >= 11) return 'E';
  return 'F';
}

const ADDITIONAL_SUBJECT_PATTERNS = [
  /^computer$/i,
  /^g\.?\s*k\.?$/i,                    // G.K / GK
  /^gk$/i,                             // GK
  /^hindi[\s-]*rhymes?$/i,
  /^english[\s-]*rhymes?$/i,
  /^engligh[\s-]*rhymes?$/i,           // UKG typo as-is in Excel
  /^conversation$/i,
  /^drawing$/i,
  /^moral\s*science$/i,
  /^m\.?\s*sc\.?$/i,                   // M. SC. (LKG / UKG)
];

function isAdditionalSubject(name: string): boolean {
  return ADDITIONAL_SUBJECT_PATTERNS.some(p => p.test(name.trim()));
}

const CO_SCHOLASTIC_ITEMS = [
  'Work education',
  'Art Education',
  'Health and Physical Education',
  'Scientific Skills',
  'Thinking Skill',
  'Social Skill',
  'Yoga /NCC',
];

const DISCIPLINE_ITEMS = [
  'Regularity and punctuality',
  'Sincerity',
  'Behaviour and Values',
  'Respectfulness of Rules and Regulations',
  'Attitude Towards Teachers',
  'Attitude towards classmates',
  'Attitude Towards society',
];

/**
 * Compute a student's total for the requested term (mirrors the same lookup
 * logic used in renderSubjectTable so ranks are consistent with displayed marks).
 */
function computeStudentTermTotal(
  student: StudentData,
  subjectNames: string[],
  resultType: ResultType
): number {
  let total = 0;
  for (const subject of subjectNames) {
    const marks = student.subjects[subject] || {};
    const isOral = /oral/i.test(subject);
    let termTotal = 0;
    if (isOral) {
      const pt  = parseFloat(String(resultType === 'FIRST_TERM' ? (marks['1T_PT']  || marks['PT']  || '') : (marks['2T_PT']  || marks['PT']  || ''))) || 0;
      const sa  = parseFloat(String(resultType === 'FIRST_TERM' ? (marks['1T_SA-I'] || marks['SA-I'] || marks['SA'] || '') : (marks['2T_SA-II'] || marks['SA-II'] || marks['SA'] || ''))) || 0;
      termTotal = pt + sa;
    } else {
      termTotal = parseFloat(String(
        resultType === 'FIRST_TERM'
          ? (marks['1T_1st Term'] || marks['1T_Total'] || marks['1st Term'] || marks['Total'] || marks['1T_SA-I'] || marks['SA-I'] || marks['SA'] || '')
          : (marks['2T_2nd Term'] || marks['2T_Total'] || marks['2nd Term'] || marks['Total'] || marks['2T_SA-II'] || marks['SA-II'] || marks['SA'] || '')
      )) || 0;
    }
    if (termTotal > 0) total += termTotal;
  }
  return total;
}

export async function generateResultsPDF(
  workbook: ParsedWorkbook,
  resultType: ResultType,
  sessionYear: string
): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210;
  const ML = 8;
  const MR = 8;
  const CW = PW - ML - MR;

  let schoolLogo: string | null = null;
  let principalSign: string | null = null;
  try {
    const r = await fetch('/logo2.jpg');
    if (r.ok) schoolLogo = await blobToBase64(await r.blob());
  } catch {}
  try {
    const r = await fetch('/logo1.png');
    if (r.ok) principalSign = await blobToBase64(await r.blob());
  } catch {}

  let firstPage = true;

  for (const sheet of workbook.sheets) {
    // ── Compute ranks for this class before rendering ──────────────────────
    // The rank formula cells in Excel depend on 2nd-term totals and error out
    // when only 1st-term data is present, so we compute rank here instead.
    const validStudents = sheet.students.filter(s => s.name || s.rollNo);
    const rankedList = validStudents
      .map(s => ({ student: s, total: computeStudentTermTotal(s, sheet.subjectNames, resultType) }))
      .sort((a, b) => b.total - a.total);

    let rankCounter = 1;
    for (let i = 0; i < rankedList.length; i++) {
      // Students with the same total share the same rank
      if (i > 0 && rankedList[i].total < rankedList[i - 1].total) {
        rankCounter = i + 1;
      }
      // Only assign a rank if the student has any marks (not fully absent)
      rankedList[i].student.rank = rankedList[i].total > 0 ? String(rankCounter) : (rankedList[i].student.rank || '');
    }
    // ──────────────────────────────────────────────────────────────────────

    for (const student of validStudents) {
      if (!firstPage) doc.addPage();
      firstPage = false;

      renderStudentResult(doc, student, sheet.subjectNames, sheet.scoreTypes,
        resultType, sessionYear, PW, ML, CW, schoolLogo, principalSign);
    }
  }

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function renderStudentResult(
  doc: jsPDF,
  student: StudentData,
  subjectNames: string[],
  scoreTypes: string[],
  resultType: ResultType,
  sessionYear: string,
  PW: number, ML: number, CW: number,
  schoolLogo: string | null, principalSign: string | null
) {
  let y = 8;
  const examLabel = resultType === 'FIRST_TERM' ? 'SA-I (Term I)' : 'SA-II (Term II)';

  if (schoolLogo) {
    try { doc.addImage(schoolLogo, 'JPEG', ML + 1.5, y + 0.5, 18, 18); } catch {}
    try { doc.addImage(schoolLogo, 'JPEG', PW - ML - 19.5, y + 0.5, 18, 18); } catch {}
  }

  // 1. School Header
  doc.setFontSize(14.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RAMKRISHNA ANGLO VEDIC PUBLIC SCHOOL', PW / 2, y + 5, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('KOLEBIRA (NEAR MOUSIBARI), SIMDEGA (JHARKHAND)', PW / 2, y + 10.5, { align: 'center' });
  doc.text('Ph. +91 7004187765, Email – ravschool@gmail.com', PW / 2, y + 15.5, { align: 'center' });

  y += 20;
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORT – CARD', PW / 2, y + 2.5, { align: 'center' });
  y += 6;

  // 2. Exam and Year bar
  const rh = 6.8;
  const t1cols = [CW * 0.16, CW * 0.34, CW * 0.14, CW * 0.36];
  doc.rect(ML, y, t1cols[0], rh);
  doc.rect(ML + t1cols[0], y, t1cols[1], rh);
  doc.rect(ML + t1cols[0] + t1cols[1], y, t1cols[2], rh);
  doc.rect(ML + t1cols[0] + t1cols[1] + t1cols[2], y, t1cols[3], rh);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Examination :', ML + 3, y + 4.6);
  doc.setFont('helvetica', 'normal');
  doc.text(examLabel, ML + t1cols[0] + 3.5, y + 4.6);
  doc.setFont('helvetica', 'bold');
  doc.text('Year :', ML + t1cols[0] + t1cols[1] + 3, y + 4.6);
  doc.setFont('helvetica', 'normal');
  doc.text(sessionYear, ML + t1cols[0] + t1cols[1] + t1cols[2] + 3.5, y + 4.6);
  y += rh + 2.5;

  // 3. Student Profile Info Box
  const leftW = CW * 0.64;
  const rightW = CW * 0.36;
  const infoH = 24;

  doc.rect(ML, y, leftW, infoH);
  doc.rect(ML + leftW, y, rightW, infoH);

  doc.setFontSize(8.5);
  const lx = ML + 3.5;
  const rx = ML + leftW + 3.5;
  const valOffset = 32;
  const rValOffset = 21;

  doc.setFont('helvetica', 'bold');
  doc.text("Student's Name :", lx, y + 5.2);
  doc.setFont('helvetica', 'normal');
  doc.text(student.name || '', lx + valOffset, y + 5.2);

  doc.setFont('helvetica', 'bold');
  doc.text("Father's Name :", lx, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(student.fatherName || '', lx + valOffset, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text("Mother's Name :", lx, y + 16.8);
  doc.setFont('helvetica', 'normal');
  doc.text(student.motherName || '', lx + valOffset, y + 16.8);

  doc.setFont('helvetica', 'bold');
  doc.text('Date of Birth :', lx, y + 22.5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.dob || '', lx + valOffset, y + 22.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Class :', rx, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.class || '', rx + rValOffset, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Roll No. :', rx, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(String(student.rollNo || ''), rx + rValOffset, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Adm. No. :', rx, y + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.text(String(student.admNo || ''), rx + rValOffset, y + 20.5);

  y += infoH + 2.5;

  const cellH = 5.8;

  const mainSubjects = subjectNames.filter(s => !isAdditionalSubject(s));
  const additionalSubjects = subjectNames.filter(s => isAdditionalSubject(s));

  // 4. Proportional Table Columns
  let subColW: number;
  let scoreCols: { label: string; key: string; w: number; maxMarks?: string }[];
  
  if (resultType === 'FIRST_TERM') {
    subColW = 50;
    const numCols = [
      { label: 'PT', key: 'PT', w: 22, maxMarks: '20' },
      { label: 'NB', key: 'NB', w: 22, maxMarks: '10' },
      { label: 'SEA', key: 'SEA', w: 22, maxMarks: '10' },
      { label: 'SA-I', key: 'SA-I', w: 26, maxMarks: '60' },
      { label: 'TOTAL', key: 'Total', w: 28, maxMarks: '100' },
      { label: 'Grade', key: 'Grade', w: 24 },
    ];
    scoreCols = numCols;
  } else {
    subColW = 40;
    const remW = CW - subColW;
    const colW = remW / 10;
    scoreCols = [
      { label: 'PT', key: 'PT', w: colW, maxMarks: '20' },
      { label: 'NB', key: 'NB', w: colW, maxMarks: '10' },
      { label: 'SEA', key: 'SEA', w: colW, maxMarks: '10' },
      { label: 'SA-II', key: 'SA-II', w: colW, maxMarks: '60' },
      { label: 'TOTAL', key: 'Total', w: colW, maxMarks: '100' },
      { label: '80%', key: '80%', w: colW },
      { label: 'Term 1', key: 'Term1Raw', w: colW, maxMarks: '100' },
      { label: '20%', key: '20%', w: colW },
      { label: '80+20', key: 'Grand Total', w: colW },
      { label: 'Grade', key: 'Grade', w: colW },
    ];
  }

  let addScoreCols: { label: string; key: string; w: number; maxMarks?: string }[];
  if (resultType === 'FIRST_TERM') {
    const remW = CW - subColW;
    const c1 = Math.round(remW * 0.35);
    const c2 = Math.round(remW * 0.35);
    const c3 = remW - c1 - c2;
    addScoreCols = [
      { label: 'SA-I', key: 'SA-I', w: c1, maxMarks: '50' },
      { label: 'TOTAL', key: 'Total', w: c2, maxMarks: '50' },
      { label: 'Grade', key: 'Grade', w: c3 },
    ];
  } else {
    const remW = CW - subColW;
    const colW = remW / 7;
    addScoreCols = [
      { label: 'SA-II', key: 'SA-II', w: colW, maxMarks: '50' },
      { label: 'TOTAL', key: 'Total', w: colW, maxMarks: '50' },
      { label: '80%', key: '80%', w: colW },
      { label: 'Term 1', key: 'Term1Raw', w: colW, maxMarks: '50' },
      { label: '20%', key: '20%', w: colW },
      { label: '80+20', key: 'Grand Total', w: colW },
      { label: 'Grade', key: 'Grade', w: colW },
    ];
  }

  function renderSubjectTable(
    subjects: string[],
    cols: { label: string; key: string; w: number; maxMarks?: string }[],
    title: string,
    isAdditional: boolean,
    maxMarksTotal: number
  ): { y: number; totalObtained: number; totalMax: number; subjectCount: number } {
    const gradeFromTotal = (total: number): string =>
      isAdditional ? getGradeFor50(total) : getGrade(total);
    let tblTotalObtained = 0;
    let tblTotalMax = 0;
    let tblSubjectCount = 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setFillColor(235, 238, 242);
    doc.rect(ML, y, CW, cellH, 'FD');
    doc.text(title, PW / 2, y + 4.1, { align: 'center' });
    y += cellH;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);

    if (resultType === 'FINAL' && !isAdditional) {
      doc.rect(ML, y, subColW, cellH * 2);
      doc.text('Subject', ML + 3, y + cellH + 0.5);
      
      const termIIW = cols.slice(0, 6).reduce((s, c) => s + c.w, 0);
      let hx = ML + subColW;
      doc.rect(hx, y, termIIW, cellH);
      doc.text('TERM II', hx + termIIW / 2, y + 4.1, { align: 'center' });
      hx += termIIW;
      
      const termIW = cols[6].w + cols[7].w;
      doc.rect(hx, y, termIW, cellH);
      doc.text('TERM I', hx + termIW / 2, y + 4.1, { align: 'center' });
      hx += termIW;
      
      doc.rect(hx, y, cols[8].w, cellH);
      doc.text('TOTAL', hx + cols[8].w / 2, y + 4.1, { align: 'center' });
      hx += cols[8].w;
      
      doc.rect(hx, y, cols[9].w, cellH);
      doc.text('Grade', hx + cols[9].w / 2, y + 4.1, { align: 'center' });
      y += cellH;

      hx = ML + subColW;
      for (const col of cols) {
        doc.rect(hx, y, col.w, cellH);
        const headerText = col.maxMarks ? `${col.label} (${col.maxMarks})` : col.label;
        doc.text(headerText, hx + col.w / 2, y + 4.1, { align: 'center' });
        hx += col.w;
      }
      y += cellH;
    } else if (resultType === 'FINAL' && isAdditional) {
      doc.rect(ML, y, subColW, cellH * 2);
      doc.text('Subject', ML + 3, y + cellH + 0.5);
      
      const termIIW = cols.slice(0, 3).reduce((s, c) => s + c.w, 0);
      let hx = ML + subColW;
      doc.rect(hx, y, termIIW, cellH);
      doc.text('TERM II', hx + termIIW / 2, y + 4.1, { align: 'center' });
      hx += termIIW;
      
      const termIW = cols[3].w + cols[4].w;
      doc.rect(hx, y, termIW, cellH);
      doc.text('TERM I', hx + termIW / 2, y + 4.1, { align: 'center' });
      hx += termIW;
      
      doc.rect(hx, y, cols[5].w, cellH);
      doc.text('TOTAL', hx + cols[5].w / 2, y + 4.1, { align: 'center' });
      hx += cols[5].w;
      
      doc.rect(hx, y, cols[6].w, cellH);
      doc.text('Grade', hx + cols[6].w / 2, y + 4.1, { align: 'center' });
      y += cellH;

      hx = ML + subColW;
      for (const col of cols) {
        doc.rect(hx, y, col.w, cellH);
        const headerText = col.maxMarks ? `${col.label} (${col.maxMarks})` : col.label;
        doc.text(headerText, hx + col.w / 2, y + 4.1, { align: 'center' });
        hx += col.w;
      }
      y += cellH;
    } else {
      doc.rect(ML, y, subColW, cellH * 2);
      doc.text('Subject', ML + 3, y + cellH + 0.5);

      let hx = ML + subColW;
      for (const col of cols) {
        doc.rect(hx, y, col.w, cellH * 2);
        const headerText = col.maxMarks ? `${col.label} (${col.maxMarks})` : col.label;
        doc.text(headerText, hx + col.w / 2, y + cellH + 0.5, { align: 'center' });
        hx += col.w;
      }
      y += cellH * 2;
    }

    for (const subject of subjects) {
      const marks = student.subjects[subject] || {};

      doc.rect(ML, y, subColW, cellH);
      const displayName = subject.length > 25 ? subject.substring(0, 23) + '..' : subject;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(displayName, ML + 3, y + 4.1);

      const termPrefix = resultType === 'FIRST_TERM' ? '1T_' : '2T_';

      const lookup = (key: string): string | number | undefined => {
        if (key === 'Total') {
          if (resultType === 'FIRST_TERM') {
            return marks['1T_1st Term'] || marks['1T_Total'] || marks['1st Term'] || marks['Total'];
          } else {
            return marks['2T_2nd Term'] || marks['2T_Total'] || marks['2nd Term'] || marks['Total'];
          }
        }
        const prefixed = marks[termPrefix + key];
        if (prefixed !== undefined && prefixed !== '') return prefixed;
        return marks[key];
      };

      const isOralSubject = /oral/i.test(subject);

      let mainTermTotal = parseFloat(String(
        resultType === 'FIRST_TERM'
          ? (marks['1T_1st Term'] || marks['1T_Total'] || marks['1st Term'] || marks['Total'] || marks['1T_SA-I'] || marks['SA-I'] || marks['SA'] || '')
          : (marks['2T_2nd Term'] || marks['2T_Total'] || marks['2nd Term'] || marks['Total'] || marks['2T_SA-II'] || marks['SA-II'] || marks['SA'] || '')
      )) || 0;

      let termITotal = parseFloat(String(
        marks['1T_1st Term'] || marks['1T_Total'] ||
        marks['TERM I'] || marks['Term I'] || marks['Term 1'] || marks['SA-I Total'] || marks['1st Term'] || marks['1T_SA-I'] || marks['SA-I'] || marks['SA'] || ''
      )) || 0;

      if (isOralSubject) {
        const term2PT = parseFloat(String(marks['2T_PT'] || marks['PT'] || '')) || 0;
        const term2SA = parseFloat(String(marks['2T_SA-II'] || marks['2T_SA'] || marks['SA-II'] || marks['SA-I'] || marks['SA'] || '')) || 0;
        const term1PT = parseFloat(String(marks['1T_PT'] || marks['PT'] || '')) || 0;
        const term1SA = parseFloat(String(marks['1T_SA-I'] || marks['1T_SA'] || marks['SA-I'] || marks['SA'] || '')) || 0;
        
        mainTermTotal = resultType === 'FIRST_TERM' ? (term1PT + term1SA) : (term2PT + term2SA);
        termITotal = term1PT + term1SA;
      }

      const computed80 = resultType === 'FINAL' ? Math.round(mainTermTotal * 0.8) : 0;
      const computed20 = resultType === 'FINAL' ? Math.round(termITotal * 0.2) : 0;
      const computedGrandTotal = resultType === 'FINAL' ? computed80 + computed20 : 0;
      let sx = ML + subColW;
      for (const col of cols) {
        doc.rect(sx, y, col.w, cellH);

        let val: string | number | undefined = lookup(col.key);
        
        if (isOralSubject && (col.key === 'NB' || col.key === 'SEA')) {
          val = '-';
        }
        
        if (val === undefined && col.key === 'SA-II') {
          val = lookup('SA-I') ?? lookup('SA') ?? marks['SA-II'];
        }
        if (val === undefined && col.key === 'SA-I') {
          val = lookup('SA') ?? lookup('SA-I') ?? marks['SA-II'];
        }

        if (resultType === 'FINAL') {
          if (col.key === '80%') {
            val = mainTermTotal > 0 ? computed80 : '';
          } else if (col.key === 'Term1Raw') {
            val = termITotal > 0 ? termITotal : '';
          } else if (col.key === '20%') {
            val = termITotal > 0 ? computed20 : '';
          } else if (col.key === 'Grand Total') {
            val = (mainTermTotal > 0 || termITotal > 0) ? computedGrandTotal : '';
          }
        }
        
        if (col.key === 'Grade') {
          if (resultType === 'FINAL') {
            val = computedGrandTotal > 0 ? gradeFromTotal(computedGrandTotal) : (val ?? '');
          } else {
            val = mainTermTotal > 0 ? gradeFromTotal(mainTermTotal) : (val ?? '');
          }
        }

        const displayVal = formatDisplayValue(val);
        const isHighlight = col.key === 'Total' || col.key === 'Grade' || col.key === 'Grand Total';
        doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
        doc.setFontSize(isHighlight ? 8.2 : 7.8);
        doc.text(displayVal, sx + col.w / 2, y + 4.1, { align: 'center' });
        sx += col.w;
      }

      if (resultType === 'FINAL') {
        if (computedGrandTotal > 0) {
          tblTotalObtained += computedGrandTotal;
          tblTotalMax += maxMarksTotal;
          tblSubjectCount++;
        }
      } else {
        if (mainTermTotal > 0) {
          tblTotalObtained += mainTermTotal;
          tblTotalMax += maxMarksTotal;
          tblSubjectCount++;
        }
      }

      y += cellH;
    }

    return { y, totalObtained: tblTotalObtained, totalMax: tblTotalMax, subjectCount: tblSubjectCount };
  }

  let totalObtained = 0;
  let totalMax = 0;
  let subjectCount = 0;

  if (mainSubjects.length > 0) {
    const r = renderSubjectTable(mainSubjects, scoreCols, 'SCHOLASTIC AREAS (ACADEMIC ACHIEVEMENTS)', false, 100);
    y = r.y;
    totalObtained += r.totalObtained;
    totalMax += r.totalMax;
    subjectCount += r.subjectCount;
  }

  if (additionalSubjects.length > 0) {
    y += 2;
    const r = renderSubjectTable(additionalSubjects, addScoreCols, 'ADDITIONAL SUBJECTS', true, 50);
    y = r.y;
    totalObtained += r.totalObtained;
    totalMax += r.totalMax;
    subjectCount += r.subjectCount;
  }

  // 5. Grading scale note
  y += 1.8;
  doc.setFontSize(5.8);
  doc.setFont('helvetica', 'italic');
  doc.rect(ML, y, CW, cellH - 0.8);
  doc.text(
    'Eight Point Grading Scale : A+(91%–100%), A(81%–90%), B+(71%–80%), B(61%–70%), C+(51%–60%), C(41%–50%), D(33%–40%), E+(21%–33%), E(11%–20%), F(0%–10%) (0 Marks for Absentee)',
    PW / 2, y + 3.5, { align: 'center', maxWidth: CW - 4 }
  );
  y += cellH - 0.8 + 2;

  // 6. Overall Performance Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setFillColor(235, 238, 242);
  doc.rect(ML, y, CW, cellH, 'FD');
  doc.text('Overall Performance', PW / 2, y + 4.1, { align: 'center' });
  y += cellH;

  const percentage = subjectCount > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  const overallGrade = getGrade(percentage);

  const opLabels = ['TOTAL MARKS', 'MARKS OBTD.', '%', 'SUPW', 'GRADE', 'RANK', 'REMARKS'];
  
  let generatedRemarks = '';
  if (percentage >= 91) generatedRemarks = 'EXCELLENT';
  else if (percentage >= 81) generatedRemarks = 'VERY GOOD';
  else if (percentage >= 71) generatedRemarks = 'GOOD';
  else if (percentage >= 61) generatedRemarks = 'FAIR';
  else if (percentage >= 51) generatedRemarks = 'SATISFACTORY';
  else if (percentage >= 41) generatedRemarks = 'AVERAGE';
  else if (percentage >= 33) generatedRemarks = 'MARGINAL';
  else if (percentage > 0) generatedRemarks = 'NEEDS IMPROVEMENT';

  const opValues = [
    String(totalMax || ''),
    formatDisplayValue(totalObtained),
    subjectCount > 0 ? percentage + '%' : '',
    getSupwGrade(
      resultType === 'FINAL'
        ? (student.extras['supw_final'] || student.supw)
        : student.supw
    ),
    overallGrade,
    student.rank || '',
    generatedRemarks,
  ];

  const opColsW = [26, 26, 20, 20, 20, 20, CW - (26 + 26 + 20 + 20 + 20 + 20)];
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  let curOpX = ML;
  for (let i = 0; i < opLabels.length; i++) {
    const w = opColsW[i];
    doc.rect(curOpX, y, w, cellH);
    doc.text(opLabels[i], curOpX + w / 2, y + 4.1, { align: 'center' });
    curOpX += w;
  }
  y += cellH;

  curOpX = ML;
  for (let i = 0; i < opValues.length; i++) {
    const w = opColsW[i];
    doc.rect(curOpX, y, w, cellH);
    doc.setFont('helvetica', (i === 1 || i === 2 || i === 4 || i === 6) ? 'bold' : 'normal');
    doc.setFontSize(7.8);
    doc.text(opValues[i], curOpX + w / 2, y + 4.1, { align: 'center' });
    curOpX += w;
  }
  y += cellH + 2;

  // 7. Attendance Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setFillColor(235, 238, 242);
  doc.rect(ML, y, CW, cellH, 'FD');
  doc.text('Attendance', PW / 2, y + 4.1, { align: 'center' });
  y += cellH;

  const attLabels = ['Total Working Days', 'Present', '%', 'Comment'];
  const attColsW = [35, 35, 35, CW - 105];
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  let curAttX = ML;
  for (let i = 0; i < 4; i++) {
    const w = attColsW[i];
    doc.rect(curAttX, y, w, cellH);
    doc.text(attLabels[i], curAttX + w / 2, y + 4.1, { align: 'center' });
    curAttX += w;
  }
  y += cellH;

  const attValues = [
    student.attendance?.workingDays || '',
    student.attendance?.daysAttended || '',
    student.attendance?.percentage || '',
    student.attendance?.remarks || '',
  ];
  curAttX = ML;
  for (let i = 0; i < 4; i++) {
    const w = attColsW[i];
    doc.rect(curAttX, y, w, cellH);
    doc.setFont('helvetica', i === 3 ? 'bold' : 'normal');
    doc.setFontSize(7.8);
    doc.text(attValues[i], curAttX + w / 2, y + 4.1, { align: 'center' });
    curAttX += w;
  }
  y += cellH + 2;

  // 8. Co-Scholastic & Discipline
  const halfW = CW / 2;
  const coItemW = halfW * 0.78;
  const coGradeW = halfW * 0.22;
  const coRowH = 5.2;

  const termLabel = resultType === 'FIRST_TERM' ? 'Term 1' : 'Term 2';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.setFillColor(235, 238, 242);
  doc.rect(ML, y, halfW, cellH + 1.2, 'FD');
  doc.rect(ML + halfW, y, halfW, cellH + 1.2, 'FD');
  doc.text('Co – Scholastic Areas (3 Point Grading Scale A, B, C)', ML + halfW / 2, y + 4.6, { align: 'center' });
  doc.text('Discipline (3 Point Grading Scale A, B, C)', ML + halfW + halfW / 2, y + 4.6, { align: 'center' });
  y += cellH + 1.2;

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.rect(ML, y, coItemW, cellH);
  doc.rect(ML + coItemW, y, coGradeW, cellH);
  doc.rect(ML + halfW, y, coItemW, cellH);
  doc.rect(ML + halfW + coItemW, y, coGradeW, cellH);
  doc.text('Activity / Skill', ML + 3, y + 4.1);
  doc.text(termLabel, ML + coItemW + coGradeW / 2, y + 4.1, { align: 'center' });
  doc.text('Discipline Attribute', ML + halfW + 3, y + 4.1);
  doc.text(termLabel, ML + halfW + coItemW + coGradeW / 2, y + 4.1, { align: 'center' });
  y += cellH;

  const termPrefix = resultType === 'FIRST_TERM' ? '1T_' : '2T_';
  const maxRows = Math.max(CO_SCHOLASTIC_ITEMS.length, DISCIPLINE_ITEMS.length);
  for (let i = 0; i < maxRows; i++) {
    doc.rect(ML, y, coItemW, coRowH);
    doc.rect(ML + coItemW, y, coGradeW, coRowH);
    doc.rect(ML + halfW, y, coItemW, coRowH);
    doc.rect(ML + halfW + coItemW, y, coGradeW, coRowH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);

    if (i < CO_SCHOLASTIC_ITEMS.length) {
      doc.text(CO_SCHOLASTIC_ITEMS[i], ML + 3, y + 3.7);
      const coGrade = student.coScholastic?.[termPrefix + CO_SCHOLASTIC_ITEMS[i]] || student.coScholastic?.[CO_SCHOLASTIC_ITEMS[i]] || '';
      if (coGrade) {
        doc.setFont('helvetica', 'bold');
        doc.text(coGrade, ML + coItemW + coGradeW / 2, y + 3.7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
      }
    }
    if (i < DISCIPLINE_ITEMS.length) {
      doc.text(DISCIPLINE_ITEMS[i], ML + halfW + 3, y + 3.7);
      const discGrade = student.discipline?.[termPrefix + DISCIPLINE_ITEMS[i]] || student.discipline?.[DISCIPLINE_ITEMS[i]] || '';
      if (discGrade) {
        doc.setFont('helvetica', 'bold');
        doc.text(discGrade, ML + halfW + coItemW + coGradeW / 2, y + 3.7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
      }
    }
    y += coRowH;
  }

  y += 2.8;

  // 9. Substantially Enlarged Signature Section (28 mm height)
  const sigW = CW / 3;
  const sigH = 28;

  doc.rect(ML, y, sigW, sigH);
  doc.rect(ML + sigW, y, sigW, sigH);
  doc.rect(ML + 2 * sigW, y, sigW, sigH);

  if (principalSign) {
    try {
      doc.addImage(principalSign, 'PNG', ML + 2 * sigW + (sigW - 38) / 2, y + 2.5, 38, 16.5);
    } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("Class Teacher's Signature", ML + sigW / 2, y + sigH - 3.5, { align: 'center' });
  doc.text("Parent's Signature", ML + sigW + sigW / 2, y + sigH - 3.5, { align: 'center' });
  doc.text("Principal's Signature", ML + 2 * sigW + sigW / 2, y + sigH - 3.5, { align: 'center' });
}

export function getResultFileName(resultType: ResultType, sessionYear: string): string {
  const prefix = resultType === 'FIRST_TERM' ? '1st_term_results' : 'final_results';
  const sanitizedYear = sessionYear.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${prefix}_${sanitizedYear}.pdf`;
}
