import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";

type Ingredient = {
  name: string;
  quantity: string;
};

type Instruction = {
  _id?: string;
  step: number;
  description: string;
};

type Recipe = {
  _id: string;
  title: string;
  image?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
};

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Recipe not found.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadRecipe() {
      try {
        const response = await axios.get<Recipe>(
          `${BACKEND_URL}/api/recipes/${id}`,
          { signal: controller.signal },
        );

        setRecipe(response.data);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          axios.isAxiosError(requestError)
            ? requestError.response?.data?.message || "Unable to load recipe."
            : "Unable to load recipe.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadRecipe();

    return () => controller.abort();
  }, [id]);

  if (isLoading) {
    return <p className="recipe-status">Loading recipe...</p>;
  }

  if (error || !recipe) {
    return (
      <section className="recipe-detail-page">
        <Link className="recipe-back-link" to="/recipes">
          Back to recipes
        </Link>
        <p className="recipe-error" role="alert">
          {error || "Recipe not found."}
        </p>
      </section>
    );
  }

  return (
    <section className="recipe-detail-page">
      <p className="breadcrumb">
        <Link to="/recipes">Home</Link>
        <span>›</span>
        <Link to="/recipes">Recipe List</Link>
        <span>›</span>
        {recipe.title}
      </p>

      {recipe.image ? (
        <img
          className="recipe-detail-image"
          src={recipe.image}
          alt={recipe.title}
        />
      ) : (
        <div className="recipe-detail-image recipe-image-placeholder">
          No image
        </div>
      )}

      <h1>{recipe.title}</h1>

      <section className="recipe-detail-section">
        <h2>Ingredients</h2>
        <ul className="recipe-detail-ingredients">
          {recipe.ingredients.map((ingredient) => (
            <li key={`${ingredient.name}-${ingredient.quantity}`}>
              {ingredient.quantity} {ingredient.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="recipe-detail-section">
        <h2>Instructions</h2>
        <ol className="recipe-detail-instructions">
          {recipe.instructions
            .slice()
            .sort((first, second) => first.step - second.step)
            .map((instruction) => (
              <li key={instruction._id || instruction.step}>
                {instruction.description}
              </li>
            ))}
        </ol>
      </section>

      <section className="recipe-detail-section">
        <h2>Tags</h2>
        <div className="recipe-tags" aria-label="Recipe tags">
          {recipe.tags.map((tag) => (
            <span className="recipe-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}

export default RecipeDetail;
