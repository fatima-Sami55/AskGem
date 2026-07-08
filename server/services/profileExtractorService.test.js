const { extractFromMessage } = require('../services/profileExtractorService');

describe('profileExtractorService — GPA friend vs own', () => {
  it('extracts GPA when the user states their own score', () => {
    const result = extractFromMessage('My CGPA is 3.5', {});
    expect(result.gpa).toBe(3.5);
  });

  it('does not extract GPA when it belongs to a friend', () => {
    const result = extractFromMessage('My friend has 3.8 CGPA', {});
    expect(result.gpa).toBeUndefined();
  });

  it('prefers own GPA over a friend mention in the same message when scores differ clearly', () => {
    const result = extractFromMessage('My friend has 3.8 CGPA but my CGPA is 3.2', {});
    expect(result.gpa).toBe(3.2);
  });

  it('extracts own GPA (not friend) from the known repro sentence', () => {
    const result = extractFromMessage('my friend has 3.8 GPA but I have 3.2', {});
    expect(result.gpa).toBe(3.2);
  });
});
