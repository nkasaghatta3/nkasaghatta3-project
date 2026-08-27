# Design Document

This document outlines the design and user stories for the Spoonful application.

**Figma Link:** [Spoonful Figma Design](https://www.figma.com/design/4UKIjxdUxW0IodUmodX8j7/Spoonful?node-id=1-2082) for css and design

## Core Features

| Feature          | Description                                | Access       |
| ---------------- | ------------------------------------------ | ------------ |
| Landing Page     | Welcome message and call-to-action         | All users    |
| Authentication   | Email/password login                       | Creators only|
| Recipe Creation  | Form input: title, photo, ingredients, instructions | Creators only|
| Recipe Update    | Edit existing recipe entries               | Creators only|
| Recipe Deletion  | Delete recipe with confirmation            | Creators only|
| Browse Recipes   | Public recipe viewing                      | All users    |
| Search/Filter    | Find by keyword, tag, or ingredient        | All users    |

<hr/>

## Key Flows

**Backend server** - is on a `localhost:3000`
**axios** - should be used for api calls

### Landing Page
- **GET /** → Public entry point.
- **Show CTA:**
    - **Explore Recipes** → routes to `/recipes` (public index)
    - **Login** → routes to `/login`

### Login / Signup
- **POST /api/users/login** and **POST /api/users/signup** → Auth flow for creators only.
- On success, redirect to `/dashboard`
- Protect `/dashboard` and recipe CRUD routes with auth guard.

### Create Recipe
- **POST /api/recipes** → Accessible from `/dashboard`
- Form inputs: title, image, ingredients, instructions,tags, description
- for the image, just use a link (imugur or something) in an regular input instead of file upload
- Validate → Submit → Show success toast/modal
- Update UI without reload

Example format of data 

```js
{
  "title": "Steak baby!",
  "description": "Crunchy romaine with creamy cashew Caesar dressing.",
  "image": "https://example.com/images/vegan-caesar.jpg",
  "ingredients": [
    { "name": "Romaine lettuce", "quantity": "1 head" },
    { "name": "Cashews", "quantity": "1/2 cup" },
    { "name": "Lemon juice", "quantity": "2 tbsp" },
    { "name": "Dijon mustard", "quantity": "1 tsp" },
    { "name": "Garlic clove", "quantity": "1" }
  ],
  "instructions": [
    { "step": 1, "description": "Blend the cashews, lemon juice, mustard, and garlic until smooth." },
    { "step": 2, "description": "Chop romaine lettuce and place in a bowl." },
    { "step": 3, "description": "Toss with the blended dressing and serve chilled." }
  ],
  "tags": ["vegan", "salad", "healthy"]

}
```

### Update Recipe
- **PUT /api/recipes/:id** → Click "Edit" on a dashboard item
- Prefill form with existing data
- On submit: update, show success, refresh list

### Delete Recipe
- **DELETE /api/recipes/:id** → Button in dashboard
- Confirm dialog → On accept, delete and update UI
- Handle edge cases (404, permission errors)

### Browse + Search Recipes
- **GET /api/recipes** → Publicly accessible
- List + Search input
- Query by title/tag/ingredient
- Click recipe card → route to **GET /recipes/:id**

## User Stories

### Recipe Management

**1. Create a Recipe**
> *As a recipe creator, I want to add new recipes so I can store and share them.*

**Acceptance Criteria:**
- Form includes title, image, ingredients, and instructions.
- Required field validation.
- Success message on submission.

---

**2. View Recipes**
> *As any user, I want to view a list of recipes so I can find something to cook.*

**Acceptance Criteria:**
- Recipe cards show key info.
- Click to open full recipe.
- Works for both logged-in and guest users.

---

**3. Edit a Recipe**
> *As a creator, I want to edit my recipe so I can fix or improve it.*

**Acceptance Criteria:**
- "Edit" button appears on creator dashboard.
- Prefilled form loads existing data.
- Save updates the recipe.

---

**4. Delete a Recipe**
> *As a creator, I want to delete my recipe so I can manage my content.*

**Acceptance Criteria:**
- "Delete" button on dashboard.
- Confirmation prompt required.
- Removed from all views on success.

### Recipe Discovery

**5. Search Recipes**
> *As a viewer, I want to search by keyword so I can quickly find recipes.*

**Acceptance Criteria:**
- Search input visible on browse page.
- Results update dynamically.
- "No match" message if empty.

---

**6. Guest Browsing**
> *As a visitor, I want to browse recipes without logging in.*

**Acceptance Criteria:**
- No login required to view recipes.
- Read-only access to recipe content.


---

## AI Recipe Assistant

| Feature | Description | Access |
| --- | --- | --- |
| AI Recipe Assistant | Prompt-driven recipe suggestions powered by Claude | All users |

### AI Assistant Flow

- **Route:** `/ai-assistant`
- **Backend endpoint:** `POST /api/ai/stream` — proxies the streaming request to an LLM (Claude or Gemini, whichever API key is configured on the backend). The API key lives on the server and is never sent to the client.
- **User experience:** User types what ingredients they have or what they want to eat. The model streams a recipe suggestion back token by token — text appears progressively, not all at once.

### User Story

**7. Get an AI Recipe Suggestion**
> *As a user, I want to describe what I have in my kitchen and get a recipe suggestion so I can decide what to cook without browsing the full list.*

**Acceptance Criteria:**
- Text input for describing ingredients or meal preference
- Submit triggers a streaming request to the backend
- Response renders progressively — token by token, not all at once
- Loading state shown while waiting for first token
- Error state shown if the request fails
- Route is accessible from the main navigation
