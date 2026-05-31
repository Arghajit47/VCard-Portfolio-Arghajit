const axios = require('axios');
const fs = require('fs');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'YOUR_RAPIDAPI_KEY_HERE';
const USERNAME = 'arghajitsingha47'; // Without the '@' for this specific API

/**
 * Formats an ISO / datetime string into the DD-MM-YYYY format expected by the frontend.
 * E.g., "2024-10-13 14:02:00" -> "13-10-2024"
 */
function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    } catch (e) {
        return dateStr;
    }
}

async function fetchAllMediumPosts() {
    try {
        if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
            console.warn("⚠️ Warning: RAPIDAPI_KEY is not set. The API request might fail unless a valid key is provided.");
        }

        // Step 1: Get the User ID from the username
        console.log(`🔍 Fetching User ID for @${USERNAME}...`);
        const userResponse = await axios.get(`https://medium2.p.rapidapi.com/user/id_for/${USERNAME}`, {
            headers: {
                'x-rapidapi-host': 'medium2.p.rapidapi.com',
                'x-rapidapi-key': RAPIDAPI_KEY
            }
        });

        const userId = userResponse.data.id;
        console.log(`🆔 Found User ID: ${userId}`);

        // Step 2: Get all article IDs published by this user
        console.log(`📚 Fetching article list...`);
        const articlesResponse = await axios.get(`https://medium2.p.rapidapi.com/user/${userId}/articles`, {
            headers: {
                'x-rapidapi-host': 'medium2.p.rapidapi.com',
                'x-rapidapi-key': RAPIDAPI_KEY
            }
        });

        const articleIds = articlesResponse.data.associated_articles;
        console.log(`📋 Found ${articleIds.length} total articles. Fetching full content for each...`);

        // Step 3: Loop through and fetch details for each individual article
        const fullArticles = [];
        for (const id of articleIds) {
            const articleDetails = await axios.get(`https://medium2.p.rapidapi.com/article/${id}`, {
                headers: {
                    'x-rapidapi-host': 'medium2.p.rapidapi.com',
                    'x-rapidapi-key': RAPIDAPI_KEY
                }
            });
            
            const data = articleDetails.data;
            fullArticles.push({
                title: data.title,
                url: data.url,
                image: data.image_url || 'No Image',
                date: formatDate(data.published_at)
            });
            console.log(`✅ Fetched: "${data.title}"`);
        }

        console.log(`🎉 Successfully fetched ${fullArticles.length} posts!`);

        // Save data to blog_data.js in the format expected by the frontend (mediumStoriesData)
        const jsContent = `const mediumStoriesData = ${JSON.stringify(fullArticles, null, 2)};`;
        fs.writeFileSync("blog_data.js", jsContent);

        console.log(`📂 Saved to blog_data.js (Ready for direct HTML import)`);

    } catch (error) {
        console.error("❌ Error scraping Medium via API:", error.response ? error.response.data : error.message);
    }
}

fetchAllMediumPosts();
