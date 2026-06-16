package com.rork.vitahero.data

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabel
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.math.abs

/**
 * Food recognition using ML Kit Image Labeling, with colour-heuristic fallback.
 * Labels are mapped to common Indian meals for calorie estimates.
 */
object FoodRecognitionService {

    private data class FoodProfile(
        val name: String,
        val baseKcal: Int,
        val keywords: Set<String>,
        val dominantHueRanges: List<FloatRange> = emptyList(),
    )

    private val foodProfiles = listOf(
        FoodProfile("Rice & Dal", 380, setOf("rice", "food", "curry", "stew", "lentil", "dal")),
        FoodProfile("Roti & Sabzi", 320, setOf("bread", "flatbread", "roti", "chapati", "vegetable")),
        FoodProfile("Poha with Peanuts", 290, setOf("cereal", "breakfast", "oatmeal", "porridge")),
        FoodProfile("Idli & Sambar", 250, setOf("dumpling", "steamed", "cake")),
        FoodProfile("Dosa & Chutney", 340, setOf("pancake", "crepe", "dosa")),
        FoodProfile("Paneer Bhurji with Roti", 420, setOf("cheese", "paneer", "cottage cheese")),
        FoodProfile("Chicken Curry & Rice", 450, setOf("chicken", "meat", "poultry")),
        FoodProfile("Khichdi with Curd", 350, setOf("mash", "gruel", "khichdi")),
        FoodProfile("Sprouts Chaat", 180, setOf("salad", "sprout", "legume", "bean")),
        FoodProfile("Fruit Bowl", 150, setOf("fruit", "banana", "apple", "orange", "berry", "mango")),
        FoodProfile("Egg Bhurji & Toast", 300, setOf("egg", "omelette", "toast")),
        FoodProfile("Mixed Vegetable Curry", 200, setOf("vegetable", "broccoli", "carrot", "greens")),
        FoodProfile("Curd Rice", 280, setOf("yogurt", "curd", "dairy")),
        FoodProfile("Paratha & Pickle", 380, setOf("paratha", "pastry", "pie")),
        FoodProfile("Salad", 100, setOf("lettuce", "cucumber", "greens", "herb")),
        FoodProfile("Banana", 105, setOf("banana")),
        FoodProfile("Milk / Doodh", 160, setOf("milk", "beverage", "drink")),
        FoodProfile("Paneer / Cottage Cheese", 265, setOf("paneer", "cheese")),
    )

    private val colourHueProfiles = listOf(
        FoodProfile("Rice & Dal", 380, emptySet(), listOf(FloatRange(25f, 45f), FloatRange(40f, 55f))),
        FoodProfile("Roti & Sabzi", 320, emptySet(), listOf(FloatRange(20f, 40f), FloatRange(80f, 100f))),
        FoodProfile("Poha with Peanuts", 290, emptySet(), listOf(FloatRange(40f, 55f))),
        FoodProfile("Idli & Sambar", 250, emptySet(), listOf(FloatRange(35f, 50f), FloatRange(10f, 20f))),
        FoodProfile("Dosa & Chutney", 340, emptySet(), listOf(FloatRange(25f, 40f), FloatRange(120f, 140f))),
        FoodProfile("Fruit Bowl", 150, emptySet(), listOf(FloatRange(0f, 20f), FloatRange(50f, 70f), FloatRange(160f, 180f))),
        FoodProfile("Salad", 100, emptySet(), listOf(FloatRange(80f, 140f), FloatRange(160f, 180f))),
        FoodProfile("Banana", 105, emptySet(), listOf(FloatRange(40f, 55f))),
    )

    suspend fun analyseBitmap(bitmap: Bitmap): List<DetectedFood> = withContext(Dispatchers.IO) {
        val mlKitResults = runMlKitLabeling(bitmap)
        if (mlKitResults.isNotEmpty()) return@withContext mlKitResults
        analyseByColour(bitmap)
    }

