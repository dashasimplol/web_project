import { initialRecipes } from "./data.js";
import { loadRecipes, saveRecipes } from "./storage.js";
import { filterAndSortRecipes, createRecipe, updateRecipe, toggleFavorite, deleteRecipe } from "./recipes.js";
import { searchInput, categoryFilter, sortBySelect, favoritesOnly, fastOnly, clearFiltersBtn, recipeForm, editRecipeIdInput, formModeTitle, formSubmitBtn, cancelEditBtn, recipeList, formMessage, renderRecipes, renderCategoryCounts } from "./ui.js";
let recipes = loadRecipes() ?? initialRecipes;
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
    renderCategoryCounts(recipes);
    renderRecipes(filterAndSortRecipes(recipes, getFilter()));
}
function persistAndRender() {
    saveRecipes(recipes);
    render();
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
    if (action === "favorite") {
        recipes = toggleFavorite(recipes, id);
        persistAndRender();
    }
    else if (action === "delete") {
        if (confirm("Вы действительно хотите удалить этот рецепт?")) {
            recipes = deleteRecipe(recipes, id);
            if (editRecipeIdInput.value === id)
                resetForm();
            persistAndRender();
        }
    }
    else if (action === "edit") {
        const targetRecipe = recipes.find(r => r.id === id);
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
    if (editId) {
        recipes = updateRecipe(recipes, editId, draft);
        formMessage.textContent = "Рецепт успешно обновлен.";
    }
    else {
        recipes = [createRecipe(draft), ...recipes];
        formMessage.textContent = "Рецепт добавлен.";
    }
    resetForm();
    persistAndRender();
});
render();
