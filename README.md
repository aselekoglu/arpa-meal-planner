# Arpa Meal Planner

A comprehensive, full-stack meal planning application designed to streamline your kitchen management. Plan your week, track your pantry, and generate smart grocery lists with ease.

## Running Instructions

1. Install dependencies:
   - `npm install`
2. Create your local environment file:
   - Copy `.env.example` to `.env`
   - Set `GEMINI_API_KEY` in `.env` (required for AI features)
3. Start the app:
   - `npm run dev`
4. Open your browser:
   - `http://127.0.0.1:3000`

### Optional Commands
- `npm run build` - Build production assets
- `npm run preview` - Preview the production build
- `npm run lint` - Type-check the project

## Desktop Usage Instructions

### 1. Managing Your Meals (Dashboard)
- **View Meals**: The home screen displays your saved meals. Use the search bar or tag filters to find specific recipes.
- **Add a Meal**: Click the **"Add Meal"** button. You can manually enter the name, ingredients, and instructions.
- **Image Management**: In the meal form, you can add a photo by:
  - **Uploading** a file from your computer.
  - **Taking a photo** using your webcam (click the Camera icon).
  - **Pasting a URL** to an image from the web.
- **Import Recipes**: Click the **"Import"** button to find recipes from across the web. Simply enter a search query, and Bebü Bot will find and format the recipe for you.
- **Edit/Delete**: Use the menu (three dots) on any meal card to modify or remove it.

### 2. Weekly Planning
- **Navigate to Planner**: Click "Planner" in the sidebar.
- **Manual Planning**: Drag and drop meals from the side panel onto specific days of the week.
- **Smart Generation**: Click **"Generate Plan"** to have the AI create a balanced weekly menu based on your preferences and diet (e.g., Mediterranean, High Protein).
- **Navigation**: Use the "Previous" and "Next" buttons to plan for future weeks.

### 3. Grocery Lists & Pantry
- **Grocery List**: Navigate to "Grocery List". The app automatically calculates what you need based on your weekly plan.
- **Smart Grouping**: Click **"Smart Group"** to organize your list by supermarket aisles (Produce, Dairy, etc.).
- **Pantry Sync**: Items you already have in your **Pantry Inventory** are automatically excluded from your shopping list.
- **Export**: Click **"Export PDF"** to get a printable version of your shopping list.
- **Pantry Management**: Switch to the "Pantry Inventory" tab to track what you have in stock. Adding items here keeps your grocery list accurate.

### 4. Bebü Bot (AI Assistant)
- **Chat**: Click the floating robot icon in the bottom right corner.
- **Ask Anything**: Bebü Bot can suggest recipes based on what you have, answer cooking questions, or help you refine your meal plan. It has access to your saved meals to provide personalized advice.

## Features
- **Full-Stack Sync**: Real-time synchronization across devices for your family.
- **Nutritional Tracking**: Automatic calculation of calories and macros for your meals.
- **Responsive Design**: Optimized for both large desktop monitors and smaller laptop screens.
- **Dark Mode Support**: Automatically adjusts to your system's light/dark preferences.
