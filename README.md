# 🥗 Arpa Meal Planner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC.svg)](https://tailwindcss.com/)

**Plan meals faster, shop smarter, and waste less food.**

Arpa is a comprehensive, full-stack meal planning application designed to streamline your kitchen workflow. It combines recipe management, weekly planning, pantry tracking, and AI-powered intelligence into one cohesive experience.

---

## ✨ Features

### 📅 Weekly Planner
- **Intuitive Interface:** Drag and drop meals into your weekly schedule with ease.
- **Forward Planning:** Navigate across weeks to organize your future meals.
- **AI-Powered Generation:** Use AI to generate balanced weekly meal plans based on your preferences.

### 🍱 Recipe & Meal Management
- **Rich Content:** Organize meals with ingredients, instructions, high-quality images, tags, and serving sizes.
- **Web Import:** Save time by importing recipes directly from your favorite websites.
- **Seamless Editing:** Quick edit mode allows you to refine recipes directly from the meal details view.

### 🛒 Grocery & Pantry Intelligence
- **Automatic Lists:** Your grocery list is automatically computed from your planned meals.
- **Pantry Deduction:** Smart inventory tracking with unit-aware conversions (grams, milliliters, teaspoons, cups, and more).
- **Measure Validation:** Strict unit validation ensures accurate calculations for your shopping and cooking.
- **PDF Export:** Generate clean, printable grocery lists to take with you.

### 🧹 Ingredient Hygiene
- **Smart Suggestions:** Auto-suggests existing ingredient names to keep your database consistent.
- **Merge Tools:** Consolidate similar items with a "Bulk Merge" tool to eliminate duplicate ingredient entries.
- **Global Updates:** Merging ingredients automatically updates all related meal recipes and pantry inventory.

### 🧠 AI Assistance (Powered by Google Gemini & more)
- **Nutrition Estimation:** Automatically fill in calories and macros for your recipes.
- **Instruction Fetching:** Pull step-by-step cooking directions for imported or incomplete recipes.
- **Aisle Grouping:** Automatically organize your grocery list by supermarket aisle/category.
- **Bebu Bot:** An integrated AI assistant ready to help with planning questions or cooking advice.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/aselekoglu/arpa-meal-planner.git
   cd arpa-meal-planner
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   - Copy `.env.example` to `.env`
   - Add your `GOOGLE_API_KEY` (and any other provider keys you wish to use).

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

5. **Access the App:**
   Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

---

## 🛠️ Scripts

- `npm run dev` - Start the development server with `tsx`
- `npm run build` - Build optimized production assets
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run TypeScript type-checking
- `npm run clean` - Remove build artifacts (`dist` folder)

---

## 🏗️ Technical Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion
- **Backend:** Node.js, Express, tsx
- **Database:** SQLite (Better-SQLite3)
- **AI Integration:** Google Gemini, Ollama, and MLX support

---

## 🗺️ Roadmap

- [ ] **Cloud Sync:** Migration to Firebase Auth + Firestore for cross-device synchronization.
- [ ] **Advanced Nutrition:** Integration with external nutrition databases for higher accuracy.
- [ ] **Community Sharing:** Ability to share recipes and meal plans with other Arpa users.
- [ ] **Mobile App:** Dedicated mobile experience for on-the-go grocery shopping.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Built with ❤️ by [aselekoglu](https://github.com/aselekoglu)*
