const express = require('express');
const router = express.Router();

const sampleStudent = {
    id: "sample_123",
    gpa: 3.5,
    intended_major: "Computer Science",
    career_goal: "AI Researcher",
    country_preference: "USA",
    budget_range: "30000-50000 USD",
    english_proficiency: "Advanced",
    interests: ["Coding", "Robotics", "Chess"],
    risk_tolerance: "Medium",
    academic_strengths: ["Math", "Physics"],
    academic_weaknesses: ["History"]
};

router.get('/sample-student', (req, res) => {
    res.status(200).json({
        status: 'success',
        data: sampleStudent
    });
});

module.exports = router;
