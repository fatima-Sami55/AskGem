const generateStudentAnalysisPrompt = (profile) => `
You are an expert academic advisor and career counselor. Analyze the following student profile deeply.

**Student Profile:**
${JSON.stringify(profile, null, 2)}

**Goal:**
Identify gaps, strengths, and necessary clarifications to provide the best academic roadmap.

**Output:**
Return a single question to ask the student next to clarify their path.
JSON Format:
{
  "question": "The actual question string",
  "reason": "Why this question is critical right now"
}
`;

const generateRecommendationPrompt = (profile) => `
You are a senior academic decision engine.
Analyze the student profile:
${JSON.stringify(profile, null, 2)}

**Rules:**
1. Consider GPA, budget, career goals, country preference, and market trends.
2. Be realistic. If GPA is low, suggest pathways or alternative universities.
3. Provide reasoning for every major choice.

**Output JSON Structure:**
{
  "summary": "Brief executive summary of the student's potential",
  "recommendations": [
    {
      "country": "Country Name",
      "university": "University Name",
      "major": "Major Name",
      "scholarships": ["Scholarship 1", "Scholarship 2"],
      "why_this_choice": "Explanation...",
      "risk_flags": ["Risk 1"],
      "admission_probability": "High/Medium/Low"
    }
  ],
  "risks": ["General risk 1", "General risk 2"],
  "alternatives": ["Alternative path 1"]
}
`;

const generateRoadmapPrompt = (profile, recommendations) => `
Create a detailed 12-18 month roadmap for this student.
Profile: ${JSON.stringify(profile)}
Target Goal: ${JSON.stringify(recommendations[0] || "General Improvement")}

**Output JSON Structure:**
{
  "roadmap": [
    {
      "phase": "Month 1-3: Foundation",
      "actions": ["Action 1", "Action 2"],
      "exams": ["IELTS", "SAT"],
      "skills_to_learn": ["Skill 1"]
    }
  ]
}
`;

module.exports = {
    generateStudentAnalysisPrompt,
    generateRecommendationPrompt,
    generateRoadmapPrompt
};
