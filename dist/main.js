import { isCategory } from "./parse.js";
import { debounce } from "./debounce.js";
import { withRetry } from "./retry.js";
import { fetchRecipes, createRecipeOnServer, setFavorite, deleteRecipeFromServer } from "./api.js";
import { filterAndSortRecipes, updateRecipe } from "./recipes.js";
import { errorMessage } from "./state.js";
import { searchInput, categoryFilter, sortBySelect, favoritesOnly, fastOnly, clearFiltersBtn, recipeForm, editRecipeIdInput, formModeTitle, formSubmitBtn, cancelEditBtn, recipeList, formMessage, renderRecipes, renderCategoryCounts, renderMessage, retryButton } from "./ui.js";
let state = { status: "loading" };
let controller;
function setState(next) {
    state = next;
    render();
}
function getFilter() {
    return {
        query: "",
        category: categoryFilter.value,
        favoritesOnly: favoritesOnly.checked,
        max30Min: fastOnly.checked,
        sortBy: sortBySelect.value
    };
}
function render() {
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
function updateRecipes(change) {
    if (state.status !== "success")
        return;
    setState({ status: "success", recipes: change(state.recipes) });
}
function resetForm() {
    recipeForm.reset();
    editRecipeIdInput.value = "";
    formModeTitle.textContent = "Добавить рецепт";
    formSubmitBtn.textContent = "Сохранить рецепт";
    cancelEditBtn.style.display = "none";
}
async function search() {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    try {
        const recipes = await fetchRecipes(searchInput.value, signal);
        setState({ status: "success", recipes });
    }
    catch (error) {
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
recipeList.addEventListener("click", async (event) => {
    if (state.status !== "success")
        return;
    const target = event.target;
    if (!(target instanceof HTMLElement))
        return;
    const button = target.closest("button[data-action]");
    if (!button)
        return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    if (!id || !action)
        return;
    try {
        if (action === "favorite") {
            const current = state.recipes.find((recipe) => recipe.id === id);
            if (!current)
                return;
            const updated = await setFavorite(id, !current.favorite);
            updateRecipes((list) => list.map((recipe) => (recipe.id === id ? updated : recipe)));
        }
        else if (action === "delete") {
            if (confirm("Вы действительно хотите удалить этот рецепт?")) {
                await deleteRecipeFromServer(id);
                updateRecipes((list) => list.filter((recipe) => recipe.id !== id));
                if (editRecipeIdInput.value === id)
                    resetForm();
            }
        }
        else if (action === "edit") {
            const targetRecipe = state.recipes.find((r) => r.id === id);
            if (!targetRecipe)
                return;
            editRecipeIdInput.value = targetRecipe.id;
            formModeTitle.textContent = "Редактировать рецепт";
            formSubmitBtn.textContent = "Обновить рецепт";
            cancelEditBtn.style.display = "inline-block";
            const elements = recipeForm.elements;
            elements.namedItem("title").value = targetRecipe.title;
            elements.namedItem("category").value = targetRecipe.category;
            elements.namedItem("servings").value = String(targetRecipe.servings);
            elements.namedItem("cookingTime").value = String(targetRecipe.cookingTime);
            elements.namedItem("imageUrl").value = targetRecipe.imageUrl || "";
            elements.namedItem("ingredients").value = targetRecipe.ingredients.join(", ");
            elements.namedItem("instructions").value = targetRecipe.instructions;
        }
    }
    catch (error) {
        formMessage.textContent = `Не удалось выполнить действие: ${errorMessage(error)}`;
    }
});
recipeForm.addEventListener("submit", async (event) => {
    if (state.status !== "success")
        return;
    event.preventDefault();
    const formData = new FormData(recipeForm);
    const title = formData.get("title").trim();
    const category = formData.get("category");
    const servings = Number(formData.get("servings"));
    const cookingTime = Number(formData.get("cookingTime"));
    const imageUrl = formData.get("imageUrl").trim();
    const instructions = formData.get("instructions").trim();
    const ingredients = formData.get("ingredients")
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
    const draft = {
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
        }
        else {
            const newRecipe = { ...draft, favorite: false };
            const created = await createRecipeOnServer(newRecipe);
            updateRecipes((list) => [created, ...list]);
            formMessage.textContent = "Рецепт добавлен.";
        }
        resetForm();
    }
    catch (error) {
        formMessage.textContent = `Не удалось сохранить рецепт: ${errorMessage(error)}`;
    }
});
async function init() {
    setState({ status: "loading" });
    try {
        const recipes = await withRetry(() => fetchRecipes(), 3, 1000);
        setState({ status: "success", recipes });
    }
    catch (error) {
        setState({ status: "error", message: errorMessage(error) });
    }
}
void init();
