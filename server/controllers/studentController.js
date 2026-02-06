const Joi = require('joi');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const storageService = require('../services/storageService');

const profileSchema = Joi.object({
    id: Joi.string().required(), // Simple ID from client for now
    gpa: Joi.number().min(0).max(4.0).required(),
    intended_major: Joi.string().required(),
    career_goal: Joi.string().required(),
    country_preference: Joi.string().required(),
    budget_range: Joi.string().required(),
    english_proficiency: Joi.string().valid('Native', 'Advanced', 'Intermediate', 'Beginner').required(),
    interests: Joi.array().items(Joi.string()).required(),
    risk_tolerance: Joi.string().valid('Low', 'Medium', 'High').required(),
    academic_strengths: Joi.array().items(Joi.string()),
    academic_weaknesses: Joi.array().items(Joi.string())
});

exports.createProfile = catchAsync(async (req, res, next) => {
    const { error, value } = profileSchema.validate(req.body);

    if (error) {
        return next(new AppError(`Validation Error: ${error.details.map(x => x.message).join(', ')}`, 400));
    }

    const profile = storageService.saveProfile(value.id, value);

    res.status(201).json({
        status: 'success',
        data: {
            profile
        }
    });
});

exports.getProfile = catchAsync(async (req, res, next) => {
    const profile = storageService.getProfile(req.params.id);

    if (!profile) {
        return next(new AppError('No profile found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            profile
        }
    });
});
