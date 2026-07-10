package com.rork.vitahero.data

import android.graphics.Bitmap
import android.util.Base64
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabel
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.Locale
import kotlin.coroutines.resume

/**
 * Food recognition using ML Kit on-device Image Labeling.
 *
 * Primary path: an AI vision model via the backend worker (accurate, specific dish
 * names + calorie estimates). Falls back to on-device ML Kit labeling when the backend
 * is unconfigured, the user is signed out, or the vision call fails/returns nothing.
 *
 * The ML Kit default model returns broad labels (e.g. "Fruit", "Food", "Dessert"),
 * not exact dish names. We map specific labels to a calorie dictionary and otherwise
 * surface the actual detected label. Previously every photo was force-matched into a
 * fixed Indian-meal list via the generic "food" keyword, so unrelated items (e.g. a
 * cup of dates) were reported as "Rice & Dal". This keeps results relevant instead.
 */
object FoodRecognitionService {

    private data class FoodEntry(
        val name: String,
        val kcal: Int,
        val keywords: List<String>,
    )

    /** Ordered specific → general; the first entry that matches a label wins. */
    private val dictionary = listOf(
        FoodEntry("Dates", 280, listOf("date", "dates", "dried fruit", "dry fruit")),
        FoodEntry("Banana", 105, listOf("banana")),
        FoodEntry("Apple", 95, listOf("apple")),
        FoodEntry("Orange", 62, listOf("orange", "tangerine", "citrus", "clementine")),
        FoodEntry("Mango", 99, listOf("mango")),
        FoodEntry("Grapes", 104, listOf("grape")),
        FoodEntry("Berries", 85, listOf("berry", "strawberry", "blueberry", "raspberry")),
        FoodEntry("Watermelon", 86, listOf("watermelon", "melon")),
        FoodEntry("Nuts & Almonds", 200, listOf("almond", "cashew", "peanut", "walnut", "nut")),
        FoodEntry("Fruit Bowl", 130, listOf("fruit", "produce")),
        FoodEntry("Rice & Dal", 380, listOf("rice", "lentil", "dal", "biryani", "pilaf")),
        FoodEntry("Roti / Bread", 260, listOf("roti", "chapati", "naan", "flatbread", "bread", "baked goods", "bun", "loaf", "toast")),
        FoodEntry("Dosa / Pancake", 340, listOf("dosa", "pancake", "crepe", "waffle")),
        FoodEntry("Idli / Steamed", 250, listOf("idli", "dumpling", "steamed")),
        FoodEntry("Egg", 78, listOf("egg", "omelette")),
        FoodEntry("Chicken / Meat", 320, listOf("chicken", "poultry", "steak", "mutton", "meat")),
        FoodEntry("Fish", 240, listOf("fish", "seafood", "prawn", "shrimp")),
        FoodEntry("Paneer / Cheese", 265, listOf("paneer", "cottage cheese", "cheese")),
        FoodEntry("Curd / Yogurt", 100, listOf("yogurt", "yoghurt", "curd", "dairy")),
        FoodEntry("Milk", 150, listOf("milk")),
        FoodEntry("Salad / Veggies", 110, listOf("salad", "lettuce", "cucumber", "broccoli", "carrot", "tomato", "greens", "vegetable")),
        FoodEntry("Soup / Curry", 200, listOf("soup", "curry", "stew", "gravy")),
        FoodEntry("Noodles / Pasta", 350, listOf("noodle", "pasta", "spaghetti")),
        FoodEntry("Pizza", 285, listOf("pizza")),
        FoodEntry("Burger / Sandwich", 350, listOf("burger", "hamburger", "sandwich")),
        FoodEntry("Sweet / Dessert", 250, listOf("dessert", "cake", "ice cream", "chocolate", "candy", "pastry", "pie", "cookie", "sweet")),
        FoodEntry("Snack", 200, listOf("junk food", "chips", "fries", "popcorn", "snack")),
        FoodEntry("Beverage", 90, listOf("juice", "smoothie", "tea", "coffee", "drink", "beverage")),
    )

