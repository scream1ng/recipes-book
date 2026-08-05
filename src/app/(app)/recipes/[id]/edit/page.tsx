import { getRecipeForEdit } from "@/lib/actions/recipes";
import { RecipeEditForm } from "@/components/recipe/RecipeEditForm";

export default async function RecipeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipeForEdit(id);

  return <RecipeEditForm recipe={recipe} />;
}
