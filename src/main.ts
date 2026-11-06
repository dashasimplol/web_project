import type { Category, Recipe, RecipeDraft, RecipeFilter } from "./types.js";
import { fetchRecipes } from "./api.js";
import { filterAndSortRecipes, createRecipe, updateRecipe, toggleFavorite, deleteRecipe } from "./recipes.js";
import {
  searchInput, categoryFilter, sortBySelect, favoritesOnly, fastOnly, clearFiltersBtn,
  recipeForm, editRecipeIdInput, formModeTitle, formSubmitBtn, cancelEditBtn, recipeList, formMessage,
  renderRecipes, renderCategoryCounts, renderMessage
} from "./ui.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; recipes: Recipe[] };

let state: LoadState = { status: "loading" };

function setState(next: LoadState): void {
  state = next;
  render();
}

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
  switch (state.status) {
    case "loading":
      renderMessage("Загрузка рецептов");
      break;
    case "error":
      renderMessage(`Не удалось загрузить рецепты: ${state.message}`);
      break;
    case "success":
      renderCategoryCounts(state.recipes);
      renderRecipes(filterAndSortRecipes(state.recipes, getFilter()));
      break;
  }
}

function persistAndRender(updatedRecipes: Recipe[]): void {
  setState({ status: "success", recipes: updatedRecipes });
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
  if (state.status !== "success") return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  if (!id) return;

  let currentRecipes = state.recipes;

  if (action === "favorite") {
    currentRecipes = toggleFavorite(currentRecipes, id);
    persistAndRender(currentRecipes);
  } else if (action === "delete") {
    if (confirm("Вы действительно хотите удалить этот рецепт?")) {
      currentRecipes = deleteRecipe(currentRecipes, id);
      if (editRecipeIdInput.value === id) resetForm();
      persistAndRender(currentRecipes);
    }
  } else if (action === "edit") {
    const targetRecipe = currentRecipes.find(r => r.id === id);
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
  if (state.status !== "success") return;
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

  let currentRecipes = state.recipes;

  if (editId) {
    currentRecipes = updateRecipe(currentRecipes, editId, draft);
    formMessage.textContent = "Рецепт успешно обновлен.";
  } else {
    currentRecipes = [createRecipe(draft), ...currentRecipes];
    formMessage.textContent = "Рецепт добавлен.";
  }

  resetForm();
  persistAndRender(currentRecipes);
});

async function init(): Promise<void> {
  setState({ status: "loading" });
  try {
    const data = await fetchRecipes();
    setState({ status: "success", recipes: data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Неизвестная ошибка";
    setState({ status: "error", message: msg });
  }
}

void init();
