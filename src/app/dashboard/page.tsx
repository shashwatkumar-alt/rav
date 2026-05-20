'use client';

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { parseWorkbook } from '@/lib/excel-parser';
import type { ParsedWorkbook, ResultType } from '@/lib/types';

type GenerationState = 'idle' | 'generating' | 'success' | 'error';

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<ParsedWorkbook | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Generation state
  const [resultType, setResultType] = useState<ResultType>('FIRST_TERM');
  const [sessionYear, setSessionYear] = useState('');
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [genError, setGenError] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // ========== LOGOUT ==========
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  // ========== FILE UPLOAD ==========
  function processFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      alert('Please upload a valid .xlsx file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const result = parseWorkbook(buffer, file.name);
      setFileName(file.name);
      setParsedData(result);
      setActiveSheet(0);
      setGenState('idle');
      setPdfBlob(null);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function removeFile() {
    setFileName('');
    setParsedData(null);
    setGenState('idle');
    setPdfBlob(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ========== PDF GENERATION ==========
  const handleGenerate = useCallback(async () => {
    if (!parsedData || !sessionYear.trim()) {
      alert('Please fill in the session year.');
      return;
    }

    setGenState('generating');
    setGenError('');

    try {
      const { generateResultsPDF } = await import('@/lib/pdf-generator');
      const pdfBytes = await generateResultsPDF(parsedData, resultType, sessionYear);

      const freshBuffer = new ArrayBuffer(pdfBytes.length);
      const view = new Uint8Array(freshBuffer);
      view.set(pdfBytes);
      const blob = new Blob([freshBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setPdfBlob(blob);
      setPdfUrl(url);
      setGenState('success');
    } catch (err) {
      console.error('PDF generation error:', err);
      setGenError(err instanceof Error ? err.message : 'PDF generation failed.');
      setGenState('error');
    }
  }, [parsedData, resultType, sessionYear]);

  async function handleDownload() {
    if (!pdfBlob) return;
    const { getResultFileName } = await import('@/lib/pdf-generator');
    const dlFileName = getResultFileName(resultType, sessionYear);

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const freshBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(freshBlob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = dlFileName;
    link.type = 'application/pdf';

    document.body.appendChild(link);
    link.click();

    requestAnimationFrame(() => {
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    });
  }

  // ========== RENDER ==========
  const currentSheet = parsedData?.sheets[activeSheet];

  return (
    <div className="hero-root">
      {/* ── Same video background as landing page ── */}
      <video
        className="hero-video"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* ── Scrollable content layer ── */}
      <div className="dashboard-container">
        <div className="dashboard-grid">

          {/* Header */}
          <div className="dashboard-header">
            <h1 className="dashboard-title">
              <span>RAV School</span> — Result Portal
            </h1>
            <button onClick={handleLogout} className="btn btn-danger" id="logout-btn">
              ⏻ Logout
            </button>
          </div>

          {/* Upload Card */}
          <div className="card">
            <div className="card-title">
              <div className="card-icon">📁</div>
              Upload Excel Workbook
            </div>

            {!fileName ? (
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                id="upload-zone"
              >
                <div className="upload-zone-icon">📤</div>
                <p className="upload-zone-text">
                  Drag &amp; drop your Excel workbook here, or click to browse
                </p>
                <p className="upload-zone-hint">Only .xlsx files are accepted</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="file-input"
                />
              </div>
            ) : (
              <div className="upload-file-info">
                <span>📊</span>
                <span className="upload-file-name">{fileName}</span>
                <button className="upload-file-remove" onClick={removeFile} title="Remove file">✕</button>
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {parsedData && parsedData.errors.length > 0 && (
            <div className="card">
              <div className="card-title">
                <div className="card-icon">⚠️</div>
                Validation Notes
              </div>
              <ul className="validation-list">
                {parsedData.errors.map((err, i) => (
                  <li key={i} className={`validation-item ${err.severity}`}>
                    <span>{err.severity === 'error' ? '❌' : '⚠️'}</span>
                    <span>{err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Excel Preview */}
          {parsedData && parsedData.sheets.length > 0 && (
            <div className="card">
              <div className="card-title">
                <div className="card-icon">👁️</div>
                Excel Preview
              </div>

              <div className="preview-section">
                <div className="sheet-tabs">
                  {parsedData.sheets.map((sheet, i) => (
                    <button
                      key={i}
                      className={`sheet-tab ${i === activeSheet ? 'active' : ''}`}
                      onClick={() => setActiveSheet(i)}
                    >
                      {sheet.className}
                    </button>
                  ))}
                </div>

                {currentSheet && (
                  <>
                    <div className="sheet-info">
                      <div className="sheet-info-item">
                        👤 Students: <span className="badge badge-accent">{currentSheet.students.length}</span>
                      </div>
                      <div className="sheet-info-item">
                        📚 Subjects: <span className="badge badge-success">{currentSheet.subjectNames.length}</span>
                      </div>
                      <div className="sheet-info-item">
                        📋 Score Types: <span className="badge badge-warning">{currentSheet.scoreTypes.length}</span>
                      </div>
                    </div>

                    <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <strong>Detected Subjects:</strong>{' '}
                      {currentSheet.subjectNames.length > 0
                        ? currentSheet.subjectNames.join(', ')
                        : 'None detected'}
                    </div>
                    <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <strong>Score Columns:</strong>{' '}
                      {currentSheet.scoreTypes.length > 0
                        ? currentSheet.scoreTypes.join(', ')
                        : 'None detected'}
                    </div>

                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Roll No</th>
                            {currentSheet.subjectNames.slice(0, 6).map((s, si) => (
                              <th key={si}>{s}</th>
                            ))}
                            {currentSheet.subjectNames.length > 6 && <th>...</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {currentSheet.students.slice(0, 10).map((stu, ri) => (
                            <tr key={ri}>
                              <td>{stu.name}</td>
                              <td>{stu.rollNo}</td>
                              {currentSheet.subjectNames.slice(0, 6).map((s, si) => {
                                const marks = stu.subjects[s];
                                const total = marks?.['Total'] ?? marks?.['Marks'] ?? '';
                                return <td key={si}>{String(total)}</td>;
                              })}
                              {currentSheet.subjectNames.length > 6 && <td>...</td>}
                            </tr>
                          ))}
                          {currentSheet.students.length > 10 && (
                            <tr>
                              <td
                                colSpan={currentSheet.subjectNames.slice(0, 6).length + 2 + (currentSheet.subjectNames.length > 6 ? 1 : 0)}
                                style={{ textAlign: 'center', color: 'var(--text-muted)' }}
                              >
                                ... and {currentSheet.students.length - 10} more students
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Generation Options */}
          {parsedData && parsedData.isValid && (
            <div className="card">
              <div className="card-title">
                <div className="card-icon">⚙️</div>
                Generate Result PDF
              </div>

              <div className="session-input-group">
                <label htmlFor="session-year">Session Year:</label>
                <input
                  id="session-year"
                  className="form-input"
                  type="text"
                  placeholder="e.g. 2024-2025"
                  value={sessionYear}
                  onChange={(e) => setSessionYear(e.target.value)}
                />
              </div>

              <div className="result-type-group">
                <div className="result-type-option">
                  <input
                    type="radio"
                    name="resultType"
                    id="result-1st-term"
                    value="FIRST_TERM"
                    checked={resultType === 'FIRST_TERM'}
                    onChange={() => setResultType('FIRST_TERM')}
                  />
                  <label htmlFor="result-1st-term" className="result-type-label">
                    <span className="result-type-label-title">📝 1st Term Result</span>
                    <span className="result-type-label-desc">Term I examination results</span>
                  </label>
                </div>
                <div className="result-type-option">
                  <input
                    type="radio"
                    name="resultType"
                    id="result-final"
                    value="FINAL"
                    checked={resultType === 'FINAL'}
                    onChange={() => setResultType('FINAL')}
                  />
                  <label htmlFor="result-final" className="result-type-label">
                    <span className="result-type-label-title">🏆 Final Result</span>
                    <span className="result-type-label-desc">Combined Term I + Term II results</span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                className="btn btn-success"
                disabled={!sessionYear.trim() || genState === 'generating'}
                id="generate-btn"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              >
                {genState === 'generating' ? '⏳ Generating...' : '🚀 Generate PDF'}
              </button>
            </div>
          )}

        </div>
        {/* End dashboard-grid */}

        {/* Generation Overlay */}
        {genState === 'generating' && (
          <div className="generation-overlay">
            <div className="generation-card">
              <div className="spinner"></div>
              <h2 className="generation-title">Generating Results...</h2>
              <p className="generation-desc">
                Creating PDF for {parsedData?.sheets.reduce((s, sh) => s + sh.students.length, 0)} students
              </p>
            </div>
          </div>
        )}

        {/* Success Overlay */}
        {genState === 'success' && (
          <div className="generation-overlay" onClick={(e) => { if (e.target === e.currentTarget) setGenState('idle'); }}>
            <div className="generation-card">
              <div className="success-icon">✓</div>
              <h2 className="generation-title">PDF Generated Successfully!</h2>
              <p className="generation-desc">Your result PDF is ready for download.</p>

              {pdfUrl && (
                <div style={{ margin: '20px 0', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <iframe
                    src={pdfUrl}
                    style={{ width: '100%', height: '300px', border: 'none' }}
                    title="PDF Preview"
                  />
                </div>
              )}

              <div className="download-btn-group">
                <button onClick={handleDownload} className="btn btn-success" id="download-btn">
                  ⬇ Download PDF
                </button>
                <button onClick={() => setGenState('idle')} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {genState === 'error' && (
          <div className="generation-overlay" onClick={(e) => { if (e.target === e.currentTarget) setGenState('idle'); }}>
            <div className="generation-card">
              <div className="success-icon" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>✕</div>
              <h2 className="generation-title">Generation Failed</h2>
              <p className="generation-desc">{genError}</p>
              <div className="download-btn-group">
                <button onClick={() => setGenState('idle')} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      {/* End dashboard-container */}
    </div>
  );
}
