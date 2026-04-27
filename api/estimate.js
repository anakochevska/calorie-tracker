export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { food } = req.body;
  if (!food || typeof food !== "string" || food.length > 200) {
    return res.status(400).json({ error: "Invalid food description" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Estimate the nutritional values for this food: "${food}"

Assume a typical single serving. Respond with ONLY a JSON object, no other text, no markdown backticks:
{"name":"<clean food name>","grams":<serving weight in grams>,"calories":<kcal>,"protein":<grams>,"carbs":<grams>,"fat":<grams>}

Be realistic and accurate. Use common nutritional databases as reference. Round to 1 decimal place for macros, whole numbers for calories and grams.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return res.status(502).json({ error: "AI service error" });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON from response
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate the response has required fields
    const result = {
      name: String(parsed.name || food),
      grams: Math.round(Number(parsed.grams) || 100),
      calories: Math.round(Number(parsed.calories) || 0),
      protein: Math.round((Number(parsed.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(parsed.carbs) || 0) * 10) / 10,
      fat: Math.round((Number(parsed.fat) || 0) * 10) / 10,
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error("Estimation error:", err);
    return res.status(500).json({ error: "Failed to estimate nutrition" });
  }
}
