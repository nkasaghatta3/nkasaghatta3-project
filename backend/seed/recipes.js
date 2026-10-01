const path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const Recipe = require("../models/recipe");
const User = require("../models/user");

const DEMO_EMAIL = "demo@spoonful.local";
const DEMO_PASSWORD = "spoonful-demo-password";

const recipes = [
  {
    title: "Chickpea Stew",
    description: "A warm, savory chickpea stew with tomatoes and spices.",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    ingredients: [
      { name: "Olive oil", quantity: "1 tbsp" },
      { name: "Onion", quantity: "1" },
      { name: "Garlic", quantity: "2 cloves" },
      { name: "Chickpeas", quantity: "1 can" },
      { name: "Diced tomatoes", quantity: "1 can" },
      { name: "Cumin", quantity: "1 tsp" },
      { name: "Chili flakes", quantity: "1/2 tsp" },
      { name: "Salt", quantity: "To taste" },
    ],
    instructions: [
      { step: 1, description: "Sauté the onion and garlic in olive oil." },
      { step: 2, description: "Add chickpeas, tomatoes, cumin, and chili flakes." },
      { step: 3, description: "Simmer for 20 minutes and season with salt." },
    ],
    tags: ["Vegan", "Gluten-free", "Easy"],
  },
  {
    title: "Caesar Salad",
    description: "A crisp Caesar salad with a creamy homemade dressing.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    ingredients: [
      { name: "Romaine lettuce", quantity: "1 head" },
      { name: "Parmesan", quantity: "1/2 cup" },
      { name: "Croutons", quantity: "1 cup" },
      { name: "Lemon juice", quantity: "2 tbsp" },
      { name: "Dijon mustard", quantity: "1 tsp" },
    ],
    instructions: [
      { step: 1, description: "Wash and chop the romaine lettuce." },
      { step: 2, description: "Whisk together the dressing ingredients." },
      { step: 3, description: "Toss the lettuce with dressing, Parmesan, and croutons." },
    ],
    tags: ["Salad", "Easy", "Quick"],
  },
  {
    title: "Coconut Lentil Curry",
    description: "A creamy coconut curry with hearty lentils and warming spices.",
    image:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
    ingredients: [
      { name: "Red lentils", quantity: "1 cup" },
      { name: "Coconut milk", quantity: "1 can" },
      { name: "Onion", quantity: "1" },
      { name: "Curry powder", quantity: "2 tbsp" },
      { name: "Vegetable broth", quantity: "2 cups" },
    ],
    instructions: [
      { step: 1, description: "Sauté the onion with curry powder." },
      { step: 2, description: "Add lentils, coconut milk, and vegetable broth." },
      { step: 3, description: "Simmer until the lentils are tender." },
    ],
    tags: ["Vegan", "Gluten-free", "Indian"],
  },
  {
    title: "Banana Oat Muffins",
    description: "Soft banana muffins made with oats and naturally sweet fruit.",
    image:
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=80",
    ingredients: [
      { name: "Ripe bananas", quantity: "3" },
      { name: "Rolled oats", quantity: "1 1/2 cups" },
      { name: "Eggs", quantity: "2" },
      { name: "Maple syrup", quantity: "1/4 cup" },
      { name: "Baking powder", quantity: "1 tsp" },
    ],
    instructions: [
      { step: 1, description: "Mash the bananas in a mixing bowl." },
      { step: 2, description: "Stir in the oats, eggs, maple syrup, and baking powder." },
      { step: 3, description: "Bake in a muffin tin until golden and set." },
    ],
    tags: ["Dessert", "Easy", "Quick"],
  },
  {
    title: "Tofu Stir Fry",
    description: "Crispy tofu and vegetables tossed in a quick savory sauce.",
    image:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
    ingredients: [
      { name: "Firm tofu", quantity: "1 block" },
      { name: "Bell pepper", quantity: "1" },
      { name: "Broccoli", quantity: "2 cups" },
      { name: "Soy sauce", quantity: "2 tbsp" },
      { name: "Sesame oil", quantity: "1 tsp" },
    ],
    instructions: [
      { step: 1, description: "Press and cube the tofu." },
      { step: 2, description: "Stir-fry the tofu and vegetables until tender." },
      { step: 3, description: "Add the soy sauce and sesame oil before serving." },
    ],
    tags: ["Vegan", "Asian", "Quick"],
  },
];

async function seedRecipes() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing from backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URL);

  try {
    let demoUser = await User.findOne({ email: DEMO_EMAIL });

    if (!demoUser) {
      demoUser = await User.create({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      console.log(`Created demo user: ${DEMO_EMAIL}`);
    }

    for (const recipe of recipes) {
      await Recipe.findOneAndUpdate(
        {
          title: recipe.title,
          ownerId: demoUser._id,
        },
        {
          ...recipe,
          ownerId: demoUser._id,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
    }

    console.log(`Seeded ${recipes.length} recipes.`);
  } finally {
    await mongoose.disconnect();
  }
}

seedRecipes().catch((error) => {
  console.error("Recipe seeding failed:", error);
  process.exitCode = 1;
});
