import type { Category, Recipe, RecipeDraft, RecipeFilter } from "./types.js";
import { initialRecipes } from "./data.js";
import { loadRecipes, saveRecipes } from "./storage.js";
import { filterAndSortRecipes, createRecipe, updateRecipe, toggleFavorite, deleteRecipe } from "./recipes.js";
import {
  searchInput, categoryFilter, sortBySelect, favoritesOnly, fastOnly, clearFiltersBtn,
  recipeForm, editRecipeIdInput, formModeTitle, formSubmitBtn, cancelEditBtn, recipeList, formMessage,
  renderRecipes, renderCategoryCounts
} from "./ui.js";

let recipes: Recipe[] = loadRecipes() ?? initialRecipes;

function getFilter(): RecipeFilter {
  return {
    query: searchInput.value,
    category: categoryFilter.value as Category | "Все",
    favoritesOnly: favoritesOnly.checked,
    max30Min: fastOnly.checked,
    sortBy: sortBySelect.value as "none" | "asc" | "desc"
  };
}

function render(): void {
  renderCategoryCounts(recipes);
  renderRecipes(filterAndSortRecipes(recipes, getFilter()));
}

function persistAndRender(): void {
  saveRecipes(recipes);
  render();
}

function resetForm(): void {
  recipeForm.reset();
  editRecipeIdInput.value = "";
  formModeTitle.textContent = "Добавить рецепт";
  formSubmitBtn.textContent = "Сохранить рецепт";
  cancelEditBtn.style.display = "none";
}

searchInput.addEventListener("input", render);
categoryFilter.addEventListener("change", render);
sortBySelect.addEventListener("change", render);
favoritesOnly.addEventListener("change", render);
fastOnly.addEventListener("change", render);

clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "Все";
  sortBySelect.value = "none";
  favoritesOnly.checked = false;
  fastOnly.checked = false;
  render();
});

cancelEditBtn.addEventListener("click", resetForm);

recipeList.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  if (!id) return;

  if (action === "favorite") {
    recipes = toggleFavorite(recipes, id);
    persistAndRender();
  } else if (action === "delete") {
    if (confirm("Вы действительно хотите удалить этот рецепт?")) {
      recipes = deleteRecipe(recipes, id);
      if (editRecipeIdInput.value === id) resetForm();
      persistAndRender();
    }
  } else if (action === "edit") {
    const targetRecipe = recipes.find(r => r.id === id);
    if (!targetRecipe) return;

    editRecipeIdInput.value = targetRecipe.id;
    formModeTitle.textContent = "Редактировать рецепт";
    formSubmitBtn.textContent = "Обновить рецепт";
    cancelEditBtn.style.display = "inline-block";

    const elements = recipeForm.elements;
    (elements.namedItem("title") as HTMLInputElement).value = targetRecipe.title;
    (elements.namedItem("category") as HTMLSelectElement).value = targetRecipe.category;
    (elements.namedItem("servings") as HTMLInputElement).value = String(targetRecipe.servings);
    (elements.namedItem("cookingTime") as HTMLInputElement).value = String(targetRecipe.cookingTime);
    (elements.namedItem("imageUrl") as HTMLInputElement).value = targetRecipe.imageUrl || "";
    (elements.namedItem("ingredients") as HTMLTextAreaElement).value = targetRecipe.ingredients.join(", ");
    (elements.namedItem("instructions") as HTMLTextAreaElement).value = targetRecipe.instructions;
  }
});

recipeForm.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();

  const formData = new FormData(recipeForm);
  const title = (formData.get("title") as string).trim();
  const category = formData.get("category") as Category;
  const servings = Number(formData.get("servings"));
  const cookingTime = Number(formData.get("cookingTime"));
  const imageUrl = (formData.get("imageUrl") as string).trim();
  const instructions = (formData.get("instructions") as string).trim();
  
  const ingredients = (formData.get("ingredients") as string)
    .split(",")
    .map(i => i.trim())
    .filter(Boolean);

  if (!title || !instructions || ingredients.length === 0) {
    formMessage.textContent = "Заполните обязательные поля.";
    return;
  }

  const editId = editRecipeIdInput.value;
  const draft: RecipeDraft = {
    title,
    category,
    servings,
    cookingTime,
    instructions,
    ingredients,
    imageUrl: imageUrl
  };

  if (editId) {
    recipes = updateRecipe(recipes, editId, draft);
    formMessage.textContent = "Рецепт успешно обновлен.";
  } else {
    recipes = [createRecipe(draft), ...recipes];
    formMessage.textContent = "Рецепт добавлен.";
  }

  resetForm();
  persistAndRender();
});

render();
