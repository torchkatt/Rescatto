import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function checkApi() {
    console.log("Listing models with key:", API_KEY?.substring(0, 10) + "...");
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            const generateModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            console.log("✅ Models supporting generateContent:");
            generateModels.forEach(m => console.log(`- ${m.name} (${m.displayName})`));

            // Try the first one
            if (generateModels.length > 0) {
                // Prefer gemini-2.0-flash if available, otherwise pick first
                const targetModel = generateModels.find(m => m.name.includes('gemini-2.0-flash')) || generateModels[0];
                const firstModel = targetModel.name.replace('models/', '');
                console.log(`\nTesting first model: ${firstModel}`);
                const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${firstModel}:generateContent?key=${API_KEY}`;
                const genResp = await fetch(genUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: "Hola" }] }] })
                });
                const genData = await genResp.json();
                console.log("Result:", JSON.stringify(genData).substring(0, 100));
            }
        } else {
            console.log("❌ FAILED:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

checkApi();
