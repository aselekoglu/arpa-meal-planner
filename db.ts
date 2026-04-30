import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'meals.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    tag TEXT,
    image_url TEXT,
    instructions TEXT,
    source_url TEXT,
    servings INTEGER NOT NULL DEFAULT 4
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    measure TEXT NOT NULL,
    calories REAL DEFAULT 0,
    protein REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    FOREIGN KEY (meal_id) REFERENCES meals (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS planner (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id TEXT DEFAULT 'default',
    date TEXT NOT NULL,
    meal_id INTEGER NOT NULL,
    servings_override INTEGER,
    FOREIGN KEY (meal_id) REFERENCES meals (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pantry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    measure TEXT NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE meals ADD COLUMN family_id TEXT DEFAULT 'default';");
  db.exec("ALTER TABLE planner ADD COLUMN family_id TEXT DEFAULT 'default';");
  db.exec("ALTER TABLE pantry ADD COLUMN family_id TEXT DEFAULT 'default';");
} catch (e) {
  // Columns likely already exist
}

// Migration for existing databases
try {
  db.exec('ALTER TABLE ingredients ADD COLUMN calories REAL DEFAULT 0;');
  db.exec('ALTER TABLE ingredients ADD COLUMN protein REAL DEFAULT 0;');
  db.exec('ALTER TABLE ingredients ADD COLUMN fat REAL DEFAULT 0;');
  db.exec('ALTER TABLE ingredients ADD COLUMN carbs REAL DEFAULT 0;');
} catch (e) {
  // Columns likely already exist
}

try {
  db.exec('ALTER TABLE meals ADD COLUMN instructions TEXT;');
  db.exec('ALTER TABLE meals ADD COLUMN source_url TEXT;');
} catch (e) {
  // Columns likely already exist
}

try {
  db.exec('ALTER TABLE meals ADD COLUMN servings INTEGER NOT NULL DEFAULT 4;');
  db.exec('ALTER TABLE planner ADD COLUMN servings_override INTEGER;');
} catch (e) {
  // Columns likely already exist
}

// Seed data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM meals').get() as { count: number };
if (count.count === 0) {
  const initialMeals = [
    {
      name: 'Bebu Koftesi',
      tag: 'Mediterranean',
      ingredients: [
        { name: 'Ground beef', amount: 500, measure: 'Gram (g)', calories: 1250, protein: 70, fat: 100, carbs: 0 },
        { name: 'Onion', amount: 1, measure: 'Unit', calories: 44, protein: 1.2, fat: 0.1, carbs: 10 },
        { name: 'Garlic', amount: 3, measure: 'Unit', calories: 13, protein: 0.6, fat: 0, carbs: 3 },
        { name: 'Panko breadcrumbs', amount: 1, measure: 'Bebu (be)', calories: 110, protein: 4, fat: 0.5, carbs: 21 },
      ],
    },
    {
      name: 'Pogaca',
      tag: 'Baking',
      ingredients: [
        { name: 'Yogurt', amount: 1, measure: 'Cup (c)' },
        { name: 'Eggs', amount: 1, measure: 'Unit' },
        { name: 'Baking powder', amount: 2, measure: 'Teaspoon (tsp)' },
        { name: 'Flour', amount: 4, measure: 'Cup (c)' },
        { name: 'Sugar', amount: 1, measure: 'Tablespoon (Tbsp)' },
        { name: 'Cheese', amount: 100, measure: 'Gram (g)' },
        { name: 'Spinach', amount: 1, measure: 'Unit' },
      ],
    },
    {
      name: 'Menemen',
      tag: 'Breakfast',
      ingredients: [
        { name: 'Eggs', amount: 3, measure: 'Unit' },
        { name: 'Tomato', amount: 3, measure: 'Unit' },
        { name: 'Bell pepper', amount: 3, measure: 'Unit' },
      ],
    },
    {
      name: 'Sucuk',
      tag: 'Breakfast',
      ingredients: [{ name: 'Sucuk', amount: 0.25, measure: 'Unit' }],
    },
    {
      name: 'Sucuklu Yumurta',
      tag: 'Breakfast',
      ingredients: [
        { name: 'Sucuk', amount: 0.25, measure: 'Unit' },
        { name: 'Eggs', amount: 3, measure: 'Unit' },
      ],
    },
    {
      name: 'Guacamole - Selu Usulu',
      tag: '',
      ingredients: [
        { name: 'Avocado', amount: 1, measure: 'Unit' },
        { name: 'Lemon', amount: 1, measure: 'Unit' },
      ],
    },
    {
      name: 'Domates Peynir Salatasi',
      tag: 'Breakfast',
      ingredients: [
        { name: 'Tomato', amount: 200, measure: 'Gram (g)' },
        { name: 'Beyaz Peynir', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Sumakli Brokoli Karnibahar',
      tag: '',
      ingredients: [
        { name: 'Broccoli', amount: 1, measure: 'Unit' },
        { name: 'Cauliflower', amount: 1, measure: 'Unit' },
        { name: 'Sumac', amount: 1, measure: 'Bebu (be)' },
        { name: 'Labne', amount: 1, measure: 'Bebu (be)' },
        { name: 'Lemon', amount: 1, measure: 'Unit' },
      ],
    },
    {
      name: 'Karniyarik',
      tag: '',
      ingredients: [
        { name: 'Eggplant', amount: 6, measure: 'Unit' },
        { name: 'Onion', amount: 1, measure: 'Unit' },
        { name: 'Bell pepper', amount: 1, measure: 'Unit' },
        { name: 'Garlic', amount: 2, measure: 'Unit' },
        { name: 'Ground beef', amount: 250, measure: 'Gram (g)' },
        { name: 'Domates Salça', amount: 2, measure: 'Tablespoon (Tbsp)' },
        { name: 'Parsley', amount: 1, measure: 'Unit' },
        { name: 'Tomato', amount: 2, measure: 'Unit' },
      ],
    },
    {
      name: 'Merco Corba',
      tag: '',
      ingredients: [
        { name: 'Red lentils', amount: 1, measure: 'Cup (c)' },
        { name: 'Flour', amount: 1, measure: 'Teaspoon (tsp)' },
        { name: 'Lemon', amount: 1, measure: 'Unit' },
      ],
    },
    {
      name: 'Yayla Corba',
      tag: '',
      ingredients: [
        { name: 'Yogurt', amount: 2, measure: 'Cup (c)' },
        { name: 'Flour', amount: 1.5, measure: 'Tablespoon (Tbsp)' },
        { name: 'Lemon', amount: 1, measure: 'Unit' },
        { name: 'Eggs', amount: 1, measure: 'Unit' },
        { name: 'Rice', amount: 1, measure: 'Cay Bardagi' },
        { name: 'Kuru Nane', amount: 1, measure: 'Tablespoon (Tbsp)' },
      ],
    },
    {
      name: 'Pilav - Bebu Usulu',
      tag: '',
      ingredients: [
        { name: 'Basmati rice', amount: 1, measure: 'Cay Bardagi' },
        { name: 'Orzo', amount: 1, measure: 'Cay Bardagi' },
        { name: 'Veggie stock concentrate', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Ekmek',
      tag: '',
      ingredients: [{ name: 'Bread', amount: 1, measure: 'Unit' }],
    },
    {
      name: 'Haşlanmış Yumurta',
      tag: 'Breakfast',
      ingredients: [
        { name: 'Eggs', amount: 6, measure: 'Unit' },
        { name: 'Sumac', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Omlet',
      tag: 'Breakfast',
      ingredients: [
        { name: 'Bell pepper', amount: 1, measure: 'Unit' },
        { name: 'Eggs', amount: 4, measure: 'Unit' },
        { name: 'Cheese', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Meksika Usulü Bebü Yemeği',
      tag: 'Dinner',
      ingredients: [
        { name: 'Basmati rice', amount: 1, measure: 'Cay Bardagi' },
        { name: 'Orzo', amount: 1, measure: 'Cay Bardagi' },
        { name: 'Ground beef', amount: 500, measure: 'Gram (g)' },
        { name: 'Labne', amount: 5, measure: 'Tablespoon (Tbsp)' },
        { name: 'Lemon', amount: 1, measure: 'Unit' },
        { name: 'Bell pepper', amount: 1, measure: 'Unit' },
        { name: 'Tomato sauce', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Makarna - Peynirli Ketçaplı Bebü Usulü',
      tag: '',
      ingredients: [
        { name: 'Gluten-free Makarna', amount: 1, measure: 'Unit' },
        { name: 'Beyaz Peynir', amount: 1, measure: 'Bebu (be)' },
        { name: 'Cheese', amount: 1, measure: 'Bebu (be)' },
        { name: 'Ketchup', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Makarna - Bebü Soslu',
      tag: '',
      ingredients: [
        { name: 'Gluten-free Makarna', amount: 1, measure: 'Unit' },
        { name: 'Tomato sauce', amount: 1, measure: 'Bebu (be)' },
        { name: 'Domates Salça', amount: 1, measure: 'Bebu (be)' },
        { name: 'Biber Salça', amount: 1, measure: 'Bebu (be)' },
        { name: 'Cream', amount: 1, measure: 'Bebu (be)' },
      ],
    },
    {
      name: 'Bebu Usulu Makarna Sosu',
      tag: '',
      ingredients: [
        { name: 'Tomato', amount: 5, measure: 'Unit' },
        { name: 'Bell pepper', amount: 3, measure: 'Unit' },
        { name: 'Onion', amount: 2, measure: 'Unit' },
        { name: 'Garlic', amount: 1, measure: 'Unit' },
      ],
    },
  ];

  const insertMeal = db.prepare(
    'INSERT INTO meals (name, tag, instructions, source_url, servings) VALUES (?, ?, ?, ?, ?)'
  );
  const insertIngredient = db.prepare(
    'INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((meals) => {
    for (const meal of meals) {
      const result = insertMeal.run(meal.name, meal.tag, null, null, 4);
      const mealId = result.lastInsertRowid;
      for (const ing of meal.ingredients) {
        insertIngredient.run(mealId, ing.name, ing.amount, ing.measure, ing.calories || 0, ing.protein || 0, ing.fat || 0, ing.carbs || 0);
      }
    }
  });

  insertMany(initialMeals);
}

export default db;
