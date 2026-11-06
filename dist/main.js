import { fetchRecipes } from "./api.js";
import { filterAndSortRecipes, createRecipe, updateRecipe, toggleFavorite, deleteRecipe } from "./recipes.js";
import { searchInput, categoryFilter, sortBySelect, favoritesOnly, fastOnly, clearFiltersBtn, recipeForm, editRecipeIdInput, formModeTitle, formSubmitBtn, cancelEditBtn, recipeList, formMessage, renderRecipes, renderCategoryCounts, renderMessage } from "./ui.js";
let state = { status: "loading" };
function setState(next) {
    state = next;
    render();
}
function getFilter() {
    return {
        query: searchInput.value,
        category: categoryFilter.value,
        favoritesOnly: favoritesOnly.checked,
        max30Min: fastOnly.checked,
        sortBy: sortBySelect.value
    };
}
function render() {
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
function persistAndRender(updatedRecipes) {
    setState({ status: "success", recipes: updatedRecipes });
}
function resetForm() {
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
recipeList.addEventListener("click", (event) => {
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
    if (!id)
        return;
    let currentRecipes = state.recipes;
    if (action === "favorite") {
        currentRecipes = toggleFavorite(currentRecipes, id);
        persistAndRender(currentRecipes);
    }
    else if (action === "delete") {
        if (confirm("Вы действительно хотите удалить этот рецепт?")) {
            currentRecipes = deleteRecipe(currentRecipes, id);
            if (editRecipeIdInput.value === id)
                resetForm();
            persistAndRender(currentRecipes);
        }
    }
    else if (action === "edit") {
        const targetRecipe = currentRecipes.find(r => r.id === id);
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
});
recipeForm.addEventListener("submit", (event) => {
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
        .map(i => i.trim())
        .filter(Boolean);
    if (!title || !instructions || ingredients.length === 0) {
        formMessage.textContent = "Заполните обязательные поля.";
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
        imageUrl: imageUrl
    };
    let currentRecipes = state.recipes;
    if (editId) {
        currentRecipes = updateRecipe(currentRecipes, editId, draft);
        formMessage.textContent = "Рецепт успешно обновлен.";
    }
    else {
        currentRecipes = [createRecipe(draft), ...currentRecipes];
        formMessage.textContent = "Рецепт добавлен.";
    }
    resetForm();
    persistAndRender(currentRecipes);
});
async function init() {
    setState({ status: "loading" });
    try {
        const data = await fetchRecipes();
        setState({ status: "success", recipes: data });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Неизвестная ошибка";
        setState({ status: "error", message: msg });
    }
}
void init();
