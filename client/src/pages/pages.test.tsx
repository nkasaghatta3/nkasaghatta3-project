import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";

import AuthPage from "./AuthPage";
import Recipes from "./Recipes";
import RecipeDetail from "./RecipeDetail";
import AIAssistant from "./AIAssistant";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock("../lib/auth", () => ({
  setToken: vi.fn(),
}));

const mockedAxios = vi.mocked(axios);


beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthPage", () => {
  it("renders login and validates an empty submission", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Welcome Back!" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      screen.getByText("Email and password are required."),
    ).toBeInTheDocument();
  });
});

describe("Recipes", () => {
  it("loads and displays recipe cards", async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          _id: "recipe-1",
          title: "Chickpea Stew",
          image: "",
          ingredients: [{ name: "Chickpeas", quantity: "1 can" }],
          tags: ["Vegan"],
        },
      ],
    } as never);

    render(
      <MemoryRouter>
        <Recipes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Chickpea Stew")).toBeInTheDocument();
    expect(screen.getByText("Vegan")).toBeInTheDocument();
  });
});

describe("RecipeDetail", () => {
  it("renders recipe ingredients and instructions", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        _id: "recipe-1",
        title: "Spicy Chickpea Stew",
        ingredients: [{ name: "Chickpeas", quantity: "1 can" }],
        instructions: [
          { step: 1, description: "Add the chickpeas." },
        ],
        tags: ["Vegan"],
      },
    } as never);

    render(
      <MemoryRouter initialEntries={["/recipes/recipe-1"]}>
        <Routes>
          <Route path="/recipes/:id" element={<RecipeDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Spicy Chickpea Stew" }),
    ).toBeInTheDocument();

    expect(screen.getByText("1 can Chickpeas")).toBeInTheDocument();
    expect(screen.getByText("Add the chickpeas.")).toBeInTheDocument();
  });
});

describe("AIAssistant", () => {
  it("rejects an empty prompt without calling the backend", async () => {
    const user = userEvent.setup();

    render(<AIAssistant />);

    await user.click(
      screen.getByRole("button", { name: "Ask the assistant" }),
    );

    expect(
      screen.getByText("Please enter a prompt before submitting."),
    ).toBeInTheDocument();

    expect(fetch).not.toHaveBeenCalled();
  });
});
