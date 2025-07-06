const axios = require("axios");

exports.config = {
  name: 'gemin',
  author: 'Developer',
  description: 'Interact with Gemini 2.5 Flash Lite using text and optional image (base64 or URL)',
  category: 'ai',
  link: ['/gemini-vision?prompt=Describe this&imgUrl=https://example.com/image.jpg']
};

exports.initialize = async function ({ req, res }) {
  try {
    const prompt = req.query.prompt;
    const imgBase64 = req.query.img;
    const imgUrl = req.query.imgUrl;
    const apiKey = "AIzaSyD-msS_FTZLH1yGO-iOzzzgQmg2fZS25hU";
    const model = "gemini-2.5-flash-lite-preview-06-17";

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt. Use ?prompt=your question" });
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
          mime_type: "image/jpeg", // You may adjust this if needed
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