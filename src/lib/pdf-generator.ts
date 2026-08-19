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

const ADDITIONAL_SUBJECT_PATTERNS = [
  /^computer$/i,
  /^g\.?\s*k\.?$/i,
  /^hindi[\s-]*rhymes?$/i,
  /^english[\s-]*rhymes?$/i,
  /^conversation$/i,
  /^drawing$/i,
  /^moral\s*science$/i,
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
    for (const student of sheet.students) {
      if (!student.name && !student.rollNo) continue;

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
  let y = 6;
  const examLabel = resultType === 'FIRST_TERM' ? 'SA-I (Term I)' : 'SA-II (Term II)';

  if (schoolLogo) {
    try { doc.addImage(schoolLogo, 'JPEG', ML + 2, y, 16, 16); } catch {}
    try { doc.addImage(schoolLogo, 'JPEG', PW - ML - 18, y, 16, 16); } catch {}
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RAMKRISHNA ANGLO VEDIC PUBLIC SCHOOL', PW / 2, y + 5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('KOLEBIRA (NEAR MOUSIBARI)', PW / 2, y + 10, { align: 'center' });
  doc.text('SIMDEGA (JHARKHAND)', PW / 2, y + 14, { align: 'center' });
  doc.text('Ph. 91+ 7004187765, Email – ravschool@gmail.com', PW / 2, y + 18, { align: 'center' });

  y += 22;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORT – CARD', PW / 2, y, { align: 'center' });
  y += 5;

  const rh = 6;
  doc.setFontSize(7);

  const t1cols = [CW * 0.15, CW * 0.35, CW * 0.1, CW * 0.4];
  doc.rect(ML, y, t1cols[0], rh);
  doc.rect(ML + t1cols[0], y, t1cols[1], rh);
  doc.rect(ML + t1cols[0] + t1cols[1], y, t1cols[2], rh);
  doc.rect(ML + t1cols[0] + t1cols[1] + t1cols[2], y, t1cols[3], rh);

  doc.setFont('helvetica', 'bold');
  doc.text('Examination', ML + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(examLabel, ML + t1cols[0] + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.text('Year', ML + t1cols[0] + t1cols[1] + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(sessionYear, ML + t1cols[0] + t1cols[1] + t1cols[2] + 2, y + 4);
  y += rh;

  const leftW = CW * 0.65;
  const rightW = CW * 0.35;
  const infoH = 24;

  doc.rect(ML, y, leftW, infoH);
  doc.rect(ML + leftW, y, rightW, infoH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const lx = ML + 3;
  const rx = ML + leftW + 3;
  const valOffset = 28;
  const rValOffset = 16;

  doc.text("Student's Name :", lx, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.name || '', lx + valOffset, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.text("Father's Name :", lx, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(student.fatherName || '', lx + valOffset, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text("Mother's Name :", lx, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(student.motherName || '', lx + valOffset, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('Date of Birth :', lx, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(student.dob || '', lx + valOffset, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('Class :', rx, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.class || '', rx + rValOffset, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Roll No. :', rx, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(String(student.rollNo || ''), rx + rValOffset, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('Adm. No. :', rx, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.text(String(student.admNo || ''), rx + rValOffset, y + 17);

  y += infoH + 1;

  const cellH = 5;

  const mainSubjects = subjectNames.filter(s => !isAdditionalSubject(s));
  const additionalSubjects = subjectNames.filter(s => isAdditionalSubject(s));

  const subColW = 28;
  let scoreCols: { label: string; key: string; w: number; maxMarks?: string }[];
  
  if (resultType === 'FIRST_TERM') {
    const remW = CW - subColW;
    const colW = remW / 6;
    scoreCols = [
      { label: 'PT', key: 'PT', w: colW, maxMarks: '20' },
      { label: 'NB', key: 'NB', w: colW, maxMarks: '10' },
      { label: 'SEA', key: 'SEA', w: colW, maxMarks: '10' },
      { label: 'SA-I', key: 'SA-I', w: colW, maxMarks: '60' },
      { label: 'TOTAL', key: 'Total', w: colW, maxMarks: '100' },
      { label: 'Grade', key: 'Grade', w: colW },
    ];
  } else {
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
    const colW = remW / 3;
    addScoreCols = [
      { label: 'SA-I', key: 'SA-I', w: colW, maxMarks: '50' },
      { label: 'TOTAL', key: 'Total', w: colW, maxMarks: '50' },
      { label: 'Grade', key: 'Grade', w: colW },
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
    let tblTotalObtained = 0;
    let tblTotalMax = 0;
    let tblSubjectCount = 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setFillColor(230, 230, 230);
    doc.rect(ML, y, CW, cellH + 1, 'FD');
    doc.text(title, PW / 2, y + 3.5, { align: 'center' });
    y += cellH + 1;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);

    if (resultType === 'FINAL' && !isAdditional) {
      doc.rect(ML, y, subColW, cellH * 2);
      doc.text('Subject', ML + 2, y + cellH);
      
      const termIIW = cols.slice(0, 6).reduce((s, c) => s + c.w, 0);
      let hx = ML + subColW;
      doc.rect(hx, y, termIIW, cellH);
      doc.text('TERM II', hx + termIIW / 2, y + 3.5, { align: 'center' });
      hx += termIIW;
      
      const termIW = cols[6].w + cols[7].w;
      doc.rect(hx, y, termIW, cellH);
      doc.text('TERM I', hx + termIW / 2, y + 3.5, { align: 'center' });
      hx += termIW;
      
      doc.rect(hx, y, cols[8].w, cellH);
      doc.text('TOTAL', hx + cols[8].w / 2, y + 3.5, { align: 'center' });
      hx += cols[8].w;
      
      doc.rect(hx, y, cols[9].w, cellH);
      doc.text('Grade', hx + cols[9].w / 2, y + 3.5, { align: 'center' });
      y += cellH;

      hx = ML + subColW;
      for (const col of cols) {
        doc.rect(hx, y, col.w, cellH);
        const headerText = col.maxMarks ? `${col.label} (${col.maxMarks})` : col.label;
        doc.text(headerText, hx + col.w / 2, y + 3.5, { align: 'center' });
        hx += col.w;
      }
      y += cellH;
    } else if (resultType === 'FINAL' && isAdditional) {
      doc.rect(ML, y, subColW, cellH * 2);
      doc.text('Subject', ML + 2, y + cellH);
      
      const termIIW = cols.slice(0, 3).reduce((s, c) => s + c.w, 0);
      let hx = ML + subColW;
      doc.rect(hx, y, termIIW, cellH);
      doc.text('TERM II', hx + termIIW / 2, y + 3.5, { align: 'center' });
      hx += termIIW;
      
      const termIW = cols[3].w + cols[4].w;
      doc.rect(hx, y, termIW, cellH);
      doc.text('TERM I', hx + termIW / 2, y + 3.5, { align: 'center' });
      hx += termIW;
      
      doc.rect(hx, y, cols[5].w, cellH);
      doc.text('TOTAL', hx + cols[5].w / 2, y + 3.5, { align: 'center' });
      hx += cols[5].w;
      
      doc.rect(hx, y, cols[6].w, cellH);
      doc.text('Grade', hx + cols[6].w / 2, y + 3.5, { align: 'center' });
      y += cellH;

      hx = ML + subColW;
      for (const col of cols) {
        doc.rect(hx, y, col.w, cellH);
        const headerText = col.maxMarks ? `${col.label} (${col.maxMarks})` : col.label;
        doc.text(headerText, hx + col.w / 2, y + 3.5, { align: 'center' });
        hx += col.w;
      }
      y += cellH;
    } else {
      doc.rect(ML, y, subColW, cellH * 2);
      doc.text('Subject', ML + 2, y + cellH);

      let hx = ML + subColW;
      for (const col of cols) {
        doc.rect(hx, y, col.w, cellH * 2);
        const headerText = col.maxMarks ? `${col.label} (${col.maxMarks})` : col.label;
        doc.text(headerText, hx + col.w / 2, y + cellH, { align: 'center' });
        hx += col.w;
      }
      y += cellH * 2;
    }

    doc.setFontSize(6);

    for (const subject of subjects) {
      const marks = student.subjects[subject] || {};

      doc.rect(ML, y, subColW, cellH);
      const displayName = subject.length > 16 ? subject.substring(0, 14) + '..' : subject;
      doc.setFont('helvetica', 'normal');
      doc.text(displayName, ML + 2, y + 3.5);

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
          ? (marks['1T_1st Term'] || marks['1T_Total'] || marks['1st Term'] || marks['Total'] || '')
          : (marks['2T_2nd Term'] || marks['2T_Total'] || marks['2nd Term'] || marks['Total'] || '')
      )) || 0;

      let termITotal = parseFloat(String(
        marks['1T_1st Term'] || marks['1T_Total'] ||
        marks['TERM I'] || marks['Term I'] || marks['Term 1'] || marks['SA-I Total'] || marks['1st Term'] || ''
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
          val = '';
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
            val = computedGrandTotal > 0 ? getGrade(computedGrandTotal) : '';
          } else {
            val = mainTermTotal > 0 ? getGrade(mainTermTotal) : '';
          }
        }

        const displayVal = formatDisplayValue(val);
        doc.text(displayVal, sx + col.w / 2, y + 3.5, { align: 'center' });
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
    const r = renderSubjectTable(additionalSubjects, addScoreCols, 'ADDITIONAL SUBJECTS', true, 50);
    y = r.y;
    totalObtained += r.totalObtained;
    totalMax += r.totalMax;
    subjectCount += r.subjectCount;
  }

  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'italic');
  doc.rect(ML, y, CW, cellH);
  doc.text(
    'Eight Point Grading Scale : A+(91%–100%), A(81%–90%), B+(71%–80%), B(61%–70%), C+(51%–60%), C(41%–50%), D(33%–40%), E+(21%–33%), E(11%–20%), F(0%–10%) (0 Marks for Absentee)',
    PW / 2, y + 3.5, { align: 'center', maxWidth: CW - 4 }
  );
  y += cellH;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setFillColor(230, 230, 230);
  doc.rect(ML, y, CW, cellH, 'FD');
  doc.text('Overall Performance', PW / 2, y + 3.5, { align: 'center' });
  y += cellH;

  const percentage = subjectCount > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  const overallGrade = getGrade(percentage);

  const opLabels = ['TOTAL MARKS', 'MARKS OBTD.', '%', 'SUPW', 'GRADE', 'RANK', 'REMARKS'];
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
    student.overallRemarks || '',
  ];

  const opW = CW / opLabels.length;
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  for (let i = 0; i < opLabels.length; i++) {
    doc.rect(ML + i * opW, y, opW, cellH);
    doc.text(opLabels[i], ML + i * opW + opW / 2, y + 3.5, { align: 'center' });
  }
  y += cellH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  for (let i = 0; i < opValues.length; i++) {
    doc.rect(ML + i * opW, y, opW, cellH);
    doc.text(opValues[i], ML + i * opW + opW / 2, y + 3.5, { align: 'center' });
  }
  y += cellH + 1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setFillColor(230, 230, 230);
  doc.rect(ML, y, CW, cellH, 'FD');
  doc.text('Attendance', PW / 2, y + 3.5, { align: 'center' });
  y += cellH;

  const attLabels = ['Total Working Days', 'Present', '%', 'Comment'];
  const attW = CW / 4;
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  for (let i = 0; i < 4; i++) {
    doc.rect(ML + i * attW, y, attW, cellH);
    doc.text(attLabels[i], ML + i * attW + attW / 2, y + 3.5, { align: 'center' });
  }
  y += cellH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const attValues = [
    student.attendance?.workingDays || '',
    student.attendance?.daysAttended || '',
    student.attendance?.percentage || '',
    student.attendance?.remarks || '',
  ];
  for (let i = 0; i < 4; i++) {
    doc.rect(ML + i * attW, y, attW, cellH + 1);
    doc.text(attValues[i], ML + i * attW + attW / 2, y + 3.5, { align: 'center' });
  }
  y += cellH + 2;

  const halfW = CW / 2;
  const coItemW = halfW * 0.72;
  const coGradeW = halfW * 0.28;

  const termLabel = resultType === 'FIRST_TERM' ? 'Term 1' : 'Term 2';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);

  doc.setFillColor(230, 230, 230);
  doc.rect(ML, y, halfW, cellH + 2, 'FD');
  doc.rect(ML + halfW, y, halfW, cellH + 2, 'FD');
  doc.text('Co – Scholastic Areas', ML + halfW / 2, y + 3, { align: 'center' });
  doc.setFontSize(4.5);
  doc.text('(3 Point Grading Scale A, B, C)', ML + halfW / 2, y + 6, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('Discipline', ML + halfW + halfW / 2, y + 3, { align: 'center' });
  doc.setFontSize(4.5);
  doc.text('(3 Point Grading Scale A, B, C)', ML + halfW + halfW / 2, y + 6, { align: 'center' });
  y += cellH + 2;

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.rect(ML, y, coItemW, cellH);
  doc.rect(ML + coItemW, y, coGradeW, cellH);
  doc.rect(ML + halfW, y, coItemW, cellH);
  doc.rect(ML + halfW + coItemW, y, coGradeW, cellH);
  doc.text(termLabel, ML + 2, y + 3.5);
  doc.text('Grade', ML + coItemW + coGradeW / 2, y + 3.5, { align: 'center' });
  doc.text(termLabel, ML + halfW + 2, y + 3.5);
  doc.text('Grade', ML + halfW + coItemW + coGradeW / 2, y + 3.5, { align: 'center' });
  y += cellH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
   const termPrefix = resultType === 'FIRST_TERM' ? '1T_' : '2T_';
   const maxRows = Math.max(CO_SCHOLASTIC_ITEMS.length, DISCIPLINE_ITEMS.length);
   for (let i = 0; i < maxRows; i++) {
     doc.rect(ML, y, coItemW, cellH);
     doc.rect(ML + coItemW, y, coGradeW, cellH);
     doc.rect(ML + halfW, y, coItemW, cellH);
     doc.rect(ML + halfW + coItemW, y, coGradeW, cellH);
 
     if (i < CO_SCHOLASTIC_ITEMS.length) {
       doc.text(CO_SCHOLASTIC_ITEMS[i], ML + 2, y + 3.5);
       const coGrade = student.coScholastic?.[termPrefix + CO_SCHOLASTIC_ITEMS[i]] || student.coScholastic?.[CO_SCHOLASTIC_ITEMS[i]] || '';
       if (coGrade) {
         doc.text(coGrade, ML + coItemW + coGradeW / 2, y + 3.5, { align: 'center' });
       }
     }
     if (i < DISCIPLINE_ITEMS.length) {
       doc.text(DISCIPLINE_ITEMS[i], ML + halfW + 2, y + 3.5);
       const discGrade = student.discipline?.[termPrefix + DISCIPLINE_ITEMS[i]] || student.discipline?.[DISCIPLINE_ITEMS[i]] || '';
       if (discGrade) {
         doc.text(discGrade, ML + halfW + coItemW + coGradeW / 2, y + 3.5, { align: 'center' });
       }
     }
     y += cellH;
   }

  y += 2;

  const sigW = CW / 3;
  const sigH = 14;

  doc.rect(ML, y, sigW, sigH);
  doc.rect(ML + sigW, y, sigW, sigH);
  doc.rect(ML + 2 * sigW, y, sigW, sigH);

  if (principalSign) {
    try {
      doc.addImage(principalSign, 'PNG', ML + 2 * sigW + (sigW - 20) / 2, y + 1, 20, 8);
    } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text("Class Teacher's Signature", ML + sigW / 2, y + sigH - 2, { align: 'center' });
  doc.text("Parent's Signature", ML + sigW + sigW / 2, y + sigH - 2, { align: 'center' });
  doc.text("Principal's Signature", ML + 2 * sigW + sigW / 2, y + sigH - 2, { align: 'center' });
}

export function getResultFileName(resultType: ResultType, sessionYear: string): string {
  const prefix = resultType === 'FIRST_TERM' ? '1st_term_results' : 'final_results';
  const sanitizedYear = sessionYear.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${prefix}_${sanitizedYear}.pdf`;
}
