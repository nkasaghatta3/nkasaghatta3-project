import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { clearToken } from "../lib/auth";

type Ingredient = {
  name: string;
  quantity: string;
};

type Recipe = {
  _id: string;
  title: string;
  description?: string;
  image?: string;
  ingredients: Ingredient[];
  tags?: string[];
  createdAt?: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOwnedRecipes() {
      try {
        const response = await api.get<Recipe[]>("/recipes/mine");
        setRecipes(response.data);
      } catch (requestError) {
        if (
          axios.isAxiosError(requestError) &&
          requestError.response?.status === 401
        ) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }

        setError("Unable to load your recipes.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOwnedRecipes();
  }, [navigate]);

  async function handleDelete(recipe: Recipe) {
    const confirmed = window.confirm(
      `Delete "${recipe.title}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/recipes/${recipe._id}`);
      setRecipes((currentRecipes) =>
        currentRecipes.filter((item) => item._id !== recipe._id),
      );
    } catch {
      setError("Unable to delete this recipe.");
    }
  }

  return (
    <section className="dashboard-page">
      <p className="eyebrow">Welcome back</p>
      <h1>Your Recipes</h1>
      <p className="dashboard-intro">
        Manage your recipes or add a new one.
      </p>

      <div className="dashboard-actions">
        <Link className="primary-action" to="/recipes/new">
          Create Recipe
        </Link>
        <Link className="secondary-action" to="/recipes">
          Browse Recipes
        </Link>
      </div>

      {isLoading && <p className="recipe-status">Loading your recipes...</p>}

      {error && (
        <p className="recipe-error" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && recipes.length === 0 && (
        <p className="recipe-status">
          You have not created any recipes yet.
        </p>
      )}

      <div className="dashboard-recipe-grid">
        {recipes.map((recipe) => (
          <article className="dashboard-recipe-card" key={recipe._id}>
            {recipe.image ? (
              <img
                className="dashboard-recipe-image"
                src={recipe.image}
                alt={recipe.title}
              />
            ) : (
              <div className="dashboard-recipe-image recipe-image-placeholder">
                No image
              </div>
            )}

            <div className="dashboard-recipe-body">
              <h2>{recipe.title}</h2>

              {recipe.tags && recipe.tags.length > 0 && (
                <div className="recipe-tags" aria-label="Recipe tags">
                  {recipe.tags.map((tag, index) => (
                    <span className="recipe-tag" key={`${tag}-${index}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="dashboard-card-actions">
                <Link to={`/recipes/${recipe._id}/edit`}>Edit</Link>
                <button type="button" onClick={() => handleDelete(recipe)}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Dashboard;
