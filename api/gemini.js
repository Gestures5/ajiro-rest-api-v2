const axios = require("axios");

exports.config = {
  name: "Gemini vision",
  author: "Ry",
  description: "Gemini vision AI image + prompt processing",
  method: "get",
  category: "ai",
  link: ["/gemini-vision"]
};

exports.initialize = async function ({ req, res }) {
  try {
    const prompt = req.query.prompt;
    const imgBase64 = req.query.img;
    const imgUrl = req.query.imgUrl;
    const apiKey = "AIzaSyD-msS_FTZLH1yGO-iOzzzgQmg2fZS25hU";
    const model = "gemini-2.5-pro";

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt. Use ?prompt=&imgUrl=" });
    }

    let imageData = null;

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
          mime_type: "image/jpeg", // or "image/png"
          data: imageData,
        },
      });
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    res.json({ response: text });
  } catch (err) {
    console.error("Gemini Vision API Error:", err.message || err);
    res.status(500).json({ error: "Gemini Vision request failed" });
  }
};