import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

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
  tags: string[];
};

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      const keyword = search.trim();

      setIsLoading(true);
      setError("");

      try {
        const response = await axios.get<Recipe[]>(
          `${BACKEND_URL}/api/recipes`,
          {
            params: keyword ? { q: keyword } : undefined,
            signal: controller.signal,
          },
        );

        setRecipes(response.data);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          axios.isAxiosError(requestError)
            ? requestError.response?.data?.message ||
                "Unable to load recipes."
            : "Unable to load recipes.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  return (
    <section className="recipe-list-page">
      <p className="breadcrumb">
        <Link to="/recipes">Home</Link> <span>›</span> Recipe List
      </p>

      <h1>Recipe List</h1>

      <label className="visually-hidden" htmlFor="recipe-search">
        Search recipes by title, tag, or ingredient
      </label>

      <input
        id="recipe-search"
        className="recipe-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by title, tag, or ingredient"
      />

      {isLoading && <p className="recipe-status">Loading recipes...</p>}

      {error && (
        <p className="recipe-error" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && recipes.length === 0 && (
        <p className="recipe-status">No recipes match your search.</p>
      )}

      <div className="recipe-list">
        {recipes.map((recipe) => (
          <article className="recipe-card" key={recipe._id}>
            {recipe.image ? (
              <img
                className="recipe-card-image"
                src={recipe.image}
                alt={recipe.title}
              />
            ) : (
              <div className="recipe-card-image recipe-image-placeholder">
                No image
              </div>
            )}

            <div className="recipe-card-body">
              <h2>{recipe.title}</h2>

              {recipe.tags.length > 0 && (
                <div className="recipe-tags" aria-label="Recipe tags">
                  {recipe.tags.map((tag) => (
                    <span className="recipe-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <Link className="recipe-card-link" to={`/recipes/${recipe._id}`}>
                View Recipe
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Recipes;
