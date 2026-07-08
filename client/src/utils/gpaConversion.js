/** Pakistani percentage (0–100) → 4.0 CGPA scale (÷ 25). */
export function percentToCgpa(percent) {
  const n = parseFloat(String(percent).replace(',', '.'));
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return Math.round((n / 25) * 100) / 100;
}

/** 4.0 CGPA → approximate Pakistani percentage (× 25). */
export function cgpaToPercent(cgpa) {
  const n = parseFloat(String(cgpa).replace(',', '.'));
  if (Number.isNaN(n) || n < 0 || n > 4) return null;
  return Math.round(n * 25);
}
