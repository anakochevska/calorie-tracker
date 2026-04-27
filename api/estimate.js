export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { food } = req.body;
  if (!food || typeof food !== "string" || food.length > 200) {
    return res.status(400).json({ error: "Invalid food description" });
  }

  const apiKey = process.env.API_NINJAS_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const response = await fetch(
      `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(food)}`,
      {
        headers: { "X-Api-Key": apiKey },
      }
    );

    if (!response.ok) {
      console.error("API Ninjas error:", response.status);
      return res.status(502).json({ error: "Nutrition API error" });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Food not found" });
    }

    // Sum up all items (API may return multiple components)
    // e.g. "pepperoni calzone" might return separate items
    const totals = data.reduce(
      (acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein_g || 0),
        carbs: acc.carbs + (item.carbohydrates_total_g || 0),
        fat: acc.fat + (item.fat_total_g || 0),
        grams: acc.grams + (item.serving_size_g || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
    );

    const result = {
      name: data.map((d) => d.name).join(" + "),
      grams: Math.round(totals.grams),
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      items: data.map((d) => d.name),
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error("Estimation error:", err);
    return res.status(500).json({ error: "Failed to estimate nutrition" });
  }
}
