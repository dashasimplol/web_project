import { CATEGORIES, type Category, type Recipe } from "./types.js";

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((category) => category === value);
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function isRecipe(value: unknown): value is Recipe {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    (typeof item.id === "string" || typeof item.id === "number") &&
    typeof item.title === "string" &&
    isCategory(item.category) &&
    isNumberInRange(item.servings, 1, 30) &&
    isNumberInRange(item.cookingTime, 1, 600) &&
    Array.isArray(item.ingredients) &&
    item.ingredients.every((x: unknown) => typeof x === "string") &&
    typeof item.instructions === "string" &&
    typeof item.favorite === "boolean"
  );
}

export function parseRecipe(data: unknown): Recipe {
  if (!isRecipe(data)) {
    throw new Error("Сервер вернул данные неожиданного формата");
  }
  return { ...data, id: String(data.id) };
}

export function parseRecipes(data: unknown): Recipe[] {
  if (!Array.isArray(data) || !data.every(isRecipe)) {
    throw new Error("Сервер вернул данные неожиданного формата");
  }
  return data.map((item) => ({ ...item, id: String(item.id) }));
}