    private suspend fun runMlKitLabeling(bitmap: Bitmap): List<DetectedFood> {
        val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
        val image = InputImage.fromBitmap(bitmap, 0)
        val labels = suspendCancellableCoroutine { cont ->
            labeler.process(image)
                .addOnSuccessListener { cont.resume(it) }
                .addOnFailureListener { cont.resume(emptyList()) }
        }
        return mapLabelsToFoods(labels)
    }

    private fun mapLabelsToFoods(labels: List<ImageLabel>): List<DetectedFood> {
        if (labels.isEmpty()) return emptyList()

        val scored = foodProfiles.mapNotNull { profile ->
            var best = 0f
            for (label in labels) {
                val text = label.text.lowercase()
                if (profile.keywords.any { text.contains(it) }) {
                    best = maxOf(best, label.confidence)
                }
            }
            if (best > 0.35f) profile to best else null
        }.sortedByDescending { it.second }

        return scored.take(4).mapIndexed { index, (profile, confidence) ->
            DetectedFood(
                name = profile.name,
                confidence = confidence.coerceIn(0.4f, 0.95f),
                estimatedKcal = profile.baseKcal + index * 40,
            )
        }
    }

    private fun analyseByColour(bitmap: Bitmap): List<DetectedFood> {
        val sampleSize = 10
        val w = bitmap.width / sampleSize
        val h = bitmap.height / sampleSize
        val scaled = Bitmap.createScaledBitmap(bitmap, w.coerceAtLeast(1), h.coerceAtLeast(1), true)

        val hueBuckets = FloatArray(36)
        var totalSamples = 0

        for (y in 0 until scaled.height) {
            for (x in 0 until scaled.width) {
                val pixel = scaled.getPixel(x, y)
                val r = android.graphics.Color.red(pixel) / 255f
                val g = android.graphics.Color.green(pixel) / 255f
                val b = android.graphics.Color.blue(pixel) / 255f

                val max = maxOf(r, g, b)
                val min = minOf(r, g, b)
                val delta = max - min
                val saturation = if (max > 0) delta / max else 0f

                if (saturation < 0.08f || max < 0.15f) continue

                val hue = when {
                    delta == 0f -> 0f
                    max == r -> 60f * (((g - b) / delta) % 6f)
                    max == g -> 60f * (((b - r) / delta) + 2f)
                    else -> 60f * (((r - g) / delta) + 4f)
                }.let { if (it < 0) it + 360f else it }

                val bucket = (hue / 10f).toInt().coerceIn(0, 35)
                hueBuckets[bucket] += saturation
                totalSamples++
            }
        }
        scaled.recycle()

        if (totalSamples < 5) return emptyList()

        for (i in hueBuckets.indices) { hueBuckets[i] /= totalSamples.toFloat() }

        val dominantHues = hueBuckets
            .mapIndexed { i, v -> i to v }
            .filter { it.second > 0.008f }
            .sortedByDescending { it.second }
            .take(8)
            .map { it.first * 10f }

        val colourProfiles = colourHueProfiles.filter { it.dominantHueRanges.isNotEmpty() }
        val matches = colourProfiles.map { profile ->
            var bestOverlap = 0f
            for (dominantHue in dominantHues) {
                for (range in profile.dominantHueRanges) {
                    val dist = minOf(
                        abs(dominantHue - range.start),
                        abs(dominantHue - range.endInclusive),
                        360f - abs(dominantHue - range.start),
                    )
                    if (dist < 25f) {
                        bestOverlap = maxOf(bestOverlap, 1f - dist / 50f)
                    }
                }
            }
            profile to bestOverlap
        }.filter { it.second > 0.2f }
            .sortedByDescending { it.second }
            .take(4)

        if (matches.isEmpty()) return emptyList()

        return matches.mapIndexed { i, (profile, confidence) ->
            DetectedFood(
                name = profile.name,
                confidence = (confidence * 0.7f + 0.25f).coerceAtMost(0.95f),
                estimatedKcal = profile.baseKcal + i * 60,
            )
        }
    }
}

data class FloatRange(val start: Float, val endInclusive: Float)

data class DetectedFood(
    val name: String,
    val confidence: Float,
    val estimatedKcal: Int = 200,
)