    /** Generic labels that carry no nutrition meaning on their own. */
    private val ignored = setOf(
        "plant", "tree", "table", "tableware", "plate", "bowl", "cup", "mug", "glass",
        "jar", "container", "kitchen", "person", "hand", "finger", "wood", "metal",
        "textile", "pattern", "art", "still life", "circle", "close-up", "macro photography",
    )

    /** Broad "this is food" labels we keep only as a last-resort fallback. */
    private val genericFood = setOf("food", "dish", "meal", "cuisine", "cooking", "recipe", "ingredient")

    private const val MIN_CONFIDENCE = 0.30f
    private const val MAX_UPLOAD_DIM = 1024
    private const val JPEG_QUALITY = 80

    suspend fun analyseBitmap(bitmap: Bitmap): List<DetectedFood> = withContext(Dispatchers.IO) {
        val remote = runCatching { analyseRemote(bitmap) }.getOrNull()
        if (!remote.isNullOrEmpty()) return@withContext remote
        mapLabelsToFoods(runMlKitLabeling(bitmap))
    }

    /** AI vision via the backend worker. Returns null when unavailable so we fall back. */
    private suspend fun analyseRemote(bitmap: Bitmap): List<DetectedFood>? {
        if (!ApiService.isConfigured || ApiService.sessionToken.isNullOrBlank()) return null
        val response = ApiRepositoryProvider.repository.recognizeFood(encodeJpeg(bitmap)) ?: return null
        return response.items
            .filter { it.name.isNotBlank() }
            .map {
                DetectedFood(
                    name = it.name,
                    confidence = it.confidence.coerceIn(0.4f, 0.99f),
                    estimatedKcal = if (it.kcal > 0) it.kcal else 200,
                )
            }
            .take(5)
    }

    private fun encodeJpeg(bitmap: Bitmap): String {
        val largest = maxOf(bitmap.width, bitmap.height)
        val scale = if (largest > MAX_UPLOAD_DIM) MAX_UPLOAD_DIM.toFloat() / largest else 1f
        val scaled = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).toInt().coerceAtLeast(1),
                (bitmap.height * scale).toInt().coerceAtLeast(1),
                true,
            )
        } else {
            bitmap
        }
        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, stream)
        if (scaled !== bitmap) scaled.recycle()
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }

    private suspend fun runMlKitLabeling(bitmap: Bitmap): List<ImageLabel> {
        val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
        val image = InputImage.fromBitmap(bitmap, 0)
        return suspendCancellableCoroutine { cont ->
            labeler.process(image)
                .addOnSuccessListener { cont.resume(it) }
                .addOnFailureListener { cont.resume(emptyList()) }
        }
    }

    private fun mapLabelsToFoods(labels: List<ImageLabel>): List<DetectedFood> {
        val relevant = labels
            .filter { it.confidence >= MIN_CONFIDENCE }
            .sortedByDescending { it.confidence }

        val results = LinkedHashMap<String, DetectedFood>()
        var sawGenericFood = false

        for (label in relevant) {
            if (results.size >= 4) break
            val text = label.text.lowercase(Locale.ROOT)
            if (text in ignored) continue
            if (text in genericFood) {
                sawGenericFood = true
                continue
            }
            val entry = dictionary.firstOrNull { e -> e.keywords.any { text.contains(it) } }
            val food = if (entry != null) {
                DetectedFood(entry.name, label.confidence.coerceIn(0.4f, 0.97f), entry.kcal)
            } else {
                // Identifiable but undictionaried label — show it as-is so the result stays relevant.
                DetectedFood(
                    label.text.replaceFirstChar { it.titlecase(Locale.ROOT) },
                    label.confidence.coerceIn(0.4f, 0.95f),
                    180,
                )
            }
            results.putIfAbsent(food.name, food)
        }

        // Nothing specific matched but the model is confident it's food — avoid a wrong dish guess.
        if (results.isEmpty() && (sawGenericFood || relevant.isNotEmpty())) {
            results["Mixed Meal"] = DetectedFood("Mixed Meal", 0.5f, 300)
        }
        return results.values.toList()
    }
}

data class DetectedFood(
    val name: String,
    val confidence: Float,
    val estimatedKcal: Int = 200,
)
