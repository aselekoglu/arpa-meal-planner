# ARPA: Meal Planner

Plan meals faster, shop smarter, and waste less food.

Arpa is a full-stack meal planning app that combines recipe management, weekly planning, pantry tracking, and AI-powered helpers in one workflow.

## Why ARPA

- Build a weekly meal plan in minutes.
- Auto-generate a grocery list from your plan.
- Deduct pantry inventory with unit-aware conversions (`g`, `kg`, `ml`, `L`, `tsp`, `tbsp`, `cup`, `unit`, and more).
- Keep ingredient naming clean with merge suggestions and bulk merge tools.
- Speed up recipe editing with AI nutrition estimation and instruction fetching.

## Feature Highlights

### Meal and Recipe Management

- Create, edit, and organize meals with ingredients, instructions, images, tags, and servings.
- Import recipes from the web.
- Edit meals directly from meal details.

### Weekly Planner

- Drag and drop meals into each day of the week.
- Navigate across weeks to plan ahead.
- Generate plans with AI support.

### Grocery List + Pantry Intelligence

- Grocery list is computed from planned meals.
- Pantry deductions support cross-unit conversions and ingredient-specific logic.
- Strict measure validation keeps unit data reliable for calculations.
- Vague units are suppressed in the grocery view when concrete units exist.
- Export grocery list to PDF.

### Ingredient Name Hygiene

- Existing ingredient names are suggested while adding/editing recipes.
- "Merge Similar Items" helps consolidate naming variants (including manual selection).
- Merge updates related meal ingredients and pantry rows for your current family scope.

### AI Assist

- Smart grouping by aisle/category from grocery list.
- "Estimate Nutrition" fills per-ingredient calories/macros in recipe editing.
- "Fetch Instructions" can pull step-by-step directions when instruction list is empty.
- In-app assistant (Bebu Bot) can help with meal planning and cooking questions.

## Quick Start

1. Install dependencies:
  - `npm install`
2. Create environment file:
  - Copy `.env.example` to `.env`
  - Set required API keys (for AI features)
3. Start development server:
  - `npm run dev`
4. Open:
  - `http://127.0.0.1:3000`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production assets
- `npm run preview` - Preview production build
- `npm run lint` - Type-check and lint

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Data: SQLite (current local setup)
- AI: Provider-based integration for planning, grouping, nutrition, and instructions

## Notes

- Database files are intentionally ignored in Git for safer collaboration.
- A future migration to per-user cloud data (Firebase Auth + Firestore) is planned.

