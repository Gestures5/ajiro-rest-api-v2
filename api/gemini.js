const axios = require("axios");

exports.config = {
  name: "geminivision",
  version: "1.0.0",
  author: "Ry",
  description: "Google Gemini Vision AI with prompt + image recognition",
  method: "get",
  link: [`/geminivision?prompt=describe this&imgUrl=https://example.com/image.jpg`],
  guide: "geminivision?prompt=What is shown in this image?&img=https://i.imgur.com/Kq1y7My.jpeg",
  category: "ai"
};

exports.initialize = async ({ req, res, font }) => {
  const prompt = req.query.prompt;
  const senderID = req.query.uid || 'default';
  const imgBase64 = req.query.img;
  const imgUrl = req.query.imgUrl;
  const model = "gemini-2.5-pro";
  const apiKey = "AIzaSyD-msS_FTZLH1yGO-iOzzzgQmg2fZS25hU";

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt. Use ?prompt=your question" });
  }

  let imageData = null;

  try {
    if (imgBase64) {
      imageData = imgBase64;
    } else if (imgUrl) {
      const imageResp = await axios.get(imgUrl, { responseType: "arraybuffer" });
      imageData = Buffer.from(imageResp.data, "binary").toString("base64");
    }

    const parts = [{ text: prompt }];

    if (imageData) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: imageData,
        }
      });
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts,
        }
      ]
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    // Extract image links if any (for consistency with gpt4o1 structure)
    const imageUrls = [...reply.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)]
      .map(([, url]) => url);

    const validImageUrls = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          const head = await axios.head(url);
          return head.headers["content-type"]?.startsWith("image") ? url : null;
        } catch {
          return null;
        }
      })
    ).then(results => results.filter(Boolean));

    res.json({
      message: font?.bold ? reply.replace(/\*\*(.*?)\*\*/g, (_, text) => font.bold(text)) : reply,
      img_urls: validImageUrls,
      model,
      prompt,
      author: exports.config.author
    });
  } catch (error) {
    console.error("Gemini Vision API Error:", error.message);
    res.status(500).json({ error: "Gemini Vision request failed" });
  }
};