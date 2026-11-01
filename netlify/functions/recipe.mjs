import { GoogleGenAI } from '@google/genai';

export default async (req) => {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metode tidak diizinkan.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Konfigurasi server belum lengkap (API Key belum diatur).' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      mode = 'cooking',
      ingredients = [],
      staples = [],
      equipment = [],
      desired_dish = '',
      servings = '3-4 orang',
      time_available = '30-60 menit',
      difficulty = 'Menengah',
      budget = 'Minimal / seperlunya',
      allergies = ''
    } = body;

    // Batasi input agar tidak berlebihan
    const safeIngredients = Array.isArray(ingredients) ? ingredients.slice(0, 30) : [];
    const safeStaples = Array.isArray(staples) ? staples.slice(0, 20) : [];
    const safeEquipment = Array.isArray(equipment) ? equipment.slice(0, 20) : [];

    // Inisialisasi Google GenAI SDK
    const ai = new GoogleGenAI({ apiKey });

    // Susun instruksi prompt untuk Gemini
    const prompt = `
Bertindaklah sebagai seorang chef profesional yang ramah dan ahli dalam meracik resep masakan rumahan Indonesia maupun internasional.
Buatlah sebuah resep kuliner dalam Bahasa Indonesia yang realistis, jelas, dan mudah dipraktikkan di rumah berdasarkan data berikut:

- Mode Kegiatan: ${mode === 'baking' ? 'Baking (Kue, roti, camilan)' : 'Cooking (Masakan harian & lauk)'}
- Bahan utama yang tersedia: ${safeIngredients.join(', ') || 'Tidak spesifik'}
- Bumbu / bahan dasar tersedia: ${safeStaples.join(', ') || 'Tidak ada'}
- Peralatan yang tersedia: ${safeEquipment.join(', ') || 'Standar dapur'}
- Keinginan / Nama masakan (opsional): ${desired_dish || 'Bebas sesuai bahan'}
- Porsi: ${servings}
- Waktu tersedia: ${time_available}
- Tingkat Kesulitan: ${difficulty}
- Anggaran Belanja: ${budget}
- Pantangan / Alergi (SANGAT PENTING - JANGAN GUNAKAN BAHAN INI): ${allergies || 'Tidak ada'}

ATURAN UTAMA:
1. Perhatikan ketat bagian pantangan/alergi! Jangan pernah merekomendasikan bahan yang mengandung atau memicu alergi tersebut.
2. Utamakan penggunaan bahan dan peralatan yang sudah tersedia.
3. Berikan output HANYA dalam format JSON valid tanpa teks pembuka atau penutup markdown tambahan (tanpa blok \`\`\`json ... \`\`\`), dengan struktur persis seperti berikut:
{
  "recipe": {
    "title": "Nama Resep",
    "intro": "Deskripsi singkat mengenai hidangan ini",
    "servings": "${servings}",
    "prep_time": "Perkiraan waktu persiapan",
    "cook_time": "Perkiraan waktu memasak",
    "ingredients": ["Daftar bahan lengkap beserta takarannya"],
    "missing_ingredients": ["Bahan tambahan yang mungkin perlu disiapkan jika ada"],
    "steps": ["Langkah-langkah pembuatan secara berurutan"],
    "tips": ["Tips tambahan agar masakan lebih lezat"],
    "note": "Catatan keamanan pangan atau variasi"
  }
}
`;

    // Gunakan model Gemini yang sesuai untuk teks
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
  thinkingConfig: {
    thinkingLevel: "low"
  },
  responseMimeType: "application/json",
  maxOutputTokens: 2500
      }
    });

    let rawText = response.text ? response.text.trim() : '';
    
    // Bersihkan jika ada pembungkus markdown block code dari AI
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let recipeJson;
    try {
      recipeJson = JSON.parse(rawText);
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Gagal memproses hasil respons AI menjadi JSON.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(recipeJson), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan pada server: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
