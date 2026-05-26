const http = require("http");

const TILE_CODES = [
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}m`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}p`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}s`),
  "E",
  "S",
  "W",
  "N",
  "C",
  "F",
  "B",
];

const PORT = Number(process.env.VISION_PROXY_PORT || 8787);
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function createServer() {
  return http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST" || req.url !== "/recognize-mahjong") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    try {
      const body = await readJson(req);
      const recognition = await recognizeMahjong(body);
      sendJson(res, 200, { recognition });
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
  });
}

async function recognizeMahjong({ imageBase64, mimeType = "image/jpeg", context = {} }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is required on the vision proxy server.");
    error.statusCode = 500;
    throw error;
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    const error = new Error("imageBase64 is required.");
    error.statusCode = 400;
    throw error;
  }

  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(context),
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mahjong_recognition",
          strict: true,
          schema: recognitionSchema(),
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error && payload.error.message ? payload.error.message : "OpenAI vision request failed.");
    error.statusCode = response.status;
    throw error;
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not include structured text output.");
  }

  const parsed = JSON.parse(outputText);
  return {
    ...parsed,
    drawnTile: parsed.drawnTile || null,
    source: "openai-vision",
  };
}

function buildPrompt(context = {}) {
  return [
    "You are recognizing Shanghai Qiao Ma Mahjong tiles from a cropped photo.",
    "Return only the user's own concealed hand, the newly drawn tile if it is visually separated, visible own melds, and known dead tiles if obvious.",
    "Use tile codes: 1m-9m for characters, 1p-9p for dots, 1s-9s for bamboo, E/S/W/N for winds, C/F/B for red/green/white dragons.",
    "In this rule set C/F/B are flowers, so include them only when visibly present and add warnings if they affect confidence.",
    "If the image is blurry, occluded, or not enough tiles are visible, keep confidence low and explain in warnings.",
    `Current app context: ${JSON.stringify(context).slice(0, 1200)}`,
  ].join("\n");
}

function recognitionSchema() {
  const tileOrEmpty = [...TILE_CODES, ""];
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "handTiles",
      "drawnTile",
      "melds",
      "deadTiles",
      "overallConfidence",
      "perTileConfidence",
      "flowerCount",
      "warnings",
      "unrecognizedReason",
    ],
    properties: {
      handTiles: {
        type: "array",
        items: { type: "string", enum: TILE_CODES },
      },
      drawnTile: {
        type: "string",
        enum: tileOrEmpty,
      },
      melds: {
        type: "array",
        items: {
          type: "array",
          items: { type: "string", enum: TILE_CODES },
        },
      },
      deadTiles: {
        type: "array",
        items: { type: "string", enum: TILE_CODES },
      },
      overallConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      perTileConfidence: {
        type: "array",
        items: { type: "number", minimum: 0, maximum: 1 },
      },
      flowerCount: {
        type: "number",
        minimum: 0,
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
      unrecognizedReason: {
        type: "string",
      },
    },
  };
}

function extractOutputText(payload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if ((content.type === "output_text" || content.type === "text") && content.text) {
        return content.text;
      }
    }
  }
  return "";
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 7 * 1024 * 1024) {
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Mahjong vision proxy listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  recognizeMahjong,
  recognitionSchema,
  extractOutputText,
};
