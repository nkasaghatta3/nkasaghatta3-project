import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import { clearToken } from "../lib/auth";

type IngredientDraft = {
  id: string;
  name: string;
  quantity: string;
};

type InstructionDraft = {
  id: string;
  description: string;
};

type RecipeResponse = {
  title: string;
  description?: string;
  image?: string;
  ingredients: { name: string; quantity: string }[];
  instructions: { step: number; description: string }[];
  tags?: string[];
};

function createId() {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}



function createIngredient(): IngredientDraft {
  return { id: createId(), name: "", quantity: "" };
}

function createInstruction(): InstructionDraft {
  return { id: createId(), description: "" };
}

function RecipeForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    createIngredient(),
  ]);
  const [instructions, setInstructions] = useState<InstructionDraft[]>([
    createInstruction(),
  ]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    async function loadRecipe() {
      try {
        const response = await api.get<RecipeResponse>(`/recipes/${id}`);
        const recipe = response.data;

        setTitle(recipe.title);
        setDescription(recipe.description ?? "");
        setImage(recipe.image ?? "");
        setTags((recipe.tags ?? []).join(", "));

        setIngredients(
          recipe.ingredients.length > 0
            ? recipe.ingredients.map((ingredient) => ({
                id: createId(),
                name: ingredient.name,
                quantity: ingredient.quantity,
              }))
            : [createIngredient()],
        );

        setInstructions(
          recipe.instructions.length > 0
            ? recipe.instructions
                .slice()
                .sort((first, second) => first.step - second.step)
                .map((instruction) => ({
                  id: createId(),
                  description: instruction.description,
                }))
            : [createInstruction()],
        );
      } catch (requestError) {
        if (
          axios.isAxiosError(requestError) &&
          requestError.response?.status === 401
        ) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }

        setError("Unable to load this recipe.");
      } finally {
        setIsLoading(false);
      }
    }

    loadRecipe();
  }, [id, navigate]);

  function updateIngredient(
    ingredientId: string,
    field: "name" | "quantity",
    value: string,
  ) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === ingredientId
          ? { ...ingredient, [field]: value }
          : ingredient,
      ),
    );
  }

  function updateInstruction(instructionId: string, value: string) {
    setInstructions((current) =>
      current.map((instruction) =>
        instruction.id === instructionId
          ? { ...instruction, description: value }
          : instruction,
      ),
    );
  }

  function removeIngredient(ingredientId: string) {
    setIngredients((current) =>
      current.length === 1
        ? current
        : current.filter((ingredient) => ingredient.id !== ingredientId),
    );
  }

  function removeInstruction(instructionId: string) {
    setInstructions((current) =>
      current.length === 1
        ? current
        : current.filter((instruction) => instruction.id !== instructionId),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const invalidIngredient = ingredients.some(
      (ingredient) =>
        !ingredient.name.trim() || !ingredient.quantity.trim(),
    );
    const invalidInstruction = instructions.some(
      (instruction) => !instruction.description.trim(),
    );

    if (
      !title.trim() ||
      !image.trim() ||
      invalidIngredient ||
      invalidInstruction
    ) {
      setError(
        "Add a title, image URL, complete ingredients, and complete instructions.",
      );
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      image: image.trim(),
      ingredients: ingredients.map(({ name, quantity }) => ({
        name: name.trim(),
        quantity: quantity.trim(),
      })),
      instructions: instructions.map((instruction, index) => ({
        step: index + 1,
        description: instruction.description.trim(),
      })),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    setIsSubmitting(true);

    try {
      if (isEdit && id) {
        await api.put(`/recipes/${id}`, payload);
        setSuccess("Recipe updated successfully.");
      } else {
        await api.post("/recipes", payload);
        setSuccess("Recipe created successfully.");
        setTitle("");
        setDescription("");
        setImage("");
        setTags("");
        setIngredients([createIngredient()]);
        setInstructions([createInstruction()]);
      }
    } catch {
      setError(
        isEdit
          ? "Unable to update this recipe."
          : "Unable to create this recipe.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="recipe-status">Loading recipe...</p>;
  }

  return (
    <section className="recipe-form-page">
      <p className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <span>›</span>
        {isEdit ? "Edit Recipe" : "Create Recipe"}
      </p>

      <h1>{isEdit ? "Edit Recipe" : "Create Recipe"}</h1>

      <form className="recipe-form" onSubmit={handleSubmit}>
        <label htmlFor="recipe-title">Title</label>
        <input
          id="recipe-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label htmlFor="recipe-image">Image URL</label>
        <input
          id="recipe-image"
          type="url"
          value={image}
          onChange={(event) => setImage(event.target.value)}
          required
        />

        <label htmlFor="recipe-description">Description</label>
        <textarea
          id="recipe-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />

        <fieldset>
          <legend>Ingredients</legend>

          {ingredients.map((ingredient, index) => (
            <div className="recipe-form-row" key={ingredient.id}>
              <input
                aria-label={`Ingredient ${index + 1} name`}
                value={ingredient.name}
                onChange={(event) =>
                  updateIngredient(
                    ingredient.id,
                    "name",
                    event.target.value,
                  )
                }
                placeholder="Ingredient"
                required
              />
              <input
                aria-label={`Ingredient ${index + 1} quantity`}
                value={ingredient.quantity}
                onChange={(event) =>
                  updateIngredient(
                    ingredient.id,
                    "quantity",
                    event.target.value,
                  )
                }
                placeholder="Quantity"
                required
              />
              <button
                className="remove-row-button"
                type="button"
                onClick={() => removeIngredient(ingredient.id)}
                disabled={ingredients.length === 1}
              >
                Remove
              </button>
            </div>
          ))}

          <button
            className="add-row-button"
            type="button"
            onClick={() =>
              setIngredients((current) => [...current, createIngredient()])
            }
          >
            + Add ingredient
          </button>
        </fieldset>

        <fieldset>
          <legend>Instructions</legend>

          {instructions.map((instruction, index) => (
            <div className="recipe-form-row" key={instruction.id}>
              <span className="instruction-number">{index + 1}</span>
              <textarea
                aria-label={`Instruction ${index + 1}`}
                value={instruction.description}
                onChange={(event) =>
                  updateInstruction(instruction.id, event.target.value)
                }
                rows={2}
                required
              />
              <button
                className="remove-row-button"
                type="button"
                onClick={() => removeInstruction(instruction.id)}
                disabled={instructions.length === 1}
              >
                Remove
              </button>
            </div>
          ))}

          <button
            className="add-row-button"
            type="button"
            onClick={() =>
              setInstructions((current) => [
                ...current,
                createInstruction(),
              ])
            }
          >
            + Add instruction
          </button>
        </fieldset>

        <label htmlFor="recipe-tags">Tags</label>
        <input
          id="recipe-tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="vegan, quick, dinner"
        />

        {error && (
          <p className="recipe-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="recipe-success" role="status">
            {success}{" "}
            <Link to="/dashboard">Return to dashboard</Link>
          </p>
        )}

        <button className="primary-action" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save Changes"
              : "Create Recipe"}
        </button>
      </form>
    </section>
  );
}

export default RecipeForm;
