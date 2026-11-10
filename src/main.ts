import type { Category, Recipe, RecipeDraft, RecipeFilter } from "./types.js";
import { isCategory } from "./parse.js";
import { debounce } from "./debounce.js";
import { withRetry } from "./retry.js";
import { fetchRecipes, createRecipeOnServer, setFavorite, deleteRecipeFromServer } from "./api.js";
import { filterAndSortRecipes, updateRecipe } from "./recipes.js";
import { errorMessage } from "./state.js";
import {
  searchInput, categoryFilter, sortBySelect, favoritesOnly, fastOnly, clearFiltersBtn,
  recipeForm, editRecipeIdInput, formModeTitle, formSubmitBtn, cancelEditBtn, recipeList, formMessage,
  renderRecipes, renderCategoryCounts, renderMessage, retryButton
} from "./ui.js";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; recipes: Recipe[] };

let state: LoadState = { status: "loading" };
let controller: AbortController | undefined;

function setState(next: LoadState): void {
  state = next;
  render();
}

function getFilter(): RecipeFilter {
  return {
    query: "",
    category: categoryFilter.value as Category | "Все",
    favoritesOnly: favoritesOnly.checked,
    max30Min: fastOnly.checked,
    sortBy: sortBySelect.value as "none" | "asc" | "desc"
  };
}

function render(): void {
  retryButton.hidden = state.status !== "error";

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

function updateRecipes(change: (list: Recipe[]) => Recipe[]): void {
  if (state.status !== "success") return;
  setState({ status: "success", recipes: change(state.recipes) });
}

function resetForm(): void {
  recipeForm.reset();
  editRecipeIdInput.value = "";
  formModeTitle.textContent = "Добавить рецепт";
  formSubmitBtn.textContent = "Сохранить рецепт";
  cancelEditBtn.style.display = "none";
}

async function search(): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  try {
    const recipes = await fetchRecipes(searchInput.value, signal);
    setState({ status: "success", recipes });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    setState({ status: "error", message: errorMessage(error) });
  }
}

searchInput.addEventListener("input", debounce(() => void search(), 300));
categoryFilter.addEventListener("change", render);
sortBySelect.addEventListener("change", render);
favoritesOnly.addEventListener("change", render);
fastOnly.addEventListener("change", render);
retryButton.addEventListener("click", () => void init());

clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "Все";
  sortBySelect.value = "none";
  favoritesOnly.checked = false;
  fastOnly.checked = false;
  void search();
});

cancelEditBtn.addEventListener("click", resetForm);

recipeList.addEventListener("click", async (event: MouseEvent) => {
  if (state.status !== "success") return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  if (!id || !action) return;

  try {
    if (action === "favorite") {
      const current = state.recipes.find((recipe) => recipe.id === id);
      if (!current) return;

      const updated = await setFavorite(id, !current.favorite);
      updateRecipes((list) =>
        list.map((recipe) => (recipe.id === id ? updated : recipe))
      );
    } else if (action === "delete") {
      if (confirm("Вы действительно хотите удалить этот рецепт?")) {
        await deleteRecipeFromServer(id);
        updateRecipes((list) => list.filter((recipe) => recipe.id !== id));
        if (editRecipeIdInput.value === id) resetForm();
      }
    } else if (action === "edit") {
      const targetRecipe = state.recipes.find((r) => r.id === id);
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
  } catch (error: unknown) {
    formMessage.textContent = `Не удалось выполнить действие: ${errorMessage(error)}`;
  }
});

recipeForm.addEventListener("submit", async (event: SubmitEvent) => {
  if (state.status !== "success") return;
  event.preventDefault();

  const formData = new FormData(recipeForm);
  const title = (formData.get("title") as string).trim();
  const category = formData.get("category");
  const servings = Number(formData.get("servings"));
  const cookingTime = Number(formData.get("cookingTime"));
  const imageUrl = (formData.get("imageUrl") as string).trim();
  const instructions = (formData.get("instructions") as string).trim();

  const ingredients = (formData.get("ingredients") as string)
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);

  if (!title || !instructions || ingredients.length === 0) {
    formMessage.textContent = "Заполните обязательные поля.";
    return;
  }

  if (!isCategory(category)) {
    formMessage.textContent = "Выберите категорию из списка.";
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
    imageUrl
  };

  try {
    if (editId) {
      const updated = await setFavorite(editId, state.recipes.find(r => r.id === editId)?.favorite || false);
      updateRecipes((list) => updateRecipe(list, editId, draft));
      formMessage.textContent = "Рецепт успешно обновлен.";
    } else {
      const newRecipe = { ...draft, favorite: false };
      const created = await createRecipeOnServer(newRecipe);
      updateRecipes((list) => [created, ...list]);
      formMessage.textContent = "Рецепт добавлен.";
    }
    resetForm();
  } catch (error: unknown) {
    formMessage.textContent = `Не удалось сохранить рецепт: ${errorMessage(error)}`;
  }
});

async function init(): Promise<void> {
  setState({ status: "loading" });
  try {
    const recipes = await withRetry(() => fetchRecipes(), 3, 1000);
    setState({ status: "success", recipes });
  } catch (error: unknown) {
    setState({ status: "error", message: errorMessage(error) });
  }
}

void init();
