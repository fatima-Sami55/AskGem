# GenEduPlanner Backend

Production-ready Node.js + Express backend for an AI-powered academic decision platform using the Google Gemini 3 API.

## Features
- **Student Intake**: Collects structured student profile data.
- **Adaptive AI Questions**: Generates dynamic follow-up questions using Gemini.
- **Recommendations**: Provides university, major, and scholarship recommendations with reasoning.
- **Roadmap**: Generates a 12-18 month personalized academic roadmap.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and add your Google Gemini API Key.
   ```bash
   cp .env.example .env
   ```

3. **Run Server**
   ```bash
   npm start
   ```

## API Endpoints

### Student Profile
- `POST /api/student/profile`
- `GET /api/student/:id`

### AI Features
- `POST /api/ai/next-question`: Generate next question based on profile.
- `POST /api/ai/recommend`: Get university/major recommendations.
- `POST /api/ai/roadmap`: Get detailed roadmap.

### Demo
- `GET /api/demo/sample-student`: Get a sample student profile.

## Error Handling
The server uses a centralized error handling mechanism. All errors return a JSON response with `status: 'error'` or `'fail'`.

## Project Structure
- `server/controllers`: Business logic.
- `server/routes`: API route definitions.
- `server/services`: Shared services (Storage).
- `server/utils`: Utility classes (AppError, catchAsync).
- `server/geminiClient.js`: Google Gemini API wrapper.
- `server/promptTemplates.js`: AI Prompt engineering.
