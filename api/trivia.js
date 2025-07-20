const axios = require('axios');

exports.config = {
  name: 'trivia',
  author: 'AceGerome',
  description: 'Fetches random trivia questions',
  method: 'get',
  category: 'others',
  link: ['/trivia?limit=1']
};

exports.initialize = async function ({ req, res }) {
  try {
    const limit = parseInt(req.query.limit) || 1;

    const response = await axios.get(`https://opentdb.com/api.php?amount=${limit}`);
    const results = response.data.results;

    const trivia = results.map((item) => {
      const options = [...item.incorrect_answers, item.correct_answer];

      // Shuffle options
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      return {
        category: item.category,
        difficulty: item.difficulty,
        question: item.question,
        options,
        answer: item.correct_answer
      };
    });

    res.json({
      count: trivia.length,
      trivia
    });
  } catch (error) {
    console.error("Error fetching trivia:", error);
    res.status(500).json({ error: "Failed to fetch trivia data from external API." });
  }
};