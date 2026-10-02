import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
export const meals = sqliteTable('meals', {
  id: integer('id').primaryKey({autoIncrement:true}), family_id: text('family_id').notNull().default('default'),
  name: text('name').notNull(), tag: text('tag'), image_url:text('image_url'), instructions:text('instructions'),
  source_url:text('source_url'), servings:integer('servings').notNull().default(4), operation_key:text('operation_key').unique(),
});
export const ingredients = sqliteTable('ingredients', {
  id:integer('id').primaryKey({autoIncrement:true}), meal_id:integer('meal_id').notNull().references(()=>meals.id,{onDelete:'cascade'}),
  name:text('name').notNull(), amount:real('amount').notNull(), measure:text('measure').notNull(),
  calories:real('calories').default(0), protein:real('protein').default(0), fat:real('fat').default(0), carbs:real('carbs').default(0),
});
export const planner = sqliteTable('planner', {
  id:integer('id').primaryKey({autoIncrement:true}),family_id:text('family_id').notNull().default('default'),date:text('date').notNull(),
  meal_id:integer('meal_id').notNull().references(()=>meals.id,{onDelete:'cascade'}),servings_override:integer('servings_override'),
});
export const pantry=sqliteTable('pantry',{
  id:integer('id').primaryKey({autoIncrement:true}),family_id:text('family_id').notNull().default('default'),
  name:text('name').notNull(),amount:real('amount').notNull(),measure:text('measure').notNull(),
});
export const previews=sqliteTable('mcp_previews',{
  id:text('id').primaryKey(),owner_id:text('owner_id').notNull(),kind:text('kind').notNull(),payload:text('payload').notNull(),
  expires_at:integer('expires_at').notNull(),consumed_at:integer('consumed_at'),
});
