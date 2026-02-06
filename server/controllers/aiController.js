const geminiClient = require('../geminiClient');
const prompts = require('../promptTemplates');
const storageService = require('../services/storageService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Helper to get profile or throw error
const getProfileOrError = (id) => {
    const profile = storageService.getProfile(id);
    if (!profile) {
        throw new AppError('Profile not found', 404);
    }
    return profile;
};

exports.getNextQuestion = catchAsync(async (req, res, next) => {
    const { studentId } = req.body;
    if (!studentId) return next(new AppError('studentId is required', 400));

    const profile = getProfileOrError(studentId);

    // We might want to append previous answers if we had them stored, 
    // currently we just analyze the static profile to ask clarification.
    // In a real app, 'profile' would include 'answers' array.

    const prompt = prompts.generateStudentAnalysisPrompt(profile);
    const aiResponse = await geminiClient.generateContent(prompt);

    res.status(200).json({
        status: 'success',
        data: aiResponse
    });
});

exports.getRecommendations = catchAsync(async (req, res, next) => {
    const { studentId } = req.body;
    if (!studentId) return next(new AppError('studentId is required', 400));

    const profile = getProfileOrError(studentId);
    const prompt = prompts.generateRecommendationPrompt(profile);
    const aiResponse = await geminiClient.generateContent(prompt);

    // Ideally store recommendations to session/db here for roadmap generation later
    storageService.saveProfile(studentId, { lastRecommendations: aiResponse.recommendations });

    res.status(200).json({
        status: 'success',
        data: aiResponse
    });
});

exports.getRoadmap = catchAsync(async (req, res, next) => {
    const { studentId } = req.body;
    if (!studentId) return next(new AppError('studentId is required', 400));

    const profile = getProfileOrError(studentId);

    // Use stored recommendations or require them in body
    const recommendations = profile.lastRecommendations || req.body.recommendations;

    if (!recommendations || recommendations.length === 0) {
        return next(new AppError('No recommendations found. Generate recommendations first.', 400));
    }

    const prompt = prompts.generateRoadmapPrompt(profile, recommendations);
    const aiResponse = await geminiClient.generateContent(prompt);

    res.status(200).json({
        status: 'success',
        data: aiResponse
    });
});
