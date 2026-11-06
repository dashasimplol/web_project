import { parseRecipes } from "./parse.js";
const API_URL = "http://localhost:3001/recipes";
export async function fetchRecipes() {
    const response = await fetch(API_URL);
    if (!response.ok) {
        throw new Error(`Сервер вернул ошибку: ${response.status}`);
    }
    const data = await response.json();
    return parseRecipes(data);
}
